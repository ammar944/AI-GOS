// Review Verification Module
// Validates that fetched review data (G2, Trustpilot) actually belongs to the
// intended competitor. Prevents wrong-company reviews from corrupting blueprints.
//
// Tier 1: Deterministic domain matching (free, instant)
// Tier 2: LLM verification via Haiku (fast, ~$0.0005/call)

import { generateObject } from 'ai';
import { z } from 'zod';
import { MODELS, estimateCost } from './providers';
import { groq, GROQ_EXTRACTION_MODEL } from './groq-provider';

// =============================================================================
// Types
// =============================================================================

export interface CompetitorContext {
  name: string;
  website?: string;
  positioning: string;
  offer: string;
}

export interface ReviewSourceInfo {
  source: 'g2' | 'trustpilot' | 'capterra';
  url?: string;
  productName?: string;
  productCategory?: string;
  productDescription?: string;
  rating?: number | null;
  reviewCount?: number | null;
}

export interface VerificationResult {
  verified: boolean;
  confidence: 'high' | 'low';
  reason: string;
  cost: number;
  tier: 1 | 2;
}

// =============================================================================
// Helpers
// =============================================================================

/** Extract bare domain from a URL (e.g., "https://www.example.com/foo" -> "example.com") */
function extractDomain(url: string): string | null {
  try {
    let normalized = url.trim();
    if (!normalized.startsWith('http')) normalized = `https://${normalized}`;
    const parsed = new URL(normalized);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/** Extract the target domain from a Trustpilot review URL */
function extractTrustpilotDomain(url: string): string | null {
  // Trustpilot URLs follow: trustpilot.com/review/{domain}
  const match = url.match(/trustpilot\.com\/review\/([^/?#]+)/i);
  if (!match) return null;
  return match[1].replace(/^www\./, '').toLowerCase();
}

/** Detect whether a URL is a Capterra product page */
function isCapterraUrl(url: string): boolean {
  // Capterra product URLs follow: capterra.com/p/{id}/{slug}/ or capterra.com/software/{category}/{slug}/
  return /capterra\.com\/(p\/\d+|software\/[^/?#]+\/[^/?#]+)/i.test(url);
}

// =============================================================================
// Tier 1: Deterministic domain matching
// =============================================================================

function tryTier1(
  competitor: CompetitorContext,
  reviewInfo: ReviewSourceInfo,
): VerificationResult | null {
  // Trustpilot URLs encode the target domain directly
  if (reviewInfo.source === 'trustpilot' && reviewInfo.url && competitor.website) {
    const competitorDomain = extractDomain(competitor.website);
    const trustpilotDomain = extractTrustpilotDomain(reviewInfo.url);

    if (competitorDomain && trustpilotDomain) {
      const match = competitorDomain === trustpilotDomain;
      return {
        verified: match,
        confidence: 'high',
        reason: match
          ? `Domain match: ${competitorDomain}`
          : `Domain mismatch: competitor is ${competitorDomain}, Trustpilot page is for ${trustpilotDomain}`,
        cost: 0,
        tier: 1,
      };
    }
  }

  // Capterra URLs: verify the URL is on capterra.com — product match requires LLM
  if (reviewInfo.source === 'capterra' && reviewInfo.url) {
    if (!isCapterraUrl(reviewInfo.url)) {
      return {
        verified: false,
        confidence: 'high',
        reason: `URL does not match expected Capterra product page pattern: ${reviewInfo.url}`,
        cost: 0,
        tier: 1,
      };
    }
    // URL looks like a valid Capterra page — fall through to LLM for product identity check
  }

  // G2 URLs are g2.com/products/{slug} — no competitor domain embedded, skip to Tier 2
  // No URLs available — skip to Tier 2
  return null;
}

// =============================================================================
// Tier 2: LLM verification (Haiku)
// =============================================================================

const verificationSchema = z.object({
  match: z
    .boolean()
    .describe('True if the review listing is for the same product/company as the competitor'),
  reason: z
    .string()
    .describe('One-sentence explanation of why this is or is not a match'),
});

async function runTier2(
  competitor: CompetitorContext,
  reviewInfo: ReviewSourceInfo,
): Promise<VerificationResult> {
  try {
    const { object, usage } = await generateObject({
      model: groq(GROQ_EXTRACTION_MODEL),
      schema: verificationSchema,
      temperature: 0.1,
      maxOutputTokens: 256,
      prompt: `Determine if this review listing is for the same company/product as the competitor.

## Competitor
- Name: ${competitor.name}
- Website: ${competitor.website || 'unknown'}
- Positioning: ${competitor.positioning}
- Offer: ${competitor.offer}

## Review Listing (${reviewInfo.source.toUpperCase()})
- Listed name: ${reviewInfo.productName || 'unknown'}
- Category: ${reviewInfo.productCategory || 'unknown'}
- Description: ${reviewInfo.productDescription || 'unknown'}
- URL: ${reviewInfo.url || 'unknown'}

Are these the same product/company? Consider name similarity, industry alignment, and product description. Companies with similar names but completely different industries are NOT matches.
Note: G2, Capterra, and Trustpilot listings may use slightly different product names — focus on whether the underlying company/product is the same.`,
    });

    const cost = estimateCost(
      MODELS.GPT_OSS_20B,
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0,
    );

    return {
      verified: object.match,
      confidence: 'low',
      reason: object.reason,
      cost,
      tier: 2,
    };
  } catch (error) {
    // Fail closed: wrong reviews are worse than missing reviews
    console.error(
      '[ReviewVerification] LLM verification failed, rejecting:',
      error instanceof Error ? error.message : error,
    );
    return {
      verified: false,
      confidence: 'low',
      reason: 'Verification failed (LLM error) — rejecting to prevent wrong data',
      cost: 0,
      tier: 2,
    };
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Verify that a review source (G2 listing, Trustpilot page) belongs to the
 * intended competitor.
 *
 * Tier 1 (free): Deterministic domain matching for Trustpilot URLs
 * Tier 2 (~$0.0005): Haiku LLM verification for G2 and ambiguous cases
 */
export async function verifyReviewSource(
  competitor: CompetitorContext,
  reviewInfo: ReviewSourceInfo,
): Promise<VerificationResult> {
  // Try Tier 1 first
  const tier1Result = tryTier1(competitor, reviewInfo);
  if (tier1Result) return tier1Result;

  // Fall through to Tier 2
  return runTier2(competitor, reviewInfo);
}
