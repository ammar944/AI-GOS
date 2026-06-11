// Offline replay proof for the provenance gate (no API spend, no DB writes).
// Applies the three new deterministic strips to the persisted section bodies
// of E2E run 8081e646 (tmp/e2e-2026-06-11-w5/) and prints what the gate would
// have caught — the cold judge's top fabrication findings.
//
// Run: npx tsx scripts/zz-provenance-gate-replay.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  downgradeUnpermalinkedVerbatimQuotes,
  scrubQuoteEmails,
  stripExemplarEchoes,
} from "../src/lib/lab-engine/agents/verification/provenance-gate";

const dumpDir = join(process.cwd(), "tmp/e2e-2026-06-11-w5");

function loadBody(name: string): Record<string, unknown> {
  const parsed = JSON.parse(
    readFileSync(join(dumpDir, `${name}.json`), "utf8"),
  ) as { body?: Record<string, unknown> };

  if (parsed.body === undefined) {
    throw new Error(`${name}.json has no body field`);
  }

  return parsed.body;
}

function header(title: string): void {
  console.log(`\n=== ${title} ===`);
}

header("competitor publicWeaknesses — verbatim downgrade");
const competitor = downgradeUnpermalinkedVerbatimQuotes({
  body: loadBody("positioningCompetitorLandscape"),
});
console.log(`downgraded: ${competitor.stripped.length}`);
for (const item of competitor.stripped) {
  console.log(`  - ${item.field}`);
  console.log(`    url: ${item.sourceUrl}`);
}

header("paid-media — exemplar echo strip");
const paidMedia = stripExemplarEchoes({
  body: loadBody("positioningPaidMediaPlan"),
  sectionId: "positioningPaidMediaPlan",
});
console.log(`stripped: ${paidMedia.stripped.length}`);
for (const item of paidMedia.stripped) {
  console.log(`  - [${item.motif}] ${item.field}`);
  console.log(`    removed: ${item.removedText.slice(0, 110)}`);
}

header("demand-intent — exemplar echo strip");
const demand = stripExemplarEchoes({
  body: loadBody("positioningDemandIntent"),
  sectionId: "positioningDemandIntent",
});
console.log(`stripped: ${demand.stripped.length}`);
for (const item of demand.stripped) {
  console.log(`  - [${item.motif}] ${item.field}`);
  console.log(`    removed: ${item.removedText.slice(0, 110)}`);
}

header("all sections — quote email scrub");
const sectionNames = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
  "positioningPaidMediaPlan",
];
for (const name of sectionNames) {
  const scrub = scrubQuoteEmails({ body: loadBody(name) });

  if (scrub.stripped.length > 0) {
    console.log(`${name}: ${scrub.stripped.length} field(s) scrubbed`);
    for (const item of scrub.stripped) {
      console.log(`  - ${item.field} (${item.count} email)`);
    }
  }
}
console.log("done");
