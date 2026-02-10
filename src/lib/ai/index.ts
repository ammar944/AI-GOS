// AI Module - Vercel AI SDK Integration
// Main exports for Strategic Blueprint generation

// Generator
export {
  generateStrategicBlueprint,
  type StrategicBlueprintOutput,
  type GeneratorOptions,
  type GeneratorResult,
} from './generator';

// Individual research functions (for custom pipelines)
export {
  researchIndustryMarket,
  researchICPAnalysis,
  researchOfferAnalysis,
  researchCompetitors,
  synthesizeCrossAnalysis,
} from './research';

// Context builder
export {
  createBusinessContext,
  validateOnboardingData,
} from './context-builder';

// Competitor enrichment (Firecrawl + Ad Library)
export {
  enrichCompetitors,
  type EnrichmentResult,
} from './competitor-enrichment';

// Review mining (Trustpilot + G2)
export {
  mineCompetitorReviews,
  type ReviewMiningResult,
} from './review-mining';

// Reconciliation (Phase 2 parallel execution)
export {
  reconcileICPAndOffer,
  type ReconciliationResult,
  type ReconciliationAdjustment,
} from './reconciliation';

// Hook Extraction (lightweight re-synthesis optimization)
export {
  extractAdHooksFromAds,
  type ExtractAdHooksResult,
} from './hook-extraction';

// Keyword Intelligence (SpyFu competitive analysis)
export {
  enrichKeywordIntelligence,
  type KeywordIntelligenceResult,
  type KeywordBusinessContext,
} from './keyword-intelligence';

// Types
export type {
  ResearchSource,
  TokenUsage,
  ResearchResult,
  IndustryMarketResult,
  ICPAnalysisResult,
  OfferAnalysisResult,
  CompetitorAnalysisResult,
  CrossAnalysisResult,
  AllSectionResults,
  GenerationProgress,
  ProgressCallback,
} from './types';

// Schemas
export {
  industryMarketSchema,
  icpAnalysisSchema,
  offerAnalysisSchema,
  competitorAnalysisSchema,
  crossAnalysisSchema,
  type IndustryMarketOverview,
  type ICPAnalysisValidation,
  type OfferAnalysisViability,
  type CompetitorAnalysis,
  type CrossAnalysisSynthesis,
} from './schemas';

// Providers (for advanced usage)
export {
  perplexity,
  anthropic,
  MODELS,
  SECTION_MODELS,
  GENERATION_SETTINGS,
  MODEL_COSTS,
  estimateCost,
} from './providers';
