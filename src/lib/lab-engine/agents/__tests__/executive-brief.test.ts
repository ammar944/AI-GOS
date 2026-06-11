import { describe, expect, it } from "vitest";

import type { CrossSectionFactConflict } from "../cross-section-facts";
import {
  runExecutiveBrief,
  type ExecutiveBriefSectionInput,
} from "../executive-brief";
import type { StructuredCaller } from "../section-agent";

const sections: ExecutiveBriefSectionInput[] = [
  {
    body: { categoryDefinition: { prose: "The honest frame is X." } },
    sectionId: "positioningMarketCategory",
    sectionTitle: "Market & Category Intelligence",
    statusSummary: "Category call made.",
    verdict: "Buy traffic on the existing shelf.",
  },
];

const conflicts: CrossSectionFactConflict[] = [
  {
    factKey: "business-plan price",
    readings: [
      {
        context: "Business at $20/seat",
        sectionId: "positioningBuyerICP",
        value: "$20/seat",
      },
      {
        context: "Business tier at $45/seat, scraped",
        sectionId: "positioningCompetitorLandscape",
        value: "$45/seat",
      },
    ],
  },
];

function buildCaller(result: unknown): StructuredCaller {
  return async () => result;
}

describe("runExecutiveBrief", (): void => {
  it("returns the brief with model-resolved conflicts aligned to input conflicts", async (): Promise<void> => {
    const result = await runExecutiveBrief({
      callStructured: buildCaller({
        executiveThesis: "One argument.\n\nSecond paragraph.",
        factConflicts: [
          {
            factKey: "business-plan price",
            resolution:
              "The scraped $45/seat reading wins over the asserted $20.",
            winningSectionId: "positioningCompetitorLandscape",
          },
        ],
        rankedMoves: [
          {
            move: "Launch the comparison campaign.",
            provingSections: ["positioningDemandIntent"],
            rank: 1,
          },
          {
            move: "Fix the demo gate.",
            provingSections: ["positioningOfferDiagnostic"],
            rank: 2,
          },
          {
            move: "Publish the cost-breakdown asset.",
            provingSections: ["positioningVoiceOfCustomer"],
            rank: 3,
          },
          {
            move: "A fourth move that must be dropped.",
            provingSections: [],
            rank: 4,
          },
        ],
      }),
      companyName: "Airtable",
      companyWebsiteUrl: "https://airtable.com",
      conflicts,
      model: {} as never,
      sections,
    });

    expect(result.executiveThesis).toContain("One argument.");
    expect(result.rankedMoves).toHaveLength(3);
    expect(result.rankedMoves.map((move) => move.rank)).toEqual([1, 2, 3]);
    expect(result.factConflicts).toHaveLength(1);
    expect(result.factConflicts[0]?.winningSectionId).toBe(
      "positioningCompetitorLandscape",
    );
    expect(result.factConflicts[0]?.readings).toHaveLength(2);
  });

  it("fills unresolved input conflicts deterministically instead of repairing", async (): Promise<void> => {
    const result = await runExecutiveBrief({
      callStructured: buildCaller({
        executiveThesis: "One argument.",
        factConflicts: [],
        rankedMoves: [
          { move: "Move one.", provingSections: [], rank: 1 },
        ],
      }),
      companyName: "Airtable",
      companyWebsiteUrl: "https://airtable.com",
      conflicts,
      model: {} as never,
      sections,
    });

    expect(result.factConflicts).toHaveLength(1);
    expect(result.factConflicts[0]?.resolution).toContain("unresolved");
    expect(result.factConflicts[0]?.winningSectionId).toBe("");
  });

  it("throws on a non-object result so the route records an error thesis", async (): Promise<void> => {
    await expect(
      runExecutiveBrief({
        callStructured: buildCaller("not an object"),
        companyName: "Airtable",
        companyWebsiteUrl: "https://airtable.com",
        conflicts: [],
        model: {} as never,
        sections,
      }),
    ).rejects.toThrow("non-object");
  });
});
