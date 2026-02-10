// Review Mining Module
// Scrapes Trustpilot reviews and G2 metadata for competitor analysis.
// Trustpilot: Construct URL from domain → Firecrawl scrape → regex parse markdown
// G2: Perplexity SERP metadata only (rating + count). Firecrawl is blocked on G2.

import { generateObject } from 'ai';
import { z } from 'zod';
import { createFirecrawlClient } from '@/lib/firecrawl';
import { perplexity, MODELS, estimateCost } from './providers';
import type {
  TrustpilotReviewData,
  TrustpilotReview,
  G2ReviewMetadata,
  CompetitorReviewData,
} from '@/lib/strategic-blueprint/output-types';

// =============================================================================
// Types
// =============================================================================

export interface ReviewMiningResult {
  reviewData: CompetitorReviewData;
  cost: number;
}

// =============================================================================
// Helpers
// =============================================================================

/** Extract bare domain from a website URL (e.g., "https://www.example.com/foo" → "example.com") */
function extractDomain(website: string): string {
  try {
    let url = website.trim();
    if (!url.startsWith('http')) url = `https://${url}`;
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    // Fallback: strip protocol and www
    return website
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .trim();
  }
}

/** Basic relevance filter — returns false for reviews clearly not about the product/service */
function isProductReview(text: string): boolean {
  const lower = text.toLowerCase();

  // Employment/HR-related signals — these reviews are about working AT the company, not USING the product
  const employmentKeywords = [
    'applying for a job', 'job application', 'job interview', 'hiring process',
    'interview process', 'as an employee', 'working there', 'work environment',
    'got hired', 'got fired', 'called me a', 'called the', 'applied for',
  ];

  // Product-related signals — if any of these appear alongside employment keywords, keep the review
  const productKeywords = [
    'software', 'tool', 'platform', 'dashboard', 'data', 'integration',
    'report', 'analytics', 'feature', 'api', 'subscription', 'billing',
    'pricing', 'support ticket', 'bug', 'app', 'product',
  ];

  const hasEmploymentSignal = employmentKeywords.some(kw => lower.includes(kw));
  if (!hasEmploymentSignal) return true; // No employment signal → keep it

  const hasProductSignal = productKeywords.some(kw => lower.includes(kw));
  return hasProductSignal; // Has both → keep (could be about product hiring/billing). Employment-only → skip.
}

// =============================================================================
// Trustpilot: Direct scrape (ground truth)
// =============================================================================

interface TrustpilotResult {
  data: TrustpilotReviewData | null;
  cost: number;
}

export async function scrapeTrustpilotReviews(
  domain: string,
  onProgress?: (message: string) => void,
): Promise<TrustpilotResult> {
  const firecrawlClient = createFirecrawlClient();
  if (!firecrawlClient.isAvailable()) {
    return { data: null, cost: 0 };
  }

  const url = `https://www.trustpilot.com/review/${domain}`;
  onProgress?.(`Scraping Trustpilot for ${domain}...`);

  try {
    const scrapeResult = await firecrawlClient.scrape({
      url,
      timeout: 15000,
    });

    // Firecrawl scrape costs ~$0.01
    const scrapeCost = 0.01;

    if (!scrapeResult.success || !scrapeResult.markdown) {
      return { data: null, cost: scrapeCost };
    }

    const markdown = scrapeResult.markdown;

    // Page too short means company likely not on Trustpilot
    if (markdown.length < 300) {
      console.log(`[ReviewMining] Trustpilot page too short for ${domain} — likely not on platform`);
      return { data: null, cost: scrapeCost };
    }

    // Parse structured data from markdown
    const trustScoreMatch = markdown.match(/(\d+\.\d+)/);
    const totalReviewsMatch =
      markdown.match(/Reviews\s*([\d,]+)/i) ||
      markdown.match(/([\d,]+)\s*reviews/i);

    // Extract Trustpilot's own AI summary
    const aiSummaryMatch = markdown.match(
      /Review summary\s*\n\s*Based on reviews, created with AI\s*\n([\s\S]*?)(?=\n###|\nBased on these reviews)/,
    );

    // Extract individual reviews
    const reviewBlocks = markdown.split(/(?=Rated \d out of 5 stars)/);
    const reviews: TrustpilotReview[] = [];

    for (const block of reviewBlocks.slice(1)) {
      const ratingMatch = block.match(/Rated (\d) out of 5 stars/);
      if (!ratingMatch) continue;
      const rating = parseInt(ratingMatch[1]);

      const lines = block.split('\n').filter((l) => l.trim().length > 0);
      const textLines: string[] = [];
      let date = '';

      for (const line of lines.slice(1)) {
        if (line.includes('Useful') || line.includes('Share') || line.includes('Flag'))
          continue;
        if (line.includes('Reply from')) break;
        if (line.includes('Date of experience')) {
          date = line
            .replace('Date of experience:', '')
            .replace('Date of experience', '')
            .trim();
          continue;
        }
        if (line.trim().length > 15) textLines.push(line.trim());
      }

      const text = textLines.join(' ').trim();
      if (text.length > 30) {
        if (!isProductReview(text)) {
          console.log(`[ReviewMining] Filtered non-product review for ${domain}: "${text.slice(0, 80)}..."`);
          continue;
        }
        reviews.push({
          rating,
          text: text.slice(0, 500),
          date: date || undefined,
        });
      }
    }

    const trustScore = trustScoreMatch ? parseFloat(trustScoreMatch[1]) : null;
    const totalReviews = totalReviewsMatch
      ? parseInt(totalReviewsMatch[1].replace(/,/g, ''))
      : null;
    const aiSummary = aiSummaryMatch?.[1]?.trim() ?? null;

    console.log(
      `[ReviewMining] Trustpilot ${domain}: score=${trustScore}, total=${totalReviews}, scraped=${reviews.length} reviews`,
    );

    return {
      data: { url, trustScore, totalReviews, aiSummary, reviews },
      cost: scrapeCost,
    };
  } catch (error) {
    console.error(`[ReviewMining] Trustpilot error for ${domain}:`, error);
    return { data: null, cost: 0.01 };
  }
}

// =============================================================================
// G2: Perplexity SERP metadata (rating + review count)
// =============================================================================

const g2MetadataSchema = z.object({
  found: z.boolean(),
  url: z.string().optional(),
  rating: z
    .number()
    .optional()
    .describe('G2 star rating out of 5. ONLY from the G2 page itself.'),
  reviewCount: z
    .number()
    .optional()
    .describe('Total reviews on G2. ONLY from G2 data.'),
  productCategory: z
    .string()
    .optional()
    .describe('G2 category for this product'),
});

interface G2Result {
  data: G2ReviewMetadata | null;
  cost: number;
}

export async function getG2Metadata(
  competitorName: string,
  onProgress?: (message: string) => void,
): Promise<G2Result> {
  onProgress?.(`Looking up G2 metadata for ${competitorName}...`);

  try {
    const model = MODELS.SONAR_PRO;
    const result = await generateObject({
      model: perplexity(model),
      schema: g2MetadataSchema,
      temperature: 0.1,
      maxOutputTokens: 512,
      system: `You look up G2.com product pages to find their aggregate rating and review count.
ONLY return data that appears on the actual G2 product page (rating stars and review count).
DO NOT summarize reviews or extract quotes. Just the metadata.`,
      prompt: `What is the G2 rating and review count for "${competitorName}"? Search: "${competitorName} site:g2.com"`,
    });

    const obj = result.object;
    const cost = estimateCost(
      model,
      result.usage.inputTokens ?? 0,
      result.usage.outputTokens ?? 0,
    );

    if (!obj.found) {
      console.log(`[ReviewMining] G2: ${competitorName} not found`);
      return { data: null, cost };
    }

    console.log(
      `[ReviewMining] G2 ${competitorName}: rating=${obj.rating}, reviews=${obj.reviewCount}`,
    );

    return {
      data: {
        url: obj.url,
        rating: obj.rating ?? null,
        reviewCount: obj.reviewCount ?? null,
        productCategory: obj.productCategory,
      },
      cost,
    };
  } catch (error) {
    console.error(`[ReviewMining] G2 error for ${competitorName}:`, error);
    return { data: null, cost: 0 };
  }
}

// =============================================================================
// Main: Mine reviews for a single competitor
// =============================================================================

export async function mineCompetitorReviews(
  name: string,
  website: string | undefined,
  onProgress?: (message: string) => void,
): Promise<ReviewMiningResult> {
  const domain = website ? extractDomain(website) : null;

  // Run both sources in parallel — they're independent
  const [trustpilotResult, g2Result] = await Promise.all([
    domain
      ? scrapeTrustpilotReviews(domain, onProgress)
      : Promise.resolve({ data: null, cost: 0 } as TrustpilotResult),
    getG2Metadata(name, onProgress),
  ]);

  const totalCost = trustpilotResult.cost + g2Result.cost;

  return {
    reviewData: {
      trustpilot: trustpilotResult.data,
      g2: g2Result.data,
      collectedAt: new Date().toISOString(),
    },
    cost: totalCost,
  };
}
