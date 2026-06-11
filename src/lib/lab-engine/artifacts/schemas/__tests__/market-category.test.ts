import { describe, expect, it } from "vitest";

import { marketCategoryFixtureArtifact } from "../../../fixtures/market-category-artifact";
import {
  validateMarketCategoryMinimums,
  type MarketCategoryArtifact,
} from "../market-category";

describe("validateMarketCategoryMinimums — bottom-up TAM recipe", (): void => {
  it("accepts the fixture bottom-up TAM recipe", (): void => {
    const result = validateMarketCategoryMinimums(marketCategoryFixtureArtifact);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a recipe missing a required input type", (): void => {
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
                (input) => input.inputType !== "acv",
              ),
          },
        },
      },
    };

    const result = validateMarketCategoryMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("missing input types acv");
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

  it("requires evidence-gap inputs to label the gap in the value", (): void => {
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

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "evidence-gap inputs must name the evidence gap",
    );
  });

  it("rejects a numeric reachable-revenue estimate when any input is an evidence gap", (): void => {
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

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain(
      "reachableRevenueEstimate: must state an evidence gap",
    );
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
