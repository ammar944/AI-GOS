import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  creativeTypeValues,
  paidMediaMoneyProvenanceValues,
  paidMediaPlanSectionOutputSchema,
  snapAngleTypesInMix,
  snapCreativeType,
  validatePaidMediaPlanMinimums,
  type PaidMediaPlanArtifact,
} from "../paid-media-plan";
import { paidMediaPlanFixtureArtifact } from "../../../fixtures/paid-media-plan-artifact";

const angleTypesInMixSchema = z.array(z.enum(creativeTypeValues));

function buildPaidMediaPlanOutput(): unknown {
  return {
    sectionTitle: paidMediaPlanFixtureArtifact.sectionTitle,
    verdict: paidMediaPlanFixtureArtifact.verdict,
    statusSummary: paidMediaPlanFixtureArtifact.statusSummary,
    confidence: paidMediaPlanFixtureArtifact.confidence,
    sources: paidMediaPlanFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher ? { publisher: source.publisher } : {}),
    })),
    body: paidMediaPlanFixtureArtifact.body,
  };
}

function cloneFixture(): PaidMediaPlanArtifact {
  return structuredClone(paidMediaPlanFixtureArtifact);
}

function withPaidMediaNumericSiblings(output: unknown): unknown {
  const cloned = structuredClone(output) as Record<string, unknown>;
  const body = cloned.body as Record<string, unknown>;
  const campaignOverview = body.campaignOverview as Record<string, unknown>;
  const campaignPhases = body.campaignPhases as Record<string, unknown>;
  const audienceTypes = body.audienceTypes as Record<string, unknown>;
  const phases = campaignPhases.phases as Array<Record<string, unknown>>;
  const audiences = audienceTypes.audiences as Array<Record<string, unknown>>;

  campaignOverview.monthlyBudgetValue = 3000;
  campaignOverview.dailySpendValue = 100;
  for (const phase of phases) {
    phase.monthlyBudgetValue = 3000;
  }
  for (const audience of audiences) {
    audience.dailyBudgetValue = 33.33;
  }

  return cloned;
}

function withoutPaidMediaNumericSiblings(output: unknown): unknown {
  const cloned = structuredClone(output) as Record<string, unknown>;
  const body = cloned.body as Record<string, unknown>;
  const campaignOverview = body.campaignOverview as Record<string, unknown>;
  const campaignPhases = body.campaignPhases as Record<string, unknown>;
  const audienceTypes = body.audienceTypes as Record<string, unknown>;
  const phases = campaignPhases.phases as Array<Record<string, unknown>>;
  const audiences = audienceTypes.audiences as Array<Record<string, unknown>>;

  delete campaignOverview.monthlyBudgetValue;
  delete campaignOverview.dailySpendValue;
  for (const phase of phases) {
    delete phase.monthlyBudgetValue;
  }
  for (const audience of audiences) {
    delete audience.dailyBudgetValue;
  }

  return cloned;
}

function withUnknownPaidMediaProvenance(output: unknown): unknown {
  const cloned = structuredClone(output) as Record<string, unknown>;
  const body = cloned.body as Record<string, unknown>;
  const campaignOverview = body.campaignOverview as Record<string, unknown>;
  const campaignPhases = body.campaignPhases as Record<string, unknown>;
  const audienceTypes = body.audienceTypes as Record<string, unknown>;
  const phases = campaignPhases.phases as Array<Record<string, unknown>>;
  const audiences = audienceTypes.audiences as Array<Record<string, unknown>>;

  campaignOverview.monthlyBudgetProvenance = "unknown";
  campaignOverview.dailySpendProvenance = "unknown";
  phases[0].monthlyBudgetProvenance = "unknown";
  audiences[0].dailyBudgetProvenance = "unknown";

  return cloned;
}

describe("snapCreativeType", () => {
  it("snaps human-readable label to its slug member", () => {
    expect(snapCreativeType("Unique Selling Point")).toBe(
      "unique-selling-point",
    );
  });

  it("snaps a SCREAMING_SNAKE_CASE value to its slug member", () => {
    expect(snapCreativeType("PROBLEM_SOLUTION_TRANSFORMATION")).toBe(
      "problem-solution-transformation",
    );
  });

  it("falls back to product-demo for an unrecognized value", () => {
    expect(snapCreativeType("testimonial")).toBe("product-demo");
  });

  it("round-trips each canonical enum value unchanged", () => {
    for (const value of creativeTypeValues) {
      expect(snapCreativeType(value)).toBe(value);
    }
  });
});

describe("snapAngleTypesInMix", () => {
  it("snaps every entry to a valid enum member", () => {
    const result = snapAngleTypesInMix([
      "unique-selling-point",
      "User Generated Content",
      "founder talking head",
    ]);

    expect(angleTypesInMixSchema.safeParse(result).success).toBe(true);
  });

  it("produces an array that parses clean against the enum after snapping an out-of-enum value", () => {
    const raw = ["unique-selling-point", "carousel-swipe", "product demo"];
    const snapped = snapAngleTypesInMix(raw);

    const parsed = angleTypesInMixSchema.safeParse(snapped);
    expect(parsed.success).toBe(true);
  });
});

describe("paidMediaPlanSectionOutputSchema", () => {
  it("accepts paid-media numeric budget and spend siblings", () => {
    const output = withPaidMediaNumericSiblings(buildPaidMediaPlanOutput());

    expect(paidMediaPlanSectionOutputSchema.safeParse(output).success).toBe(
      true,
    );
  });

  it("accepts legacy paid-media artifacts without numeric budget and spend siblings", () => {
    const output = withoutPaidMediaNumericSiblings(buildPaidMediaPlanOutput());

    expect(paidMediaPlanSectionOutputSchema.safeParse(output).success).toBe(
      true,
    );
  });

  it("accepts unknown provenance when paid-media numeric siblings are omitted", () => {
    const output = withUnknownPaidMediaProvenance(
      withoutPaidMediaNumericSiblings(buildPaidMediaPlanOutput()),
    );

    expect(paidMediaPlanSectionOutputSchema.safeParse(output).success).toBe(
      true,
    );
  });

  it("requires source urls on funnel and channel recommendations", () => {
    const output = structuredClone(buildPaidMediaPlanOutput()) as Record<
      string,
      unknown
    >;
    const body = output.body as Record<string, unknown>;
    const funnelIdeation = body.funnelIdeation as Record<string, unknown>;
    const channelSuggestions = body.channelSuggestions as Record<
      string,
      unknown
    >;
    const recommendations =
      funnelIdeation.recommendations as Array<Record<string, unknown>>;
    const suggestions =
      channelSuggestions.suggestions as Array<Record<string, unknown>>;
    const recommendation = recommendations[0];
    const suggestion = suggestions[0];

    if (recommendation === undefined || suggestion === undefined) {
      throw new Error("Expected fixture funnel and channel rows.");
    }
    delete recommendation.sourceUrl;
    delete suggestion.sourceUrl;

    const parsed = paidMediaPlanSectionOutputSchema.safeParse(output);

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected missing funnel/channel source URLs to fail.");
    }
    expect(
      parsed.error.issues.map((issue) => issue.path.join(".")),
    ).toEqual(
      expect.arrayContaining([
        "body.funnelIdeation.recommendations.0.sourceUrl",
        "body.channelSuggestions.suggestions.0.sourceUrl",
      ]),
    );
  });

  it("rejects paid-media numeric siblings with unknown provenance at their field paths", () => {
    const output = withUnknownPaidMediaProvenance(
      withPaidMediaNumericSiblings(buildPaidMediaPlanOutput()),
    );

    const parsed = paidMediaPlanSectionOutputSchema.safeParse(output);

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error(
        "Expected unknown-provenance numeric money fields to fail validation.",
      );
    }
    expect(
      parsed.error.issues.map((issue) => issue.path.join(".")),
    ).toEqual(
      expect.arrayContaining([
        "body.campaignOverview.monthlyBudgetValue",
        "body.campaignOverview.dailySpendValue",
        "body.campaignPhases.phases.0.monthlyBudgetValue",
        "body.audienceTypes.audiences.0.dailyBudgetValue",
      ]),
    );
  });

  it("rejects negative paid-media numeric budget and spend siblings at their field paths", () => {
    const output = withPaidMediaNumericSiblings(
      buildPaidMediaPlanOutput(),
    ) as Record<string, unknown>;
    const body = output.body as Record<string, unknown>;
    const campaignOverview = body.campaignOverview as Record<string, unknown>;
    const campaignPhases = body.campaignPhases as Record<string, unknown>;
    const audienceTypes = body.audienceTypes as Record<string, unknown>;
    const phases = campaignPhases.phases as Array<Record<string, unknown>>;
    const audiences = audienceTypes.audiences as Array<Record<string, unknown>>;

    campaignOverview.monthlyBudgetValue = -1;
    campaignOverview.dailySpendValue = -1;
    phases[0].monthlyBudgetValue = -1;
    audiences[0].dailyBudgetValue = -1;

    const parsed = paidMediaPlanSectionOutputSchema.safeParse(output);

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected negative numeric money fields to fail validation.");
    }
    expect(
      parsed.error.issues.map((issue) => issue.path.join(".")),
    ).toEqual(
      expect.arrayContaining([
        "body.campaignOverview.monthlyBudgetValue",
        "body.campaignOverview.dailySpendValue",
        "body.campaignPhases.phases.0.monthlyBudgetValue",
        "body.audienceTypes.audiences.0.dailyBudgetValue",
      ]),
    );
  });

  it("rejects competitor estimated spend numeric siblings", () => {
    const output = structuredClone(buildPaidMediaPlanOutput()) as Record<
      string,
      unknown
    >;
    const body = output.body as Record<string, unknown>;
    const competitorMarketingInsights =
      body.competitorMarketingInsights as Record<string, unknown>;
    const competitors =
      competitorMarketingInsights.competitors as Array<Record<string, unknown>>;

    competitors[0].estSpendValue = 1000;

    const parsed = paidMediaPlanSectionOutputSchema.safeParse(output);

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected competitor estSpendValue to fail validation.");
    }
    expect(
      parsed.error.issues.map((issue) => issue.path.join(".")),
    ).toContain("body.competitorMarketingInsights.competitors.0");
  });

  it("requires provenance labels on every paid-media money field", () => {
    const output = structuredClone(buildPaidMediaPlanOutput()) as Record<
      string,
      unknown
    >;
    const body = output.body as Record<string, unknown>;
    const campaignOverview = body.campaignOverview as Record<string, unknown>;
    const campaignPhases = body.campaignPhases as Record<string, unknown>;
    const audienceTypes = body.audienceTypes as Record<string, unknown>;
    const competitorMarketingInsights =
      body.competitorMarketingInsights as Record<string, unknown>;
    const phases = campaignPhases.phases as Array<Record<string, unknown>>;
    const audiences = audienceTypes.audiences as Array<Record<string, unknown>>;
    const competitors =
      competitorMarketingInsights.competitors as Array<Record<string, unknown>>;

    delete campaignOverview.monthlyBudgetProvenance;
    delete campaignOverview.dailySpendProvenance;
    delete phases[0].monthlyBudgetProvenance;
    delete audiences[0].dailyBudgetProvenance;
    delete competitors[0].estSpendProvenance;

    const parsed = paidMediaPlanSectionOutputSchema.safeParse(output);

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      throw new Error("Expected missing provenance fields to fail validation.");
    }
    expect(
      parsed.error.issues.map((issue) => issue.path.join(".")),
    ).toEqual(
      expect.arrayContaining([
        "body.campaignOverview.monthlyBudgetProvenance",
        "body.campaignOverview.dailySpendProvenance",
        "body.campaignPhases.phases.0.monthlyBudgetProvenance",
        "body.audienceTypes.audiences.0.dailyBudgetProvenance",
        "body.competitorMarketingInsights.competitors.0.estSpendProvenance",
      ]),
    );
  });

  it("accepts the defined paid-media money provenance labels", () => {
    const provenanceSchema = z.enum(paidMediaMoneyProvenanceValues);

    expect(
      paidMediaMoneyProvenanceValues.map((value) =>
        provenanceSchema.parse(value),
      ),
    ).toEqual([
      "user-supplied",
      "tool-measured",
      "source-reported",
      "model-estimated",
      "unknown",
    ]);
    expect(paidMediaPlanSectionOutputSchema.safeParse(buildPaidMediaPlanOutput()).success).toBe(
      true,
    );
  });
});

describe("validatePaidMediaPlanMinimums", () => {
  it("accepts the valid fixture", () => {
    expect(validatePaidMediaPlanMinimums(cloneFixture())).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("rejects creative framework rows missing type-specific copy", () => {
    const artifact = cloneFixture();
    const creative = artifact.body.creativeFramework.creatives[0];

    if (creative === undefined) {
      throw new Error("Expected fixture creative.");
    }
    delete creative.uspSentence;

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "body.creativeFramework.creatives[0].uspSentence",
        ),
      ]),
    );
  });

  it("rejects unreconciled audience spend math", () => {
    const artifact = cloneFixture();
    const audience = artifact.body.audienceTypes.audiences[0];

    if (audience === undefined) {
      throw new Error("Expected fixture audience.");
    }
    audience.dailyBudgetValue = 20;

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("body.audienceTypes.audiences"),
      ]),
    );
  });

  it("rejects brand-only competitor claims without operational signals", () => {
    const artifact = cloneFixture();
    const reviewInsight = artifact.body.competitorReviewInsights.insights[0];
    const marketingInsight =
      artifact.body.competitorMarketingInsights.competitors[0];

    if (reviewInsight === undefined || marketingInsight === undefined) {
      throw new Error("Expected fixture competitor insights.");
    }
    reviewInsight.competitor = "Acme CRM";
    reviewInsight.verbatimComplaint = "Acme CRM feels better than others.";
    reviewInsight.adLeverage = "Make the ad say Acme CRM is easier.";
    marketingInsight.competitor = "Acme CRM";
    marketingInsight.messaging = "Acme CRM is easy to use.";
    marketingInsight.adPlatforms = [];
    marketingInsight.estSpend = "not publicly disclosed";
    marketingInsight.icpTargeted = "teams";
    marketingInsight.anglesTested = "ease";
    marketingInsight.positioningClaim = "easy software";
    marketingInsight.offer = "demo";

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "body.competitorReviewInsights.insights[0]",
        ),
        expect.stringContaining(
          "body.competitorMarketingInsights.competitors[0]",
        ),
      ]),
    );
  });

  it("rejects funnel recommendations without buyer and stage context", () => {
    const artifact = cloneFixture();
    const recommendation = artifact.body.funnelIdeation.recommendations[0];

    if (recommendation === undefined) {
      throw new Error("Expected fixture funnel recommendation.");
    }
    recommendation.recommendation = "Use a landing page.";
    recommendation.optInToBookedCall = "Book a call.";

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "body.funnelIdeation.recommendations[0].recommendation",
        ),
        expect.stringContaining(
          "body.funnelIdeation.recommendations[0].optInToBookedCall",
        ),
      ]),
    );
  });

  it("rejects channel suggestions without concrete assets or actions", () => {
    const artifact = cloneFixture();
    const suggestion = artifact.body.channelSuggestions.suggestions[0];

    if (suggestion === undefined) {
      throw new Error("Expected fixture channel suggestion.");
    }
    suggestion.observation = "The market is attractive.";
    suggestion.recommendation = "Improve performance.";

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "body.channelSuggestions.suggestions[0].recommendation",
        ),
      ]),
    );
  });

  it("rejects thesis source refs that do not span two distinct sections", () => {
    const artifact = cloneFixture();
    artifact.body.strategicThesis.sourceSections = [
      {
        sourceSection: "positioningVoiceOfCustomer",
        sourceUrl: "https://example.com/paid-media/source-1",
      },
      {
        sourceSection: "positioningVoiceOfCustomer",
        sourceUrl: "https://example.com/paid-media/source-2",
      },
    ];

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.includes("strategicThesis.sourceSections"),
      ),
    ).toBe(true);
  });

  it("rejects ordered moves with non-consecutive ranks and forward dependencies", () => {
    const artifact = cloneFixture();
    artifact.body.orderedMoves.moves[1].rank = 4;
    artifact.body.orderedMoves.moves[1].dependsOn = [3];

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) => error.includes("consecutive starting at 1")),
    ).toBe(true);
    expect(
      result.errors.some((error) =>
        error.includes("dependencies must point to earlier ranks"),
      ),
    ).toBe(true);
  });

  it("rejects ordered moves without a specific thesis trace", () => {
    const artifact = cloneFixture();
    artifact.body.orderedMoves.moves[0].thesisTrace = "better positioning";

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) => error.includes("thesisTrace")),
    ).toBe(true);
  });

  it("rejects placeholder kill criteria on ordered moves", () => {
    const artifact = cloneFixture();
    artifact.body.orderedMoves.moves[0].provesWrongIf = {
      metric: "unknown",
      threshold: "n/a",
      window: "none",
    };

    const result = validatePaidMediaPlanMinimums(artifact);

    expect(result.ok).toBe(false);
    expect(
      result.errors.filter((error) => error.includes("provesWrongIf")).length,
    ).toBeGreaterThanOrEqual(3);
  });
});
