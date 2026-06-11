// Offline replay proof for the coherence pack (no API spend, no DB writes).
// Applies the numeric coherence gate, internal jargon scrub, and brief
// numeric-fidelity gate to the persisted artifacts of E2E run 8081e646
// (tmp/e2e-2026-06-11-w5/) and prints what the gates would have caught —
// the cold judge's coherence findings (5,900-vs-7,300, six-of-twelve,
// CHANNEL POLICY / verifiedCount jargon, brief phantom figures).
//
// Run: npx tsx scripts/zz-coherence-gate-replay.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildSectionNumericTruth,
  enforceBriefNumericFidelity,
  enforceNumericCoherence,
  gateProseNumbers,
  scrubBodyInternalJargon,
  scrubInternalJargon,
} from "../src/lib/lab-engine/agents/verification/numeric-coherence";

// Default: the run the gate was built from. Point COHERENCE_REPLAY_DIR at a
// fresh dump to prove idempotence (in-pipeline gate ran → offline replay ~0).
const dumpDir = join(
  process.cwd(),
  process.env.COHERENCE_REPLAY_DIR ?? "tmp/e2e-2026-06-11-w5",
);

const sectionNames = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
  "positioningPaidMediaPlan",
];

interface PersistedSection {
  body: Record<string, unknown>;
  statusSummary?: string;
  verdict?: string;
}

function loadSection(name: string): PersistedSection {
  const parsed = JSON.parse(
    readFileSync(join(dumpDir, `${name}.json`), "utf8"),
  ) as PersistedSection;

  if (parsed.body === undefined) {
    throw new Error(`${name}.json has no body field`);
  }

  return parsed;
}

function header(title: string): void {
  console.log(`\n=== ${title} ===`);
}

let totalStrikes = 0;

// Runtime parity: every section's ResearchInput carries the corpus; paid-media
// additionally reads the six committed positioning bodies.
const corpus = JSON.parse(
  readFileSync(join(dumpDir, "deepResearchProgram.json"), "utf8"),
) as Record<string, unknown>;
const corpusEvidence = corpus.body ?? corpus;

function auxiliaryFor(name: string): unknown {
  if (name !== "positioningPaidMediaPlan") {
    return corpusEvidence;
  }

  return [
    corpusEvidence,
    ...sectionNames
      .filter((sibling) => sibling !== "positioningPaidMediaPlan")
      .map((sibling) => loadSection(sibling).body),
  ];
}

for (const name of sectionNames) {
  const section = loadSection(name);
  const auxiliaryEvidence = auxiliaryFor(name);

  const jargon = scrubBodyInternalJargon({ body: section.body, sectionId: name });
  const coherence = enforceNumericCoherence({
    auxiliaryEvidence,
    body: jargon.body,
    sectionId: name,
  });
  const truth = buildSectionNumericTruth({
    auxiliaryEvidence,
    body: coherence.body,
    sectionId: name,
  });

  const envelopeStrikes: Array<{ field: string; numbers?: string[]; pattern?: string; removedText: string }> = [];

  for (const [field, value] of [
    ["statusSummary", section.statusSummary],
    ["verdict", section.verdict],
  ] as const) {
    if (typeof value !== "string") {
      continue;
    }

    const jargonGate = scrubInternalJargon({ field, value });
    const numberGate = gateProseNumbers({ field, truth, value: jargonGate.value });

    envelopeStrikes.push(...jargonGate.strikes, ...numberGate.strikes);
  }

  const count =
    jargon.stripped.length + coherence.stripped.length + envelopeStrikes.length;

  if (count === 0) {
    continue;
  }

  totalStrikes += count;
  header(`${name} — ${count} strike(s)`);

  for (const strike of jargon.stripped) {
    console.log(`  [jargon:${strike.pattern}] ${strike.field}`);
    console.log(`    removed: ${strike.removedText.slice(0, 110)}`);
  }

  for (const strike of coherence.stripped) {
    console.log(`  [numbers: ${strike.numbers.join(", ")}] ${strike.field}`);
    console.log(`    removed: ${strike.removedText.slice(0, 110)}`);
  }

  for (const strike of envelopeStrikes) {
    const tag = strike.numbers ? `numbers: ${strike.numbers.join(", ")}` : `jargon:${strike.pattern}`;
    console.log(`  [${tag}] ${strike.field}`);
    console.log(`    removed: ${strike.removedText.slice(0, 110)}`);
  }
}

header("executive brief — numeric fidelity vs committed bodies");

const briefRaw = JSON.parse(
  readFileSync(join(dumpDir, "executive-brief.json"), "utf8"),
) as Record<string, unknown>;

const thesisDoc = (briefRaw.thesis ?? briefRaw) as Record<string, unknown>;
const thesis = typeof thesisDoc.executiveThesis === "string" ? thesisDoc.executiveThesis : "";
const rankedMoves = Array.isArray(thesisDoc.rankedMoves) ? thesisDoc.rankedMoves : [];
const moves = rankedMoves
  .map((move) => (typeof (move as Record<string, unknown>).move === "string" ? (move as Record<string, unknown>).move as string : ""))
  .filter((move) => move.length > 0);

if (thesis.length === 0) {
  console.log("no executiveThesis found in executive-brief.json — skipping");
} else {
  const fidelity = enforceBriefNumericFidelity({
    moves,
    sectionBodies: sectionNames.map((name) => loadSection(name).body),
    thesis,
  });

  console.log(`strikes: ${fidelity.strikes.length}`);
  totalStrikes += fidelity.strikes.length;

  for (const strike of fidelity.strikes) {
    console.log(`  [${strike.kind}] ${strike.field}`);
    console.log(`    removed: ${strike.removedText.slice(0, 110)}`);
  }
}

console.log(`\ntotal strikes across run 8081e646: ${totalStrikes}`);
console.log("done");
