/**
 * zz-composer-glm.ts — LIVE proof harness for the GLM composer.
 *
 * Runs composePaidMediaPlan against real GLM-5.2 (Ollama Cloud dev / OpenRouter
 * prod) using the orchestrator's Clay digest + the paid-media fixture's
 * section markdowns as the 6 committed sections. Proves the composer:
 * reads the 6 sections + ledger digest → emits the 13-block deck → parses
 * against paidMediaPlanBodySchema.
 *
 * Usage:
 *   npx tsx scripts/zz-composer-glm.ts --subject clay
 *   npx tsx scripts/zz-composer-glm.ts --subject clay --dry   # assemble prompt only, no live call
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { composePaidMediaPlan, composerStripFloor } from "../src/lib/lab-engine/agents/composer-glm";
import { POSITIONING_SECTION_IDS } from "../src/lib/ai/prompts/positioning-skills";

interface CliArgs {
  subject: string;
  dry: boolean;
  maxSteps: number;
}

function parseArgs(argv: string[]): CliArgs {
  let subject = "";
  let dry = false;
  let maxSteps = 4;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry") dry = true;
    else if (a === "--subject") subject = argv[++i];
    else if (a.startsWith("--subject=")) subject = a.slice("--subject=".length);
    else if (a === "--max-steps") maxSteps = Number(argv[++i]);
    else if (a.startsWith("--max-steps=")) maxSteps = Number(a.slice("--max-steps=".length));
  }
  if (subject.length === 0) subject = "clay";
  return { subject, dry, maxSteps };
}

// Load the orchestrator's Clay digest from the Step D proof. Falls back to a
// short placeholder if the orchestrator proof hasn't run.
function loadLedgerDigest(subject: string): string {
  const path = join(process.cwd(), "tmp", "zz-orchestrator-glm", subject, "research-digest.md");
  if (existsSync(path)) {
    return readFileSync(path, "utf8");
  }
  return `(no orchestrator digest found for ${subject} — run scripts/zz-orchestrator-glm.ts first; using a placeholder so the composer can still be proven)`;
}

// The 6 committed section markdowns. For a FAITHFUL end-to-end proof these are
// the REAL agentic section bodies written by zz-agentic-section.ts to
// tmp/zz-agentic-glm/<subject>/<short>/body.md — NOT hand-written summaries.
// A missing body is surfaced loudly (honest-gap placeholder), never masked.
// In production these come from research_artifact_sections.markdown per zone.
const SHORT_TO_POSITIONING_ID: Record<string, string> = {
  market: "positioningMarketCategory",
  buyer: "positioningBuyerICP",
  competitor: "positioningCompetitorLandscape",
  voc: "positioningVoiceOfCustomer",
  demand: "positioningDemandIntent",
  offer: "positioningOfferDiagnostic",
};

function buildCommittedSectionMarkdown(subject: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [short, positioningId] of Object.entries(SHORT_TO_POSITIONING_ID)) {
    const path = join(process.cwd(), "tmp", "zz-agentic-glm", subject, short, "body.md");
    if (existsSync(path)) {
      const body = readFileSync(path, "utf8").trim();
      out[positioningId] =
        body.length > 0
          ? body
          : `## ${positioningId}\n(EMPTY section body — generation produced no text)`;
      console.log(`[composer-proof] loaded REAL section ${short} (${positioningId}): ${body.length} chars`);
    } else {
      out[positioningId] = `## ${positioningId}\n(MISSING — section not generated for ${subject})`;
      console.warn(`[composer-proof] WARNING: missing section body ${path} — using honest-gap placeholder`);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const outDir = join(process.cwd(), "tmp", "zz-composer-glm", args.subject);
  mkdirSync(outDir, { recursive: true });

  const committedSectionMarkdown = buildCommittedSectionMarkdown(args.subject);
  const ledgerDigest = loadLedgerDigest(args.subject);
  const onboardingFrame = JSON.stringify({
    companyName: args.subject === "clay" ? "Clay" : args.subject,
    websiteUrl: `https://www.${args.subject}.com`,
    monthlyAdBudget: "$50,000",
    primaryGoal90Days: "Pipeline generation",
  });

  console.log(`[composer-proof] subject=${args.subject} dry=${args.dry} maxSteps=${args.maxSteps}`);

  if (args.dry) {
    const sections = Object.keys(committedSectionMarkdown).map((id) => `<section id="${id}">`).join(", ");
    console.log(`[composer-proof] committed sections: ${sections}`);
    console.log(`[composer-proof] ledger digest length: ${ledgerDigest.length}`);
    writeFileSync(join(outDir, "dry-inputs.json"), JSON.stringify({ committedSectionIds: Object.keys(committedSectionMarkdown), ledgerDigestLength: ledgerDigest.length }, null, 2));
    console.log(`[composer-proof] dry ok → ${outDir}/dry-inputs.json`);
    return;
  }

  const startedAt = Date.now();
  const result = await composePaidMediaPlan({
    committedSectionMarkdown,
    ledgerDigest,
    onboardingFrame,
    maxSteps: args.maxSteps,
    env: process.env,
  });
  const elapsedMs = Date.now() - startedAt;

  const strip = composerStripFloor(result.deck);

  console.log(
    `[composer-proof] done stepCount=${result.stepCount} elapsedMs=${elapsedMs} deck=${result.deck ? "yes" : "null"} deckMarkdownLen=${result.deckMarkdown.length} stripAdmitted=${strip.admitted} stripReasons=${strip.reasons.join(",") || "(none)"}`,
  );

  writeFileSync(join(outDir, "deck.json"), JSON.stringify(result.deck, null, 2));
  writeFileSync(join(outDir, "deck-readout.md"), result.deckMarkdown);
  writeFileSync(join(outDir, "transcript.json"), JSON.stringify(result.transcript, null, 2));
  writeFileSync(join(outDir, "strip-verdict.json"), JSON.stringify(strip, null, 2));

  console.log(`[composer-proof] artifacts → ${outDir}`);
}

main().catch((err) => {
  console.error("[composer-proof] FAILED:", err);
  process.exit(1);
});