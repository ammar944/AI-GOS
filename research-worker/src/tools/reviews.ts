// research-worker/src/tools/reviews.ts
// Scrapes Trustpilot and G2 review data for a competitor using Firecrawl.
// Never throws — always returns a ReviewResult with whatever succeeded.

import type { BetaToolResultContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
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
  url: string;
}

export interface ReviewResult {
  competitorName: string;
  domain: string;
  trustpilot: TrustpilotResult | null;
  g2: G2Result | null;
  error?: string;
}

/**
 * betaZodTool.run() returns Promise<string | Array<BetaToolResultContentBlockParam>>.
 * In practice our tool implementations return a JSON string, but TypeScript sees
 * the wider union. This helper narrows to string.
 */
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

// ── Trustpilot ──

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

/**
 * Extract review themes from Trustpilot markdown.
 * Looks for category headings, common topic words near review sections.
 */
function parseTrustpilotThemes(markdown: string): string[] {
  const themes: string[] = [];

  // Look for category-style headings: "## Customer Service", "### Ease of Use"
  const headingPattern = /^#{1,4}\s+(.{3,40})$/gm;
  let match;
  const skipHeadings = /trustpilot|review|about|write|filter|sort|share|report|reply|page|showing|company/i;

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

  try {
    const resultStr = runResultToString(await firecrawlTool.run({ url }));
    const result = safeJsonParse(resultStr) as {
      success?: boolean;
      markdown?: string;
      error?: unknown;
    } | null;

    if (!result?.success || typeof result.markdown !== 'string' || result.markdown.trim().length < 20) {
      return null;
    }

    const markdown = result.markdown;

    return {
      rating: parseTrustpilotRating(markdown),
      reviewCount: parseTrustpilotCount(markdown),
      recentThemes: parseTrustpilotThemes(markdown),
      url,
    };
  } catch {
    return null;
  }
}

// ── G2 ──

const G2_RATING_PATTERNS = [
  /(\d+\.?\d*)\s*(?:out of\s*5|\/\s*5|stars?)/i,
  /rated?\s+(\d+\.?\d*)/i,
  /rating[:\s]+(\d+\.?\d*)/i,
];

const G2_COUNT_PATTERN = /(\d[\d,]*)\s*(?:total\s+)?reviews?/i;

function parseG2Rating(markdown: string): number | null {
  for (const pattern of G2_RATING_PATTERNS) {
    const match = markdown.match(pattern);
    if (match?.[1]) {
      const rating = parseFloat(match[1]);
      if (rating >= 1.0 && rating <= 5.0) return rating;
    }
  }
  return null;
}

function parseG2Count(markdown: string): number | null {
  const match = markdown.match(G2_COUNT_PATTERN);
  if (match?.[1]) {
    const count = parseInt(match[1].replace(/,/g, ''), 10);
    if (count > 0 && Number.isFinite(count)) return count;
  }
  return null;
}

/**
 * Extract G2 category badges from the markdown.
 * G2 typically shows categories like "CRM Software", "Sales Automation", etc.
 */
function parseG2Categories(markdown: string): string[] {
  const categories: string[] = [];

  // Look for category patterns: "Category: X" or lines with "Software", "Platform", etc.
  const categoryPattern = /(?:categor(?:y|ies)|type)[:\s]+([^\n]{3,50})/gi;
  let match;

  while ((match = categoryPattern.exec(markdown)) !== null && categories.length < 5) {
    const cat = match[1].trim().replace(/[|\\].*$/, '').trim();
    if (cat.length > 2 && cat.length < 50) {
      categories.push(cat);
    }
  }

  // Also look for badge-like patterns: "Leader in X" or "High Performer in X"
  if (categories.length === 0) {
    const badgePattern = /(?:Leader|High Performer|Momentum Leader|Best[\s-]?Of)\s+(?:in\s+)?([^\n|]{3,50})/gi;
    while ((match = badgePattern.exec(markdown)) !== null && categories.length < 5) {
      const cat = match[1].trim();
      if (cat.length > 2 && cat.length < 50) {
        categories.push(cat);
      }
    }
  }

  return categories.slice(0, 5);
}

/**
 * Build a G2 slug from company name.
 * Lowercased, spaces to hyphens, non-alphanumeric (except hyphens) removed.
 */
function buildG2Slug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function scrapeG2(companyName: string): Promise<G2Result | null> {
  const slug = buildG2Slug(companyName);
  if (!slug) return null;

  const url = `https://www.g2.com/products/${slug}/reviews`;

  try {
    const resultStr = runResultToString(await firecrawlTool.run({ url }));
    const result = safeJsonParse(resultStr) as {
      success?: boolean;
      markdown?: string;
      error?: unknown;
    } | null;

    if (!result?.success || typeof result.markdown !== 'string' || result.markdown.trim().length < 20) {
      return null;
    }

    const markdown = result.markdown;

    return {
      rating: parseG2Rating(markdown),
      reviewCount: parseG2Count(markdown),
      categories: parseG2Categories(markdown),
      url,
    };
  } catch {
    // G2 slugs are unpredictable — graceful null return
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
 * Runs both scrapes in parallel. Never throws.
 */
export async function fetchReviews(competitor: ReviewInput): Promise<ReviewResult> {
  const domain = competitor.domain ?? '';

  if (!domain) {
    return {
      competitorName: competitor.name,
      domain: '',
      trustpilot: null,
      g2: null,
      error: 'No domain available',
    };
  }

  try {
    const [trustpilot, g2] = await Promise.all([
      scrapeTrustpilot(domain),
      scrapeG2(competitor.name),
    ]);

    return {
      competitorName: competitor.name,
      domain,
      trustpilot,
      g2,
    };
  } catch (error) {
    return {
      competitorName: competitor.name,
      domain,
      trustpilot: null,
      g2: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
