/**
 * TDD test for the audience↔BuyerICP overlap-threshold tightening.
 *
 * TEST 2: A synthesized/thin audience row that shares ONE incidental token with
 * a BuyerICP persona must NOT be marked status:'grounded' by the evidence pack.
 * The threshold must require ≥2 meaningful shared tokens.
 */

import { describe, expect, it } from "vitest";

import type { ArtifactEnvelope } from "../../artifacts/artifact-envelope";
import { withPaidMediaEvidencePack } from "../paid-media-evidence-pack";

// Minimal BuyerICP body with ONE persona whose name is "Nexus Manager".
// The word "nexus" is the incidental shared token.
function buildBuyerICPBodyWithSingleTokenOverlap(): Record<string, unknown> {
  return {
    personaReality: {
      personas: [
        {
          name: "Nexus Manager",
          title: "Operations Director",
          company: "Acme Corp",
          role: "economic_buyer",
          seniority: "Director",
          evidence:
            "Nexus Manager publicly described the need for better tooling.",
          sourceUrl: "https://example.com/nexus-manager",
        },
      ],
    },
    buyingContext: {
      triggers: [],
    },
    icpExistenceCheck: {
      firmographicCuts: [],
    },
    clusters: {
      venues: [],
    },
  };
}

// A thin audience row that only mentions "nexus" — single incidental overlap.
function buildThinAudienceArtifact(): ArtifactEnvelope {
  return {
    id: "artifact_thin_audience",
    runId: "run_test_001",
    sectionId: "positioningPaidMediaPlan",
    sectionTitle: "Paid Media Plan",
    verdict: "Test verdict",
    statusSummary: "Test summary",
    confidence: 0.5,
    createdAt: "2026-06-19T00:00:00.000Z",
    sources: [{ id: "s1", title: "Source", url: "https://example.com", observedAt: "2026-06-19T00:00:00.000Z" }],
    body: {
      campaignOverview: {
        prose: "Test campaign",
        platform: "Meta Ads",
        monthlyBudget: "$3,000",
        monthlyBudgetValue: 3000,
        monthlyBudgetProvenance: "model-estimated",
        dailySpend: "$100",
        dailySpendValue: 100,
        dailySpendProvenance: "model-estimated",
        totalMonths: 2,
        phaseCount: 1,
        primaryKpi: "MQLs",
      },
      campaignPhases: [
        {
          phaseName: "Phase 1",
          monthsLabel: "Months 1-2",
          monthlyBudget: "$3,000",
          monthlyBudgetValue: 3000,
          monthlyBudgetProvenance: "model-estimated",
          bullets: ["Test bullet one.", "Test bullet two.", "Test bullet three.", "Test bullet four."],
        },
      ],
      // Thin audience row: only mentions "nexus" — 1 incidental shared token.
      audienceTypes: [
        {
          slot: "01",
          archetype: "Nexus network audience",
          dailyBudget: "$100/day",
          dailyBudgetValue: 100,
          dailyBudgetProvenance: "model-estimated",
          detail: "Evidence gap: no real audience data from BuyerICP.",
          sourceSection: "positioningBuyerICP",
          grounding: "Evidence gap: insufficient grounding from upstream.",
        },
      ],
      anglesToTest: [
        {
          shortName: "Pain Angle",
          description: "Address pain points",
          angleType: "PAIN",
          sourceSection: "positioningVoiceOfCustomer",
          grounding: "VoC evidence",
        },
        {
          shortName: "ROI Angle",
          description: "Return on investment",
          angleType: "ROI",
          sourceSection: "positioningVoiceOfCustomer",
          grounding: "VoC evidence",
        },
      ],
      creativeStrategy: {
        prose: "Standard mix",
        staticCount: 5,
        videoCount: 3,
        totalPerAudience: 8,
      },
      creativeFramework: [
        {
          label: "PST 1",
          angleType: "PAIN",
          hook: "Evidence gap: hook missing",
          executesAngle: "Angle 1",
          sourceSection: "positioningVoiceOfCustomer",
          grounding: "Evidence gap: grounding missing",
        },
        {
          label: "PST 2",
          angleType: "ROI",
          hook: "Evidence gap: hook missing",
          executesAngle: "Angle 2",
          sourceSection: "positioningVoiceOfCustomer",
          grounding: "Evidence gap: grounding missing",
        },
        {
          label: "PST 3",
          angleType: "REVIEW",
          hook: "Evidence gap: hook missing",
          executesAngle: "Angle 3",
          sourceSection: "positioningVoiceOfCustomer",
          grounding: "Evidence gap: grounding missing",
        },
      ],
      funnelIdeation: [
        {
          rank: "1 - PRIMARY",
          name: "Direct Response",
          description: "Drive direct signups",
          whatItProves: "Funnel conversion",
        },
      ],
      salesProcess: [
        {
          label: "Sales Process Overview",
          assetType: "gap",
          url: "",
          note: "Evidence gap: asset was not provided.",
        },
      ],
      competitorMarketingInsights: [],
      competitorReviewInsights: [],
      channelSuggestions: [
        {
          channel: "Paid Social",
          recommendation: "Run ads on LinkedIn",
          verdict: "ADD",
          sourceSection: "positioningBuyerICP",
        },
      ],
      projectedResults: [
        {
          targetIcp: "Test ICP",
          kpi: "MQLs",
          kpiCostValue: undefined,
          kpiCostDisplay: "Unknown",
          kpiCostProvenance: "unknown",
          objective: "Test",
          durationLabel: "Phase 1",
          monthlyBudgetValue: 3000,
          monthlyBudgetDisplay: "$3,000",
          monthlyBudgetProvenance: "model-estimated",
        },
      ],
      kpis: [
        {
          metric: "MQLs / Signups",
          role: "Primary outcome",
          definition: "Marketing qualified leads generated per month",
        },
        {
          metric: "CTR",
          role: "Creative health",
          definition: "Click-through rate on ad creatives",
        },
      ],
      crossSectionInsight: [
        {
          tension: "BuyerICP vs VoC gap",
          sourceSections: ["positioningBuyerICP", "positioningVoiceOfCustomer"],
          implicationForPlan: "Evidence gap: plan implication missing.",
          clientBlindSpot: "Evidence gap: blind spot missing.",
          secondOrderRisk: "Evidence gap: second-order risk missing.",
          contrarianInversion: "Evidence gap: contrarian inversion missing.",
        },
      ],
    },
  } as unknown as ArtifactEnvelope;
}

describe("withPaidMediaEvidencePack — overlap threshold tightening", () => {
  it("TEST 2: a thin audience row sharing ONE incidental token with a BuyerICP persona is NOT marked grounded", () => {
    const artifact = buildThinAudienceArtifact();
    const committedArtifacts = {
      positioningBuyerICP: buildBuyerICPBodyWithSingleTokenOverlap(),
    };

    const result = withPaidMediaEvidencePack({ artifact, committedArtifacts });
    const resultBody = result.body as { audienceTypes: Array<{ evidencePack?: { status: string } }> };
    const audienceRow = resultBody.audienceTypes[0];

    // The row's detail/grounding already starts with "Evidence gap:" so it's
    // an honest-gap row — rowIsHonestGap() must skip pack assignment entirely.
    // A gap row must NOT receive status:'grounded'.
    expect(audienceRow?.evidencePack?.status).not.toBe("grounded");
  });

  it("TEST 2b: a real audience row sharing ONLY one incidental non-salient token with a persona is NOT marked grounded", () => {
    // Build an artifact where the audience row is a REAL row (no gap text)
    // but only shares 1 token ("nexus") with the persona.
    const artifact = buildThinAudienceArtifact();
    // Override audienceTypes with a real-looking row that only shares "nexus"
    (artifact.body as Record<string, unknown>).audienceTypes = [
      {
        slot: "01",
        archetype: "Nexus network audience",
        dailyBudget: "$100/day",
        dailyBudgetValue: 100,
        dailyBudgetProvenance: "model-estimated",
        // NOT a gap row — real-looking but only 1 shared token with persona
        detail: "Nexus-adjacent operators who need better tooling.",
        sourceSection: "positioningBuyerICP",
        grounding: "Sourced from BuyerICP section",
      },
    ];

    const committedArtifacts = {
      positioningBuyerICP: buildBuyerICPBodyWithSingleTokenOverlap(),
    };

    const result = withPaidMediaEvidencePack({ artifact, committedArtifacts });
    const resultBody = result.body as { audienceTypes: Array<{ evidencePack?: { status: string } }> };
    const audienceRow = resultBody.audienceTypes[0];

    // With overlap threshold >= 2, a single "nexus" token is NOT sufficient
    // to promote this row to grounded.
    expect(audienceRow?.evidencePack?.status).not.toBe("grounded");
  });

  it("TEST 3: an audience row whose only candidate match is an inference-disclaimed firmographicCut[1] is gap; a clean firmographicCut[0] match still binds grounded", () => {
    // BuyerICP body with TWO firmographicCuts:
    //   [0] clean industry value (grounded, ledger-backable)
    //   [1] inferred employee band carrying disclaimer words — the LOCUS A
    //       guard must refuse to enumerate it so an audience can never bind to
    //       an un-ledger-backable inferred band.
    const committedArtifacts = {
      positioningBuyerICP: {
        personaReality: { personas: [] },
        buyingContext: { triggers: [] },
        clusters: { venues: [] },
        icpExistenceCheck: {
          firmographicCuts: [
            {
              cutType: "industry",
              value: "Technology, ecommerce, professional services",
              source: "G2",
              sourceUrl: "https://example.com/industry",
              dateObserved: "2026-01-01",
            },
            {
              cutType: "headcount",
              value:
                "10-2,000 employees (approximate range, no precise floor/ceiling verified)",
              source: "inferred",
              sourceUrl: "https://example.com/headcount",
              dateObserved: "2026-01-01",
            },
          ],
        },
      },
    };

    // Row A: only overlaps the inference-disclaimed cut[1] (employees +
    // approximate). The guard skips cut[1], so this row must be a gap.
    const gapArtifact = buildThinAudienceArtifact();
    (gapArtifact.body as Record<string, unknown>).audienceTypes = [
      {
        slot: "01",
        archetype: "Mid-market headcount band",
        dailyBudget: "$100/day",
        dailyBudgetValue: 100,
        dailyBudgetProvenance: "model-estimated",
        detail:
          "Targets companies by employees count in the approximate mid-market band.",
        sourceSection: "positioningBuyerICP",
        grounding: "Sized to the employees headcount approximate band.",
      },
    ];

    const gapResult = withPaidMediaEvidencePack({
      artifact: gapArtifact,
      committedArtifacts,
    });
    const gapRow = (gapResult.body as {
      audienceTypes: Array<{ evidencePack?: { status: string } }>;
    }).audienceTypes[0];
    expect(gapRow?.evidencePack?.status).toBe("gap");

    // Row B: overlaps the clean industry cut[0] (technology + ecommerce +
    // professional). The clean cut stays enumerable, so this row binds grounded.
    const groundedArtifact = buildThinAudienceArtifact();
    (groundedArtifact.body as Record<string, unknown>).audienceTypes = [
      {
        slot: "01",
        archetype: "Technology and ecommerce buyers",
        dailyBudget: "$100/day",
        dailyBudgetValue: 100,
        dailyBudgetProvenance: "model-estimated",
        detail:
          "Targets technology, ecommerce and professional services operators.",
        sourceSection: "positioningBuyerICP",
        grounding:
          "Industry cut names technology, ecommerce, professional services.",
      },
    ];

    const groundedResult = withPaidMediaEvidencePack({
      artifact: groundedArtifact,
      committedArtifacts,
    });
    const groundedRow = (groundedResult.body as {
      audienceTypes: Array<{
        evidencePack?: { status: string; refs: Array<{ locator: string }> };
      }>;
    }).audienceTypes[0];
    expect(groundedRow?.evidencePack?.status).toBe("grounded");
    // It binds to the CLEAN cut[0], never the skipped cut[1].
    expect(groundedRow?.evidencePack?.refs[0]?.locator).toBe(
      "body.icpExistenceCheck.firmographicCuts[0]",
    );
  });

  it("TEST 2c: a well-matched audience row sharing 3+ tokens with a persona IS still marked grounded", () => {
    // This is the no-regression path for the overlap fix — real matches
    // with substantial token overlap must still be grounded.
    const artifact = buildThinAudienceArtifact();
    (artifact.body as Record<string, unknown>).audienceTypes = [
      {
        slot: "01",
        archetype: "Dana Ruiz Revenue Operations",
        dailyBudget: "$100/day",
        dailyBudgetValue: 100,
        dailyBudgetProvenance: "model-estimated",
        detail: "Dana Ruiz described messy CRM handoffs slowing campaign launch at VP level.",
        sourceSection: "positioningBuyerICP",
        grounding: "Dana Ruiz VP Revenue Operations sourced from BuyerICP",
      },
    ];

    const committedArtifacts = {
      positioningBuyerICP: {
        personaReality: {
          personas: [
            {
              name: "Dana Ruiz",
              title: "VP Revenue Operations",
              company: "Northwind Logistics",
              role: "economic_buyer",
              seniority: "VP",
              evidence: "Dana Ruiz publicly described messy CRM handoffs slowing campaign launch.",
              sourceUrl: "https://example.com/dana-ruiz",
            },
          ],
        },
        buyingContext: { triggers: [] },
        icpExistenceCheck: { firmographicCuts: [] },
        clusters: { venues: [] },
      },
    };

    const result = withPaidMediaEvidencePack({ artifact, committedArtifacts });
    const resultBody = result.body as { audienceTypes: Array<{ evidencePack?: { status: string } }> };
    const audienceRow = resultBody.audienceTypes[0];

    // "dana", "ruiz", "revenue", "operations" — 4+ shared tokens → grounded.
    expect(audienceRow?.evidencePack?.status).toBe("grounded");
  });
});
