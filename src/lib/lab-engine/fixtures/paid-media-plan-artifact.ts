import type { PaidMediaPlanArtifact } from "../artifacts/schemas/paid-media-plan";

const sources = Array.from({ length: 5 }, (_, index) => ({
  id: `source_paid_media_${index + 1}`,
  title: `Paid Media Source ${index + 1}`,
  url: `https://example.com/paid-media/source-${index + 1}`,
  observedAt: "2026-05-25T12:00:00.000Z",
}));

export const paidMediaPlanFixtureArtifact: PaidMediaPlanArtifact = {
  id: "artifact_paid_media_plan_fixture",
  runId: "run_saaslaunch_fixture",
  sectionId: "positioningPaidMediaPlan",
  sectionTitle: "Paid Media Plan",
  verdict:
    "Run a two-phase Meta-led test that turns positioning evidence into angle, creative, and funnel experiments.",
  statusSummary: "Ready for campaign buildout after six positioning sections.",
  confidence: 0.72,
  createdAt: "2026-05-25T12:00:00.000Z",
  sources,
  body: {
    campaignOverview: {
      prose: "A four-month paid-media plan starts with controlled testing before scale.",
      platform: "Meta Ads",
      monthlyBudget: "$3,000",
      monthlyBudgetValue: 3000,
      monthlyBudgetProvenance: "user-supplied",
      dailySpend: "$100",
      dailySpendValue: 100,
      dailySpendProvenance: "model-estimated",
      totalMonths: 4,
      phaseCount: 2,
      primaryKpi: "MQLs",
    },
    campaignPhases: [
      {
        phaseName: "Phase 1 - Testing",
        monthsLabel: "Months 1-2",
        monthlyBudget: "$3,000",
        monthlyBudgetValue: 3000,
        monthlyBudgetProvenance: "model-estimated",
        bullets: [
          "Test multiple audience types in parallel.",
          "Run a full mix of static and UGC creatives.",
          "Collect data on CPL, CTR, and MQL quality.",
          "No scaling until Phase 1 data is reviewed.",
        ],
      },
      {
        phaseName: "Phase 2 - Optimization & Scale",
        monthsLabel: "Months 3-4",
        monthlyBudget: "$3,000",
        monthlyBudgetValue: 3000,
        monthlyBudgetProvenance: "model-estimated",
        bullets: [
          "Turn off underperforming audiences and creatives.",
          "Scale budget on winning audience and creative combinations.",
          "Refresh creative and introduce retargeting on Phase 1 signals.",
          "Continue landing-page iteration around demo-form conversion.",
        ],
      },
    ],
    audienceTypes: [
      {
        slot: "01",
        archetype: "Broad Prospecting - Interest Stack",
        dailyBudget: "$33.33/day",
        dailyBudgetValue: 33.33,
        dailyBudgetProvenance: "model-estimated",
        detail: "Operators researching workflow automation and CRM cleanup.",
        sourceSection: "positioningBuyerICP",
        grounding: "Buyer ICP names founder-led operators with messy CRM handoffs.",
      },
      {
        slot: "02",
        archetype: "High Intent - ABM ICP List + 1% Lookalike",
        dailyBudget: "$33.33/day",
        dailyBudgetValue: 33.33,
        dailyBudgetProvenance: "model-estimated",
        detail: "Founder-led teams with visible sales handoff friction.",
        sourceSection: "positioningVoiceOfCustomer",
        grounding: "VoC evidence says slow handoffs block campaign launch.",
      },
      {
        slot: "03",
        archetype: "AI Optimized - Advantage+",
        dailyBudget: "$33.33/day",
        dailyBudgetValue: 33.33,
        dailyBudgetProvenance: "model-estimated",
        detail: "Broad platform-optimized prospecting constrained by offer copy.",
        sourceSection: "positioningOfferDiagnostic",
        grounding: "Offer Diagnostic recommends proof-backed audit language.",
      },
    ],
    anglesToTest: [
      {
        shortName: "Launch Delay Anxiety",
        description: "Expose the cost of having research but no campaign angle.",
        angleType: "Problem-Aware",
        sourceSection: "positioningVoiceOfCustomer",
        grounding: "Buyers describe the operational cost of slow sales follow-up.",
      },
      {
        shortName: "Proof Before Platform",
        description: "Use source-backed proof before asking buyers to trust a platform narrative.",
        angleType: "Proof-Stacked",
        sourceSection: "positioningOfferDiagnostic",
        grounding: "Offer evidence warns broad authority claims collapse without visible proof.",
      },
      {
        shortName: "Competitor Drag",
        description: "Contrast slower implementation promises with fast campaign readiness.",
        angleType: "Comparison",
        sourceSection: "positioningCompetitorLandscape",
        grounding: "Competitor rows show setup-heavy positioning and broad workflow claims.",
      },
      {
        shortName: "Contrarian Narrow Start",
        description: "Start narrow so the first budget buys learning instead of polish.",
        angleType: "Contrarian",
        sourceSection: "positioningDemandIntent",
        grounding: "Demand evidence supports immediate testing around audit intent.",
      },
    ],
    creativeStrategy: {
      prose: "Use static and UGC to test problem, proof, and objection angles.",
      staticCount: 5,
      videoCount: 3,
      totalPerAudience: 8,
    },
    creativeFramework: [
      {
        label: "PST 1",
        angleType: "Problem-Aware",
        hook: "You have buyer research, but your first ad angle is still a guess.",
        executesAngle: "Launch Delay Anxiety",
        sourceSection: "positioningVoiceOfCustomer",
        grounding: "VoC evidence names slow campaign handoff as the operational pain.",
      },
      {
        label: "PST 2",
        angleType: "Problem-Aware",
        hook: "Stop losing qualified pipeline while campaign decisions sit in docs.",
        executesAngle: "Launch Delay Anxiety",
        sourceSection: "positioningDemandIntent",
        grounding: "Demand signals point to immediate audit and workflow-cleanup interest.",
      },
      {
        label: "PST 3",
        angleType: "Proof-Stacked",
        hook: "Turn six positioning sections into a launchable paid-media plan.",
        executesAngle: "Proof Before Platform",
        sourceSection: "positioningOfferDiagnostic",
        grounding: "Offer evidence supports evidence-to-campaign conversion as the wedge.",
      },
      {
        label: "Objection 1",
        angleType: "Enemy",
        hook: "Already know your buyer? Then your ad should quote their switching language.",
        executesAngle: "Proof Before Platform",
        sourceSection: "positioningVoiceOfCustomer",
        grounding: "VoC rows preserve buyer switching language for ad copy.",
      },
      {
        label: "Objection 2",
        angleType: "Comparison",
        hook: "Campaign teams do not need another generic workflow promise.",
        executesAngle: "Competitor Drag",
        sourceSection: "positioningCompetitorLandscape",
        grounding: "Competitor evidence shows broad workflow automation messaging.",
      },
      {
        label: "USP",
        angleType: "Mechanism-Led",
        hook: "AI-GOS compresses research evidence into testable ad angles.",
        executesAngle: "Proof Before Platform",
        sourceSection: "positioningOfferDiagnostic",
        grounding: "Offer diagnostic identifies campaign-readiness as the proof loop.",
      },
      {
        label: "Demo + Objection",
        angleType: "Comparison",
        hook: "Watch an evidence-backed angle replace a vague platform claim.",
        executesAngle: "Competitor Drag",
        sourceSection: "positioningCompetitorLandscape",
        grounding: "Competitor landscape records vague platform claims as a gap.",
      },
      {
        label: "Before / After",
        angleType: "Contrarian",
        hook: "Before: research parked in docs. After: a paid-media test built around proof.",
        executesAngle: "Contrarian Narrow Start",
        sourceSection: "positioningDemandIntent",
        grounding: "Demand evidence supports immediate narrow testing before scale.",
      },
    ],
    funnelIdeation: [
      {
        rank: "1 - PRIMARY",
        name: "Free GTM Evidence Audit",
        description:
          "Problem-aware founder-led SaaS operators see two campaign-specific insights before booking.",
        whatItProves: "Whether audit demand converts into qualified MQLs.",
      },
      {
        rank: "2 - SECONDARY",
        name: "Proof-Backed Demo Page",
        description:
          "A lower-friction demo page tests whether proof language beats platform language.",
        whatItProves: "Whether proof-backed copy improves demo-form conversion.",
      },
      {
        rank: "3 - TEST",
        name: "High-Intent Retargeting",
        description:
          "Retarget visitors who engage with audit proof but do not book immediately.",
        whatItProves: "Whether proof engagement predicts booked-call quality.",
      },
    ],
    salesProcess: [
      {
        label: "Sales Process Overview",
        assetType: "sop-doc",
        url: "https://example.com/sales-process",
        note: "End-to-end MQL to closed-won workflow.",
      },
      {
        label: "SDR Opt-In Flow",
        assetType: "sop-doc",
        url: "",
        note: "Evidence gap: SDR opt-in flow was not provided.",
      },
      {
        label: "Personalization Playbook",
        assetType: "sop-doc",
        url: "",
        note: "Evidence gap: personalization playbook was not provided.",
      },
      {
        label: "Loom Walkthrough",
        assetType: "loom",
        url: "",
        note: "Evidence gap: sales-process Loom was not provided.",
      },
    ],
    competitorMarketingInsights: [
      {
        competitor: "Competitor 1",
        messaging: "Workflow automation for revenue teams that need handoff cleanup.",
        adPlatforms: "Meta; Google",
        estSpendProvenance: "unknown",
        icp: "Founder-led B2B teams",
        angles: "Speed-to-launch and CRM cleanup proof",
        positioning: "Fastest path to clean up GTM workflow handoffs",
        offer: "Free audit",
        sourceSection: "positioningCompetitorLandscape",
        grounding: "Competitor evidence lists speed-to-launch and CRM cleanup claims.",
      },
      {
        competitor: "Competitor 2",
        messaging: "Broad AI workflow automation for revenue operators.",
        adPlatforms: "Google",
        estSpendProvenance: "unknown",
        icp: "Revenue operators",
        angles: "Workflow breadth and implementation promises",
        positioning: "General revenue workflow platform",
        offer: "Book a demo",
        sourceSection: "positioningCompetitorLandscape",
        grounding: "Competitor evidence contrasts broad workflow claims with narrower proof needs.",
      },
    ],
    competitorReviewInsights: [
      {
        complaint: "Competitor setup requires manual handoffs before launch.",
        howWeLeverage:
          "Lead with campaign-ready evidence instead of another setup-heavy platform promise.",
        sourceSection: "positioningCompetitorLandscape",
        grounding: "Competitor review evidence points to implementation drag.",
      },
      {
        complaint: "Customers complain that generic automation claims are hard to trust.",
        howWeLeverage:
          "Use proof-backed audit language in ads and sales scripts before platform claims.",
        sourceSection: "positioningVoiceOfCustomer",
        grounding: "VoC evidence warns trust drops without visible proof.",
      },
      {
        complaint: "Users need more clarity before they book a call.",
        howWeLeverage:
          "Show two concrete GTM evidence findings before routing to calendar.",
        sourceSection: "positioningOfferDiagnostic",
        grounding: "Offer diagnostic supports visible proof before sales conversion.",
      },
    ],
    channelSuggestions: [
      {
        channel: "Website",
        recommendation:
          "Replace above-the-fold CTA copy with the top objection-handling asset and track demo-form CVR.",
        verdict: "FIX",
        sourceSection: "positioningOfferDiagnostic",
      },
      {
        channel: "Content / Organic",
        recommendation:
          "Rework blog and guide pages around workflow-cleanup proof before scaling paid traffic.",
        verdict: "REWORK",
        sourceSection: "positioningDemandIntent",
      },
      {
        channel: "Other Ad Platforms",
        recommendation:
          "Review Google exact-match ad groups for problem-aware workflow-cleanup queries.",
        verdict: "REVIEW",
        sourceSection: "positioningDemandIntent",
      },
      {
        channel: "Email / Nurture",
        recommendation:
          "Add a nurture sequence that sends two audit insights before a booking CTA.",
        verdict: "ADD",
        sourceSection: "positioningOfferDiagnostic",
      },
    ],
    kpis: [
      {
        metric: "MQLs",
        role: "Primary outcome",
        definition: "Qualified free-audit leads that match the ICP.",
      },
      {
        metric: "CTR",
        role: "Creative health",
        definition: "Hook and angle engagement rate across static and UGC ads.",
      },
      {
        metric: "CPL",
        role: "Efficiency",
        definition: "Cost per qualified lead by audience and creative angle.",
      },
    ],
    crossSectionInsight: [
      {
        tension:
          "Demand evidence supports immediate testing, but offer and VoC evidence warn that broad authority claims collapse without visible proof.",
        sourceSections: [
          "positioningDemandIntent",
          "positioningVoiceOfCustomer",
          "positioningOfferDiagnostic",
        ],
        implicationForPlan:
          "Spend first on the narrow speed-and-proof loop, then test broader platform language after Phase 1.",
        clientBlindSpot:
          "The client may see paid media as a scale lever before proving the first campaign belief.",
        secondOrderRisk:
          "A broad first campaign burns budget learning that buyers wanted proof before a platform story.",
        contrarianInversion:
          "The fastest route to scale is a constrained first campaign, not a broader launch.",
      },
    ],
  },
};
