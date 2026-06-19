#!/usr/bin/env tsx
/**
 * zz-record-live-section.ts — run ONE positioning section LIVE (real model +
 * real research tools) against a frozen corpus, with the durable Evidence
 * Ledger (research_facts) wired in, then test the P0 spine on that FRESH output:
 *
 *   Pillar 1 (durable ledger): an in-memory factStore is injected, so the
 *     section's real persona/VoC/corpus miners write ResearchFacts AS THEY ARE
 *     FOUND. After the run we assert facts were captured and every one carries a
 *     non-empty http(s) source_url + source_quote — even if the section later
 *     fails the evidence gate (facts found before the failure stay durable).
 *
 *   Pillar 5 (liar-catcher logic): every committed BuyerICP persona is checked
 *     against the captured ledger with checkPersonasBackedByLedger — the same
 *     (sourceUrl match + clean name-token containment) the shipped deck gate
 *     uses. Unbacked personas are fabrication / laundering the spine would catch.
 *
 * This is the "capture ONE live section" leg of the DoD: it costs one real run
 * (~$1.50-2) and proves the spine on data that is NOT the frozen b0d12b45
 * fixture. A fresh bundle (committed artifact + facts + corpus) is persisted so
 * the offline spine proof can be re-pointed at it later at $0.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/zz-record-live-section.ts \
 *        --section positioningBuyerICP
 *   add --dry to validate all wiring (imports, corpus build, store) at $0 — it
 *   stops right before the live call.
 *
 * SAFETY: a single bounded run (deadline + AbortController). No loop. Real keys
 * come from --env-file; this script never reads or prints them.
 */

// Non-secret behavior knobs, set BEFORE importing run-section. Provider matches
// prod (deepseek-direct); live tools + streaming left at their prod defaults.
process.env.LAB_ENGINE_PROVIDER = process.env.LAB_ENGINE_PROVIDER ?? "deepseek-direct";

import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { researchInputSchema } from "@/lib/lab-engine/artifacts/artifact-envelope";
import { corpusToResearchInput } from "@/lib/research-v2/corpus-to-research-input";
import { createRunStore } from "@/lib/lab-engine/runs/run-store";
import { isSupportedSectionId } from "@/lib/lab-engine/sections/section-registry";
import { createInMemoryResearchFactStore } from "@/lib/lab-engine/evidence/research-fact";
import {
  checkPersonasBackedByLedger,
  type PersonaLike,
} from "./lib/persona-ledger-check";

function readFlag(args: string[], name: string): string | null {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}
function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function extractPersonas(body: unknown): PersonaLike[] {
  const personaReality =
    (body as { personaReality?: { personas?: unknown[] } })?.personaReality ?? {};
  const personas = Array.isArray(personaReality.personas)
    ? personaReality.personas
    : [];
  return personas
    .filter(
      (p): p is { name: string; sourceUrl: string; title?: string; company?: string } =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { name?: unknown }).name === "string" &&
        typeof (p as { sourceUrl?: unknown }).sourceUrl === "string",
    )
    .map((p) => ({
      name: p.name,
      sourceUrl: p.sourceUrl,
      ...(typeof p.title === "string" ? { title: p.title } : {}),
      ...(typeof p.company === "string" ? { company: p.company } : {}),
    }));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sectionId = readFlag(args, "section") ?? "positioningBuyerICP";
  const corpusDir = readFlag(args, "corpus") ?? "tmp/accept/b0d12b45";
  const outRoot = readFlag(args, "out") ?? "tmp/replay-live";
  const deadlineMin = Number(readFlag(args, "deadline-min") ?? "8");
  const dry = hasFlag(args, "dry");

  if (!isSupportedSectionId(sectionId)) {
    console.error(`Unknown sectionId: ${sectionId}`);
    process.exit(1);
  }

  // Fail BEFORE spending if the live keys aren't loaded (--env-file missing).
  if (!dry) {
    const provider = process.env.LAB_ENGINE_PROVIDER;
    const needsDeepseek = provider === "deepseek-direct";
    if (needsDeepseek && !process.env.DEEPSEEK_API_KEY) {
      console.error(
        "[record-live] DEEPSEEK_API_KEY not set — run with `node --env-file=.env.local --import tsx ...`",
      );
      process.exit(1);
    }
  }

  const runId = `live-${sectionId.replace(/^positioning/, "")}-${Date.now()
    .toString(36)
    .slice(-6)}`;

  // 1) Build ResearchInput from the frozen corpus (pure; the section INPUT is
  //    frozen — what is FRESH is the live model+tool OUTPUT we capture).
  const program = JSON.parse(
    await readFile(join(corpusDir, "deepResearchProgram.json"), "utf8"),
  );
  const manifest = JSON.parse(
    await readFile(join(corpusDir, "_manifest.json"), "utf8"),
  );
  const built = corpusToResearchInput({
    runId,
    deepResearchProgramData: program,
    onboardingData: manifest.briefInput ?? {},
  });
  const researchInput = researchInputSchema.parse({ ...built, runId });

  // 2) File-based offline RunStore (no Supabase / Clerk) in a fresh tmp dir.
  const storeRoot = await mkdtemp(join(tmpdir(), "aigos-live-"));
  const store = createRunStore({
    rootDir: storeRoot,
    defaultSectionIds: [sectionId],
  });
  await store.createRun(researchInput);

  // 3) The durable ledger — captures facts as the live miners find them.
  const factStore = createInMemoryResearchFactStore();

  console.log(
    `[record-live] section=${sectionId} corpus=${corpusDir} provider=${process.env.LAB_ENGINE_PROVIDER} runId=${runId}`,
  );
  console.log(
    `[record-live] excerpts in corpus: ${researchInput.corpus.excerpts.length}`,
  );

  if (dry) {
    console.log(
      "[record-live] --dry: wiring OK (imports + corpus build + store + factStore). Stopping before the live call ($0).",
    );
    return;
  }

  // 4) LIVE run. Bounded by a deadline + an AbortController. Every model/tool
  //    seam defaults to its REAL implementation (we pass none), so this spends.
  const controller = new AbortController();
  const deadlineAt = Date.now() + deadlineMin * 60 * 1000;
  const killer = setTimeout(
    () => controller.abort(new Error(`[record-live] hard ${deadlineMin}m timeout`)),
    deadlineMin * 60 * 1000 + 30_000,
  );

  const { runSection } = await import("@/lib/lab-engine/agents/run-section");

  let committed = false;
  let artifact: Record<string, unknown> | undefined;
  let runError: string | undefined;
  const startedAt = Date.now();
  try {
    const result = await runSection(
      { runId, sectionId, signal: controller.signal, deadlineAt },
      {
        store,
        loadSkill: async (slug: string) => {
          try {
            return await readFile(
              join("src", "lib", "lab-engine", "skills", slug, "SKILL.md"),
              "utf8",
            );
          } catch {
            return "Live capture: corpus + live tools.";
          }
        },
        allowedTools: undefined, // undefined => all live tools allowed
        parentAuditRunId: runId, // + factStore => the miners write facts
        factStore,
        now: () => new Date(),
      },
    );
    committed = true;
    artifact = result.artifact as Record<string, unknown>;
  } catch (err) {
    runError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  } finally {
    clearTimeout(killer);
  }
  const durationMs = Date.now() - startedAt;

  // 5) Inspect the captured ledger (Pillar 1: durable, real, http-pinned).
  const facts = factStore.getFacts();
  const byKind: Record<string, number> = {};
  for (const f of facts) byKind[f.factKind] = (byKind[f.factKind] ?? 0) + 1;
  const allHttp = facts.every((f) => /^https?:\/\//u.test(f.sourceUrl));
  const allQuote = facts.every((f) => f.sourceQuote.trim().length > 0);

  // 6) Grounding (Pillar 5 logic) on the committed personas, if any.
  const personas = artifact ? extractPersonas(artifact.body) : [];
  const grounding = checkPersonasBackedByLedger(personas, facts);

  // 7) Persist a fresh bundle for offline re-proof.
  const outDir = join(outRoot, runId);
  await mkdir(outDir, { recursive: true });
  if (artifact) {
    await writeFile(
      join(outDir, `${sectionId}.json`),
      JSON.stringify(artifact, null, 2),
      "utf8",
    );
  }
  await writeFile(
    join(outDir, "research-facts.json"),
    JSON.stringify(facts, null, 2),
    "utf8",
  );
  await cp(corpusDir, join(outDir, "corpus"), { recursive: true });

  const summary = {
    sectionId,
    runId,
    provider: process.env.LAB_ENGINE_PROVIDER,
    durationMs,
    committed,
    runError: runError ?? null,
    verdict: artifact?.verdict ?? null,
    confidence: artifact?.confidence ?? null,
    personaCount: personas.length,
    facts: { total: facts.length, byKind, allHttp, allQuote },
    grounding: {
      total: grounding.total,
      backed: grounding.backed,
      unbacked: grounding.unbacked,
      details: grounding.details,
    },
    outDir,
  };
  await writeFile(
    join(outDir, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  // 8) Print the verdict.
  console.log("\n=== LIVE SPINE TEST (fresh data, one section) ===");
  console.log(`  committed:            ${committed}${runError ? ` (error: ${runError})` : ""}`);
  console.log(`  duration:             ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`  verdict/confidence:   ${summary.verdict} / ${summary.confidence}`);
  console.log(`\n  [Pillar 1] durable ledger:`);
  console.log(`    facts captured:     ${facts.length}  ${JSON.stringify(byKind)}`);
  console.log(`    all http source_url:${allHttp}`);
  console.log(`    all non-empty quote:${allQuote}`);
  console.log(`\n  [Pillar 5] persona grounding:`);
  console.log(`    committed personas: ${grounding.total}`);
  console.log(`    backed by ledger:   ${grounding.backed}`);
  console.log(`    UNBACKED:           ${grounding.unbacked}`);
  for (const d of grounding.details) {
    console.log(`      - ${d.backed ? "OK  " : "MISS"} ${d.name} <- ${d.reason} (${d.sourceUrl})`);
  }
  console.log(`\n  bundle: ${outDir}\n`);
}

main().catch((err) => {
  console.error("[record-live] FATAL", err);
  process.exit(1);
});
