import { describe, expect, it, vi } from "vitest";

import { POSITIONING_SECTION_IDS } from "@/lib/ai/prompts/positioning-skills";
import {
  artifactEnvelopeSchema,
  researchInputSchema,
  type ArtifactEnvelope,
  type ResearchInput,
} from "@/lib/lab-engine/artifacts/artifact-envelope";
import { paidMediaPlanFixtureArtifact } from "@/lib/lab-engine/fixtures/paid-media-plan-artifact";
import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";

import {
  composeJudgeAbortSignal,
  deterministicPlanPass,
  extractPlanClaims,
  verifyPaidMediaPlan,
  type PlanClaim,
  type PlanClaimJudge,
} from "../claim-source-verifier";

type VerifierSections = Parameters<typeof deterministicPlanPass>[1];

function longSectionText(label: string, extra = ""): string {
  return [
    `${label} section evidence starts here with enough words to exceed the verifier empty-section threshold.`,
    "The source text includes concrete GTM observations, buyer language, competitor positioning, demand constraints, and offer tradeoffs.",
    "These sentences are intentionally stable fixture markdown for deterministic verifier tests and do not require external model calls.",
    extra,
  ].join(" ");
}

function buildSections(
  overrides: Partial<Record<(typeof POSITIONING_SECTION_IDS)[number], string>> = {},
): VerifierSections {
  return Object.fromEntries(
    POSITIONING_SECTION_IDS.map((zone) => [
      zone,
      overrides[zone] ?? longSectionText(zone),
    ]),
  ) as VerifierSections;
}

function buildResearchInput(sections = buildSections()): ResearchInput {
  return researchInputSchema.parse({
    ...saaslaunchResearchInput,
    committedPositioningArtifacts: Object.fromEntries(
      POSITIONING_SECTION_IDS.map((zone) => [
        zone,
        {
          sectionId: zone,
          body: { markdown: sections[zone] },
        },
      ]),
    ),
    committedPositioningSectionMarkdown: sections,
  });
}

function buildArtifact(body: Record<string, unknown>): ArtifactEnvelope {
  return artifactEnvelopeSchema.parse({
    ...paidMediaPlanFixtureArtifact,
    body,
  });
}

function buildAngleClaimBody(
  sourceSection = "positioningMarketCategory",
): Record<string, unknown> {
  return {
    anglesToTest: [
      {
        shortName: "Founder proof",
        description:
          "Use founder-led weekly pipeline review as the paid media wedge.",
        angleType: "operator-proof",
        sourceSection,
        grounding:
          "Founder-led weekly pipeline review is cited in the source section.",
      },
    ],
  };
}

describe("extractPlanClaims", (): void => {
  it("extracts W4 gated paid-media fields", (): void => {
    const claims = extractPlanClaims({
      campaignOverview: {
        prose: "Launch a Meta-first test with a narrow founder-led sales wedge.",
        primaryKpi: "Pipeline-qualified demos",
      },
      crossSectionInsight: [
        {
          tension: "The buyer wants proof but competitors sell automation volume.",
          sourceSections: [
            "positioningBuyerICP",
            "positioningOfferDiagnostic",
          ],
          implicationForPlan: "Lead with proof of weekly behavior change.",
          clientBlindSpot: "The plan should not imply fully autonomous revenue.",
          secondOrderRisk: "Overclaiming automation could weaken trust.",
          contrarianInversion: "Sell disciplined founder control, not hands-off AI.",
        },
      ],
      audienceTypes: [
        {
          archetype: "Founder",
          detail: "Founder-led SaaS teams running weekly pipeline reviews.",
          sourceSection: "positioningBuyerICP",
          grounding: "Buyer ICP names founder-led SaaS teams.",
        },
      ],
      channelSuggestions: [
        {
          channel: "Meta",
          recommendation: "Use Meta only for founder proof creative testing.",
          verdict: "ADD",
          sourceSection: "positioningDemandIntent",
        },
      ],
    });

    expect(claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "campaignOverview.prose",
          kind: "campaignOverview",
          sourceSection: "gtmBrief",
        }),
        expect.objectContaining({
          id: "crossSectionInsight[0].clientBlindSpot",
          kind: "crossSectionInsight.clientBlindSpot",
        }),
        expect.objectContaining({
          id: "crossSectionInsight[0].secondOrderRisk",
          kind: "crossSectionInsight.secondOrderRisk",
        }),
        expect.objectContaining({
          id: "crossSectionInsight[0].contrarianInversion",
          kind: "crossSectionInsight.contrarianInversion",
        }),
        expect.objectContaining({
          id: "audienceTypes[0].Founder",
          kind: "audienceTypes.detail",
        }),
        expect.objectContaining({
          id: "channelSuggestions[0].Meta",
          kind: "channelSuggestions.recommendation",
        }),
      ]),
    );
  });
});

describe("deterministicPlanPass", (): void => {
  it("excludes gtmBrief before invalid-enum validation", (): void => {
    const result = deterministicPlanPass(
      [
        {
          id: "campaignOverview.prose",
          kind: "campaignOverview",
          text: "Launch a Meta-first test from the GTM brief.",
          grounding: "The GTM brief says Meta is the first paid channel.",
          sourceSection: "gtmBrief",
        },
      ],
      buildSections(),
    );

    expect(result.verdicts).toHaveLength(0);
    expect(result.needJudge).toHaveLength(1);
  });

  it("hard-flags invalid source sections and empty cited sections", (): void => {
    const invalid = deterministicPlanPass(
      [
        {
          id: "angle.invalid",
          kind: "anglesToTest",
          text: "Use founder-led proof.",
          grounding: "Grounded elsewhere.",
          sourceSection: "positioningCrossSectionReasoning",
        },
      ],
      buildSections(),
    );
    const empty = deterministicPlanPass(
      [
        {
          id: "angle.empty",
          kind: "anglesToTest",
          text: "Use founder-led proof.",
          grounding: "Grounded in the cited section.",
          sourceSection: "positioningBuyerICP",
        },
      ],
      buildSections({ positioningBuyerICP: "too short" }),
    );

    expect(invalid.verdicts[0]).toEqual(
      expect.objectContaining({ flag: "INVALID_ENUM" }),
    );
    expect(empty.verdicts[0]).toEqual(
      expect.objectContaining({ flag: "EMPTY_SECTION_CITATION" }),
    );
  });

  it("hard-flags fabricated competitor review quotes", (): void => {
    const result = deterministicPlanPass(
      [
        {
          id: "review.quote",
          kind: "competitorReviewInsights",
          text: 'A buyer said "the onboarding experience was painfully slow".',
          grounding: "Cited review complaint.",
          sourceSection: "positioningCompetitorLandscape",
        },
      ],
      buildSections(),
    );

    expect(result.verdicts[0]).toEqual(
      expect.objectContaining({ flag: "FABRICATED_QUOTE" }),
    );
  });
});

describe("verifyPaidMediaPlan", (): void => {
  it("surfaces distinctive count misattribution as needs_review (verifier never hard-fails)", async (): Promise<void> => {
    const sections = buildSections({
      positioningBuyerICP: longSectionText(
        "positioningBuyerICP",
        "The buyer pool includes exactly 987654 qualified founder-led teams.",
      ),
      positioningMarketCategory: longSectionText("positioningMarketCategory"),
    });
    const result = await verifyPaidMediaPlan({
      artifact: buildArtifact({
        anglesToTest: [
          {
            shortName: "Wrong count",
            description: "Target the 987654 founder-led team segment.",
            sourceSection: "positioningMarketCategory",
            grounding: "The cited section says 987654 founder-led teams.",
          },
        ],
      }),
      researchInput: buildResearchInput(sections),
      judge: vi.fn<PlanClaimJudge>(async () => ({
        byId: new Map(),
        finishReason: "stop",
      })),
    });

    expect(result.hardFail).toBe(false);
    expect(result.needsReview).toBe(true);
    expect(result.summary.needsReviewIds).toContain(result.verdicts[0]?.id);
    expect(result.verdicts[0]).toEqual(
      expect.objectContaining({ flag: "MIS_ATTRIBUTION", by: "deterministic" }),
    );
  });

  it("commits-with-badge on a deterministic FABRICATED_QUOTE instead of hard-failing (ARI; the false-hard-fail regression)", async (): Promise<void> => {
    // Root-cause regression guard: a fabricated/unverifiable quote must surface in
    // the needs_review badge, NOT kill the section. (Live run 73dfbc0d hard-failed
    // because a judge — blind to 87% of the clipped VoC source — false-flagged a
    // real quote as FABRICATED_QUOTE, and FABRICATED_QUOTE used to hard-fail.)
    const result = await verifyPaidMediaPlan({
      artifact: buildArtifact({
        competitorReviewInsights: [
          {
            complaint:
              'A buyer said "this exact phrase appears in no provided section".',
            howWeLeverage: "Lead with the opposite promise in creative.",
            sourceSection: "positioningCompetitorLandscape",
            grounding: "Cited competitor review complaint.",
          },
        ],
      }),
      researchInput: buildResearchInput(),
      judge: vi.fn<PlanClaimJudge>(async () => ({
        byId: new Map(),
        finishReason: "stop",
      })),
    });

    expect(result.hardFail).toBe(false);
    expect(result.needsReview).toBe(true);
    const fabricated = result.verdicts.find(
      (verdict) => verdict.flag === "FABRICATED_QUOTE",
    );
    expect(fabricated).toBeDefined();
    expect(result.summary.needsReviewIds).toContain(fabricated?.id);
    expect(result.summary.hardFailIds).toHaveLength(0);
  });

  it("keeps judge-layer semantic flags as needs_review", async (): Promise<void> => {
    const claimBody = buildAngleClaimBody();
    const judge = vi.fn<PlanClaimJudge>(async ({ batch }) => ({
      byId: new Map(
        batch.map((claim: PlanClaim) => [
          claim.id,
          {
            id: claim.id,
            flag: "FABRICATION",
            reason: "The claimed mechanism is not in the cited section.",
          },
        ]),
      ),
      finishReason: "stop",
    }));

    const result = await verifyPaidMediaPlan({
      artifact: buildArtifact(claimBody),
      researchInput: buildResearchInput(),
      judge,
    });

    expect(result.hardFail).toBe(false);
    expect(result.needsReview).toBe(true);
    expect(result.summary.needsReviewIds).toEqual(["anglesToTest[0].Founder proof"]);
  });

  it("turns missing judge verdicts into VERIFIER_ERROR after retry", async (): Promise<void> => {
    const judge = vi.fn<PlanClaimJudge>(async () => ({
      byId: new Map(),
      finishReason: "length",
    }));

    const result = await verifyPaidMediaPlan({
      artifact: buildArtifact(buildAngleClaimBody()),
      researchInput: buildResearchInput(),
      judge,
    });

    expect(judge).toHaveBeenCalledTimes(2);
    expect(judge.mock.calls[0]?.[0].maxOutputTokens).toBe(16_384);
    expect(judge.mock.calls[1]?.[0].maxOutputTokens).toBe(24_576);
    // VERIFIER_ERROR (judge truncation/timeout) is NOT a confirmed fabrication —
    // it commits-with-honest-badge (ARI), it does not hard-fail the section.
    expect(result.hardFail).toBe(false);
    expect(result.needsReview).toBe(true);
    expect(result.summary.verifierErrors).toBeGreaterThan(0);
    expect(result.verdicts[0]).toEqual(
      expect.objectContaining({ flag: "VERIFIER_ERROR", by: "judge" }),
    );
  });

  it("turns unsupported judge flags into VERIFIER_ERROR", async (): Promise<void> => {
    const judge = vi.fn<PlanClaimJudge>(async ({ batch }) => ({
      byId: new Map(
        batch.map((claim: PlanClaim) => [
          claim.id,
          {
            id: claim.id,
            flag: "MAYBE",
            reason: "Unsupported verifier enum.",
          },
        ]),
      ),
      finishReason: "stop",
    }));

    const result = await verifyPaidMediaPlan({
      artifact: buildArtifact(buildAngleClaimBody()),
      researchInput: buildResearchInput(),
      judge,
    });

    expect(result.hardFail).toBe(false);
    expect(result.needsReview).toBe(true);
    expect(result.verdicts[0]).toEqual(
      expect.objectContaining({ flag: "VERIFIER_ERROR", by: "judge" }),
    );
  });

  it("runs judge chunks concurrently rather than sequentially", async (): Promise<void> => {
    let inFlight = 0;
    let maxInFlight = 0;
    const judge = vi.fn<PlanClaimJudge>(async ({ batch }) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return {
        byId: new Map(
          batch.map((claim: PlanClaim) => [
            claim.id,
            { id: claim.id, flag: "PASS", reason: "supported" },
          ]),
        ),
        finishReason: "stop",
      };
    });

    // 10 distinct angle claims -> two judge chunks (size 8) that must overlap.
    const result = await verifyPaidMediaPlan({
      artifact: buildArtifact({
        anglesToTest: Array.from({ length: 10 }, (_unused, index) => ({
          shortName: `Concurrent angle ${index}`,
          description: `Distinct load-bearing paid-media angle number ${index} about the founder-led category wedge.`,
          angleType: "operator-proof",
          sourceSection: "positioningMarketCategory",
          grounding: "Supported by the market category section evidence.",
        })),
      }),
      researchInput: buildResearchInput(),
      judge,
    });

    expect(judge).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBeGreaterThanOrEqual(2);
    expect(result.hardFail).toBe(false);
  });
});

describe("composeJudgeAbortSignal", (): void => {
  it("applies a per-call timeout even when a never-aborting parent signal is provided", (): void => {
    const parent = new AbortController().signal;
    const composed = composeJudgeAbortSignal(parent);

    // Must NOT pass the bare unbounded parent through (that was the regression).
    expect(composed).not.toBe(parent);
    expect(composed.aborted).toBe(false);
  });

  it("still aborts immediately when the parent (job) signal is already aborted", (): void => {
    const composed = composeJudgeAbortSignal(AbortSignal.abort());

    expect(composed.aborted).toBe(true);
  });

  it("returns a timeout-backed signal when no parent signal is provided", (): void => {
    const composed = composeJudgeAbortSignal(undefined);

    expect(composed).toBeInstanceOf(AbortSignal);
    expect(composed.aborted).toBe(false);
  });
});
