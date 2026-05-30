import type { PositioningSynthesisArtifact } from "../artifacts/schemas/positioning-synthesis";

const sources = Array.from({ length: 5 }, (_, index) => ({
  id: `src_synthesis_${index + 1}`,
  title: `Positioning Synthesis Source ${index + 1}`,
  url: `https://example.com/synthesis/source-${index + 1}`,
  observedAt: "2026-05-25T12:00:00.000Z",
}));

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
  },
  createdAt: "2026-05-25T12:00:00.000Z",
};
