import { describe, expect, it } from "vitest";

import { reconcileFactLedgerForMemo } from "../contradictions";
import { buildFactLedger, type SynthesisSectionInput } from "../fact-ledger";

const RAMP_SECTIONS: SynthesisSectionInput[] = [
  {
    body: {
      offerSummary:
        "Ramp's core offer has product-market fit: 70,000+ customers and a $13B valuation. The mid-tier plan sits at an ACV of $4,200 and the entry tier lands around $1,500 ACV.",
    },
    sectionId: "positioningOfferDiagnostic",
  },
  {
    body: {
      campaignNote:
        "Average CTR stayed below 0.5% and zero conversions landed after $200 in cumulative ad spend across all non-branded ad groups.",
    },
    sectionId: "positioningDemandIntent",
  },
  {
    body: {
      operatorBudget:
        "The operator runs a $25,000/mo media budget; allocate monthly spend across branded and non-branded channels.",
    },
    sectionId: "positioningMarketCategory",
  },
];

describe("E-ledger contamination (W2)", (): void => {
  it("E1: a billion-dollar valuation never lands as an ACV reading or winner", (): void => {
    const ledger = buildFactLedger({
      sections: RAMP_SECTIONS,
      subjectName: "Ramp",
      subjectWebsiteUrl: "https://ramp.com",
    });
    const acv = ledger.facts.find((fact) => fact.factKey === "acv");

    expect(acv).toBeDefined();
    expect(
      acv?.readings.every(
        (reading) =>
          reading.normalizedValue === undefined ||
          reading.normalizedValue < 1_000_000_000,
      ),
    ).toBe(true);
    expect(
      acv?.winner === undefined ||
        acv.winner.normalizedValue === undefined ||
        acv.winner.normalizedValue < 1_000_000_000,
    ).toBe(true);
  });

  it("E3: the monthly-budget winner is the magnitude-plausible $25,000/mo, not a stray sub-$1000 spend mention", (): void => {
    const ledger = reconcileFactLedgerForMemo(
      buildFactLedger({
        sections: RAMP_SECTIONS,
        subjectName: "Ramp",
        subjectWebsiteUrl: "https://ramp.com",
      }),
    );
    const budget = ledger.facts.find(
      (fact) => fact.factKey === "monthly-budget",
    );

    expect(budget).toBeDefined();
    expect(budget?.winner?.normalizedValue).toBe(25_000);
    expect(
      budget?.readings.every(
        (reading) =>
          reading.normalizedValue === undefined ||
          reading.normalizedValue < 1_000_000_000,
      ),
    ).toBe(true);
  });
});
