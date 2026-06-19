// @vitest-environment node
// PGlite's WASM loader (used transitively via the rollup harness in STEP 3 and
// the ledger table in STEP 1) needs Node's fetch/Response.arrayBuffer; the
// repo-default jsdom environment polyfills a Response without arrayBuffer and
// breaks loading.
import { describe, it, expect, beforeAll } from "vitest";

import {
  runSpineProof,
  evaluateSpineProof,
  type SpineProofResult,
} from "../zz-prove-p0-spine";

// The end-to-end $0 spine proof runs the full pipeline once (corpus transform +
// pglite ledger inserts + deck gate + rollup chain) and exposes its three
// sub-results. The assertions below pin every load-bearing value so the test
// fails LOUDLY if any of the three P0 pieces regresses on the frozen fixture.

describe("P0 spine proof — all three pieces chain on frozen fixture b0d12b45", () => {
  let result: SpineProofResult;

  beforeAll(async () => {
    result = await runSpineProof();
  }, 120_000);

  it("STEP 1 (P0.2 durability): every corpus excerpt is a durable research_facts row with non-empty source_url + source_quote, and a mid-loop abort leaves the inserted rows durable", () => {
    // The transform produces N excerpts on the frozen fixture; do NOT hardcode N.
    expect(result.step1.excerptCount).toBeGreaterThan(0);
    // Durable row count exactly equals the excerpt count (no data dropped, no
    // double-insert) — the durability invariant.
    expect(result.step1.durableRowCount).toBe(result.step1.excerptCount);
    expect(result.step1.everyRowHasSourceUrl).toBe(true);
    expect(result.step1.everyRowHasSourceQuote).toBe(true);
    // Mid-loop abort: the N rows committed before the abort remain durable — NOT
    // rolled back to zero. Durability, not all-or-nothing.
    expect(result.step1.abortAfterN).toBeGreaterThan(0);
    expect(result.step1.durableRowsAfterAbort).toBe(result.step1.abortAfterN);
  });

  it("STEP 2 (P0.3 liar-catcher): a dropped-data corpus ledger BLOCKS the two grounded PMP cells and SKIPS the empty BuyerICP; the full corpus ledger does NOT block", () => {
    const dropped = result.step2.droppedLedgerVerdict;
    // The dropped-data ledger reproduces the b0d12b45 failure: the deck asserts
    // grounding the (dropped) ledger cannot prove -> BLOCK.
    expect(dropped.blocked).toBe(true);
    // Exactly the two grounded cells, no more, no less.
    expect(dropped.violations).toHaveLength(2);
    const flagged = dropped.violations
      .map((v) => `${v.cell.rowKind}[${v.cell.rowIndex}]`)
      .sort();
    expect(flagged).toEqual(["anglesToTest[0]", "audienceTypes[0]"]);
    for (const v of dropped.violations) {
      expect(v.reason).toBe("no-ledger-fact-for-source");
      expect(v.cell.sectionId).toBe("positioningPaidMediaPlan");
    }
    // The empty BuyerICP (personas:[]) is an HONEST gap — never flagged.
    expect(
      dropped.violations.filter(
        (v) => v.cell.sectionId === "positioningBuyerICP",
      ),
    ).toEqual([]);

    // Control: the FULL corpus ledger DOES back the grounded cells -> no block.
    // The gate punishes unprovable grounding, never honest data.
    expect(result.step2.fullLedgerVerdict.blocked).toBe(false);
    expect(result.step2.fullLedgerVerdict.violations).toEqual([]);
  });

  it("STEP 3 (P0.1 rollup): children_complete === 5 (empty BuyerICP rejected), parent NOT complete, corpus zone NOT counted", () => {
    expect(result.step3.childrenComplete).toBe(5);
    expect(result.step3.parentStatus).not.toBe("complete");
    // The corpus zone is fail-closed FALSE via the exact-six allow-list.
    expect(result.step3.corpusCountsTowardRollup).toBe(false);
    // The rejected section is empty/unreliable by tier.
    expect(result.step3.buyerIcpVerificationTier).toBe("insufficient");
  });

  it("overall: evaluateSpineProof reports all three steps PASS", () => {
    const verdict = evaluateSpineProof(result);
    expect(verdict.step1Pass).toBe(true);
    expect(verdict.step2Pass).toBe(true);
    expect(verdict.step3Pass).toBe(true);
    expect(verdict.allPass).toBe(true);
  });
});
