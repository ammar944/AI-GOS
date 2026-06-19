import { describe, expect, it } from "vitest";

import type { ResearchFact } from "@/lib/lab-engine/evidence/research-fact";
import {
  checkDeckAgainstLedger,
  type DeckBundle,
} from "@/lib/lab-engine/verification/deck-ledger-gate";
import { readSectionBody } from "../../../../../scripts/lib/fixture-loader";

// ---------------------------------------------------------------------------
// P0.3-fixture — prove the deck-vs-ledger liar-catcher on the REAL frozen
// b0d12b45 acceptance deck (not hand-authored shapes).
//
// Ground truth observed in tmp/accept/b0d12b45/positioningPaidMediaPlan.json
// (enumerated 2026-06-18): the synthesized grounded-row arrays carry
//   audienceTypes:            4 rows -> 1 grounded, 3 gap
//   anglesToTest:             4 rows -> 1 grounded, 2 gap, 1 no-pack
//   creativeFramework:        3 rows -> 0 grounded, 3 gap
//   competitorMarketingInsights: 2 rows -> 0 grounded, 2 gap
//   competitorReviewInsights: 2 rows -> 0 grounded, 2 gap
//   channelSuggestions:       3 rows -> 0 grounded, 1 gap, 2 no-pack
//   => 2 GROUNDED cells, 13 gap cells, 3 no-pack cells.
//
// Both grounded cells (audienceTypes[0], anglesToTest[0]) cite the SAME
// upstream locator: positioningMarketCategory body.structuralForces.forces[0],
// which carries a real https sourceUrl
//   https://www.g2.com/products/ramp-financial-ramp/competitors/alternatives
// and a quote whose first token is "G2".
//
// The b0d12b45 slop is GAP cells + an empty BuyerICP (personas:[]), NOT
// fabricated grounded claims. This gate's job is to catch the FUTURE failure
// mode where a cell ASSERTS grounding the ledger cannot prove. So:
//   - a sparse ledger that does NOT carry a fact at the g2 URL must BLOCK both
//     grounded cells (no-ledger-fact-for-source), while the 13 gap + 3 no-pack
//     cells and the empty BuyerICP are SKIPPED, not flagged.
//   - a fuller ledger that DOES carry a containing fact at the g2 URL passes.
// ---------------------------------------------------------------------------

const FIXTURE_DIR = "tmp/accept/b0d12b45";

const SECTION_FILES = {
  positioningPaidMediaPlan: `${FIXTURE_DIR}/positioningPaidMediaPlan.json`,
  positioningVoiceOfCustomer: `${FIXTURE_DIR}/positioningVoiceOfCustomer.json`,
  positioningMarketCategory: `${FIXTURE_DIR}/positioningMarketCategory.json`,
  positioningBuyerICP: `${FIXTURE_DIR}/positioningBuyerICP.json`,
  positioningCompetitorLandscape: `${FIXTURE_DIR}/positioningCompetitorLandscape.json`,
  positioningDemandIntent: `${FIXTURE_DIR}/positioningDemandIntent.json`,
  positioningOfferDiagnostic: `${FIXTURE_DIR}/positioningOfferDiagnostic.json`,
} as const;

// The single upstream source both grounded PMP cells resolve to.
const G2_SOURCE_URL =
  "https://www.g2.com/products/ramp-financial-ramp/competitors/alternatives";
const G2_QUOTE =
  "G2 and Stampli competitor lists include card issuers (Brex, Rho), AP tools (Stampli, Tipalti), and T&E platforms (Navan, Spendesk) — indicating buyers evaluate across silos and expect unified solutions.";

async function loadCommittedDeck(): Promise<DeckBundle> {
  const deck: DeckBundle = {};
  for (const [sectionId, file] of Object.entries(SECTION_FILES)) {
    deck[sectionId] = { body: await readSectionBody(file) };
  }
  return deck;
}

// A sparse ledger of exactly two facts, NEITHER at the g2 URL the grounded
// cells cite — mirrors the real failure: the deck claims grounding the ledger
// cannot prove.
function sparseLedger(): ResearchFact[] {
  return [
    {
      runId: "b0d12b45",
      sectionId: "positioningVoiceOfCustomer",
      factKind: "voc_quote",
      sourceUrl: "https://www.reddit.com/r/accounting/comments/unrelated",
      sourceQuote: "Closing the books takes us a full week every month.",
      claimToken: "Closing",
      createdAt: "2026-06-18T00:00:00.000Z",
    },
    {
      runId: "b0d12b45",
      sectionId: "positioningCompetitorLandscape",
      factKind: "corpus_excerpt",
      sourceUrl: "https://ramp.com/pricing",
      sourceQuote: "Ramp charges no monthly platform fee for the core card.",
      claimToken: "Ramp",
      createdAt: "2026-06-18T00:00:00.000Z",
    },
  ];
}

// A fuller ledger that backs every grounded cell: a corpus_excerpt fact at the
// g2 URL whose sourceQuote literally contains the claimed token "G2" at a clean
// boundary.
function backingLedger(): ResearchFact[] {
  return [
    ...sparseLedger(),
    {
      runId: "b0d12b45",
      sectionId: "positioningMarketCategory",
      factKind: "corpus_excerpt",
      sourceUrl: G2_SOURCE_URL,
      sourceQuote: G2_QUOTE,
      claimToken: "G2",
      createdAt: "2026-06-18T00:00:00.000Z",
    },
  ];
}

describe("checkDeckAgainstLedger on the frozen b0d12b45 deck", () => {
  it("BLOCKS the two grounded PMP cells when the sparse ledger lacks a fact at their cited g2 source — and SKIPS the 13 gap cells + empty BuyerICP", async () => {
    const deck = await loadCommittedDeck();

    const verdict = checkDeckAgainstLedger({ deck, ledger: sparseLedger() });

    // Both grounded cells cite the g2 URL that no sparse-ledger fact backs.
    expect(verdict.blocked).toBe(true);

    // Exactly the two grounded cells are flagged — no more, no less. The 13
    // gap cells + 3 no-pack cells + empty BuyerICP personas:[] are SKIPPED.
    expect(verdict.violations).toHaveLength(2);

    for (const v of verdict.violations) {
      expect(v.reason).toBe("no-ledger-fact-for-source");
      expect(v.sourceUrl).toBe(G2_SOURCE_URL);
      expect(v.cell.sectionId).toBe("positioningPaidMediaPlan");
    }

    // The two flagged cells are precisely audienceTypes[0] and anglesToTest[0].
    const flagged = verdict.violations
      .map((v) => `${v.cell.rowKind}[${v.cell.rowIndex}]`)
      .sort();
    expect(flagged).toEqual(["anglesToTest[0]", "audienceTypes[0]"]);

    // The empty BuyerICP (personaReality.personas:[]) is an HONEST gap, never a
    // lie: no violation may reference it.
    const buyerIcpViolations = verdict.violations.filter(
      (v) => v.cell.sectionId === "positioningBuyerICP",
    );
    expect(buyerIcpViolations).toEqual([]);
  });

  it("does NOT block when a fuller ledger carries a containing fact at the cited g2 source", async () => {
    const deck = await loadCommittedDeck();

    const verdict = checkDeckAgainstLedger({ deck, ledger: backingLedger() });

    expect(verdict.blocked).toBe(false);
    expect(verdict.violations).toEqual([]);
  });
});
