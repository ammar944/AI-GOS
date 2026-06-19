#!/usr/bin/env tsx
/**
 * zz-full-run-harness.ts — in-process full-deck run + deterministic gate.
 *
 * Freezes corpus + onboarding → runs all 7 positioning sections in-process
 * (6 core then Paid Media last) → captures the durable fact ledger → runs
 * checkDeckAgainstLedger (the in-tree BLOCKING liar-gate) → prints a per-section
 * fill map so we can see, against real committed artifacts, what's actually
 * empty vs what the handoff claims.
 *
 * No browser, no Clerk, no Supabase writes. Filesystem RunStore only.
 * Real model + real tools (Firecrawl/SpyFu/Perplexity/SearchAPI/Reviews) by
 * default; --corpus-only disables live tools so you can validate the plumbing
 * with zero tool keys in seconds.
 *
 * Usage:
 *   npx tsx scripts/zz-full-run-harness.ts                       # Ramp, live tools
 *   npx tsx scripts/zz-full-run-harness.ts --corpus-only          # Ramp, no live tools (fast smoke)
 *   npx tsx scripts/zz-full-run-harness.ts --subject fathom        # Fathom (needs frozen corpus)
 *   npx tsx scripts/zz-full-run-harness.ts --sections positioningBuyerICP   # run one section only
 *
 * Output: tmp/zz-full-run/<runId>/{per-section.json, deck.json, ledger.json, gate.json, report.md}
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

loadEnvConfig(process.cwd());

import {
  researchInputSchema,
  type ResearchInput,
} from "../src/lib/lab-engine/artifacts/artifact-envelope";
import { createRunStore } from "../src/lib/lab-engine/runs/run-store";
import { isSupportedSectionId } from "../src/lib/lab-engine/sections/section-registry";
import { runSection } from "../src/lib/lab-engine/agents/run-section";
import {
  createInMemoryResearchFactStore,
  type ResearchFact,
} from "../src/lib/lab-engine/evidence/research-fact";
import { checkDeckAgainstLedger } from "../src/lib/lab-engine/verification/deck-ledger-gate";
import { corpusToResearchInput } from "../src/lib/research-v2/corpus-to-research-input";
import {
  POSITIONING_SECTION_IDS,
  PAID_MEDIA_PLAN_SECTION_ID,
} from "../src/lib/ai/prompts/positioning-skills";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function readFlag(args: string[], name: string): string | null {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const args = process.argv.slice(2);
const subject = readFlag(args, "subject") ?? "ramp";
const corpusOnly = args.includes("--corpus-only");
const sectionsArg = readFlag(args, "sections");
const requestedSections = sectionsArg
  ? sectionsArg.split(",").map((s) => s.trim())
  : null;

const SUBJECT_DIR: Record<string, string> = {
  ramp: "tmp/grill/ramp-fresh",
};

const subjectDir = SUBJECT_DIR[subject];
if (!subjectDir) {
  console.error(`Unknown subject "${subject}". Known: ${Object.keys(SUBJECT_DIR).join(", ")}`);
  process.exit(1);
}

async function loadLabSkill(slug: string): Promise<string> {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Invalid skill slug ${slug}`);
  return readFile(
    join(process.cwd(), "src", "lib", "lab-engine", "skills", slug, "SKILL.md"),
    "utf8",
  );
}

function sectionSlug(sectionId: string): string {
  return sectionId.replace(/^positioning/, "positioning-");
}

// ---------------------------------------------------------------------------
// Build the base ResearchInput from the frozen corpus + brief
// ---------------------------------------------------------------------------
async function buildResearchInput(runId: string): Promise<ResearchInput> {
  if (subject === "ramp") {
    const program = JSON.parse(
      await readFile(join(subjectDir, "deepResearchProgram.json"), "utf8"),
    );
    const manifest = JSON.parse(
      await readFile(join(subjectDir, "_manifest.json"), "utf8"),
    );
    const built = corpusToResearchInput({
      runId,
      deepResearchProgramData: program,
      onboardingData: manifest.briefInput ?? {},
    });
    return researchInputSchema.parse(built);
  }
  // Future: other subjects with their own frozen corpus.
  throw new Error(`No frozen corpus loader for subject "${subject}"`);
}

// ---------------------------------------------------------------------------
// Per-section fill map (the honest "what's actually empty" read)
// ---------------------------------------------------------------------------
function countEvidence(body: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(body)) {
    if (Array.isArray(value)) {
      out[key] = value.length;
    } else if (value && typeof value === "object") {
      // Nested block: count its arrays.
      const nested = value as Record<string, unknown>;
      let nestedNonEmptyArrays = 0;
      for (const v of Object.values(nested)) {
        if (Array.isArray(v) && v.length > 0) nestedNonEmptyArrays++;
      }
      if (nestedNonEmptyArrays > 0) out[`${key}.*`] = nestedNonEmptyArrays;
    }
  }
  return out;
}

function blockGaps(body: Record<string, unknown>): string[] {
  const gaps: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const rec = value as Record<string, unknown>;
      if (rec.blockGap !== undefined) {
        gaps.push(key);
      }
    }
  }
  return gaps;
}

function artifactSummary(artifact: unknown): {
  confidence: number;
  verdict: unknown;
  statusSummary: unknown;
  sourceCount: number;
  evidenceCounts: Record<string, number>;
  gapBlocks: string[];
  hasBody: boolean;
} {
  const a = artifact as Record<string, unknown> | null;
  if (!a) {
    return {
      confidence: -1,
      verdict: null,
      statusSummary: null,
      sourceCount: 0,
      evidenceCounts: {},
      gapBlocks: [],
      hasBody: false,
    };
  }
  const body = (a.body as Record<string, unknown>) ?? {};
  return {
    confidence: typeof a.confidence === "number" ? a.confidence : -1,
    verdict: a.verdict ?? null,
    statusSummary: a.statusSummary ?? null,
    sourceCount: Array.isArray(a.sources) ? a.sources.length : 0,
    evidenceCounts: countEvidence(body),
    gapBlocks: blockGaps(body),
    hasBody: Object.keys(body).length > 0,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const runId = `harness-${subject}-${randomUUID().slice(0, 8)}`;
  const outDir = join(process.cwd(), "tmp", "zz-full-run", runId);
  await mkdir(outDir, { recursive: true });

  console.log("=".repeat(72));
  console.log(`AI-GOS FULL-RUN HARNESS`);
  console.log(`  subject:    ${subject}  (${subjectDir})`);
  console.log(`  runId:      ${runId}`);
  console.log(`  corpusOnly: ${corpusOnly}`);
  console.log(`  model:      ${process.env.LAB_ENGINE_PROVIDER ?? "(default)"}`);
  console.log(`  liveTools:  ${corpusOnly ? "OFF" : "ON (Firecrawl/SpyFu/Perplexity/SearchAPI/Reviews)"}`);
  console.log("=".repeat(72));

  // 1. Build ResearchInput from frozen corpus + brief.
  const baseInput = await buildResearchInput(runId);
  console.log(
    `[harness] ResearchInput: company=${baseInput.company.name} sources=${baseInput.sources.length} corpusExcerpts=${baseInput.corpus.excerpts.length} competitorSeeds=${baseInput.competitorSeeds?.length ?? 0}`,
  );

  // 2. Filesystem RunStore (no Supabase).
  const rootDir = await mkdtemp(join(tmpdir(), "aigos-harness-"));
  const store = createRunStore({
    rootDir,
    defaultSectionIds: [
      ...POSITIONING_SECTION_IDS,
      PAID_MEDIA_PLAN_SECTION_ID,
    ] as readonly string[] as never,
  });
  await store.createRun(baseInput);

  // 3. Durable fact ledger (wired for both write + read).
  const factStore = createInMemoryResearchFactStore();
  const parentAuditRunId = runId;

  // 4. Decide section order: 6 core first, then paid media last (only if all 6 ran).
  const allSections = [...POSITIONING_SECTION_IDS, PAID_MEDIA_PLAN_SECTION_ID];
  const sectionsToRun =
    requestedSections ?? allSections;
  const includesPaidMedia = sectionsToRun.includes(PAID_MEDIA_PLAN_SECTION_ID);
  const coreSections = sectionsToRun.filter((s) => s !== PAID_MEDIA_PLAN_SECTION_ID);

  // 5. Run core sections.
  const results: Record<string, unknown> = {};
  for (const sectionId of coreSections) {
    if (!isSupportedSectionId(sectionId)) {
      console.error(`[harness] unsupported sectionId ${sectionId}`);
      continue;
    }
    console.log(`\n[harness] >>> ${sectionId}`);
    const start = Date.now();
    try {
      const result = await runSection(
        { runId, sectionId },
        {
          store,
          loadSkill: loadLabSkill,
          allowedTools: corpusOnly ? [] : undefined,
          factStore,
          parentAuditRunId,
          env: { ...process.env, _HARNESS_SECTION: sectionId },
        },
      );
      results[sectionId] = result.artifact;
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const s = artifactSummary(result.artifact);
      console.log(
        `[harness] <<< ${sectionId}  ${elapsed}s  confidence=${s.confidence}  sources=${s.sourceCount}  gapBlocks=[${s.gapBlocks.join(",")}]`,
      );
      await writeFile(
        join(outDir, `${sectionId}.json`),
        JSON.stringify(result.artifact, null, 2),
        "utf8",
      );
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.error(`[harness] !!! ${sectionId} FAILED after ${elapsed}s:`, err);
      results[sectionId] = { error: err instanceof Error ? err.message : String(err) };
      await writeFile(
        join(outDir, `${sectionId}.error.json`),
        JSON.stringify(
          { error: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined },
          null,
          2,
        ),
        "utf8",
      );
    }
  }

  // 6. Paid Media last — inject the committed core artifacts as its input.
  if (includesPaidMedia) {
    console.log(`\n[harness] >>> ${PAID_MEDIA_PLAN_SECTION_ID} (consuming committed core artifacts)`);
    const record = await store.readRun(runId);
    const committedPositioningArtifacts: Record<string, unknown> = {};
    for (const id of POSITIONING_SECTION_IDS) {
      const sec = record.sections?.[id];
      if (sec?.artifact) {
        committedPositioningArtifacts[id] = sec.artifact;
      }
    }
    const committedCount = Object.keys(committedPositioningArtifacts).length;
    console.log(`[harness]   committed upstream artifacts available: ${committedCount}/6`);
    if (committedCount === 0) {
      console.log(`[harness]   skipping Paid Media — no committed upstream artifacts to consume`);
    } else {
      // Paid Media needs committedPositioningArtifacts in its ResearchInput.
      // Use a fresh runId so createRun succeeds (the store rejects duplicate
      // runIds). Paid Media reads committed artifacts from its own input, not
      // from the parent run's sections.
      const paidMediaRunId = `${runId}-paidmedia`;
      const paidMediaInput: ResearchInput = {
        ...baseInput,
        runId: paidMediaRunId,
        committedPositioningArtifacts,
      };
      await store.createRun(paidMediaInput);
      const start = Date.now();
      try {
        const result = await runSection(
          { runId: paidMediaRunId, sectionId: PAID_MEDIA_PLAN_SECTION_ID },
          {
            store,
            loadSkill: loadLabSkill,
            allowedTools: corpusOnly ? [] : undefined,
            factStore,
            parentAuditRunId,
            env: { ...process.env, _HARNESS_SECTION: PAID_MEDIA_PLAN_SECTION_ID },
          },
        );
        results[PAID_MEDIA_PLAN_SECTION_ID] = result.artifact;
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const s = artifactSummary(result.artifact);
        console.log(
          `[harness] <<< ${PAID_MEDIA_PLAN_SECTION_ID}  ${elapsed}s  confidence=${s.confidence}  sources=${s.sourceCount}`,
        );
        await writeFile(
          join(outDir, `${PAID_MEDIA_PLAN_SECTION_ID}.json`),
          JSON.stringify(result.artifact, null, 2),
          "utf8",
        );
      } catch (err) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.error(`[harness] !!! ${PAID_MEDIA_PLAN_SECTION_ID} FAILED after ${elapsed}s:`, err);
        results[PAID_MEDIA_PLAN_SECTION_ID] = {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  // 7. Build the deck bundle + run the deterministic liar-gate.
  // Read committed artifacts from BOTH the parent run (6 core) and the paid-media run.
  const deck: Record<string, unknown> = {};
  const parentRecord = await store.readRun(runId);
  for (const id of POSITIONING_SECTION_IDS) {
    const sec = parentRecord.sections?.[id];
    if (sec?.artifact) {
      deck[id] = sec.artifact;
    }
  }
  try {
    const paidMediaRunId = `${runId}-paidmedia`;
    const paidRecord = await store.readRun(paidMediaRunId);
    const paidSec = paidRecord.sections?.[PAID_MEDIA_PLAN_SECTION_ID];
    if (paidSec?.artifact) {
      deck[PAID_MEDIA_PLAN_SECTION_ID] = paidSec.artifact;
    }
  } catch {
    // Paid media run may not exist (skipped or crashed before createRun).
  }
  await writeFile(join(outDir, "deck.json"), JSON.stringify(deck, null, 2), "utf8");

  const ledger: ResearchFact[] = factStore.getFacts();
  await writeFile(
    join(outDir, "ledger.json"),
    JSON.stringify(ledger, null, 2),
    "utf8",
  );
  console.log(`\n[harness] ledger captured ${ledger.length} research facts`);

  const gate = checkDeckAgainstLedger({ deck, ledger });
  await writeFile(join(outDir, "gate.json"), JSON.stringify(gate, null, 2), "utf8");
  console.log(
    `[harness] deck-ledger gate: blocked=${gate.blocked}  violations=${gate.violations.length}`,
  );

  // 8. Per-section fill report.
  const reportLines: string[] = [];
  reportLines.push(`# AI-GOS Full-Run Harness Report`);
  reportLines.push(``);
  const providerLabel = process.env.LAB_ENGINE_PROVIDER || "default";
  reportLines.push(`- **Subject:** ${subject}  |  **Run:** ${runId}`);
  reportLines.push(`- **Corpus-only:** ${corpusOnly}  |  **Live tools:** ${corpusOnly ? "OFF" : "ON"}`);
  reportLines.push(`- **Model:** ${providerLabel}`);
  reportLines.push(`- **Out dir:** ${outDir}`);
  reportLines.push(``);
  reportLines.push(`## Deck-ledger gate (deterministic liar-catcher)`);
  reportLines.push(``);
  reportLines.push(`- **Blocked:** ${gate.blocked}`);
  reportLines.push(`- **Violations:** ${gate.violations.length}`);
  for (const v of gate.violations.slice(0, 20)) {
    reportLines.push(`  - ${v.cell.sectionId}.${v.cell.rowKind}[${v.cell.rowIndex}] — ${v.reason}${v.sourceUrl ? ` (${v.sourceUrl})` : ""}`);
  }
  reportLines.push(``);
  reportLines.push(`## Ledger`);
  reportLines.push(``);
  reportLines.push(`- Total facts captured: ${ledger.length}`);
  const byKind: Record<string, number> = {};
  for (const f of ledger) byKind[f.factKind] = (byKind[f.factKind] ?? 0) + 1;
  for (const [k, c] of Object.entries(byKind)) reportLines.push(`  - ${k}: ${c}`);
  reportLines.push(``);
  reportLines.push(`## Per-section fill map`);
  reportLines.push(``);
  let paidMediaRecord: typeof parentRecord | null = null;
  try {
    paidMediaRecord = await store.readRun(`${runId}-paidmedia`);
  } catch {
    paidMediaRecord = null;
  }
  for (const id of allSections) {
    const isPaid = id === PAID_MEDIA_PLAN_SECTION_ID;
    const rec = isPaid ? paidMediaRecord : parentRecord;
    const sec = rec?.sections?.[id];
    const artifact = sec?.artifact;
    const s = artifactSummary(artifact);
    const status = sec?.status ?? "unknown";
    reportLines.push(`### ${id}`);
    reportLines.push(`- status: ${status}  |  confidence: ${s.confidence}  |  sources: ${s.sourceCount}`);
    if (s.gapBlocks.length > 0) reportLines.push(`- gap blocks: ${s.gapBlocks.join(", ")}`);
    reportLines.push(`- evidence counts:`);
    for (const [k, c] of Object.entries(s.evidenceCounts)) reportLines.push(`  - ${k}: ${c}`);
    if (!s.hasBody && status !== "completed") reportLines.push(`- **NO BODY COMMITTED**`);
    reportLines.push(``);
  }

  const report = reportLines.join("\n");
  await writeFile(join(outDir, "report.md"), report, "utf8");
  console.log(`\n[harness] report → ${join(outDir, "report.md")}`);
  console.log("=".repeat(72));
  console.log("DONE. Read report.md for the per-section fill map + gate verdict.");
}

main().catch((err) => {
  console.error("[harness] FATAL", err);
  process.exit(1);
});