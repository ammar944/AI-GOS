// research-worker/src/tools/reviews.ts
// Fetches Trustpilot (Firecrawl scrape) and G2 (Perplexity search) review data.
// Both run in parallel per competitor. Never throws.

import type { BetaToolResultContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { generateObject } from 'ai';
import { createPerplexity } from '@ai-sdk/perplexity';
import { z } from 'zod';
import { firecrawlTool } from './firecrawl';

export interface TrustpilotResult {
  rating: number | null;
  reviewCount: number | null;
  recentThemes: string[];
  url: string;
}

export interface G2Result {
  rating: number | null;
  reviewCount: number | null;
  categories: string[];
  url: string | null;
}

export interface ReviewResult {
  competitorName: string;
  domain: string;
  trustpilot: TrustpilotResult | null;
  g2: G2Result | null;
  error?: string;
}

// ── Helpers ──

function runResultToString(
  value: string | Array<BetaToolResultContentBlockParam>,
): string {
  if (typeof value === 'string') return value;
  return value
    .map((block) => ('text' in block && typeof block.text === 'string' ? block.text : ''))
    .join('');
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ── Trustpilot (Firecrawl scrape) ──

const TRUSTPILOT_404_PATTERN = /(?:page you're looking for could not be found|Whoops!|404)/i;
const TRUSTPILOT_MIN_CHARS = 300;

const TRUSTPILOT_RATING_PATTERNS = [
  /TrustScore\s*(\d+\.?\d*)/i,
  /(\d+\.?\d*)\s*(?:out of\s*5|\/\s*5)/i,
  /rated?\s+(\d+\.?\d*)/i,
];

const TRUSTPILOT_COUNT_PATTERN = /(\d[\d,]*)\s*(?:total\s+)?reviews?/i;

function parseTrustpilotRating(markdown: string): number | null {
  for (const pattern of TRUSTPILOT_RATING_PATTERNS) {
    const match = markdown.match(pattern);
    if (match?.[1]) {
      const rating = parseFloat(match[1]);
      if (rating >= 1.0 && rating <= 5.0) return rating;
    }
  }
  return null;
}

function parseTrustpilotCount(markdown: string): number | null {
  const match = markdown.match(TRUSTPILOT_COUNT_PATTERN);
  if (match?.[1]) {
    const count = parseInt(match[1].replace(/,/g, ''), 10);
    if (count > 0 && Number.isFinite(count)) return count;
  }
  return null;
}

function parseTrustpilotThemes(markdown: string): string[] {
  const themes: string[] = [];
  const headingPattern = /^#{1,4}\s+(.{3,40})$/gm;
  let match;
  const skipHeadings = /trustpilot|review|about|write|filter|sort|share|report|reply|page|showing|company|whoops|404/i;

  while ((match = headingPattern.exec(markdown)) !== null && themes.length < 5) {
    const heading = match[1].trim();
    if (!skipHeadings.test(heading) && heading.length > 2 && heading.length < 40) {
      themes.push(heading);
    }
  }

  return themes.slice(0, 5);
}

async function scrapeTrustpilot(domain: string): Promise<TrustpilotResult | null> {
  const url = `https://www.trustpilot.com/review/${domain}`;
  console.log(`[reviews] scraping Trustpilot: ${url}`);

  try {
    const resultStr = runResultToString(await firecrawlTool.run({ url }));
    const result = safeJsonParse(resultStr) as {
      success?: boolean;
      markdown?: string;
      error?: unknown;
    } | null;

    const markdown = typeof result?.markdown === 'string' ? result.markdown : '';

    // Detect 404 pages and too-short content
    if (markdown.trim().length < TRUSTPILOT_MIN_CHARS || TRUSTPILOT_404_PATTERN.test(markdown)) {
      console.log(`[reviews] Trustpilot ${domain}: skipped (${markdown.length} chars, 404=${TRUSTPILOT_404_PATTERN.test(markdown)})`);
      return null;
    }

    const rating = parseTrustpilotRating(markdown);
    const reviewCount = parseTrustpilotCount(markdown);
    const recentThemes = parseTrustpilotThemes(markdown);

    // Only return if we got at least a rating or count
    if (rating === null && reviewCount === null) {
      console.log(`[reviews] Trustpilot ${domain}: page found but no rating/count parseable`);
      return null;
    }

    console.log(`[reviews] Trustpilot ${domain}: rating=${rating}, count=${reviewCount}, themes=${recentThemes.length}`);
    return { rating, reviewCount, recentThemes, url };
  } catch (error) {
    console.error(`[reviews] Trustpilot error for ${domain}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ── G2 (Perplexity search + Firecrawl verification) ──

const G2_TIMEOUT_MS = 15_000;
const G2_VERIFY_TIMEOUT_MS = 10_000;

/** Patterns that indicate a G2 page has no real reviews */
const G2_NO_REVIEWS_PATTERNS = [
  /hasn't been reviewed yet/i,
  /be the first to share your experience/i,
  /0\/5\s*\(0\)/,
  /0 out of 5/i,
  /no reviews/i,
];

const g2MetadataSchema = z.object({
  found: z.boolean(),
  url: z.string().optional(),
  rating: z.number().optional().describe('G2 star rating out of 5. ONLY the rating shown directly next to the product name, NOT from sponsored alternatives or comparison widgets.'),
  reviewCount: z.number().optional().describe('Total reviews shown in parentheses next to the star rating on the product page header. NOT from alternative products.'),
  productCategory: z.string().optional().describe('G2 category for this product'),
});

/**
 * Verify G2 data by scraping the actual G2 URL with Firecrawl.
 * Returns false if the page says "hasn't been reviewed yet" or shows 0 reviews.
 */
async function verifyG2Page(url: string, companyName: string): Promise<boolean> {
  try {
    const resultStr = runResultToString(
      await Promise.race([
        firecrawlTool.run({ url }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('G2 verify timeout')), G2_VERIFY_TIMEOUT_MS),
        ),
      ]),
    );
    const result = safeJsonParse(resultStr) as { markdown?: string } | null;
    const markdown = typeof result?.markdown === 'string' ? result.markdown : '';

    if (markdown.length < 100) {
      console.log(`[reviews] G2 verify ${companyName}: page too short (${markdown.length} chars)`);
      return false;
    }

    for (const pattern of G2_NO_REVIEWS_PATTERNS) {
      if (pattern.test(markdown)) {
        console.log(`[reviews] G2 verify ${companyName}: REJECTED — page says "${pattern.source}"`);
        return false;
      }
    }

    console.log(`[reviews] G2 verify ${companyName}: passed (${markdown.length} chars, no rejection patterns)`);
    return true;
  } catch (error) {
    // Verification failure = don't trust the data
    console.log(`[reviews] G2 verify ${companyName}: failed (${error instanceof Error ? error.message : error}) — rejecting`);
    return false;
  }
}

async function searchG2(companyName: string): Promise<G2Result | null> {
  console.log(`[reviews] searching G2 via Perplexity for: ${companyName}`);

  if (!process.env.PERPLEXITY_API_KEY) {
    console.log(`[reviews] G2 skipped for ${companyName}: no PERPLEXITY_API_KEY`);
    return null;
  }

  try {
    const perplexity = createPerplexity({
      apiKey: process.env.PERPLEXITY_API_KEY,
    });

    const result = await Promise.race([
      generateObject({
        model: perplexity('sonar-pro'),
        schema: g2MetadataSchema,
        temperature: 0.1,
        maxOutputTokens: 400,
        system: `You look up G2.com product pages to find their aggregate rating and review count.

CRITICAL RULES — read carefully:
- ONLY report the star rating and review count shown directly next to the PRODUCT NAME at the top of the G2 product page.
- Do NOT report ratings from "Top-Rated Alternatives", "Sponsored" listings, or comparison widgets on the same page.
- If the G2 page says "This product hasn't been reviewed yet" or shows 0/5 (0), set found: false.
- If you cannot find a dedicated G2 product page for this exact company, set found: false.
- Do NOT confuse similarly-named products. Verify the company website matches.`,
        prompt: `What is the G2 rating and review count for "${companyName}"? Search: "${companyName} site:g2.com"`,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`G2 search timed out after ${G2_TIMEOUT_MS / 1000}s`)),
          G2_TIMEOUT_MS,
        ),
      ),
    ]);

    const obj = result.object;

    if (!obj.found) {
      console.log(`[reviews] G2 ${companyName}: not found on G2`);
      return null;
    }

    // Reject if Perplexity claims 0 reviews
    if (obj.reviewCount !== undefined && obj.reviewCount === 0) {
      console.log(`[reviews] G2 ${companyName}: Perplexity returned 0 reviews — skipping`);
      return null;
    }

    console.log(`[reviews] G2 ${companyName} (unverified): rating=${obj.rating}, count=${obj.reviewCount}, category=${obj.productCategory}`);

    // Ground-truth verification: scrape the actual G2 URL to confirm reviews exist
    if (obj.url) {
      const verified = await verifyG2Page(obj.url, companyName);
      if (!verified) {
        console.log(`[reviews] G2 ${companyName}: REJECTED by Firecrawl verification — Perplexity data was hallucinated`);
        return null;
      }
    }

    console.log(`[reviews] G2 ${companyName} (verified): rating=${obj.rating}, count=${obj.reviewCount}`);

    return {
      rating: obj.rating ?? null,
      reviewCount: obj.reviewCount ?? null,
      categories: obj.productCategory ? [obj.productCategory] : [],
      url: obj.url ?? null,
    };
  } catch (error) {
    console.error(`[reviews] G2 error for ${companyName}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ── Public API ──

interface ReviewInput {
  name: string;
  domain: string | null;
}

/**
 * Fetch Trustpilot and G2 reviews for a single competitor.
 * Trustpilot: Firecrawl scrape (fast, ~5s)
 * G2: Perplexity Sonar Pro search (fast, ~3-5s)
 * Both run in parallel. Never throws.
 */
export async function fetchReviews(competitor: ReviewInput): Promise<ReviewResult> {
  const domain = competitor.domain ?? '';

  if (!domain) {
    console.log(`[reviews] skipping ${competitor.name}: no domain`);
    return {
      competitorName: competitor.name,
      domain: '',
      trustpilot: null,
      g2: null,
      error: 'No domain available',
    };
  }

  console.log(`[reviews] fetching reviews for ${competitor.name} (${domain})`);

  try {
    const [trustpilot, g2] = await Promise.all([
      scrapeTrustpilot(domain),
      searchG2(competitor.name),
    ]);

    const hasTrustpilot = trustpilot && (trustpilot.rating !== null || trustpilot.reviewCount !== null);
    const hasG2 = g2 && (g2.rating !== null || g2.reviewCount !== null);

    console.log(`[reviews] ${competitor.name}: trustpilot=${hasTrustpilot ? 'data' : 'none'}, g2=${hasG2 ? 'data' : 'none'}`);

    return {
      competitorName: competitor.name,
      domain,
      trustpilot: hasTrustpilot ? trustpilot : null,
      g2: hasG2 ? g2 : null,
    };
  } catch (error) {
    console.error(`[reviews] ${competitor.name} failed:`, error instanceof Error ? error.message : error);
    return {
      competitorName: competitor.name,
      domain,
      trustpilot: null,
      g2: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
