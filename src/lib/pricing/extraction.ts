// Pricing Extraction Service
// LLM-based pricing extraction with Zod validation and confidence scoring

import { createOpenRouterClient, MODELS } from '@/lib/openrouter/client';
import {
  PricingExtractionResultSchema,
  type PricingExtractionOptions,
  type ScoredPricingResult,
  type ConfidenceBreakdown,
  type ConfidenceLevel,
  type BatchPricingExtractionOptions,
  type BatchPricingExtractionResult,
  type ExtractedPricingTier,
} from './types';

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_CONCURRENCY = 3;

/**
 * System prompt for pricing extraction
 * Emphasizes accuracy and source attribution to prevent hallucination
 */
const EXTRACTION_SYSTEM_PROMPT = `You are a pricing data extraction specialist. Your task is to extract structured pricing information from scraped pricing page content.

CRITICAL RULES:
1. Extract ONLY pricing explicitly stated in the content. Do NOT infer, guess, or make up prices.
2. If you cannot find explicit pricing, return an empty tiers array.
3. For each tier, include a sourceQuote - the exact text from the content where you found this information.
4. "Contact sales", "Contact us", "Get a quote", or "Custom pricing" indicates custom pricing - set hasCustomPricing to true.
5. Common tier names: Free, Starter, Basic, Pro, Professional, Business, Enterprise, Team, Growth, Scale.
6. Price formats vary: "$99/mo", "$99/month", "$1,188/year", "€99/mo", "£99/mo", "Free".
7. Extract billing period if mentioned (monthly, annual, yearly, one-time, per user/seat).
8. Extract currency if identifiable from price symbols or text.

IMPORTANT - Price field requirements:
- The "price" field is REQUIRED and must ALWAYS be a non-empty string.
- For Enterprise/Custom tiers with no listed price, use: "Custom" or "Contact sales"
- For free tiers, use: "Free" or "$0"
- NEVER return null, undefined, or empty string for the price field.

REQUIRED JSON OUTPUT STRUCTURE:
{
  "tiers": [
    {
      "tier": "string - tier name exactly as shown",
      "price": "string - REQUIRED, price exactly as shown (e.g., '$99/mo', 'Free', 'Custom', 'Contact sales')",
      "description": "string - brief description if available",
      "targetAudience": "string - who this tier is for if mentioned",
      "features": ["array of key features if listed"],
      "limitations": "string - usage limits if mentioned",
      "sourceQuote": "string - exact quote from content where this was found"
    }
  ],
  "hasCustomPricing": boolean,
  "currency": "string - e.g., 'USD', 'EUR', 'GBP' or null if unclear",
  "billingPeriod": "string - e.g., 'monthly', 'annual' or null if unclear"
}

If no pricing information is found, return: {"tiers": [], "hasCustomPricing": false}`;

/**
 * Extract pricing tiers from markdown content using LLM
 *
 * @param options - Extraction options including markdown content
 * @returns Scored extraction result with confidence scoring
 */
export async function extractPricing(
  options: PricingExtractionOptions
): Promise<ScoredPricingResult> {
  const {
    markdown,
    sourceUrl,
    companyName,
    timeout = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  // Validate input
  if (!markdown || markdown.trim().length === 0) {
    return createFailureResult('Empty markdown content provided', sourceUrl);
  }

  // Check for minimum content (likely JS rendering issue if too short)
  const wordCount = markdown.split(/\s+/).length;
  if (wordCount < 50) {
    console.warn(
      `[Pricing Extraction] Very low word count (${wordCount}) for ${sourceUrl || 'unknown'} - may be JS rendering issue`
    );
  }

  try {
    const client = createOpenRouterClient();

    // Build user prompt with context
    const userPrompt = buildUserPrompt(markdown, companyName);

    // Use Gemini 2.0 Flash for cost-efficient extraction
    const response = await client.chatJSONValidated(
      {
        model: MODELS.GEMINI_FLASH,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1, // Low temperature for deterministic extraction
        maxTokens: 2048,
        timeout,
      },
      PricingExtractionResultSchema,
      maxRetries
    );

    const extractionResult = response.data;

    // Calculate confidence score
    const confidenceBreakdown = calculateConfidenceBreakdown(
      extractionResult.tiers,
      markdown
    );
    const confidence = calculateOverallConfidence(confidenceBreakdown);
    const confidenceLevel = getConfidenceLevel(confidence);

    console.log(
      `[Pricing Extraction] Extracted ${extractionResult.tiers.length} tiers for ${sourceUrl || 'unknown'} (confidence: ${confidence}%)`
    );

    return {
      success: true,
      tiers: extractionResult.tiers,
      confidence,
      confidenceLevel,
      confidenceBreakdown,
      hasCustomPricing: extractionResult.hasCustomPricing,
      currency: extractionResult.currency ?? undefined,
      billingPeriod: extractionResult.billingPeriod ?? undefined,
      sourceUrl,
      cost: response.cost,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Pricing Extraction] Failed for ${sourceUrl || 'unknown'}:`, errorMessage);

    return createFailureResult(errorMessage, sourceUrl);
  }
}

/**
 * Extract pricing from multiple sources in batch (with concurrency control)
 *
 * @param options - Batch extraction options
 * @returns Batch result with individual results and totals
 */
export async function extractPricingBatch(
  options: BatchPricingExtractionOptions
): Promise<BatchPricingExtractionResult> {
  const {
    requests,
    timeout = DEFAULT_TIMEOUT,
    concurrency = DEFAULT_CONCURRENCY,
  } = options;

  const results = new Map<string, ScoredPricingResult>();
  let totalCost = 0;

  // Process in chunks for concurrency control
  const chunks = chunkArray(requests, concurrency);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (req) => {
        const result = await extractPricing({
          markdown: req.markdown,
          sourceUrl: req.sourceUrl,
          companyName: req.companyName,
          timeout,
        });
        return { id: req.id, result };
      })
    );

    for (const { id, result } of chunkResults) {
      results.set(id, result);
      totalCost += result.cost;
    }
  }

  const successCount = Array.from(results.values()).filter((r) => r.success).length;

  return {
    results,
    successCount,
    failureCount: requests.length - successCount,
    totalCost,
  };
}

/**
 * Build user prompt with markdown content and optional company context
 */
function buildUserPrompt(markdown: string, companyName?: string): string {
  // Truncate very long content to stay within token limits
  const maxLength = 15000;
  const truncatedMarkdown =
    markdown.length > maxLength
      ? markdown.slice(0, maxLength) + '\n\n[Content truncated...]'
      : markdown;

  let prompt = 'Extract pricing information from this pricing page content:\n\n';

  if (companyName) {
    prompt += `Company: ${companyName}\n\n`;
  }

  prompt += '---BEGIN CONTENT---\n';
  prompt += truncatedMarkdown;
  prompt += '\n---END CONTENT---\n\n';
  prompt += 'Extract all pricing tiers found in the content above. If no pricing is found, return empty tiers array.';

  return prompt;
}

/**
 * Calculate confidence breakdown using multi-signal scoring
 */
function calculateConfidenceBreakdown(
  tiers: ExtractedPricingTier[],
  markdown: string
): ConfidenceBreakdown {
  // Source overlap: Do the extracted values appear in the source?
  const sourceOverlap = calculateSourceOverlap(tiers, markdown);

  // Schema completeness: Are required fields filled?
  const schemaCompleteness = calculateSchemaCompleteness(tiers);

  // Field plausibility: Are the values reasonable?
  const fieldPlausibility = calculateFieldPlausibility(tiers);

  // Tier count: Is the number of tiers reasonable?
  const tierCountReasonable = calculateTierCountScore(tiers.length);

  // Price format: Are prices in valid formats?
  const priceFormatValid = calculatePriceFormatScore(tiers);

  return {
    sourceOverlap,
    schemaCompleteness,
    fieldPlausibility,
    tierCountReasonable,
    priceFormatValid,
  };
}

/**
 * Calculate overall confidence from breakdown (weighted average)
 *
 * Weights:
 * - Source overlap: 40%
 * - Schema completeness: 20%
 * - Field plausibility: 20%
 * - Tier count: 10%
 * - Price format: 10%
 */
function calculateOverallConfidence(breakdown: ConfidenceBreakdown): number {
  const weighted =
    breakdown.sourceOverlap * 0.4 +
    breakdown.schemaCompleteness * 0.2 +
    breakdown.fieldPlausibility * 0.2 +
    breakdown.tierCountReasonable * 0.1 +
    breakdown.priceFormatValid * 0.1;

  return Math.round(weighted);
}

/**
 * Convert numeric confidence to level category
 */
function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 80) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}

/**
 * Calculate source overlap score
 * Checks if extracted tier names and prices appear in source markdown
 */
function calculateSourceOverlap(
  tiers: ExtractedPricingTier[],
  markdown: string
): number {
  if (tiers.length === 0) return 0;

  const lowerMarkdown = markdown.toLowerCase();
  let foundCount = 0;
  let totalChecks = 0;

  for (const tier of tiers) {
    // Check tier name
    totalChecks++;
    if (lowerMarkdown.includes(tier.tier.toLowerCase())) {
      foundCount++;
    }

    // Check price (remove $ and check numeric part)
    totalChecks++;
    const priceMatch = tier.price.match(/[\d,]+(?:\.\d{2})?/);
    if (priceMatch && markdown.includes(priceMatch[0])) {
      foundCount++;
    }

    // Check source quote if provided
    if (tier.sourceQuote) {
      totalChecks++;
      // Check if at least 60% of source quote words appear in markdown
      const quoteWords = tier.sourceQuote.toLowerCase().split(/\s+/);
      const foundWords = quoteWords.filter((w) => lowerMarkdown.includes(w));
      if (foundWords.length >= quoteWords.length * 0.6) {
        foundCount++;
      }
    }
  }

  return totalChecks > 0 ? Math.round((foundCount / totalChecks) * 100) : 0;
}

/**
 * Calculate schema completeness score
 * Checks how many optional fields are filled
 */
function calculateSchemaCompleteness(tiers: ExtractedPricingTier[]): number {
  if (tiers.length === 0) return 0;

  let totalFields = 0;
  let filledFields = 0;

  for (const tier of tiers) {
    // Required fields (always count as filled if we got here)
    totalFields += 2; // tier, price
    filledFields += 2;

    // Optional fields
    totalFields += 5; // description, targetAudience, features, limitations, sourceQuote

    if (tier.description && tier.description.length > 0) filledFields++;
    if (tier.targetAudience && tier.targetAudience.length > 0) filledFields++;
    if (tier.features && tier.features.length > 0) filledFields++;
    if (tier.limitations && tier.limitations.length > 0) filledFields++;
    if (tier.sourceQuote && tier.sourceQuote.length > 0) filledFields++;
  }

  return Math.round((filledFields / totalFields) * 100);
}

/**
 * Calculate field plausibility score
 * Checks if values look reasonable (not hallucinated)
 */
function calculateFieldPlausibility(tiers: ExtractedPricingTier[]): number {
  if (tiers.length === 0) return 0;

  let plausibleCount = 0;
  let totalChecks = 0;

  for (const tier of tiers) {
    // Tier name should be reasonable length (1-50 chars)
    totalChecks++;
    if (tier.tier.length >= 1 && tier.tier.length <= 50) {
      plausibleCount++;
    }

    // Price should match common patterns
    totalChecks++;
    if (isPlausiblePrice(tier.price)) {
      plausibleCount++;
    }

    // Features should not be too generic or too long
    if (tier.features && tier.features.length > 0) {
      totalChecks++;
      const reasonableFeatures = tier.features.filter(
        (f) => f.length > 3 && f.length < 200
      );
      if (reasonableFeatures.length >= tier.features.length * 0.8) {
        plausibleCount++;
      }
    }
  }

  return totalChecks > 0 ? Math.round((plausibleCount / totalChecks) * 100) : 0;
}

/**
 * Check if a price string looks plausible
 */
function isPlausiblePrice(price: string): boolean {
  const lowerPrice = price.toLowerCase();

  // Common valid patterns
  const validPatterns = [
    /^free$/i,
    /^custom/i,
    /^contact/i,
    /^get\s+quote/i,
    /^[\$€£¥]?\s*[\d,]+(?:\.\d{2})?\s*(?:\/?\s*(?:mo|month|yr|year|user|seat|agent)?)?$/i,
    /^[\d,]+(?:\.\d{2})?\s*(?:usd|eur|gbp)?(?:\s*\/?\s*(?:mo|month|yr|year))?$/i,
  ];

  return validPatterns.some((pattern) => pattern.test(lowerPrice));
}

/**
 * Calculate tier count reasonableness score
 * Most SaaS companies have 2-5 tiers
 */
function calculateTierCountScore(count: number): number {
  if (count === 0) return 0;
  if (count >= 2 && count <= 5) return 100;
  if (count === 1) return 70; // Single tier is unusual but valid
  if (count === 6) return 80;
  if (count >= 7 && count <= 10) return 60;
  return 40; // More than 10 tiers is suspicious
}

/**
 * Calculate price format validity score
 * Checks if prices are in recognizable formats
 */
function calculatePriceFormatScore(tiers: ExtractedPricingTier[]): number {
  if (tiers.length === 0) return 0;

  const validCount = tiers.filter((t) => isPlausiblePrice(t.price)).length;
  return Math.round((validCount / tiers.length) * 100);
}

/**
 * Create a failure result with zero confidence
 */
function createFailureResult(
  error: string,
  sourceUrl?: string
): ScoredPricingResult {
  return {
    success: false,
    tiers: [],
    confidence: 0,
    confidenceLevel: 'low',
    confidenceBreakdown: {
      sourceOverlap: 0,
      schemaCompleteness: 0,
      fieldPlausibility: 0,
      tierCountReasonable: 0,
      priceFormatValid: 0,
    },
    hasCustomPricing: false,
    sourceUrl,
    error,
    cost: 0,
  };
}

/**
 * Split array into chunks for controlled concurrency
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
