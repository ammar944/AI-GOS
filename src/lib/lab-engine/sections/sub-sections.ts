import type { SectionId } from "../events/activity-event";

export interface SectionSubSectionDefinition {
  key: string;
  label: string;
}

export const SECTION_SUB_SECTIONS: Record<
  SectionId,
  readonly SectionSubSectionDefinition[]
> = {
  positioningMarketCategory: [
    {
      key: "categoryDefinition",
      label: "Category definition and adjacent categories",
    },
    {
      key: "marketSize",
      label: "Market size and trajectory signals",
    },
    {
      key: "structuralForces",
      label: "Structural forces moving the market",
    },
    {
      key: "categoryMaturity",
      label: "Category maturity classification",
    },
  ],
  positioningBuyerICP: [
    {
      key: "icpExistenceCheck",
      label: "ICP existence check",
    },
    {
      key: "personaReality",
      label: "Persona reality",
    },
    {
      key: "awarenessDistribution",
      label: "Awareness-level distribution",
    },
    {
      key: "buyingContext",
      label: "Buying context",
    },
    {
      key: "clusters",
      label: "Where buyers cluster",
    },
  ],
  positioningCompetitorLandscape: [
    {
      key: "competitorSet",
      label: "Full competitor set",
    },
    {
      key: "positioningTaxonomy",
      label: "Positioning taxonomy",
    },
    {
      key: "pricingReality",
      label: "Pricing reality",
    },
    {
      key: "shareOfVoice",
      label: "Share-of-voice map",
    },
    {
      key: "publicWeaknesses",
      label: "Public strengths and weaknesses",
    },
    {
      key: "narrativeArcs",
      label: "Competitor narrative arc",
    },
    {
      key: "adPresence",
      label: "Ad presence",
    },
    {
      key: "adEvidence",
      label: "Ad evidence",
    },
  ],
  positioningVoiceOfCustomer: [
    {
      key: "painLanguage",
      label: "Pain language",
    },
    {
      key: "objections",
      label: "Objection evidence",
    },
    {
      key: "switchingStories",
      label: "Switching stories",
    },
    {
      key: "decisionCriteria",
      label: "Stated decision criteria",
    },
    {
      key: "successLanguage",
      label: "Success-state language",
    },
  ],
  positioningDemandIntent: [
    {
      key: "keywordDemand",
      label: "Keyword demand",
    },
    {
      key: "questionMining",
      label: "Question mining",
    },
    {
      key: "contentGaps",
      label: "Content-gap evidence",
    },
    {
      key: "intentSignals",
      label: "Intent signals",
    },
    {
      key: "venueMap",
      label: "Event and community signal map",
    },
  ],
  positioningOfferDiagnostic: [
    {
      key: "offerMarketFit",
      label: "Offer-market fit evidence",
    },
    {
      key: "funnelDiagnosis",
      label: "Funnel diagnosis",
    },
    {
      key: "channelTruth",
      label: "Channel truth",
    },
    {
      key: "retentionHealth",
      label: "Retention and activation health",
    },
    {
      key: "redFlags",
      label: "Red flags in own numbers",
    },
  ],
  positioningSynthesis: [
    { key: "situationThesis", label: "Situation thesis" },
    { key: "positioningOptions", label: "Positioning options" },
    { key: "recommendedMove", label: "Recommended move" },
    { key: "messagingDirections", label: "Messaging directions" },
  ],
  positioningCrossSectionReasoning: [
    { key: "crossSectionThreads", label: "Cross-section threads" },
    { key: "clientBlindSpot", label: "Client blind spot" },
    { key: "namedTension", label: "Named tension" },
    { key: "secondOrderRisk", label: "Second-order risk" },
    { key: "contrarianInversion", label: "Contrarian inversion" },
  ],
  positioningPaidMediaPlan: [
    { key: "campaignOverview", label: "Campaign overview" },
    { key: "campaignPhases", label: "Campaign phases" },
    { key: "audienceTypes", label: "Audience types" },
    { key: "creativeStrategy", label: "Creative strategy" },
    { key: "anglesToTest", label: "Angles to test" },
    { key: "creativeFramework", label: "Creative framework" },
    { key: "competitorReviewInsights", label: "Competitor review insights" },
    { key: "competitorMarketingInsights", label: "Competitor marketing insights" },
    { key: "funnelIdeation", label: "Funnel ideation" },
    { key: "salesProcess", label: "Sales process" },
    { key: "channelSuggestions", label: "Channel suggestions" },
    { key: "kpis", label: "KPIs and success metrics" },
  ],
};

export function getSectionSubSections(
  sectionId: SectionId,
): readonly SectionSubSectionDefinition[] {
  return SECTION_SUB_SECTIONS[sectionId];
}
