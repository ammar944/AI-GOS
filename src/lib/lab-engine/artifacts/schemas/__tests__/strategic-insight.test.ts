import { describe, expect, it } from "vitest";

import {
  validateOrderedStrategicMovesMinimums,
  validateProvesWrongIfMinimums,
  validateStrategicInsightMinimums,
} from "../strategic-insight";

describe("strategic insight validators", (): void => {
  it("rejects vacuous summary-style strategic insight fields", (): void => {
    const errors: string[] = [];

    validateStrategicInsightMinimums(errors, "body.strategicInsight", {
      strategicVerdict: "This section summarizes the market.",
      nonObviousRead: "This section summarizes the market.",
      secondOrderImplication: "This section summarizes the market.",
      keyTension: {
        tension: "This section summarizes the market.",
        side: "This section summarizes the market.",
        costOfPosition: "This section summarizes the market.",
      },
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(" ")).toContain("not a summary/restatement");
  });

  it("rejects repeated generic strategy fills across strategic insight fields", (): void => {
    const errors: string[] = [];
    const generic =
      "The company should focus on the best strategic opportunity to improve messaging and win buyers.";

    validateStrategicInsightMinimums(errors, "body.strategicInsight", {
      strategicVerdict: generic,
      nonObviousRead: generic,
      secondOrderImplication: generic,
      keyTension: {
        tension: generic,
        side: generic,
        costOfPosition: generic,
      },
    });

    expect(errors.join(" ")).toContain("duplicates");
    expect(errors.join(" ")).toContain("not a summary/restatement");
  });

  it("rejects repeated non-generic fills even when the prose is long enough", (): void => {
    const errors: string[] = [];
    const repeated =
      "The buyer should prioritize accountable workflow control before broad automation claims.";

    validateStrategicInsightMinimums(errors, "body.strategicInsight", {
      strategicVerdict: repeated,
      nonObviousRead: repeated,
      secondOrderImplication: repeated,
      keyTension: {
        tension: repeated,
        side: repeated,
        costOfPosition: repeated,
      },
    });

    expect(errors.join(" ")).toContain("duplicates");
  });

  it("permits a single evidence-gap line among distinct strategic fields", (): void => {
    const errors: string[] = [];

    validateStrategicInsightMinimums(errors, "body.strategicInsight", {
      strategicVerdict:
        "The buyer should prioritize accountable workflow control before broad automation claims.",
      nonObviousRead:
        "evidence gap: no public source names the dominant prior tool in this segment.",
      secondOrderImplication:
        "Targeting should weight founder-led operating pain over broad SaaS size filters.",
      keyTension: {
        tension:
          "The buyer wants operating leverage but fears a full RevOps rebuild too early.",
        side:
          "Take the lightweight operating ritual side before selling a system migration.",
        costOfPosition:
          "This gives up broad RevOps accounts to win founder pain earlier.",
      },
    });

    expect(errors).toHaveLength(0);
  });

  it("rejects the same evidence-gap line repeated across strategic fields", (): void => {
    const errors: string[] = [];
    const repeatedGap =
      "evidence gap: no public source names the dominant prior tool in this segment.";

    validateStrategicInsightMinimums(errors, "body.strategicInsight", {
      strategicVerdict:
        "The buyer should prioritize accountable workflow control before broad automation claims.",
      nonObviousRead: repeatedGap,
      secondOrderImplication: repeatedGap,
      keyTension: {
        tension:
          "The buyer wants operating leverage but fears a full RevOps rebuild too early.",
        side:
          "Take the lightweight operating ritual side before selling a system migration.",
        costOfPosition:
          "This gives up broad RevOps accounts to win founder pain earlier.",
      },
    });

    expect(errors).toHaveLength(1);
    expect(errors.join(" ")).toContain(
      "body.strategicInsight.secondOrderImplication: repeats the evidence gap already stated in body.strategicInsight.nonObviousRead",
    );
  });

  it("rejects exact or near restatements of verdict and status summary", (): void => {
    const errors: string[] = [];

    validateStrategicInsightMinimums(
      errors,
      "body.strategicInsight",
      {
        strategicVerdict:
          "The strongest ICP is founder-led B2B SaaS teams with visible sales-operation strain.",
        nonObviousRead:
          "Founder-led teams with sales-operation strain are the strongest ICP.",
        secondOrderImplication:
          "Targeting should weight founder-led operating pain over broad SaaS size filters.",
        keyTension: {
          tension:
            "The buyer wants operating leverage but fears a full RevOps rebuild too early.",
          side:
            "Take the lightweight operating ritual side before selling a system migration.",
          costOfPosition:
            "This gives up broad RevOps accounts to win founder pain earlier.",
        },
      },
      {
        comparisonTexts: [
          "The strongest ICP is founder-led B2B SaaS teams with visible sales-operation strain.",
          "Founder-led SaaS teams show repeated operating strain across public persona and trigger signals.",
        ],
      },
    );

    expect(errors.join(" ")).toContain("strategicVerdict");
    expect(errors.join(" ")).toContain("nonObviousRead");
  });

  it("requires ordered moves to be consecutive with backward-only dependencies", (): void => {
    const errors: string[] = [];

    validateOrderedStrategicMovesMinimums(errors, "body.orderedMoves", [
      {
        rank: 1,
        move: "Start with the highest-information paid test before broad scaling.",
        dependsOn: [2],
        rationale:
          "This should fail because first-ranked moves cannot depend on later moves.",
      },
      {
        rank: 3,
        move: "Scale the best-performing proof path after the first test settles.",
        dependsOn: [1],
        rationale:
          "This should fail because ranks must be consecutive starting at one.",
      },
    ]);

    expect(errors.join(" ")).toContain("consecutive");
    expect(errors.join(" ")).toContain("first-ranked move");
    expect(errors.join(" ")).toContain("lower existing ranks");
  });

  it("accepts concise falsifiability windows while rejecting placeholders", (): void => {
    const acceptedErrors: string[] = [];
    validateProvesWrongIfMinimums(acceptedErrors, "body.provesWrongIf", {
      metric: "qualified demo request rate",
      threshold: "below 2 percent",
      window: "Q1",
    });

    validateProvesWrongIfMinimums(acceptedErrors, "body.provesWrongIf", {
      metric: "qualified demo request rate",
      threshold: "below 2 percent",
      window: "14d",
    });

    const rejectedErrors: string[] = [];
    validateProvesWrongIfMinimums(rejectedErrors, "body.provesWrongIf", {
      metric: "unknown",
      threshold: "n/a",
      window: "none",
    });

    expect(acceptedErrors).toHaveLength(0);
    expect(rejectedErrors).toHaveLength(3);
  });
});
