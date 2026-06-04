import type { PaidMediaPlanArtifact } from "../artifacts/schemas/paid-media-plan";

const sources = Array.from({ length: 5 }, (_, index) => ({
  id: `source_paid_media_${index + 1}`,
  title: `Paid Media Source ${index + 1}`,
  url: `https://example.com/paid-media/source-${index + 1}`,
  observedAt: "2026-05-25T12:00:00.000Z",
}));

const sourceRef = {
  sourceSection: "positioningVoiceOfCustomer" as const,
  sourceUrl: "https://example.com/paid-media/source-1",
};

export const paidMediaPlanFixtureArtifact: PaidMediaPlanArtifact = {
  id: "artifact_paid_media_plan_fixture",
  runId: "run_saaslaunch_fixture",
  sectionId: "positioningPaidMediaPlan",
  sectionTitle: "Paid Media Plan",
  verdict: "Run a two-phase Meta-led test that turns positioning evidence into angle, creative, and funnel experiments.",
  statusSummary: "Ready for campaign buildout after six positioning sections.",
  confidence: 0.72,
  sources,
  body: {
    campaignOverview: {
      prose: "A four-month paid-media plan starts with controlled testing before scale.",
      monthlyBudget: "$3,000",
      monthlyBudgetValue: 3000,
      monthlyBudgetProvenance: "user-supplied",
      totalMonths: 4,
      phaseCount: 2,
      dailySpend: "$100",
      dailySpendValue: 100,
      dailySpendProvenance: "model-estimated",
      primaryKpi: "MQLs",
      platform: "Meta Ads",
    },
    campaignPhases: {
      prose: "Testing precedes optimization so spend follows evidence.",
      phases: [
        {
          phaseName: "Testing",
          monthsLabel: "Months 1-2",
          monthlyBudget: "$3,000",
          monthlyBudgetValue: 3000,
          monthlyBudgetProvenance: "model-estimated",
          bullets: ["Test audiences", "Test creative angles"],
        },
        {
          phaseName: "Optimization & Scale",
          monthsLabel: "Months 3-4",
          monthlyBudget: "$3,000",
          monthlyBudgetValue: 3000,
          monthlyBudgetProvenance: "model-estimated",
          bullets: ["Scale winners", "Refresh creative"],
        },
      ],
    },
    audienceTypes: {
      prose: "Three audiences balance ICP specificity and platform learning.",
      audiences: [
        {
          slot: "01 Broad Prospecting",
          archetype: "Interest Stack",
          dailyBudget: "$33/day",
          dailyBudgetValue: 33,
          dailyBudgetProvenance: "model-estimated",
          detail: "Operators researching workflow automation and CRM cleanup.",
          ...sourceRef,
        },
        {
          slot: "02 High Intent",
          archetype: "ABM ICP List + Lookalike",
          dailyBudget: "$33/day",
          dailyBudgetValue: 33,
          dailyBudgetProvenance: "model-estimated",
          detail: "Founder-led teams with messy sales handoff processes.",
          ...sourceRef,
        },
        {
          slot: "03 AI Optimized",
          archetype: "Advantage+",
          dailyBudget: "$33/day",
          dailyBudgetValue: 33,
          dailyBudgetProvenance: "model-estimated",
          detail: "Broad platform-optimized prospecting constrained by offer copy.",
          ...sourceRef,
        },
      ],
    },
    creativeStrategy: {
      prose: "Use static and UGC to test problem, proof, and objection angles.",
      staticCount: 5,
      videoCount: 3,
      totalPerAudience: 8,
      angleTypesInMix: [
        "unique-selling-point",
        "problem-solution-transformation",
        "objection-handling",
      ],
    },
    anglesToTest: {
      prose: "Each angle maps a positioning insight to usable ad copy.",
      angles: Array.from({ length: 4 }, (_, index) => ({
        angleName: `Angle ${index + 1}`,
        primaryText: `Stop losing qualified pipeline to manual handoffs ${index + 1}.`,
        supportingLine: "AI-GOS turns buyer evidence into sales-ready campaign direction.",
        insight: "Buyers describe the operational cost of slow sales follow-up.",
        ...sourceRef,
      })),
    },
    creativeFramework: {
      prose: "The framework is filled with copy, not labels.",
      creatives: [
        {
          creativeType: "unique-selling-point",
          uspSentence: "The fastest path from research evidence to a paid-media-ready GTM plan.",
          ...sourceRef,
        },
        {
          creativeType: "problem-solution-transformation",
          problem: "Your team has research but no campaign angle.",
          solution: "AI-GOS converts the evidence into testable ad copy.",
          transformation: "Launch with proof-backed messaging instead of guesses.",
          ...sourceRef,
        },
        {
          creativeType: "objection-handling",
          objection: "We already know our buyer.",
          objectionAnswer: "The audit shows the language buyers actually use when switching.",
          ...sourceRef,
        },
      ],
    },
    competitorReviewInsights: {
      prose: "Competitor complaints become leverage for ad positioning.",
      insights: [1, 2].map((index) => ({
        competitor: `Competitor ${index}`,
        verbatimComplaint: "Setup feels manual and slow.",
        adLeverage: "Lead with speed-to-launch and less operational drag.",
        ...sourceRef,
      })),
    },
    competitorMarketingInsights: {
      prose: "Competitor marketing gives the campaign contrast points.",
      competitors: [1, 2].map((index) => ({
        competitor: `Competitor ${index}`,
        messaging: "Workflow automation for revenue teams.",
        adPlatforms: ["Meta"],
        estSpend: "unknown",
        estSpendProvenance: "unknown",
        icpTargeted: "Founder-led B2B teams",
        anglesTested: "Speed and simplicity",
        positioningClaim: "Fastest way to clean up GTM workflow",
        offer: "Free audit",
        ...sourceRef,
      })),
    },
    funnelIdeation: {
      prose: "Use a free audit funnel to bridge paid click to booked sales call.",
      recommendations: [
        {
          funnelType: "free-audit-landing-page",
          recommendation: "Offer a focused GTM evidence audit before the call.",
          optInToBookedCall: "Show two insights immediately, then route to calendar.",
          sourceSection: "positioningOfferDiagnostic",
        },
      ],
    },
    salesProcess: {
      prose: "Sales assets are linked as operating support, not generated research.",
      assets: [
        {
          label: "Sales Process Overview",
          url: "https://example.com/sales-process",
          assetType: "sop-doc",
        },
      ],
    },
    channelSuggestions: {
      prose: "Channel suggestions are bounded by the offer and channel-truth evidence.",
      suggestions: [
        {
          channel: "Google Ads",
          observation: "Search can support retargeting once category language is proven.",
          recommendation: "Start with exact problem-aware terms before broad keywords.",
          verdict: "start",
          sourceSection: "positioningOfferDiagnostic",
        },
        {
          channel: "Website",
          observation: "The page needs the same buyer-language hooks as the ads.",
          recommendation: "Mirror the top objection-handling copy above the fold.",
          verdict: "fix",
          sourceSection: "positioningOfferDiagnostic",
        },
      ],
    },
    kpis: {
      prose: "SLG campaigns should optimize for qualified sales conversations.",
      gtmMotion: "SLG",
      kpis: [
        { metric: "MQLs", role: "Primary", definition: "Qualified free-audit leads" },
        { metric: "CPL", role: "Efficiency", definition: "Cost per qualified lead" },
        { metric: "CTR", role: "Creative health", definition: "Hook engagement rate" },
      ],
    },
  },
  createdAt: "2026-05-25T12:00:00.000Z",
};
