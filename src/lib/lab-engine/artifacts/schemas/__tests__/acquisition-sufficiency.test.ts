import { describe, expect, it } from "vitest";

import {
  acquisitionSufficiencySchema,
  computeAcquisitionSufficiency,
} from "../strategic-insight";

// Deterministic sufficiency roll-up (Wave 2B). Pure tally of acquisitionLedger
// promotionStatus + section floors -> tier. No LLM, no fabrication: zero promoted
// is always insufficient, and a self-reported "sufficient" is reached ONLY by
// meeting an absolute floor (never a ratio), so a thin pack can never launder up.
describe("computeAcquisitionSufficiency", () => {
  it("returns a schema-valid summary", () => {
    const result = computeAcquisitionSufficiency(
      [{ promotionStatus: "promoted", domain: "g2.com" }],
      { promotedFloor: 1 },
    );

    expect(() => acquisitionSufficiencySchema.parse(result)).not.toThrow();
  });

  it("reports insufficient when no candidate rows exist", () => {
    expect(computeAcquisitionSufficiency([], { promotedFloor: 3 })).toEqual({
      tier: "insufficient",
      rationale: "Zero candidates were promoted; evidence acquisition failed.",
      candidatesFound: 0,
      promoted: 0,
      rejected: 0,
    });
  });

  it("ignores not_applicable attempt rows when tallying candidatesFound", () => {
    const result = computeAcquisitionSufficiency(
      [
        { promotionStatus: "not_applicable", domain: "g2.com" },
        { promotionStatus: "not_applicable", domain: "capterra.com" },
        { promotionStatus: "promoted", domain: "g2.com" },
        { promotionStatus: "rejected", domain: "reddit.com" },
      ],
      { promotedFloor: 3 },
    );

    expect(result.candidatesFound).toBe(2);
    expect(result.promoted).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.tier).toBe("partial");
  });

  it("reports insufficient when candidates were found but none promoted", () => {
    const result = computeAcquisitionSufficiency(
      [
        { promotionStatus: "rejected", domain: "g2.com" },
        { promotionStatus: "rejected", domain: "capterra.com" },
        { promotionStatus: "rejected", domain: "reddit.com" },
      ],
      { promotedFloor: 3 },
    );

    expect(result.tier).toBe("insufficient");
    expect(result.candidatesFound).toBe(3);
    expect(result.promoted).toBe(0);
    expect(result.rejected).toBe(3);
  });

  it("reports sufficient when the promoted count meets the absolute floor (BuyerICP)", () => {
    const result = computeAcquisitionSufficiency(
      [
        { promotionStatus: "promoted", domain: "g2.com" },
        { promotionStatus: "promoted", domain: "linkedin.com" },
        { promotionStatus: "promoted", domain: "youtube.com" },
        { promotionStatus: "rejected", domain: "reddit.com" },
      ],
      { promotedFloor: 3 },
    );

    expect(result.tier).toBe("sufficient");
    expect(result.promoted).toBe(3);
    expect(result.rejected).toBe(1);
    expect(result.candidatesFound).toBe(4);
  });

  it("reports partial when promoted is above zero but below the floor (BuyerICP)", () => {
    const result = computeAcquisitionSufficiency(
      [
        { promotionStatus: "promoted", domain: "g2.com" },
        { promotionStatus: "promoted", domain: "linkedin.com" },
        { promotionStatus: "rejected", domain: "reddit.com" },
        { promotionStatus: "rejected", domain: "capterra.com" },
      ],
      { promotedFloor: 3 },
    );

    expect(result.tier).toBe("partial");
    expect(result.promoted).toBe(2);
    expect(result.candidatesFound).toBe(4);
  });

  it("reports sufficient when VoC clears the promoted-quote floor", () => {
    const rows = Array.from({ length: 6 }, () => ({
      promotionStatus: "promoted" as const,
      domain: "g2.com",
    }));

    const result = computeAcquisitionSufficiency(rows, {
      promotedFloor: 6,
      promotedDomainFloor: 3,
    });

    expect(result.tier).toBe("sufficient");
  });

  it("reports sufficient when VoC clears the independent-domain floor even below the quote floor", () => {
    const result = computeAcquisitionSufficiency(
      [
        { promotionStatus: "promoted", domain: "g2.com" },
        { promotionStatus: "promoted", domain: "capterra.com" },
        { promotionStatus: "promoted", domain: "reddit.com" },
        { promotionStatus: "rejected", domain: "trustradius.com" },
      ],
      { promotedFloor: 6, promotedDomainFloor: 3 },
    );

    expect(result.tier).toBe("sufficient");
    expect(result.promoted).toBe(3);
    expect(result.rejected).toBe(1);
    expect(result.candidatesFound).toBe(4);
  });

  it("reports partial for VoC when neither the quote floor nor the domain floor is met", () => {
    const result = computeAcquisitionSufficiency(
      [
        { promotionStatus: "promoted", domain: "g2.com" },
        { promotionStatus: "promoted", domain: "g2.com" },
        { promotionStatus: "rejected", domain: "reddit.com" },
      ],
      { promotedFloor: 6, promotedDomainFloor: 3 },
    );

    expect(result.tier).toBe("partial");
    expect(result.promoted).toBe(2);
  });

  it("does not let a high promotion ratio fabricate sufficiency below the floor", () => {
    // 2/2 promoted = 100% ratio, but only 2 promoted against a floor of 3.
    // Honesty rule: ratio alone never reaches "sufficient".
    const result = computeAcquisitionSufficiency(
      [
        { promotionStatus: "promoted", domain: "g2.com" },
        { promotionStatus: "promoted", domain: "linkedin.com" },
      ],
      { promotedFloor: 3 },
    );

    expect(result.tier).toBe("partial");
  });
});
