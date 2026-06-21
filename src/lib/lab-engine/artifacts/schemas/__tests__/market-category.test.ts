import { describe, expect, it } from "vitest";

import { marketCategoryFixtureArtifact } from "../../../fixtures/market-category-artifact";
import {
  marketCategoryBodySchema,
  validateMarketCategoryMinimums,
  type MarketCategoryArtifact,
} from "../market-category";

describe("validateMarketCategoryMinimums — bottom-up TAM recipe", (): void => {
  it("accepts the fixture bottom-up TAM recipe", (): void => {
    const result = validateMarketCategoryMinimums(marketCategoryFixtureArtifact);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts a recipe missing input types and snaps the estimate to directional-only when two or more are absent or gapped", (): void => {
    const artifact: MarketCategoryArtifact = {
      ...marketCategoryFixtureArtifact,
      body: {
        ...marketCategoryFixtureArtifact.body,
        marketSize: {
          ...marketCategoryFixtureArtifact.body.marketSize,
          bottomUpTam: {
            ...marketCategoryFixtureArtifact.body.marketSize.bottomUpTam,
            inputs:
              marketCategoryFixtureArtifact.body.marketSize.bottomUpTam.inputs.filter(
                (input) =>
                  input.inputType !== "acv" &&
                  input.inputType !== "keyword-volume",
              ),
          },
        },
      },
    };

    const result = validateMarketCategoryMinimums(artifact);

    expect(
      result.errors.find((error) => error.includes("missing input types")),
    ).toBeUndefined();

    const reparsedBody = marketCategoryBodySchema.parse(artifact.body);
    expect(reparsedBody.marketSize.bottomUpTam.reachableRevenueEstimate).toBe(
      "directional only — not computed",
    );
  });

  it("rejects a sourced input without a valid source URL", (): void => {
    const [firstInput, ...remainingInputs] =
      marketCategoryFixtureArtifact.body.marketSize.bottomUpTam.inputs;

    if (firstInput === undefined) {
      throw new Error("Expected bottom-up TAM fixture inputs.");
    }

    const artifact: MarketCategoryArtifact = {
      ...marketCategoryFixtureArtifact,
      body: {
        ...marketCategoryFixtureArtifact.body,
        marketSize: {
          ...marketCategoryFixtureArtifact.body.marketSize,
          bottomUpTam: {
            ...marketCategoryFixtureArtifact.body.marketSize.bottomUpTam,
            inputs: [
              {
                ...firstInput,
                sourceUrl: "not-a-url",
              },
              ...remainingInputs,
            ],
          },
        },
      },
    };

    const result = validateMarketCategoryMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("sourceUrl is not a valid URL");
  });

  it("prefixes unlabeled evidence-gap values deterministically instead of rejecting", (): void => {
    const [firstInput, ...remainingInputs] =
      marketCategoryFixtureArtifact.body.marketSize.bottomUpTam.inputs;

    if (firstInput === undefined) {
      throw new Error("Expected bottom-up TAM fixture inputs.");
    }

    const artifact: MarketCategoryArtifact = {
      ...marketCategoryFixtureArtifact,
      body: {
        ...marketCategoryFixtureArtifact.body,
        marketSize: {
          ...marketCategoryFixtureArtifact.body.marketSize,
          bottomUpTam: {
            ...marketCategoryFixtureArtifact.body.marketSize.bottomUpTam,
            inputs: [
              {
                ...firstInput,
                status: "evidence-gap",
                value: "Keyword volume unavailable.",
                sourceUrl: undefined,
              },
              ...remainingInputs,
            ],
          },
        },
      },
    };

    const result = validateMarketCategoryMinimums(artifact);

    expect(result.ok).toBe(true);

    const reparsedBody = marketCategoryBodySchema.parse(artifact.body);
    const gapInput = reparsedBody.marketSize.bottomUpTam.inputs[0];
    expect(gapInput?.value.toLowerCase().startsWith("evidence gap:")).toBe(true);
  });

  it("accepts a computed estimate alongside a single labeled evidence-gap input", (): void => {
    const [firstInput, ...remainingInputs] =
      marketCategoryFixtureArtifact.body.marketSize.bottomUpTam.inputs;

    if (firstInput === undefined) {
      throw new Error("Expected bottom-up TAM fixture inputs.");
    }

    const artifact: MarketCategoryArtifact = {
      ...marketCategoryFixtureArtifact,
      body: {
        ...marketCategoryFixtureArtifact.body,
        marketSize: {
          ...marketCategoryFixtureArtifact.body.marketSize,
          bottomUpTam: {
            ...marketCategoryFixtureArtifact.body.marketSize.bottomUpTam,
            reachableRevenueEstimate: "$1.09M directional reachable revenue.",
            inputs: [
              {
                ...firstInput,
                status: "evidence-gap",
                value: "evidence gap: keyword volume unavailable.",
                sourceUrl: undefined,
              },
              ...remainingInputs,
            ],
          },
        },
      },
    };

    const result = validateMarketCategoryMinimums(artifact);

    expect(result.ok).toBe(true);
  });

  it("accepts the directional-only TAM state when two inputs are evidence gaps", (): void => {
    const [firstInput, secondInput, ...remainingInputs] =
      marketCategoryFixtureArtifact.body.marketSize.bottomUpTam.inputs;

    if (firstInput === undefined || secondInput === undefined) {
      throw new Error("Expected bottom-up TAM fixture inputs.");
    }

    const artifact: MarketCategoryArtifact = {
      ...marketCategoryFixtureArtifact,
      body: {
        ...marketCategoryFixtureArtifact.body,
        marketSize: {
          ...marketCategoryFixtureArtifact.body.marketSize,
          bottomUpTam: {
            ...marketCategoryFixtureArtifact.body.marketSize.bottomUpTam,
            reachableRevenueEstimate: "directional only — not computed",
            inputs: [
              {
                ...firstInput,
                status: "evidence-gap",
                value: "evidence gap: keyword volume unavailable.",
                sourceUrl: undefined,
              },
              {
                ...secondInput,
                status: "evidence-gap",
                value: "evidence gap: commercial intent share unavailable.",
                sourceUrl: undefined,
              },
              ...remainingInputs,
            ],
          },
        },
      },
    };

    const result = validateMarketCategoryMinimums(artifact);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts a market-size block gap without forced bottom-up TAM inputs", (): void => {
    const artifact: MarketCategoryArtifact = {
      ...marketCategoryFixtureArtifact,
      body: {
        ...marketCategoryFixtureArtifact.body,
        marketSize: {
          ...marketCategoryFixtureArtifact.body.marketSize,
          signals: [],
          blockGap: {
            summary:
              "No source-backed market-size signals were retrieved in this run.",
            foundCount: 0,
            requiredCount: 2,
            sourcingPlan: [
              "Run keyword-volume and public funding/hiring checks before estimating market size.",
            ],
          },
          bottomUpTam: {
            ...marketCategoryFixtureArtifact.body.marketSize.bottomUpTam,
            reachableRevenueEstimate: "directional only — not computed",
            inputs: [],
          },
        },
      },
    };

    const result = validateMarketCategoryMinimums(artifact);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("market-category optional honesty fields (additive)", (): void => {
  it("parses the fixture body unchanged when all three fields are omitted (back-compat)", (): void => {
    const body = structuredClone(marketCategoryFixtureArtifact.body);

    const result = marketCategoryBodySchema.safeParse(body);

    expect(result.success).toBe(true);
  });

  it("parses and round-trips confidenceBasis, categoryVerdict, and tamGapPosture when all are set", (): void => {
    const body: MarketCategoryArtifact["body"] = {
      ...structuredClone(marketCategoryFixtureArtifact.body),
      confidenceBasis:
        "Three independent analyst sizings agree within one order of magnitude.",
      categoryVerdict: "create-new-category",
      tamGapPosture:
        "TAM is directional only; treat the sizing as a floor, not a ceiling.",
    };

    const result = marketCategoryBodySchema.safeParse(body);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.confidenceBasis).toBe(
        "Three independent analyst sizings agree within one order of magnitude.",
      );
      expect(result.data.categoryVerdict).toBe("create-new-category");
      expect(result.data.tamGapPosture).toBe(
        "TAM is directional only; treat the sizing as a floor, not a ceiling.",
      );
    }
  });

  it("rejects an out-of-enum categoryVerdict value", (): void => {
    const body = {
      ...structuredClone(marketCategoryFixtureArtifact.body),
      categoryVerdict: "made-up",
    };

    const result = marketCategoryBodySchema.safeParse(body);

    expect(result.success).toBe(false);
  });
});
