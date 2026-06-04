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

const sourceRefs = {
  market: {
    sourceSection: "positioningMarketCategory",
    sourceUrl: "https://example.com/paid-media/source-5",
  },
  competitor: {
    sourceSection: "positioningCompetitorLandscape",
    sourceUrl: "https://example.com/paid-media/source-4",
  },
  voc: sourceRef,
  demand: {
    sourceSection: "positioningDemandIntent",
    sourceUrl: "https://example.com/paid-media/source-2",
  },
  offer: {
    sourceSection: "positioningOfferDiagnostic",
    sourceUrl: "https://example.com/paid-media/source-3",
  },
} as const;

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
    strategicThesis: {
      thesis:
        "This paid plan bets that impatient founder-led SaaS teams can be moved by implementation-delay anxiety with a proof-backed time-to-first-campaign wedge before they trust a full platform story.",
      segment: "Founder-led SaaS teams with enough research evidence to act but not enough campaign clarity to launch.",
      awareness:
        "Problem-aware buyers who recognize manual handoffs and campaign indecision before they are ready for a platform replacement.",
      force:
        "The campaign should turn operational impatience into the first buying motion instead of asking cold traffic to believe category authority.",
      defensibleDifferentiator:
        "The differentiator is the short proof loop from buyer evidence to launchable ad angle, which incumbents cannot copy with slower implementation promises.",
      sourceSections: [sourceRefs.voc, sourceRefs.competitor, sourceRefs.offer],
    },
    contradictionReconciliation: {
      contradiction:
        "The demand evidence supports immediate paid testing, but the offer and VoC evidence warn that broad authority claims will collapse without visible proof.",
      resolution:
        "Spend first on the narrow speed-and-proof loop, then use validated audit demand to earn the right to test the broader platform narrative.",
      tradeOffAccepted:
        "Accept a constrained first campaign so the budget buys strategic learning instead of prematurely scaling a message buyers cannot yet verify.",
      sourceSections: [sourceRefs.demand, sourceRefs.voc, sourceRefs.offer],
    },
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
    orderedMoves: {
      prose:
        "The plan spends in the order that creates the most information first: validate speed pain, prove the evidence loop, then test authority expansion.",
      moves: [
        {
          rank: 1,
          move:
            "Run the time-to-first-campaign free-audit angle before any broader GTM platform message.",
          dependsOn: [],
          learningPriority:
            "Find out whether delay anxiety is strong enough to create qualified audit demand from cold paid traffic.",
          rationale:
            "VoC and competitor evidence indicate implementation delay is the concrete switching pain incumbents expose.",
          thesisTrace:
            "This tests the thesis force directly by asking whether implementation impatience creates qualified audit demand.",
          provesWrongIf: {
            metric: "Qualified audit lead rate",
            threshold: "Fewer than 12 qualified free-audit leads from the first 1000 landing-page sessions",
            window: "First 21 days",
          },
          ...sourceRefs.voc,
        },
        {
          rank: 2,
          move:
            "Shift spend toward proof-backed creative only if the speed wedge creates enough qualified audit demand.",
          dependsOn: [1],
          learningPriority:
            "Determine whether showing buyer evidence becoming campaign direction improves trust and booked-call rate.",
          rationale:
            "Offer evidence says buyers need a lower-commitment proof loop before they believe a larger transformation claim.",
          thesisTrace:
            "This tests whether the thesis differentiator, a short proof loop from evidence to campaign direction, improves trust.",
          provesWrongIf: {
            metric: "Booked-call conversion from proof creative",
            threshold: "Proof creative fails to beat speed-only creative by at least 20%",
            window: "First two creative refresh cycles",
          },
          ...sourceRefs.offer,
        },
        {
          rank: 3,
          move:
            "Test the broader platform-authority story only after speed and proof creatives produce customer-visible evidence.",
          dependsOn: [1, 2],
          learningPriority:
            "Learn whether the larger story can raise conversion without reigniting proof anxiety.",
          rationale:
            "Market and proof gaps make authority messaging a later-stage bet rather than the safest first spend.",
          thesisTrace:
            "This only expands the thesis after the narrow wedge proves the segment will act on speed and evidence.",
          provesWrongIf: {
            metric: "Authority creative cost per qualified lead",
            threshold: "Authority creative costs more than 1.5x proof creative with no higher booked-call rate",
            window: "First 30 days after authority test starts",
          },
          ...sourceRefs.market,
        },
      ],
    },
  },
  createdAt: "2026-05-25T12:00:00.000Z",
};
