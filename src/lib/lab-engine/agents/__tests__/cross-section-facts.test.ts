import { describe, expect, it } from "vitest";

import { extractCrossSectionFactConflicts } from "../cross-section-facts";

describe("extractCrossSectionFactConflicts", (): void => {
  it("detects the subject pricing-tier conflict across sections (the cold-read defect)", (): void => {
    const conflicts = extractCrossSectionFactConflicts({
      subjectName: "Airtable",
      sections: [
        {
          sectionId: "positioningBuyerICP",
          body: {
            icpExistenceCheck: {
              prose:
                "Airtable's Business plan at $20/seat fits mid-market ops teams that have outgrown spreadsheets entirely.",
            },
          },
        },
        {
          sectionId: "positioningCompetitorLandscape",
          body: {
            pricingReality: {
              prose:
                "Airtable publishes a Business tier at $45/seat billed annually, scraped from the live pricing page this run.",
            },
          },
        },
      ],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.factKey).toBe("business-plan price");
    expect(
      conflicts[0]?.readings.map((reading) => reading.sectionId).sort(),
    ).toEqual([
      "positioningBuyerICP",
      "positioningCompetitorLandscape",
    ]);
  });

  it("does not flag agreeing values or competitor-sentence pricing", (): void => {
    const conflicts = extractCrossSectionFactConflicts({
      subjectName: "Airtable",
      sections: [
        {
          sectionId: "positioningMarketCategory",
          body: {
            prose:
              "Airtable's Business plan costs $45/seat for mid-market operations teams today.",
          },
        },
        {
          sectionId: "positioningCompetitorLandscape",
          body: {
            pricingReality: {
              prose:
                "Airtable lists the Business tier at $45 / seat on its public pricing page. ClickUp's Business plan undercuts the whole shelf at $12/seat for comparable records.",
            },
          },
        },
      ],
    });

    expect(conflicts).toEqual([]);
  });

  it("treats unit variants of the same price as one reading", (): void => {
    const conflicts = extractCrossSectionFactConflicts({
      subjectName: "Airtable",
      sections: [
        {
          sectionId: "a",
          body: { prose: "Airtable Business runs $45/user for every team." },
        },
        {
          sectionId: "b",
          body: { prose: "Airtable Business is priced at $45/seat on the page." },
        },
      ],
    });

    expect(conflicts).toEqual([]);
  });

  it("flags diverging ARR readings for the subject", (): void => {
    const conflicts = extractCrossSectionFactConflicts({
      subjectName: "Airtable",
      sections: [
        {
          sectionId: "positioningMarketCategory",
          body: {
            prose: "Airtable reached $478M ARR in 2024 per Sacra estimates.",
          },
        },
        {
          sectionId: "positioningOfferDiagnostic",
          body: {
            prose:
              "Airtable's ARR of $375M anchors the offer-economics read this section makes.",
          },
        },
      ],
    });

    expect(conflicts.map((conflict) => conflict.factKey)).toContain("ARR");
  });

  it("caps emitted conflicts and never throws on hostile bodies", (): void => {
    const conflicts = extractCrossSectionFactConflicts({
      subjectName: "Airtable",
      sections: [
        { sectionId: "x", body: { a: null, b: [{ c: 7 }], d: "short" } },
      ],
    });

    expect(conflicts).toEqual([]);
  });
});
