import type { CrossSectionReasoningArtifact } from "../artifacts/schemas/cross-section-reasoning";

const sources = Array.from({ length: 6 }, (_, index) => ({
  id: `src_cross_reasoning_${index + 1}`,
  title: `Cross-Section Reasoning Source ${index + 1}`,
  url: `https://example.com/cross-reasoning/source-${index + 1}`,
  observedAt: "2026-06-04T12:00:00.000Z",
}));

const sourceRefs = {
  market: {
    sectionId: "positioningMarketCategory",
    sourceUrl: "https://example.com/cross-reasoning/source-1",
    sourceTitle: "Market maturity signal",
  },
  buyer: {
    sectionId: "positioningBuyerICP",
    sourceUrl: "https://example.com/cross-reasoning/source-2",
    sourceTitle: "ICP buying-context signal",
  },
  competitor: {
    sectionId: "positioningCompetitorLandscape",
    sourceUrl: "https://example.com/cross-reasoning/source-3",
    sourceTitle: "Competitor weakness signal",
  },
  voc: {
    sectionId: "positioningVoiceOfCustomer",
    sourceUrl: "https://example.com/cross-reasoning/source-4",
    sourceTitle: "Customer objection signal",
  },
  demand: {
    sectionId: "positioningDemandIntent",
    sourceUrl: "https://example.com/cross-reasoning/source-5",
    sourceTitle: "Intent-pattern signal",
  },
  offer: {
    sectionId: "positioningOfferDiagnostic",
    sourceUrl: "https://example.com/cross-reasoning/source-6",
    sourceTitle: "Offer bottleneck signal",
  },
} as const;

export const crossSectionReasoningFixtureArtifact: CrossSectionReasoningArtifact = {
  id: "artifact_cross_section_reasoning_fixture",
  runId: "run_saaslaunch_fixture",
  sectionId: "positioningCrossSectionReasoning",
  sectionTitle: "Cross-Section Reasoning",
  verdict:
    "The decisive bet is not broader proof; it is converting operational impatience into a speed wedge before competitors reframe the category around governance.",
  statusSummary:
    "Three cross-section threads connect market maturity, buyer urgency, competitor gaps, VoC objections, demand signals, and offer constraints.",
  confidence: 0.78,
  sources,
  body: {
    crossSectionThreads: [
      {
        claim:
          "Buyer urgency and competitor weakness collide around implementation delay, making time-to-first-campaign the wedge competitors are structurally slow to copy.",
        sourceSections: [sourceRefs.buyer, sourceRefs.competitor, sourceRefs.voc],
        whyNonObvious:
          "Each isolated section reads like a normal speed complaint; together they show speed is not a feature claim but the buyer's switching trigger and the incumbent blind spot.",
      },
      {
        claim:
          "Demand is problem-aware while the offer still asks buyers to believe a full GTM transformation, so the first move should sell a narrow proof loop rather than the whole platform.",
        sourceSections: [sourceRefs.demand, sourceRefs.offer, sourceRefs.market],
        whyNonObvious:
          "The demand section alone suggests content expansion, but the offer diagnostic changes the answer: lower the commitment surface before scaling acquisition.",
      },
      {
        claim:
          "The category has enough signal for a specific wedge but not enough customer proof to sustain aggressive authority claims, so restraint is the premium-positioning choice.",
        sourceSections: [sourceRefs.market, sourceRefs.voc, sourceRefs.offer],
        whyNonObvious:
          "A weaker synthesis would fill the proof gap with confidence; the cross-section read says the proof gap itself determines the safest strategic posture.",
      },
    ],
    clientBlindSpot: {
      claim:
        "The client is likely treating proof gaps as a credibility problem when they are also a sequencing problem: overclaiming authority too early raises switching anxiety.",
      sourceSections: [sourceRefs.voc, sourceRefs.offer],
      whyItMatters:
        "This changes the roadmap from gather-more-proof generically to sequence proof loops before high-authority messaging and sales assets.",
    },
    namedTension: {
      tension:
        "Lead with operational speed while accepting that this temporarily underplays the broader strategic-platform story.",
      side:
        "Take the speed side because buyer urgency and competitor inertia are both present now, while platform authority still needs more proof.",
      costAccepted:
        "Accept a narrower initial wedge and defer category-leadership language until review-body and proof-asset evidence catches up.",
      sourceSections: [sourceRefs.buyer, sourceRefs.competitor, sourceRefs.offer],
    },
    secondOrderRisk: {
      claim:
        "If the company scales paid media before the narrow proof loop is visible, the campaign may educate buyers into a comparison set where incumbents win on trust.",
      sourceSections: [sourceRefs.competitor, sourceRefs.demand, sourceRefs.offer],
      whyItMatters:
        "This risk turns paid-media launch order into a strategic dependency instead of a channel-calendar preference.",
    },
    contrarianInversion: {
      claim:
        "The strongest move is to advertise less of the platform at first: the thinner promise is more defensible and creates faster evidence for the larger story.",
      sourceSections: [sourceRefs.market, sourceRefs.voc, sourceRefs.offer],
      whyItMatters:
        "It prevents the synthesis from defaulting to a bigger narrative when the cross-section evidence supports a smaller, more testable wedge.",
    },
  },
  createdAt: "2026-06-04T12:00:00.000Z",
};
