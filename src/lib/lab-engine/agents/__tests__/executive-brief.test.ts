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

  it("threads verification tier and confidence into the prompt with the directional rule", async (): Promise<void> => {
    const captured: Array<{ instructions?: string; prompt?: string }> = [];
    const caller: StructuredCaller = async (params) => {
      captured.push({
        instructions: (params as { instructions?: string }).instructions,
        prompt: (params as { prompt?: string }).prompt,
      });
      return {
        executiveThesis: "One argument.",
        factConflicts: [],
        rankedMoves: [{ move: "Move one.", provingSections: [], rank: 1 }],
      };
    };

    await runExecutiveBrief({
      callStructured: caller,
      companyName: "Airtable",
      companyWebsiteUrl: "https://airtable.com",
      conflicts: [],
      model: {} as never,
      sections: [
        {
          ...sections[0],
          verificationTier: "insufficient",
          verificationConfidence: 0.4,
        },
        {
          body: { buyerMap: { prose: "Buyer map." } },
          sectionId: "positioningBuyerICP",
          sectionTitle: "Buyer & ICP Validation",
          statusSummary: "Buyers validated.",
          verdict: "Target the ops lead.",
        },
      ],
    });

    const prompt = captured[0]?.prompt ?? "";
    const instructions = captured[0]?.instructions ?? "";
    expect(prompt).toContain("verification: insufficient (confidence 0.40)");
    // Sections without DB context degrade honestly to unknown, not verified.
    expect(prompt).toContain("verification: unknown");
    expect(instructions).toContain("'directional'");
    expect(instructions).toContain("needs_review or insufficient");
  });

  it("refuses to write a brief from zero committed sections", async (): Promise<void> => {
    await expect(
      runExecutiveBrief({
        callStructured: buildCaller({}),
        companyName: "Airtable",
        companyWebsiteUrl: "https://airtable.com",
        conflicts: [],
        model: {} as never,
        sections: [],
      }),
    ).rejects.toThrow("refusing to write from nothing");
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
