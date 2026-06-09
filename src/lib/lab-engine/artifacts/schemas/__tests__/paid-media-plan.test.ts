import { describe, expect, it } from "vitest";
import { z } from "zod";

import { paidMediaPlanFixtureArtifact } from "../../../fixtures/paid-media-plan-artifact";
import {
  normalizePaidMediaPlanBody,
  paidMediaMoneyProvenanceValues,
  paidMediaPlanBodySchema,
  paidMediaPlanSectionOutputSchema,
  snapSourceSection,
  validatePaidMediaPlanMinimums,
  type PaidMediaPlanArtifact,
} from "../paid-media-plan";

function buildPaidMediaPlanOutput(): Record<string, unknown> {
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
    body: structuredClone(paidMediaPlanFixtureArtifact.body),
  };
}

function cloneFixture(): PaidMediaPlanArtifact {
  return structuredClone(paidMediaPlanFixtureArtifact);
}

describe("snapSourceSection", () => {
  it("snaps common aliases to canonical source sections", () => {
    expect(snapSourceSection("positioningVoC")).toBe("positioningVoiceOfCustomer");
    expect(snapSourceSection("buyer-icp")).toBe("positioningBuyerICP");
    expect(snapSourceSection("offer diagnostic")).toBe(
      "positioningOfferDiagnostic",
    );
  });

  it("snaps unknown legacy sources to the GTM brief fallback", () => {
    expect(snapSourceSection("legacy-thinker")).toBe("gtmBrief");
  });
});

describe("paidMediaPlanSectionOutputSchema", () => {
  it("accepts the lean paid-media output fixture", () => {
    const parsed = paidMediaPlanSectionOutputSchema.safeParse(
      buildPaidMediaPlanOutput(),
    );

    expect(parsed.success).toBe(true);
  });

  it("strips unknown body keys instead of failing the commit path", () => {
    const output = buildPaidMediaPlanOutput();
    const body = output.body as Record<string, unknown>;
    const campaignOverview = body.campaignOverview as Record<string, unknown>;

    body.strategicThesis = { stale: true };
    body.orderedMoves = { stale: true };
    campaignOverview.unexpected = "strip me";

    const parsed = paidMediaPlanSectionOutputSchema.parse(output);
    const parsedBody = parsed.body as Record<string, unknown>;
    const parsedCampaignOverview = parsedBody.campaignOverview as Record<
      string,
      unknown
    >;

    expect(parsedBody).not.toHaveProperty("strategicThesis");
    expect(parsedBody).not.toHaveProperty("orderedMoves");
    expect(parsedCampaignOverview).not.toHaveProperty("unexpected");
  });

  it("keeps money provenance as free strings while documenting snap targets", () => {
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

    const output = buildPaidMediaPlanOutput();
    const body = output.body as Record<string, unknown>;
    const overview = body.campaignOverview as Record<string, unknown>;
    overview.monthlyBudgetProvenance = "client-note";

    expect(paidMediaPlanSectionOutputSchema.safeParse(output).success).toBe(
      true,
    );
  });
});

describe("normalizePaidMediaPlanBody", () => {
  it("pads and truncates fixed-count arrays without throwing", () => {
    const rawBody = structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;

    rawBody.campaignPhases = [];
    rawBody.audienceTypes = [
      {
        slot: "01",
        archetype: "Interest Stack",
        dailyBudget: "$33/day",
        dailyBudgetProvenance: "customer",
        dailyBudgetValue: 33,
        detail: "Founder-led SaaS operators",
        sourceSection: "positioningVoC",
        grounding: "VoC says operators need proof.",
      },
    ];
    rawBody.anglesToTest = getRepeatedRows(rawBody.anglesToTest, 6);
    rawBody.creativeFramework = getRepeatedRows(rawBody.creativeFramework, 10);
    rawBody.funnelIdeation = [];
    rawBody.competitorReviewInsights = [];
    rawBody.channelSuggestions = [
      {
        channel: "Website",
        recommendation: "Rewrite the hero CTA around the audit proof.",
        verdict: "start",
        sourceSection: "offer diagnostic",
      },
    ];
    rawBody.kpis = [];

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(normalized.campaignPhases).toHaveLength(2);
    expect(normalized.audienceTypes).toHaveLength(3);
    expect(normalized.anglesToTest).toHaveLength(4);
    expect(normalized.creativeFramework).toHaveLength(8);
    expect(normalized.funnelIdeation).toHaveLength(3);
    expect(normalized.competitorReviewInsights).toHaveLength(3);
    expect(normalized.channelSuggestions).toHaveLength(4);
    expect(normalized.kpis).toHaveLength(3);
    expect(normalized.audienceTypes[0]?.sourceSection).toBe(
      "positioningVoiceOfCustomer",
    );
    expect(normalized.audienceTypes[0]?.dailyBudgetProvenance).toBe(
      "user-supplied",
    );
    expect(normalized.channelSuggestions[0]?.verdict).toBe("ADD");
  });

  it("accepts old wrapped arrays during rollout and emits the lean shape", () => {
    const rawBody = structuredClone(paidMediaPlanFixtureArtifact.body) as Record<
      string,
      unknown
    >;
    rawBody.campaignPhases = {
      phases: paidMediaPlanFixtureArtifact.body.campaignPhases,
      prose: "legacy wrapper",
    };
    rawBody.audienceTypes = {
      audiences: paidMediaPlanFixtureArtifact.body.audienceTypes,
      prose: "legacy wrapper",
    };
    rawBody.anglesToTest = {
      angles: paidMediaPlanFixtureArtifact.body.anglesToTest,
      prose: "legacy wrapper",
    };

    const normalized = normalizePaidMediaPlanBody(rawBody);

    expect(Array.isArray(normalized.campaignPhases)).toBe(true);
    expect(Array.isArray(normalized.audienceTypes)).toBe(true);
    expect(Array.isArray(normalized.anglesToTest)).toBe(true);
    expect(paidMediaPlanBodySchema.safeParse(normalized).success).toBe(true);
  });
});

describe("validatePaidMediaPlanMinimums", () => {
  it("accepts the normalized fixture without strategic capstone fields", () => {
    const artifact = cloneFixture();

    expect(validatePaidMediaPlanMinimums(artifact)).toEqual({
      ok: true,
      errors: [],
    });
  });
});

function getRepeatedRows(value: unknown, count: number): unknown[] {
  const source = Array.isArray(value) ? value : [];
  const first = source[0] ?? {};

  return Array.from({ length: count }, () => structuredClone(first));
}
