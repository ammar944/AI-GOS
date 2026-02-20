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
  researchSummaryCompetitors,
  synthesizeCrossAnalysis,
} from './research';

// Competitor tier utilities
export {
  parseCompetitorNames,
  rankCompetitorsByEmphasis,
  DEFAULT_FULL_TIER_LIMIT,
  MAX_TOTAL_COMPETITORS,
} from './competitor-utils';

// Context builder
export {
  createBusinessContext,
  validateOnboardingData,
  type ContextBuilderOptions,
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
  type HookExtractionContext,
} from './hook-extraction';

// Hook Diversity Validator (deterministic validation + quota logic)
export {
  computeAdDistribution,
  getHookQuotas,
  validateHookDiversity,
  remediateHooks,
  validateHookSegmentRelevance,
  type AdDistributionTier,
  type HookQuotas,
  type HookViolation,
} from './hook-diversity-validator';

// Keyword Intelligence (SpyFu competitive analysis)
export {
  enrichKeywordIntelligence,
  type KeywordIntelligenceResult,
  type KeywordBusinessContext,
} from './keyword-intelligence';

// SEO Audit (Technical SEO + PageSpeed Insights)
export {
  runSEOAudit,
  type SEOAuditResult,
} from './seo-audit';

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
  summaryCompetitorBatchSchema,
  type IndustryMarketOverview,
  type ICPAnalysisValidation,
  type OfferAnalysisViability,
  type CompetitorAnalysis,
  type CrossAnalysisSynthesis,
  type SummaryCompetitorBatch,
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
