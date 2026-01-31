// Pricing Module
// LLM-based pricing extraction from scraped competitor pricing pages

export {
  extractPricing,
  extractPricingBatch,
} from './extraction';

export {
  scorePricingRelevance,
  filterRelevantPricing,
  groupByRelevanceCategory,
  getCoreProductTiers,
  type PricingRelevanceCategory,
  type PricingRelevance,
  type PricingRelevanceOptions,
  type FilterPricingOptions,
  type ScoredPricingTier,
} from './relevance-scorer';

export {
  ExtractedPricingTierSchema,
  PricingExtractionResultSchema,
  type ExtractedPricingTier,
  type PricingExtractionResult,
  type ScoredPricingResult,
  type ConfidenceBreakdown,
  type ConfidenceLevel,
  type PricingExtractionOptions,
  type BatchPricingExtractionOptions,
  type BatchPricingExtractionResult,
} from './types';
