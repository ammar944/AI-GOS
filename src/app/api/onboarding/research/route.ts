// POST /api/onboarding/research
// Scrapes key website pages with Firecrawl, then streams structured company
// research using Perplexity Sonar Pro via streamObject.
// Firecrawl is optional — gracefully falls back to search-only if unavailable.

import { streamObject } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { perplexity, MODELS } from '@/lib/ai/providers';
import { companyResearchSchema } from '@/lib/company-intel/schemas';
import { createFirecrawlClient } from '@/lib/firecrawl';

export const maxDuration = 120;

const SYSTEM_PROMPT = `You are a factual business researcher. You ONLY extract verifiable information from real web sources.

You may be provided with SCRAPED WEBSITE CONTENT below — this is the actual HTML-to-markdown content of the company's website pages. Use this content as your PRIMARY source for extraction. It is real, verified content from their site.

ABSOLUTE RULES:
1. ONLY include information you can VERIFY from the scraped website content, LinkedIn page, or credible search results
2. If you cannot find a piece of information, the value MUST be null — NEVER guess, infer, or make up data
3. Every non-null value must have a real sourceUrl where you found it — do NOT fabricate URLs
4. Use the company's own words whenever possible — quote, don't paraphrase
5. Confidence scores must honestly reflect certainty — do NOT inflate scores
6. For testimonial quotes, ONLY use real quotes found on the site with attribution
7. For competitor names, ONLY list competitors explicitly mentioned or clearly in the same market
8. For URLs (case studies, pricing, demo pages), ONLY include URLs that actually exist on the site
9. When scraped content is provided, prefer extracting from it over web search — it is the ground truth`;

// Pages to scrape for comprehensive company research
const SCRAPE_PATHS = [
  '',            // homepage
  '/about',
  '/about-us',
  '/pricing',
  '/features',
  '/products',
  '/customers',
  '/case-studies',
] as const;

// Max chars per scraped page to stay within token limits
const MAX_PAGE_CHARS = 3000;
// Max total scraped content
const MAX_TOTAL_CHARS = 15000;
// Scrape timeout (shorter than default — we don't want to block too long)
const SCRAPE_TIMEOUT = 15000;

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLinkedInCompanyUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return (
      (url.hostname === 'linkedin.com' || url.hostname === 'www.linkedin.com') &&
      url.pathname.startsWith('/company/')
    );
  } catch {
    return false;
  }
}

/**
 * Scrape key pages from the company website using Firecrawl.
 * Returns a formatted markdown block of scraped content, or empty string if unavailable.
 */
async function scrapeWebsiteContent(websiteUrl: string): Promise<string> {
  const firecrawl = createFirecrawlClient();
  if (!firecrawl.isAvailable()) {
    console.info('[onboarding/research] Firecrawl not available — using search-only mode');
    return '';
  }

  try {
    // Derive base URL (strip paths, query params)
    const parsed = new URL(websiteUrl);
    const baseUrl = `${parsed.protocol}//${parsed.host}`;

    // Build unique URLs to scrape
    const urlsToScrape = [...new Set(
      SCRAPE_PATHS.map(path => `${baseUrl}${path}`)
    )];

    console.log(`[onboarding/research] Scraping ${urlsToScrape.length} pages from ${baseUrl}`);

    const results = await firecrawl.batchScrape({
      urls: urlsToScrape,
      timeout: SCRAPE_TIMEOUT,
    });

    console.log(
      `[onboarding/research] Scraped ${results.successCount}/${urlsToScrape.length} pages successfully`
    );

    if (results.successCount === 0) return '';

    // Build formatted content block
    const sections: string[] = [];
    let totalChars = 0;

    for (const [url, result] of results.results) {
      if (!result.success || !result.markdown) continue;
      if (totalChars >= MAX_TOTAL_CHARS) break;

      const remaining = MAX_TOTAL_CHARS - totalChars;
      const pageLimit = Math.min(MAX_PAGE_CHARS, remaining);
      const content = result.markdown.slice(0, pageLimit);
      const pageName = result.title || url.replace(baseUrl, '') || 'Homepage';

      sections.push(`### ${pageName} (${url})\n${content}`);
      totalChars += content.length;
    }

    if (sections.length === 0) return '';

    return `\n\n--- SCRAPED WEBSITE CONTENT (${sections.length} pages) ---\nThe following is real content scraped directly from the company's website. Use this as your primary source.\n\n${sections.join('\n\n')}\n--- END SCRAPED CONTENT ---`;
  } catch (error) {
    console.error('[onboarding/research] Firecrawl scraping failed:', error);
    return '';
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { websiteUrl?: string; linkedinUrl?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { websiteUrl, linkedinUrl } = body;

  if (!websiteUrl || typeof websiteUrl !== 'string' || !isValidUrl(websiteUrl)) {
    return new Response(
      JSON.stringify({ error: 'A valid websiteUrl is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (linkedinUrl !== undefined) {
    if (typeof linkedinUrl !== 'string' || !isLinkedInCompanyUrl(linkedinUrl)) {
      return new Response(
        JSON.stringify({ error: 'linkedinUrl must be a valid LinkedIn company page URL (e.g., https://linkedin.com/company/acme)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  // Step 1: Scrape website pages with Firecrawl (graceful fallback if unavailable)
  const scrapedContent = await scrapeWebsiteContent(websiteUrl);

  // Step 2: Build prompt with scraped content as primary context
  const userPrompt = `Research this company thoroughly:
- Website: ${websiteUrl}
${linkedinUrl ? `- LinkedIn: ${linkedinUrl}` : ''}
${scrapedContent}

${scrapedContent
    ? 'I have provided the actual scraped content from their website above. Extract information primarily from this content, and supplement with web search for anything not covered (e.g., LinkedIn data, competitor info).'
    : 'Visit the website and extract factual information for each field in the schema.'}
For any field you cannot verify from actual sources, set the value to null.
Be thorough but honest — a null value is better than a fabricated one.`;

  // Step 3: Stream structured extraction
  const result = streamObject({
    model: perplexity(MODELS.SONAR_PRO),
    schema: companyResearchSchema,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.1,
    maxOutputTokens: 4000,
  });

  return result.toTextStreamResponse();
}
