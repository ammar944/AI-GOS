#!/usr/bin/env tsx
/**
 * zz-record-corpus.ts — generate + capture a deepResearchProgram corpus for ONE
 * subject and assemble its ResearchInput JSON, with Perplexity cost metering.
 *
 * This is the "$ leg" the offline section harness consumes: it fires ONE bounded
 * deepResearchProgram dispatch at the Railway worker, polls Supabase until the
 * corpus is terminal (hard deadline, no retry loop), dumps the corpus + manifest,
 * assembles a validated ResearchInput fixture, and writes a usage.json with the
 * captured Perplexity token + search usage and an estimated $ (using the rate
 * matrix below). After this runs once (~$0.16-0.30 sonar-pro), the section
 * harness re-points at the frozen corpus at $0.
 *
 * Usage:
 *   npx tsx scripts/zz-record-corpus.ts --name Fathom --url https://fathom.video
 *   npx tsx scripts/zz-record-corpus.ts --name Fathom --url https://fathom.video --dry
 *
 *   --dry validates ALL wiring (env presence by NAME only, worker /health,
 *   envelope assembly, Supabase client construct, corpusToResearchInput import)
 *   and EXITs 0 BEFORE any paid dispatch. $0 spend.
 *
 * SAFETY: a single bounded dispatch + a poll-with-deadline (no retry loop). The
 * worker run itself is fire-and-forget (worker-side AbortController + its own
 * 900s watchdog). This script never reads or prints secrets — it only checks env
 * presence by name. Keys come from .env.local via @next/env loadEnvConfig.
 *
 * VIABILITY: clean. The dispatch path is the worker POST /run endpoint
 * (Bearer RAILWAY_API_KEY), NOT the Clerk-gated app route — so this script can
 * dispatch without a browser session. It creates its own isolated
 * journey_sessions row (synthetic user_id per run, so it never clobbers a real
 * user's single-session row) with metadata.activeJourneyRunId set, which the
 * worker's isActiveJourneyRun() gate requires before it will persist the result.
 *
 * NOTE on journey_sessions columns: the CONTEXT recipe says `status: 'active'`,
 * but journey_sessions has NO `status` column (verified against migrations — it
 * has `phase`, not `status`). We set `phase: 'research'` and omit `status`.
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";

import { researchInputSchema } from "../src/lib/lab-engine/artifacts/artifact-envelope";
import { corpusToResearchInput } from "../src/lib/research-v2/corpus-to-research-input";

// ---------------------------------------------------------------------------
// Pricing matrix (per CONTEXT) — $ per 1k tokens. sonar-pro is the
// deepResearchProgram default; opt-in to sonar-deep-research via
// RESEARCH_DEEP_PROGRAM_MAIN_MODEL.
// ---------------------------------------------------------------------------
interface ModelRate {
  inputPer1k: number;
  outputPer1k: number;
}
const PRICING: Record<string, ModelRate> = {
  sonar: { inputPer1k: 0.003, outputPer1k: 0.01 },
  "sonar-pro": { inputPer1k: 0.006, outputPer1k: 0.02 },
  "sonar-deep-research": { inputPer1k: 0.008, outputPer1k: 0.03 },
};
const DEFAULT_MODEL = "sonar-pro";
const CACHE_WRITE_MULTIPLIER = 0.5; // applied to input rate
const CACHE_READ_MULTIPLIER = 0.1; // applied to input rate

const POLL_INTERVAL_MS = 25_000;
const DEFAULT_DEADLINE_MS = 900_000; // 15 min
const HEALTH_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// CLI parsing.
// ---------------------------------------------------------------------------
function readFlag(args: string[], name: string): string | null {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 48) || "subject"
  );
}

// ---------------------------------------------------------------------------
// Usage extraction + cost formula (per CONTEXT).
// ---------------------------------------------------------------------------
interface CapturedUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
  serverToolUseCount: number | null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readUsage(usageRaw: unknown): CapturedUsage {
  const u = (usageRaw ?? {}) as Record<string, unknown>;
  const inputTokens = num(u.inputTokens) ?? 0;
  const outputTokens = num(u.outputTokens) ?? 0;
  const totalTokens = num(u.totalTokens) ?? inputTokens + outputTokens;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cacheCreationInputTokens: num(u.cacheCreationInputTokens),
    cacheReadInputTokens: num(u.cacheReadInputTokens),
    serverToolUseCount: num(u.serverToolUseCount),
  };
}

function estimateCostUsd(model: string, usage: CapturedUsage): number {
  const rate = PRICING[model] ?? PRICING[DEFAULT_MODEL];
  const base =
    (usage.inputTokens / 1000) * rate.inputPer1k +
    (usage.outputTokens / 1000) * rate.outputPer1k;
  const cacheWrite =
    ((usage.cacheCreationInputTokens ?? 0) / 1000) *
    rate.inputPer1k *
    CACHE_WRITE_MULTIPLIER;
  const cacheRead =
    ((usage.cacheReadInputTokens ?? 0) / 1000) *
    rate.inputPer1k *
    CACHE_READ_MULTIPLIER;
  return base + cacheWrite + cacheRead;
}

// ---------------------------------------------------------------------------
// Worker context block. deepResearchProgram needs the subject URL + name in the
// context string; the worker prepends date/baseline/provenance instructions.
// ---------------------------------------------------------------------------
function buildCorpusContext(name: string, url: string): string {
  return [
    `Company: ${name}`,
    `Company website: ${url}`,
    ``,
    `Generate a comprehensive research corpus for ${name} (${url}). Extract and`,
    `cite: market category & TAM, ICP / buyer personas (titles, pains, jobs-to-be-done),`,
    `competitor landscape (named alternatives + pricing/feature comparison), voice of`,
    `customer (real review quotes with source URLs), demand & intent signals, and offer`,
    `/ pricing diagnostics. Prioritise the most recent, primary-source data with URLs.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Env contract. Names ONLY — values are never read into log output.
// ---------------------------------------------------------------------------
const REQUIRED_ENV = [
  "RAILWAY_WORKER_URL",
  "RAILWAY_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function missingEnv(): string[] {
  return REQUIRED_ENV.filter((k) => {
    const v = process.env[k];
    return !(typeof v === "string" && v.trim().length > 0);
  });
}

// ---------------------------------------------------------------------------
// Supabase admin client (service role).
// ---------------------------------------------------------------------------
function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

interface DeepResearchEnvelope {
  status?: string;
  error?: string;
  data?: { corpus?: unknown; onboardingFields?: unknown } & Record<string, unknown>;
  telemetry?: {
    model?: string;
    usage?: unknown;
    estimatedCostUsd?: number;
  } & Record<string, unknown>;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const name = readFlag(args, "name");
  const url = readFlag(args, "url");
  const dry = hasFlag(args, "dry");
  const deadlineMs = Number(readFlag(args, "deadline-ms") ?? DEFAULT_DEADLINE_MS);

  if (!name || !url) {
    console.error(
      "usage: npx tsx scripts/zz-record-corpus.ts --name <Fathom> --url <https://fathom.video> [--dry]",
    );
    process.exit(2);
  }

  const slug = slugify(name);
  const runId = randomUUID();
  const jobId = randomUUID();
  // Synthetic, isolated user_id per run — never clobbers a real user's session
  // row (journey_sessions is UNIQUE(user_id, run_id); user_id has no auth FK).
  const userId = `corpus-rec-${createHash("sha1").update(runId).digest("hex").slice(0, 16)}`;

  const grillDir = join("tmp", "grill", slug);
  const fixtureDir = join("tmp", "zz-section-out");
  const corpusContext = buildCorpusContext(name, url);
  const workerUrl = (process.env.RAILWAY_WORKER_URL ?? "").trim().replace(/\/+$/u, "");

  const missing = missingEnv();

  // -------------------------------------------------------------------------
  // --dry: validate ALL wiring at $0 and EXIT before any paid dispatch.
  // -------------------------------------------------------------------------
  if (dry) {
    console.log("=== zz-record-corpus --dry (NO paid dispatch, $0) ===");
    console.log(`subject:        ${name}  ${url}`);
    console.log(`slug:           ${slug}`);
    console.log(`runId:          ${runId}`);
    console.log(`jobId:          ${jobId}`);
    console.log(`userId:         ${userId} (synthetic, isolated)`);
    console.log("");

    console.log("env vars required (presence by name only):");
    for (const k of REQUIRED_ENV) {
      console.log(`  ${missing.includes(k) ? "MISSING" : "present"}  ${k}`);
    }
    console.log("  optional: RESEARCH_DEEP_PROGRAM_MAIN_MODEL (opt-in sonar-deep-research)");
    console.log("");

    // Validate corpusToResearchInput import + envelope assembly against a tiny
    // synthetic corpus so the schema wiring is exercised at $0.
    let assemblyOk = false;
    let assemblyDetail = "";
    try {
      const built = corpusToResearchInput({
        runId,
        deepResearchProgramData: {
          corpus: {
            company: { name, website: url },
            sources: [{ url, title: name }],
            // One evidence record so the schema's excerpts>=1 floor is exercised
            // end-to-end (the live corpus carries dozens). Synthetic, $0.
            evidence: [
              {
                url,
                source: name,
                claim: `${name} wiring probe`,
                quote: `${name} dry-run excerpt for schema validation.`,
              },
            ],
          },
          onboardingFields: { companyName: name, websiteUrl: url },
        },
        // Mirror the LIVE path exactly: onboardingData = manifest.briefInput.
        onboardingData: { companyName: name, websiteUrl: url },
      });
      const parsed = researchInputSchema.safeParse(built);
      assemblyOk = parsed.success;
      assemblyDetail = parsed.success
        ? `company=${parsed.data.company.name} sources=${parsed.data.sources.length} excerpts=${parsed.data.corpus.excerpts.length}`
        : JSON.stringify(parsed.error.flatten().fieldErrors).slice(0, 200);
    } catch (e) {
      assemblyDetail = e instanceof Error ? e.message : String(e);
    }
    console.log(`corpusToResearchInput import + assembly: ${assemblyOk ? "OK" : "FAIL"} (${assemblyDetail})`);

    // Construct the Supabase client (no network) to prove credentials parse.
    let supabaseCtor = false;
    try {
      if (!missing.includes("NEXT_PUBLIC_SUPABASE_URL") && !missing.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        makeSupabase();
        supabaseCtor = true;
      }
    } catch {
      supabaseCtor = false;
    }
    console.log(`supabase client construct: ${supabaseCtor ? "OK" : "SKIPPED (env missing)"}`);

    // Worker reachability via GET /health (bounded; never throws the script).
    let workerHealth = "unknown";
    if (workerUrl) {
      try {
        const res = await fetch(`${workerUrl}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        });
        workerHealth = res.ok ? `OK (${res.status})` : `unreachable (${res.status})`;
      } catch (e) {
        workerHealth = `unreachable (${e instanceof Error ? e.name : "error"})`;
      }
    } else {
      workerHealth = "SKIPPED (RAILWAY_WORKER_URL missing)";
    }
    console.log(`worker GET /health: ${workerHealth}`);
    console.log("");

    console.log("a LIVE run WOULD:");
    console.log(`  1. upsert journey_sessions row (user_id=${userId}, run_id=${runId},`);
    console.log(`       metadata.activeJourneyRunId=${runId}, onboarding_data.company_name=${name})`);
    console.log(`  2. POST ${workerUrl || "<RAILWAY_WORKER_URL>"}/run  Bearer <RAILWAY_API_KEY>`);
    console.log(`       body: { tool: 'runDeepResearchProgram', context, userId, jobId, runId }`);
    console.log(`  3. poll journey_sessions.research_results.deepResearchProgram.status`);
    console.log(`       every ${POLL_INTERVAL_MS / 1000}s, hard deadline ${deadlineMs / 1000}s (no retry loop)`);
    console.log(`  4. dump ${join(grillDir, "deepResearchProgram.json")} + ${join(grillDir, "_manifest.json")}`);
    console.log(`  5. assemble + validate ${join(fixtureDir, `${slug}-research-input.json`)}`);
    console.log(`  6. write ${join(grillDir, "usage.json")} (model + tokens + est $ via sonar-pro rates)`);
    console.log("");
    console.log("--dry complete: wiring validated, $0 spent.");
    process.exit(0);
  }

  // -------------------------------------------------------------------------
  // LIVE path. Fail BEFORE spending if any env is missing.
  // -------------------------------------------------------------------------
  if (missing.length > 0) {
    console.error(`[record-corpus] missing env: ${missing.join(", ")}`);
    console.error("Load .env.local (run via tsx after `loadEnvConfig`) and ensure the worker URL/key are set.");
    process.exit(1);
  }

  const supabase = makeSupabase();

  console.log(`[record-corpus] subject=${name} url=${url} runId=${runId} slug=${slug}`);

  // 1) Create the isolated journey_sessions run row. The worker's
  //    isActiveJourneyRun() gate requires metadata.activeJourneyRunId === runId
  //    before it will persist the result.
  const { error: insertErr } = await supabase.from("journey_sessions").insert({
    user_id: userId,
    run_id: runId,
    phase: "research",
    metadata: { websiteUrl: url, activeJourneyRunId: runId },
    onboarding_data: { company_name: name, companyName: name, websiteUrl: url },
    research_results: {},
  });
  if (insertErr) {
    console.error(`[record-corpus] journey_sessions insert failed: ${insertErr.message}`);
    process.exit(1);
  }
  console.log(`[record-corpus] journey_sessions row created (user_id=${userId})`);

  // 2) Fire the SINGLE bounded dispatch to the worker /run endpoint.
  let dispatchStatus = 0;
  try {
    const res = await fetch(`${workerUrl}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RAILWAY_API_KEY}`,
      },
      body: JSON.stringify({
        tool: "runDeepResearchProgram",
        context: corpusContext,
        userId,
        jobId,
        runId,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    dispatchStatus = res.status;
    if (res.status !== 202) {
      const body = await res.text();
      console.error(`[record-corpus] worker rejected dispatch: ${res.status} ${body.slice(0, 300)}`);
      process.exit(1);
    }
  } catch (e) {
    console.error(`[record-corpus] dispatch failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
  console.log(`[record-corpus] dispatched (HTTP ${dispatchStatus}). polling...`);

  // 3) Poll journey_sessions.research_results.deepResearchProgram until terminal
  //    or deadline. NO retry loop — a single bounded wait.
  const startedAt = Date.now();
  let envelope: DeepResearchEnvelope | null = null;
  while (Date.now() - startedAt < deadlineMs) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const { data, error } = await supabase
      .from("journey_sessions")
      .select("research_results")
      .eq("user_id", userId)
      .eq("run_id", runId)
      .maybeSingle();
    if (error) {
      console.warn(`[record-corpus] poll read error (continuing): ${error.message}`);
      continue;
    }
    const rr = (data?.research_results ?? {}) as Record<string, unknown>;
    const drp = rr.deepResearchProgram as DeepResearchEnvelope | undefined;
    const status = drp?.status ?? "pending";
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    console.log(`[record-corpus] [${elapsed}s] deepResearchProgram.status=${status}`);
    if (status === "complete" || status === "error") {
      envelope = drp ?? null;
      break;
    }
  }

  if (!envelope) {
    console.error(`[record-corpus] DEADLINE: corpus did not reach terminal status in ${deadlineMs / 1000}s.`);
    process.exit(1);
  }
  if (envelope.status === "error") {
    console.error(`[record-corpus] corpus FAILED: ${envelope.error ?? "unknown error"}`);
    process.exit(1);
  }

  // 4) Dump corpus + manifest to tmp/grill/<slug>/.
  await mkdir(grillDir, { recursive: true });
  const programData = envelope.data ?? {};
  await writeFile(
    join(grillDir, "deepResearchProgram.json"),
    JSON.stringify(programData, null, 2),
    "utf8",
  );
  const manifest = {
    run_id: runId,
    status: envelope.status ?? "complete",
    subjectUrl: url,
    completedAt: new Date().toISOString(),
    briefInput: { companyName: name, websiteUrl: url },
    corpusKeys:
      programData && typeof programData === "object"
        ? Object.keys(programData as Record<string, unknown>)
        : [],
  };
  await writeFile(join(grillDir, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(`[record-corpus] dumped corpus + manifest -> ${grillDir}`);

  // 5) Assemble ResearchInput + validate against the schema.
  const built = corpusToResearchInput({
    runId,
    deepResearchProgramData: programData,
    onboardingData: manifest.briefInput,
  });
  const parsed = researchInputSchema.safeParse(built);
  if (!parsed.success) {
    console.error("[record-corpus] ResearchInput failed schema validation:");
    console.error(JSON.stringify(parsed.error.flatten(), null, 2).slice(0, 4000));
    process.exit(1);
  }
  await mkdir(fixtureDir, { recursive: true });
  const fixturePath = join(fixtureDir, `${slug}-research-input.json`);
  await writeFile(fixturePath, JSON.stringify(parsed.data, null, 2), "utf8");
  const ri = parsed.data;
  console.log(
    `[record-corpus] wrote ${fixturePath} (company=${ri.company.name} sources=${ri.sources.length} excerpts=${ri.corpus.excerpts.length} competitorSeeds=${ri.competitorSeeds?.length ?? 0})`,
  );

  // 6) Capture Perplexity usage + estimate cost.
  const model = envelope.telemetry?.model ?? DEFAULT_MODEL;
  const usage = readUsage(envelope.telemetry?.usage);
  const estimatedCostUsd = estimateCostUsd(model, usage);
  const usageOut = {
    model,
    usage: {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      cacheCreationInputTokens: usage.cacheCreationInputTokens,
      cacheReadInputTokens: usage.cacheReadInputTokens,
      serverToolUseCount: usage.serverToolUseCount,
    },
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
    runId,
    completedAt: manifest.completedAt,
  };
  await writeFile(join(grillDir, "usage.json"), JSON.stringify(usageOut, null, 2), "utf8");

  // Per-run cost line.
  console.log("\n=== CORPUS COST ===");
  console.log(`  model:              ${model}`);
  console.log(`  input tokens:       ${usage.inputTokens}`);
  console.log(`  output tokens:      ${usage.outputTokens}`);
  console.log(
    `  cache write/read:   ${usage.cacheCreationInputTokens ?? 0} / ${usage.cacheReadInputTokens ?? 0}`,
  );
  console.log(`  perplexity searches:${usage.serverToolUseCount ?? "n/a"}`);
  console.log(`  ----`);
  console.log(`  estimated TOTAL:    $${estimatedCostUsd.toFixed(4)}`);
  console.log(`\n  fixture: ${fixturePath}`);
  console.log(`  usage:   ${join(grillDir, "usage.json")}\n`);
}

main().catch((err) => {
  console.error("[record-corpus] FATAL", err);
  process.exit(1);
});
