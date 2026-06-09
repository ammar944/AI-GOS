#!/usr/bin/env tsx
/**
 * zz-run-one-section.ts — CLI sandbox to run a single lab-engine section
 * against a local ResearchInput fixture WITHOUT a browser E2E or paid corpus.
 *
 * Usage:
 *   npx tsx scripts/zz-run-one-section.ts --section positioningMarketCategory
 *   npx tsx scripts/zz-run-one-section.ts --section positioningBuyerICP --fixture path/to/input.json
 *
 * Output: tmp/zz-section-out/<section>.json  (artifact + elapsed + toolCallCount)
 *
 * DO NOT execute this script against live APIs without operator sign-off.
 * Keys required: DEEPSEEK_API_KEY, BRAVE_SEARCH_API_KEY (for web_search tool).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";

// Load .env.local before any other imports that might read process.env.
loadEnvConfig(process.cwd());

import { randomUUID } from "node:crypto";
import {
  researchInputSchema,
  type ResearchInput,
} from "../src/lib/lab-engine/artifacts/artifact-envelope";
import { createRunStore } from "../src/lib/lab-engine/runs/run-store";
import { isSupportedSectionId } from "../src/lib/lab-engine/sections/section-registry";
import { runSection } from "../src/lib/lab-engine/agents/run-section";
import { saaslaunchResearchInput } from "../src/lib/lab-engine/fixtures/saaslaunch";

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------
function readFlag(args: string[], name: string): string | null {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const args = process.argv.slice(2);
const sectionId = readFlag(args, "section") ?? "positioningMarketCategory";
const fixturePath = readFlag(args, "fixture");

if (!isSupportedSectionId(sectionId)) {
  console.error(`Unknown sectionId: ${sectionId}`);
  console.error(
    "Valid values: positioningMarketCategory | positioningBuyerICP | " +
      "positioningCompetitorLandscape | positioningVoiceOfCustomer | " +
      "positioningDemandIntent | positioningOfferDiagnostic | " +
      "positioningPaidMediaPlan | positioningCrossSectionReasoning | positioningPaidMediaPlan",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fixture resolution
// ---------------------------------------------------------------------------
async function loadResearchInput(): Promise<ResearchInput> {
  if (fixturePath) {
    const raw = JSON.parse(await readFile(fixturePath, "utf8"));
    return researchInputSchema.parse(raw);
  }
  // Built-in SaaSLaunch fixture — no corpus cost.
  return saaslaunchResearchInput;
}

// ---------------------------------------------------------------------------
// loadSkill: reads from src/lib/lab-engine/skills/<slug>/SKILL.md
// ---------------------------------------------------------------------------
async function loadLabSkill(slug: string): Promise<string> {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Invalid skill slug: ${slug}`);
  const skillPath = join(
    process.cwd(),
    "src",
    "lib",
    "lab-engine",
    "skills",
    slug,
    "SKILL.md",
  );
  return readFile(skillPath, "utf8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log(`[zz-run-one-section] section=${sectionId} fixture=${fixturePath ?? "built-in:saaslaunch"}`);

  const researchInput = await loadResearchInput();

  // Override runId so each invocation is isolated under .data/runs/
  const runId = `zz-${sectionId.replace(/positioning/, "")}-${randomUUID().slice(0, 8)}`;
  const patchedInput: ResearchInput = { ...researchInput, runId };

  // File-based RunStore — writes to .data/runs/<runId>.json
  const store = createRunStore({ defaultSectionIds: [sectionId] });
  await store.createRun(patchedInput);

  const startMs = Date.now();
  let toolCallCount = 0;

  // Patch env to count tool invocations via a simple tally
  const patchedEnv: Record<string, string | undefined> = {
    ...process.env,
    _HARNESS_SECTION: sectionId,
  };

  console.log("[zz-run-one-section] calling runSection — may take 60–180s with live tools...");

  const result = await runSection(
    { runId, sectionId },
    {
      store,
      loadSkill: loadLabSkill,
      env: patchedEnv,
    },
  );

  const elapsedMs = Date.now() - startMs;

  // Approximate tool call count from artifact sources length as a proxy
  toolCallCount = result.artifact.sources?.length ?? 0;

  const out = {
    sectionId: result.sectionId,
    runId: result.runId,
    elapsedMs,
    toolCallCount,
    confidence: result.artifact.confidence,
    verdict: result.artifact.verdict,
    statusSummary: result.artifact.statusSummary,
    sourceCount: result.artifact.sources.length,
    artifact: result.artifact,
  };

  const outDir = join(process.cwd(), "tmp", "zz-section-out");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${sectionId}.json`);
  await writeFile(outPath, JSON.stringify(out, null, 2), "utf8");

  console.log(`[zz-run-one-section] DONE in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`  verdict: ${result.artifact.verdict}`);
  console.log(`  confidence: ${result.artifact.confidence}`);
  console.log(`  sources: ${result.artifact.sources.length}`);
  console.log(`  output: ${outPath}`);
}

main().catch((err) => {
  console.error("[zz-run-one-section] FATAL", err);
  process.exit(1);
});
