// Strategic Blueprint Output Types
// Based on the Strategic Blueprint Template v1.0

import type { EnrichedAdCreative } from '@/lib/foreplay/types';

// =============================================================================
// Section 1: Industry & Market Overview
// =============================================================================

export type MarketMaturity = "early" | "growing" | "saturated";
export type AwarenessLevel = "low" | "medium" | "high";
export type BuyingBehavior = "impulsive" | "committee_driven" | "roi_based" | "mixed";

export interface CategorySnapshot {
  /** The market category */
  category: string;
  /** Market maturity stage */
  marketMaturity: MarketMaturity;
  /** Target audience awareness level */
  awarenessLevel: AwarenessLevel;
  /** How buyers make decisions */
  buyingBehavior: BuyingBehavior;
  /** Average sales cycle description */
  averageSalesCycle: string;
  /** Seasonality patterns */
  seasonality: string;
}

export interface MarketDynamics {
  /** Key demand drivers in the market */
  demandDrivers: string[];
  /** What triggers buying decisions */
  buyingTriggers: string[];
  /** Barriers preventing purchases */
  barriersToPurchase: string[];
  /** Macro-level risks */
  macroRisks: {
    regulatoryConcerns: string;
    marketDownturnRisks: string;
    industryConsolidation: string;
  };
}

export interface PainPoints {
  /** Primary pain points (most critical) */
  primary: string[];
  /** Secondary pain points */
  secondary: string[];
}

export interface PsychologicalDrivers {
  /** Emotional motivators that drive buying */
  drivers: {
    driver: string;
    description: string;
  }[];
}

export interface AudienceObjections {
  /** Common objections prospects raise */
  objections: {
    objection: string;
    howToAddress: string;
  }[];
}

export interface MessagingOpportunities {
  /** Summary messaging recommendations */
  summaryRecommendations: string[];
}

export interface IndustryMarketOverview {
  /** Category snapshot */
  categorySnapshot: CategorySnapshot;
  /** Market dynamics */
  marketDynamics: MarketDynamics;
  /** Top 10-15 pain points */
  painPoints: PainPoints;
  /** Psychological/emotional drivers */
  psychologicalDrivers: PsychologicalDrivers;
  /** Common audience objections */
  audienceObjections: AudienceObjections;
  /** Messaging opportunities and recommendations */
  messagingOpportunities: MessagingOpportunities;
}

// =============================================================================
// Section 2: ICP Analysis & Validation
// =============================================================================

export type ValidationStatus = "validated" | "workable" | "invalid";
export type RiskRating = "low" | "medium" | "high" | "critical";

export interface ICPCoherenceCheck {
  /** ICP is clearly defined */
  clearlyDefined: boolean;
  /** Reachable through paid channels */
  reachableThroughPaidChannels: boolean;
  /** Exists at adequate scale */
  adequateScale: boolean;
  /** Has the pain the offer solves */
  hasPainOfferSolves: boolean;
  /** Has budget and decision authority */
  hasBudgetAndAuthority: boolean;
}

export interface PainSolutionFit {
  /** Primary pain being solved */
  primaryPain: string;
  /** Offer component that solves it */
  offerComponentSolvingIt: string;
  /** Fit assessment */
  fitAssessment: "strong" | "moderate" | "weak";
  /** Notes on fit */
  notes: string;
}

export interface MarketReachability {
  /** Enough audience volume on Meta */
  metaVolume: boolean;
  /** Enough job title/seniority volume on LinkedIn */
  linkedInVolume: boolean;
  /** Search demand exists on Google */
  googleSearchDemand: boolean;
  /** Any contradicting signals */
  contradictingSignals: string[];
}

export interface EconomicFeasibility {
  /** ICP has budget */
  hasBudget: boolean;
  /** Purchases similar tools/services */
  purchasesSimilar: boolean;
  /** TAM aligns with CAC target */
  tamAlignedWithCac: boolean;
  /** Notes */
  notes: string;
}

export interface ICPRiskAssessment {
  /** Reachability risk */
  reachability: RiskRating;
  /** Budget risk */
  budget: RiskRating;
  /** Pain strength risk */
  painStrength: RiskRating;
  /** Competitiveness risk */
  competitiveness: RiskRating;
}

export interface ICPAnalysisValidation {
  /** ICP coherence check */
  coherenceCheck: ICPCoherenceCheck;
  /** Pain-solution fit analysis */
  painSolutionFit: PainSolutionFit;
  /** Market size and reachability */
  marketReachability: MarketReachability;
  /** Economic feasibility */
  economicFeasibility: EconomicFeasibility;
  /** Risk assessment */
  riskAssessment: ICPRiskAssessment;
  /** Final verdict */
  finalVerdict: {
    status: ValidationStatus;
    reasoning: string;
    recommendations: string[];
  };
}

// =============================================================================
// Section 3: Offer Analysis & Viability
// =============================================================================

export interface OfferClarity {
  /** Client can clearly articulate the offer */
  clearlyArticulated: boolean;
  /** Offer solves a real pain */
  solvesRealPain: boolean;
  /** Benefits are easy to understand */
  benefitsEasyToUnderstand: boolean;
  /** Transformation is measurable */
  transformationMeasurable: boolean;
  /** Value prop obvious in under 3 seconds */
  valuePropositionObvious: boolean;
}

export interface OfferStrength {
  /** Pain relevance score (1-10) */
  painRelevance: number;
  /** Urgency score (1-10) */
  urgency: number;
  /** Differentiation score (1-10) */
  differentiation: number;
  /** Tangibility score (1-10) */
  tangibility: number;
  /** Proof score (1-10) */
  proof: number;
  /** Pricing logic score (1-10) */
  pricingLogic: number;
  /** Overall score */
  overallScore: number;
}

export interface MarketOfferFit {
  /** Does the market want this now */
  marketWantsNow: boolean;
  /** Are competitors offering similar solutions */
  competitorsOfferSimilar: boolean;
  /** Does the price match expectations */
  priceMatchesExpectations: boolean;
  /** Is proof strong enough for cold traffic */
  proofStrongForColdTraffic: boolean;
  /** Is the transformation believable */
  transformationBelievable: boolean;
}

export type OfferRedFlag =
  | "offer_too_vague"
  | "overcrowded_market"
  | "price_mismatch"
  | "weak_or_no_proof"
  | "no_funnel_built"
  | "transformation_unclear";

export type OfferRecommendation =
  | "proceed"
  | "adjust_messaging"
  | "adjust_pricing"
  | "icp_refinement_needed"
  | "major_offer_rebuild";

export interface OfferAnalysisViability {
  /** Offer clarity assessment */
  offerClarity: OfferClarity;
  /** Offer strength scores */
  offerStrength: OfferStrength;
  /** Market-offer fit */
  marketOfferFit: MarketOfferFit;
  /** Red flags identified */
  redFlags: OfferRedFlag[];
  /** Final recommendation */
  recommendation: {
    status: OfferRecommendation;
    reasoning: string;
    actionItems: string[];
  };
}

// =============================================================================
// Section 4: Competitor Analysis
// =============================================================================

/** Pricing tier extracted from competitor research/ads */
export interface PricingTier {
  /** Tier name (e.g., "Starter", "Pro", "Enterprise") */
  tier: string;
  /** Price string (e.g., "$99/mo", "$299/mo", "Custom") */
  price: string;
  /** Brief description of what this tier offers */
  description?: string;
  /** Target audience for this tier (e.g., "Small teams", "Growing businesses", "Enterprise") */
  targetAudience?: string;
  /** Key features included at this tier - should be concrete deliverables */
  features?: string[];
  /** Usage limitations (e.g., "Up to 5 users", "10,000 contacts/mo") */
  limitations?: string;
}

/** Structured offer extracted from competitor ads */
export interface CompetitorOffer {
  /** Primary value proposition headline from ads */
  headline: string;
  /** What they promise (value proposition) */
  valueProposition: string;
  /** Common call-to-action pattern */
  cta: string;
}

// =============================================================================
// Review Mining Types
// =============================================================================

export interface TrustpilotReviewData {
  url: string;
  trustScore: number | null;
  totalReviews: number | null;
  /** Trustpilot's own AI summary, not ours */
  aiSummary: string | null;
  reviews: TrustpilotReview[];
}

export interface TrustpilotReview {
  /** 1-5 star rating */
  rating: number;
  /** Review text, capped at 500 chars */
  text: string;
  date?: string;
}

export interface G2ReviewMetadata {
  url?: string;
  rating: number | null;
  reviewCount: number | null;
  productCategory?: string;
}

export interface CompetitorReviewData {
  trustpilot: TrustpilotReviewData | null;
  g2: G2ReviewMetadata | null;
  collectedAt: string;
}

/** How pricing data was obtained */
export type PricingSource = 'scraped' | 'unavailable';

export interface CompetitorSnapshot {
  /** Competitor name */
  name: string;
  /** Competitor website URL */
  website?: string;
  /** Positioning */
  positioning: string;
  /** Their offer */
  offer: string;
  /** Price point */
  price: string;
  /** Funnel types used */
  funnels: string;
  /** Ad platforms used */
  adPlatforms: string[];
  /** Key strengths */
  strengths: string[];
  /** Key weaknesses */
  weaknesses: string[];
  /** Real ad creatives fetched from ad libraries (enriched with Foreplay intelligence when available) */
  adCreatives?: EnrichedAdCreative[];
  /** Structured pricing tiers extracted from pricing page scraping */
  pricingTiers?: PricingTier[];
  /** Structured main offer from ad patterns */
  mainOffer?: CompetitorOffer;
  /** Recurring messaging themes extracted from ad copy (3-5 themes) */
  adMessagingThemes?: string[];
  /** Source of pricing data: 'scraped' from actual page or 'unavailable' */
  pricingSource?: PricingSource;
  /** Confidence score for scraped pricing (0-100) */
  pricingConfidence?: number;
  /** Note about pricing (e.g., verification URL if unavailable) */
  pricingNote?: string;
  /** Customer review data from Trustpilot and G2 */
  reviewData?: CompetitorReviewData;
}

export interface CompetitorCreativeLibrary {
  /** Creative formats used */
  creativeFormats: {
    ugc: boolean;
    carousels: boolean;
    statics: boolean;
    testimonial: boolean;
    productDemo: boolean;
  };
}

export interface CompetitorFunnelBreakdown {
  /** Landing page URLs (for reference) */
  landingPagePatterns: string[];
  /** Headline structure patterns */
  headlineStructure: string[];
  /** CTA hierarchy patterns */
  ctaHierarchy: string[];
  /** Social proof patterns */
  socialProofPatterns: string[];
  /** Lead capture methods */
  leadCaptureMethods: string[];
  /** Form friction level */
  formFriction: "low" | "medium" | "high";
}

export interface CompetitorAnalysis {
  /** Competitor snapshots */
  competitors: CompetitorSnapshot[];
  /** Creative library insights */
  creativeLibrary: CompetitorCreativeLibrary;
  /** Funnel breakdown insights */
  funnelBreakdown: CompetitorFunnelBreakdown;
  /** Overall strengths in market */
  marketStrengths: string[];
  /** Overall weaknesses in market */
  marketWeaknesses: string[];
  /** Gaps and opportunities for client */
  gapsAndOpportunities: {
    messagingOpportunities: string[];
    creativeOpportunities: string[];
    funnelOpportunities: string[];
  };
}

// =============================================================================
// Section 5: Cross-Analysis Synthesis
// =============================================================================

export interface CrossAnalysisSynthesis {
  /** Key strategic insights from all sections */
  keyInsights: {
    insight: string;
    source: string;
    implication: string;
    priority: "high" | "medium" | "low";
  }[];
  /** Recommended positioning */
  recommendedPositioning: string;
  /** Positioning strategy with alternatives */
  positioningStrategy?: {
    primary: string;
    alternatives: string[];
    differentiators: string[];
    avoidPositions: string[];
  };
  /** Messaging framework with ad hooks */
  messagingFramework?: {
    coreMessage: string;
    supportingMessages: string[];
    proofPoints: string[];
    tonalGuidelines: string[];
    adHooks: {
      hook: string;
      technique: "controversial" | "revelation" | "myth-bust" | "status-quo-challenge" | "curiosity-gap" | "story" | "fear" | "social-proof" | "urgency" | "authority" | "comparison";
      targetAwareness: "unaware" | "problem-aware" | "solution-aware" | "product-aware" | "most-aware";
      source?: {
        type: "extracted" | "inspired" | "generated";
        competitors?: string[];
        platform?: "linkedin" | "meta" | "google";
      };
    }[];
    angles: {
      name: string;
      description: string;
      targetEmotion: string;
      exampleHeadline: string;
    }[];
    proofPointsDetailed: {
      claim: string;
      evidence: string;
      source?: string;
    }[];
    objectionHandlers: {
      objection: string;
      response: string;
      reframe: string;
    }[];
  };
  /** Recommended platforms based on analysis */
  recommendedPlatforms: {
    platform: string;
    reasoning: string;
    priority: "primary" | "secondary" | "testing";
  }[];
  /** Critical success factors */
  criticalSuccessFactors: string[];
  /** Potential blockers */
  potentialBlockers: string[];
  /** Next steps recommendations */
  nextSteps: string[];
}

// =============================================================================
// SEO Audit Types (Technical SEO + Performance)
// =============================================================================

export interface SEOPageCheck {
  url: string;
  title: { value: string | null; length: number; pass: boolean };
  metaDescription: { value: string | null; length: number; pass: boolean };
  h1: { values: string[]; pass: boolean };
  canonical: { value: string | null; pass: boolean };
  robots: { value: string | null; indexable: boolean };
  images: { total: number; withAlt: number; coveragePercent: number };
  internalLinks: number;
  schemaTypes: string[];
  hasViewport: boolean;
  isHttps: boolean;
}

export interface SEOTechnicalAudit {
  pages: SEOPageCheck[];
  sitemapFound: boolean;
  robotsTxtFound: boolean;
  overallScore: number;
  issueCount: { critical: number; warning: number; pass: number };
}

export interface PageSpeedMetrics {
  performanceScore: number;
  lcp: number;
  fid: number;
  cls: number;
  fcp: number;
  tti: number;
  speedIndex: number;
}

export interface SEOPerformanceAudit {
  mobile: PageSpeedMetrics | null;
  desktop: PageSpeedMetrics | null;
  url: string;
}

export interface SEOAuditData {
  technical: SEOTechnicalAudit;
  performance: SEOPerformanceAudit;
  overallScore: number;
  collectedAt: string;
}

// =============================================================================
// Section 6: Keyword Intelligence (SpyFu)
// =============================================================================

export type KeywordSource = 'gap_organic' | 'gap_paid' | 'competitor_top' | 'related' | 'shared';

export interface KeywordOpportunity {
  keyword: string;
  searchVolume: number;
  cpc: number;
  /** Ranking difficulty 1-100 */
  difficulty: number;
  clicksPerMonth?: number;
  source: KeywordSource;
  /** Which competitors rank for this keyword */
  competitors?: string[];
}

export interface DomainKeywordStats {
  domain: string;
  organicKeywords: number;
  paidKeywords: number;
  monthlyOrganicClicks: number;
  monthlyPaidClicks: number;
  /** Estimated monthly value of organic traffic */
  organicClicksValue: number;
  /** Estimated monthly PPC spend */
  paidClicksValue: number;
}

export interface ContentTopicCluster {
  theme: string;
  keywords: string[];
  searchVolumeTotal: number;
  /** Recommended content format: blog, landing page, comparison, guide */
  recommendedFormat: string;
}

export interface KeywordStrategicRecommendations {
  organicStrategy: string[];
  paidSearchStrategy: string[];
  competitivePositioning: string[];
  quickWinActions: string[];
}

/**
 * Keyword Intelligence section — populated asynchronously by SpyFu enrichment
 * (parallel with Phase 2/3) and merged at the API route level.
 * All fields are populated by SpyFu API data + deterministic categorization rules.
 * Phase 3 synthesis reads this data to inform strategic recommendations
 * but does NOT modify these fields.
 */
export interface KeywordIntelligence {
  /** Client domain stats (null if no data available) */
  clientDomain: DomainKeywordStats | null;
  /** Competitor domain stats */
  competitorDomains: DomainKeywordStats[];

  /** Raw opportunities from SpyFu */
  organicGaps: KeywordOpportunity[];
  paidGaps: KeywordOpportunity[];
  sharedKeywords: KeywordOpportunity[];
  relatedExpansions: KeywordOpportunity[];
  /** Keywords only the client ranks for (competitors don't) — defensive strengths */
  clientStrengths: KeywordOpportunity[];
  /** Top keywords per competitor (most valuable organic keywords) */
  competitorTopKeywords: {
    competitorName: string;
    domain: string;
    keywords: KeywordOpportunity[];
  }[];

  /** Categorized opportunities (deterministic rules in enrichment module) */
  quickWins: KeywordOpportunity[];
  longTermPlays: KeywordOpportunity[];
  highIntentKeywords: KeywordOpportunity[];

  /** Thematic content clusters */
  contentTopicClusters: ContentTopicCluster[];

  /** Strategic recommendations */
  strategicRecommendations: KeywordStrategicRecommendations;

  /** Collection metadata */
  metadata: {
    clientDomain: string;
    competitorDomainsAnalyzed: string[];
    totalKeywordsAnalyzed: number;
    spyfuCost: number;
    collectedAt: string;
    /** Number of keywords removed by B2B volume ceiling (>50K/mo) */
    volumeCappedKeywords?: number;
  };

  /** SEO Audit data (optional - requires client URL) */
  seoAudit?: SEOAuditData;
}

// =============================================================================
// Complete Strategic Blueprint Output
// =============================================================================

export interface StrategicBlueprintOutput {
  /** Section 1: Industry & Market Overview */
  industryMarketOverview: IndustryMarketOverview;
  /** Section 2: ICP Analysis & Validation */
  icpAnalysisValidation: ICPAnalysisValidation;
  /** Section 3: Offer Analysis & Viability */
  offerAnalysisViability: OfferAnalysisViability;
  /** Section 4: Competitor Analysis */
  competitorAnalysis: CompetitorAnalysis;
  /** Section 5: Cross-Analysis Synthesis */
  crossAnalysisSynthesis: CrossAnalysisSynthesis;
  /** Section 6: Keyword Intelligence (optional - requires client URL + SpyFu API key) */
  keywordIntelligence?: KeywordIntelligence;
  /** Metadata */
  metadata: StrategicBlueprintMetadata;
}

export interface StrategicBlueprintMetadata {
  /** When the research was generated */
  generatedAt: string;
  /** Version of the output structure */
  version: string;
  /** Total processing time in ms */
  processingTime: number;
  /** Total cost of AI calls */
  totalCost: number;
  /** Models used */
  modelsUsed: string[];
  /** Overall confidence score (0-100) */
  overallConfidence?: number;
  /** Per-section timing data in ms */
  sectionTimings?: Record<string, number>;
  /** Citations collected during research (keyed by section) */
  sectionCitations?: Record<string, Citation[] | { url: string; title?: string }[]>;
  /** Reconciliation notes from parallel Phase 2 execution (if any conflicts detected) */
  reconciliationNotes?: string[];
  /** Number of reconciliation adjustments made */
  reconciliationAdjustments?: number;
}

// =============================================================================
// Progress Types for Streaming
// =============================================================================

export type StrategicBlueprintSection = keyof Omit<StrategicBlueprintOutput, "metadata">;

export interface StrategicBlueprintProgress {
  /** Current section being generated */
  currentSection: StrategicBlueprintSection | null;
  /** Completed sections */
  completedSections: StrategicBlueprintSection[];
  /** Partial output with completed sections */
  partialOutput: Partial<StrategicBlueprintOutput>;
  /** Progress percentage */
  progressPercentage: number;
  /** Current progress message */
  progressMessage: string;
  /** Error if any */
  error?: string;
}

// =============================================================================
// Section Order & Labels
// =============================================================================

export const STRATEGIC_BLUEPRINT_SECTION_ORDER: StrategicBlueprintSection[] = [
  "industryMarketOverview",
  "icpAnalysisValidation",
  "offerAnalysisViability",
  "competitorAnalysis",
  "crossAnalysisSynthesis",
  "keywordIntelligence",
];

export const STRATEGIC_BLUEPRINT_SECTION_LABELS: Record<StrategicBlueprintSection, string> = {
  industryMarketOverview: "Industry & Market Overview",
  icpAnalysisValidation: "ICP Analysis & Validation",
  offerAnalysisViability: "Offer Analysis & Viability",
  competitorAnalysis: "Competitor Analysis",
  crossAnalysisSynthesis: "Cross-Analysis Synthesis",
  keywordIntelligence: "Keyword Intelligence",
};

// =============================================================================
// Citation Types (for research agent responses)
// =============================================================================

/** A citation from a research model response */
export interface Citation {
  /** Source URL */
  url: string;
  /** Source title (from search_results) */
  title?: string;
  /** Publication/last updated date */
  date?: string;
  /** Brief excerpt from the source */
  snippet?: string;
}

/** Section output with citations */
export interface CitedSectionOutput<T> {
  /** The section data */
  data: T;
  /** Citations used to generate this section */
  citations: Citation[];
  /** Model that generated this section */
  model: string;
  /** Cost of this section's generation */
  cost: number;
}
