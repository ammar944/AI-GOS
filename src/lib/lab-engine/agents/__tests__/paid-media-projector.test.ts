import { describe, expect, it, vi } from "vitest";

import {
  projectPaidMediaPlan,
  type PaidMediaProjectGenerateFn,
} from "../paid-media-projector";

// A roughly-shaped deck body the injected generate fn returns. It is NOT
// schema-perfect — it carries the kind of drift the live GLM produces (aliased
// keys, wrapper objects, overshoot) so the test proves the projector + the
// tolerant decoder (normalizePaidMediaPlanBody) cooperate, mirroring the
// composer's existing decode tests.
const PROJECTED_DECK = {
  campaignOverview: {
    prose: "Lead with proof — 30s teardowns of real revenue-team workflows.",
    platform: "LinkedIn Ads",
    monthlyBudget: "$12,000/month",
    monthlyBudgetProvenance: "user-supplied",
    dailySpend: "$400/day",
    dailySpendProvenance: "derived",
    totalMonths: 4,
    phaseCount: 2,
    primaryKpi: "Qualified demos booked",
  },
  campaignPhases: [
    {
      phaseName: "Phase 1 - Testing",
      monthsLabel: "Months 1-2",
      monthlyBudget: "$6,000/month",
      monthlyBudgetProvenance: "user-supplied",
      bullets: ["Test 3 audiences in parallel.", "Validate creative angles."],
    },
  ],
  audienceTypes: [
    {
      slot: "01",
      archetype: "RevOps leaders",
      dailyBudget: "$200/day",
      dailyBudgetProvenance: "derived",
      detail: "Revenue ops leaders at venture-backed SaaS.",
      sourceSection: "positioningBuyerICP",
      grounding: "ICP section named RevOps as the primary buyer.",
    },
  ],
  anglesToTest: [
    {
      shortName: "Speed-to-close",
      description: "Position the product as the fastest path from demo to closed-won.",
      angleType: "pain-point",
      sourceSection: "positioningVoiceOfCustomer",
      grounding: "VoC quote: 'switching took 6 months'.",
    },
    {
      shortName: "Audit-ready by default",
      description: "Frame the product as the SOC2-friendly option.",
      angleType: "trust",
      sourceSection: "positioningCompetitorLandscape",
      grounding: "Competitor reviews cited weak compliance.",
    },
  ],
  creativeStrategy: { prose: "Lead with proof — 30s teardowns and named outcomes." },
  creativeFramework: [
    {
      label: "PST 1",
      angleType: "pain-point",
      hook: "30s teardown of a real revenue workflow",
      executesAngle: "Speed-to-close",
      sourceSection: "positioningVoiceOfCustomer",
      grounding: "VoC switching-story quote.",
    },
    {
      label: "Objection 1",
      angleType: "trust",
      hook: "SOC2 in week one, not month six",
      executesAngle: "Audit-ready by default",
      sourceSection: "positioningCompetitorLandscape",
      grounding: "Competitor review complaint.",
    },
    {
      label: "USP",
      angleType: "trust",
      hook: "The only API-first support built for B2B",
      executesAngle: "Audit-ready by default",
      sourceSection: "positioningMarketCategory",
      grounding: "Category section framing.",
    },
  ],
  funnelIdeation: [
    {
      rank: "1 - PRIMARY",
      name: "Problem-aware TOFU",
      description: "Pain-aware LinkedIn video → demo request.",
      whatItProves: "Cost per qualified demo.",
    },
  ],
  salesProcess: [],
  competitorMarketingInsights: [
    {
      competitor: "Ramp",
      messaging: "Spend management for finance teams",
      adPlatforms: "LinkedIn; Google",
      estSpendProvenance: "model-estimated",
      icp: "Finance ops",
      angles: "Control + visibility",
      positioning: "The spend-control platform",
      offer: "Free corporate card",
      sourceSection: "positioningCompetitorLandscape",
      grounding: "Competitor section ad-presence row.",
    },
    {
      competitor: "Brex",
      messaging: "All-in-one finance",
      adPlatforms: "LinkedIn",
      estSpendProvenance: "model-estimated",
      icp: "Startups",
      angles: "Bundling",
      positioning: "The finance platform",
      offer: "Sign-up bonus",
      sourceSection: "positioningCompetitorLandscape",
      grounding: "Competitor section ad-presence row.",
    },
  ],
  competitorReviewInsights: [
    {
      complaint: "Onboarding takes months",
      howWeLeverage: "Counter with 1-3 day implementation.",
      sourceSection: "positioningVoiceOfCustomer",
      grounding: "G2 quote about slow onboarding.",
    },
    {
      complaint: "Hidden fees pile up",
      howWeLeverage: "Lead with transparent all-in pricing.",
      sourceSection: "positioningVoiceOfCustomer",
      grounding: "Reddit thread on pricing add-ons.",
    },
    {
      complaint: "Support is unresponsive",
      howWeLeverage: "Offer Slack-channel support from day one.",
      sourceSection: "positioningCompetitorLandscape",
      grounding: "Trustpilot review.",
    },
  ],
  channelSuggestions: [
    {
      channel: "LinkedIn",
      recommendation: "Primary ICP surface — scale the demo-request campaign.",
      verdict: "SCALE",
      sourceSection: "positioningBuyerICP",
    },
  ],
  projectedResults: [
    {
      targetIcp: "RevOps leaders",
      kpi: "Qualified demos",
      kpiCostProvenance: "model-estimated",
      objective: "Test",
      durationLabel: "Months 1-2",
      phaseMonthlyBudgetValue: 6000,
      phaseMonthlyBudgetProvenance: "user-supplied",
      sourceSection: "gtmBrief",
    },
  ],
  kpis: [
    { metric: "Qualified demos", role: "Primary outcome", definition: "A booked sales call." },
    { metric: "CPL", role: "Efficiency", definition: "Cost per lead." },
  ],
  crossSectionInsight: [
    {
      tension: "ICP wants speed-to-close; competitors sell control.",
      sourceSections: ["positioningBuyerICP", "positioningCompetitorLandscape"],
      implicationForPlan: "Lead creative with speed, not control.",
      clientBlindSpot: "Client assumes buyers want control.",
      secondOrderRisk: "If speed messaging underperforms, the control angle is untested.",
      contrarianInversion: "Sell control to the buyer who already has speed.",
    },
  ],
};

const DECK_MEMO_MARKDOWN = `# Paid Media Plan — Operator Readout

## Campaign Overview
Lead with proof — 30s teardowns of real revenue-team workflows. $12,000/month on LinkedIn Ads, $400/day, 4-month campaign, 2 phases. Primary KPI: qualified demos booked.

## Phases
### Phase 1 - Testing (Months 1-2)
$6,000/month. Test 3 audiences in parallel. Validate creative angles.

## Audiences
- 01 RevOps leaders: revenue ops leaders at venture-backed SaaS.

## Angles to Test
- Speed-to-close: position as the fastest path from demo to closed-won.
- Audit-ready by default: frame as the SOC2-friendly option.

## Creative Strategy
Lead with proof — 30s teardowns and named outcomes.

## Creative Framework
- PST 1 (pain-point): 30s teardown of a real revenue workflow.
- Objection 1 (trust): SOC2 in week one, not month six.
- USP (trust): The only API-first support built for B2B.

## Funnel Ideation
1 - PRIMARY: Problem-aware TOFU. Pain-aware LinkedIn video → demo request. Proves cost per qualified demo.

## Competitor Marketing Insights
- Ramp: spend management for finance teams. LinkedIn + Google. ICP: finance ops. Control + visibility angle. Free corporate card offer.
- Brex: all-in-one finance. LinkedIn. ICP: startups. Bundling angle. Sign-up bonus.

## Competitor Review Insights
1. Onboarding takes months → counter with 1-3 day implementation.
2. Hidden fees pile up → lead with transparent all-in pricing.
3. Support is unresponsive → offer Slack-channel support from day one.

## Channel Suggestions
- LinkedIn: SCALE. Primary ICP surface.

## Projected Results
RevOps leaders / Qualified demos / Months 1-2 / $6,000 budget.

## KPIs
- Qualified demos: a booked sales call. Primary outcome.
- CPL: cost per lead. Efficiency.

## Cross-Section Insight
ICP wants speed-to-close; competitors sell control. Lead creative with speed, not control. Client blind spot: assumes buyers want control.`;

describe("projectPaidMediaPlan", () => {
  it("projects a deck memo into a typed deck via the tolerant decoder (decoded)", async () => {
    const generate: PaidMediaProjectGenerateFn = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(PROJECTED_DECK));

    const result = await projectPaidMediaPlan({
      deckMarkdown: DECK_MEMO_MARKDOWN,
      generate,
    });

    expect(result.deckSource).toBe("decoded");
    expect(result.deck.campaignOverview.primaryKpi).toBe("Qualified demos booked");
    expect(result.deck.audienceTypes.length).toBeGreaterThanOrEqual(1);
    expect(result.deck.anglesToTest.length).toBeGreaterThanOrEqual(2);
    expect(result.deck.competitorReviewInsights.length).toBe(3);
    expect(result.deck.crossSectionInsight.length).toBeGreaterThanOrEqual(1);
    // the projected body passes the strip floor (no honest-gap markers)
    expect(result.deck.campaignOverview.prose.toLowerCase()).not.toContain("evidence gap");
  });

  it("returns an honest-gap deck when the projector emits unparseable JSON", async () => {
    const generate: PaidMediaProjectGenerateFn = vi
      .fn()
      .mockResolvedValueOnce("{ not valid json")
      .mockResolvedValueOnce("still not valid");

    const result = await projectPaidMediaPlan({
      deckMarkdown: DECK_MEMO_MARKDOWN,
      generate,
    });

    expect(result.deckSource).toBe("honest_gap");
    // honest-gap deck is schema-valid (not null)
    expect(result.deck.competitorReviewInsights.length).toBe(3);
    expect(result.deck.campaignOverview.prose.toLowerCase()).toContain("evidence gap");
  });

  it("runs one repair round on a parse miss and succeeds when the repair is valid", async () => {
    const generate: PaidMediaProjectGenerateFn = vi
      .fn()
      .mockResolvedValueOnce("garbage")
      .mockResolvedValueOnce(JSON.stringify(PROJECTED_DECK));

    const result = await projectPaidMediaPlan({
      deckMarkdown: DECK_MEMO_MARKDOWN,
      generate,
    });

    expect(result.deckSource).toBe("decoded");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.deck.campaignOverview.primaryKpi).toBe("Qualified demos booked");
  });

  it("returns an honest-gap deck when normalizePaidMediaPlanBody rejects the projected JSON", async () => {
    // An empty object normalizes to a gap deck (no campaign overview etc.)
    const generate: PaidMediaProjectGenerateFn = vi
      .fn()
      .mockResolvedValueOnce("{}")
      .mockResolvedValueOnce("{}");

    const result = await projectPaidMediaPlan({
      deckMarkdown: DECK_MEMO_MARKDOWN,
      generate,
    });

    expect(result.deckSource).toBe("honest_gap");
  });

  it("returns an honest-gap deck on an empty deck memo (compose guards this path)", async () => {
    const generate: PaidMediaProjectGenerateFn = vi
      .fn()
      .mockResolvedValue("")
      .mockResolvedValue("");

    const result = await projectPaidMediaPlan({
      deckMarkdown: "   ",
      generate,
    });

    expect(result.deckSource).toBe("honest_gap");
    expect(result.deck.competitorReviewInsights.length).toBe(3);
  });
});