import type { PositioningSynthesisArtifact } from "../artifacts/schemas/positioning-synthesis";

const sources = Array.from({ length: 5 }, (_, index) => ({
  id: `src_synthesis_${index + 1}`,
  title: `Positioning Synthesis Source ${index + 1}`,
  url: `https://example.com/synthesis/source-${index + 1}`,
  observedAt: "2026-05-25T12:00:00.000Z",
}));

const sourceRefs = {
  market: {
    sourceSection: "positioningMarketCategory",
    sourceUrl: "https://example.com/synthesis/source-5",
  },
  buyer: {
    sourceSection: "positioningBuyerICP",
    sourceUrl: "https://example.com/synthesis/source-2",
  },
  competitor: {
    sourceSection: "positioningCompetitorLandscape",
    sourceUrl: "https://example.com/synthesis/source-4",
  },
  voc: {
    sourceSection: "positioningVoiceOfCustomer",
    sourceUrl: "https://example.com/synthesis/source-1",
  },
  demand: {
    sourceSection: "positioningDemandIntent",
    sourceUrl: "https://example.com/synthesis/source-2",
  },
  offer: {
    sourceSection: "positioningOfferDiagnostic",
    sourceUrl: "https://example.com/synthesis/source-3",
  },
} as const;

export const positioningSynthesisFixtureArtifact: PositioningSynthesisArtifact = {
  id: "artifact_positioning_synthesis_fixture",
  runId: "run_saaslaunch_fixture",
  sectionId: "positioningSynthesis",
  sectionTitle: "Positioning Synthesis",
  verdict:
    "Lead with operational speed: position as the fastest research-to-campaign bridge for cost-conscious SaaS founders.",
  statusSummary:
    "Two divergent positioning options synthesized from the six sections; recommended the speed wedge.",
  confidence: 0.76,
  sources,
  body: {
    strategicThesis: {
      thesis:
        "This plan bets that impatient founder-led SaaS teams can be moved by implementation-delay anxiety with a proof-backed time-to-first-campaign wedge because speed is both the switching trigger and the incumbent blind spot.",
      segment: "Founder-led SaaS teams with research evidence but no campaign-ready GTM path.",
      awareness:
        "Problem-aware buyers who feel the cost of manual research handoffs before they trust a full platform story.",
      force:
        "Operational impatience is stronger than platform curiosity, so the wedge must convert delay pain before asking for category-level belief.",
      defensibleDifferentiator:
        "The defensible differentiator is a narrow proof loop from buyer evidence to launchable campaign angle, not a broad AI GTM platform claim.",
      sourceSections: [sourceRefs.voc, sourceRefs.competitor, sourceRefs.offer],
    },
    contradictionReconciliation: {
      contradiction:
        "Demand and buyer sections support a speed message, while offer and customer-proof sections warn that broad authority claims will outpace the available proof.",
      resolution:
        "Lead with the narrower time-to-first-campaign promise and defer platform-authority language until the first proof loop creates customer evidence.",
      tradeOffAccepted:
        "Accept a smaller initial story so the campaign can generate trustworthy proof faster instead of educating buyers into a trust contest with incumbents.",
      sourceSections: [sourceRefs.demand, sourceRefs.voc, sourceRefs.offer],
    },
    situationThesis: {
      prose:
        "Fast-growing SaaS founders sit on research evidence but lack campaign direction. The buyer is cost-conscious, impatient with manual handoffs, and skeptical of generic GTM advice.",
    },
    positioningOptions: {
      prose:
        "Two divergent wedges, each grounded in the committed positioning sections, with distinct trade-offs.",
      options: [
        {
          optionName: "Operational Efficiency",
          angle: "From research to campaign in days, not months.",
          rationale:
            "Buyers repeatedly describe slow, manual research-to-campaign handoff as the primary operational friction.",
          sourceSection: "positioningVoiceOfCustomer",
          sourceUrl: "https://example.com/synthesis/source-1",
        },
        {
          optionName: "Evidence-Backed Confidence",
          angle: "Campaign angles backed by buyer evidence, not guesses.",
          rationale:
            "Demand and offer signals show buyers validate positioning with real buyer language before committing budget.",
          sourceSection: "positioningDemandIntent",
          sourceUrl: "https://example.com/synthesis/source-2",
        },
      ],
    },
    recommendedMove: {
      optionAngle: "From research to campaign in days, not months.",
      rationale:
        "Cost-conscious founders optimize for time-to-launch first; in an early-maturity category, speed beats proof as the wedge.",
      nextSteps:
        "Lead messaging with 'days not months,' use setup-friction complaints as objection-handling material, and frame the free audit as the speed-up hook.",
    },
    messagingDirections: {
      prose:
        "Core messaging anchors that should thread through paid media and the website.",
      directions: [
        {
          direction: "Speed & Efficiency",
          copyPoint: "Stop losing qualified pipeline to manual research handoffs.",
          sourceSection: "positioningVoiceOfCustomer",
          sourceUrl: "https://example.com/synthesis/source-1",
        },
        {
          direction: "Proof Anchor",
          copyPoint: "Turn buyer evidence into sales-ready campaign direction.",
          sourceSection: "positioningOfferDiagnostic",
          sourceUrl: "https://example.com/synthesis/source-3",
        },
        {
          direction: "Risk Reversal",
          copyPoint: "Validate the angle before you scale the spend.",
          sourceSection: "positioningCompetitorLandscape",
          sourceUrl: "https://example.com/synthesis/source-4",
        },
      ],
    },
    orderedMoves: {
      prose:
        "Sequence the wedge as a learning system: prove speed first, test evidence-backed copy second, then expand the platform story only if the proof loop holds.",
      moves: [
        {
          rank: 1,
          move:
            "Launch the time-to-first-campaign wedge against buyers already frustrated by slow manual research handoffs.",
          dependsOn: [],
          learningPriority:
            "Confirm whether implementation-delay anxiety creates qualified free-audit demand before broadening the message.",
          rationale:
            "The buyer, competitor, and VoC signals all point to delay as the concrete pain incumbents are slow to neutralize.",
          thesisTrace:
            "This directly tests the thesis that operational impatience, not platform curiosity, is the first force that can move the segment.",
          provesWrongIf: {
            metric: "Free-audit qualified lead rate",
            threshold: "Fewer than 12 qualified free-audit leads from the first 1000 landing-page sessions",
            window: "First 21 days",
          },
          ...sourceRefs.voc,
        },
        {
          rank: 2,
          move:
            "Test proof-backed copy that shows buyer evidence becoming campaign direction instead of selling the whole platform.",
          dependsOn: [1],
          learningPriority:
            "Learn whether narrower evidence proof raises trust before the larger GTM transformation narrative.",
          rationale:
            "Demand and offer evidence say buyers need a lower-commitment proof loop before they believe a broader system claim.",
          thesisTrace:
            "This protects the thesis differentiator by proving that buyer evidence can become campaign direction before the story expands.",
          provesWrongIf: {
            metric: "Proof-angle booked-call conversion",
            threshold: "Proof-angle conversion does not exceed the speed-only angle by at least 20%",
            window: "First two creative refresh cycles",
          },
          ...sourceRefs.offer,
        },
        {
          rank: 3,
          move:
            "Expand into platform-authority messaging only after the speed and proof loops produce customer-visible evidence.",
          dependsOn: [1, 2],
          learningPriority:
            "Determine whether the broader story can carry authority without triggering the same trust anxiety seen in customer evidence.",
          rationale:
            "The market and proof gaps make restraint valuable until the campaign creates evidence that supports a larger claim.",
          thesisTrace:
            "This is the thesis expansion step: platform authority is only tested after the speed-and-proof wedge creates defensible evidence.",
          provesWrongIf: {
            metric: "Authority-angle cost per qualified lead",
            threshold: "Authority angle costs more than 1.5x the proof-backed angle with no higher booked-call rate",
            window: "First 30 days after authority copy launches",
          },
          ...sourceRefs.market,
        },
      ],
    },
  },
  createdAt: "2026-05-25T12:00:00.000Z",
};
