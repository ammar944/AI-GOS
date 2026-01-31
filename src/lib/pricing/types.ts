// Pricing Extraction Types
// Types for LLM-based pricing extraction from scraped content

import { z } from 'zod';

/**
 * Confidence level for extracted data
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Zod schema for a single extracted pricing tier
 * Used for LLM extraction validation
 * Note: Using .nullish() allows both null and undefined from LLM responses
 */
export const ExtractedPricingTierSchema = z.object({
  /** Tier name (e.g., "Starter", "Pro", "Enterprise") */
  tier: z.string().min(1),
  /** Price string (e.g., "$99/mo", "Custom pricing", "Free") */
  price: z.preprocess(
    // Transform null/undefined to "Custom" as a fallback
    (val) => (val === null || val === undefined || val === '') ? 'Custom' : val,
    z.string().min(1)
  ),
  /** Brief description of what this tier offers */
  description: z.string().nullish(),
  /** Target audience for this tier */
  targetAudience: z.string().nullish(),
  /** Key features included at this tier */
  features: z.array(z.string()).nullish(),
  /** Usage limitations */
  limitations: z.string().nullish(),
  /** Source quote from the markdown where this tier was found (anti-hallucination) */
  sourceQuote: z.string().nullish(),
});

/**
 * Zod schema for the complete extraction result from LLM
 * Note: Using .nullish() allows both null and undefined from LLM responses
 */
export const PricingExtractionResultSchema = z.object({
  /** Extracted pricing tiers */
  tiers: z.array(ExtractedPricingTierSchema),
  /** Whether "Contact sales" or custom pricing was detected */
  hasCustomPricing: z.boolean(),
  /** Currency detected (e.g., "USD", "EUR", "GBP") */
  currency: z.string().nullish(),
  /** Billing period detected (e.g., "monthly", "annual", "one-time") */
  billingPeriod: z.string().nullish(),
});

/**
 * TypeScript type for an extracted pricing tier
 */
export type ExtractedPricingTier = z.infer<typeof ExtractedPricingTierSchema>;

/**
 * TypeScript type for the LLM extraction result
 */
export type PricingExtractionResult = z.infer<typeof PricingExtractionResultSchema>;

/**
 * Confidence breakdown for multi-signal scoring
 */
export interface ConfidenceBreakdown {
  /** Source text overlap score (0-100) - 40% weight */
  sourceOverlap: number;
  /** Schema completeness score (0-100) - 20% weight */
  schemaCompleteness: number;
  /** Field plausibility score (0-100) - 20% weight */
  fieldPlausibility: number;
  /** Tier count reasonableness (0-100) - 10% weight */
  tierCountReasonable: number;
  /** Price format validity (0-100) - 10% weight */
  priceFormatValid: number;
}

/**
 * Result of pricing extraction with confidence scoring
 */
export interface ScoredPricingResult {
  /** Whether extraction was successful */
  success: boolean;
  /** Extracted pricing tiers (empty if failed) */
  tiers: ExtractedPricingTier[];
  /** Overall confidence score (0-100) */
  confidence: number;
  /** Confidence level category */
  confidenceLevel: ConfidenceLevel;
  /** Detailed confidence breakdown */
  confidenceBreakdown: ConfidenceBreakdown;
  /** Whether custom/contact pricing was detected */
  hasCustomPricing: boolean;
  /** Currency if detected */
  currency?: string;
  /** Billing period if detected */
  billingPeriod?: string;
  /** Source URL if available */
  sourceUrl?: string;
  /** Error message if extraction failed */
  error?: string;
  /** LLM cost for this extraction */
  cost: number;
}

/**
 * Options for pricing extraction
 */
export interface PricingExtractionOptions {
  /** Markdown content from scraped page */
  markdown: string;
  /** Source URL (for logging and tracking) */
  sourceUrl?: string;
  /** Company name (helps LLM context) */
  companyName?: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retries on validation failure (default: 1) */
  maxRetries?: number;
}

/**
 * Options for batch pricing extraction
 */
export interface BatchPricingExtractionOptions {
  /** Array of extraction requests */
  requests: Array<{
    /** Unique identifier for this request */
    id: string;
    /** Markdown content */
    markdown: string;
    /** Source URL */
    sourceUrl?: string;
    /** Company name */
    companyName?: string;
  }>;
  /** Timeout per extraction in milliseconds (default: 30000) */
  timeout?: number;
  /** Concurrency limit (default: 3) */
  concurrency?: number;
}

/**
 * Result of batch pricing extraction
 */
export interface BatchPricingExtractionResult {
  /** Results keyed by request ID */
  results: Map<string, ScoredPricingResult>;
  /** Total number of successful extractions */
  successCount: number;
  /** Total number of failed extractions */
  failureCount: number;
  /** Total LLM cost */
  totalCost: number;
}
