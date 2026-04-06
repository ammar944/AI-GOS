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

// Fallback paths if crawl fails — the original 11-page approach
const FALLBACK_SCRAPE_PATHS = [
  '',            // homepage
  '/about',
  '/about-us',
  '/pricing',
  '/features',
  '/products',
  '/customers',
  '/case-studies',
  '/solutions',
  '/services',
  '/why-us',
  '/testimonials',
] as const;

// Char limits for crawled pages
const KEY_PAGE_CHARS = 5000;   // pricing, features, testimonials, case-studies
const OTHER_PAGE_CHARS = 3000; // everything else
const MAX_TOTAL_CHARS = 30000; // total budget (up from 15k)
// Scrape timeout for fallback path
const SCRAPE_TIMEOUT = 15000;

/** URL patterns for key pages that get higher char limits */
const KEY_PAGE_PATTERNS = [
  /\/pricing/i, /\/plans/i, /\/buy/i,
  /\/features/i, /\/product/i,
  /\/testimonials/i, /\/reviews/i, /\/customers/i,
  /\/case.?stud/i,
];

/** URL patterns to categorize pages into sections */
const PAGE_CATEGORIES: [RegExp, string][] = [
  [/^\/?$/, 'Homepage'],
  [/\/pricing|\/plans|\/buy/i, 'Pricing'],
  [/\/features/i, 'Features'],
  [/\/product/i, 'Products'],
  [/\/about|\/company|\/who-we-are/i, 'About'],
  [/\/testimonial|\/review|\/customer/i, 'Testimonials & Customers'],
  [/\/case.?stud/i, 'Case Studies'],
  [/\/solution/i, 'Solutions'],
  [/\/service/i, 'Services'],
  [/\/integrat/i, 'Integrations'],
  [/\/why/i, 'Why Us'],
];

function categorize(url: string, baseUrl: string): string {
  const path = url.replace(baseUrl, '');
  for (const [pattern, label] of PAGE_CATEGORIES) {
    if (pattern.test(path)) return label;
  }
  return `Other (${path || '/'})`;
}

function isKeyPage(url: string): boolean {
  return KEY_PAGE_PATTERNS.some(p => p.test(url));
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function callWithRetry<T>(
  fn: () => T,
  label: string,
  maxRetries = 2,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`[onboarding/research] ${label} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError ?? new Error(`${label} failed after retries`);
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

async function checkDomainReachable(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch(baseUrl, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeoutId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build structured markdown from crawled/scraped pages with categorization and char limits.
 */
function buildStructuredContent(
  pages: { url: string; markdown: string; title?: string }[],
  baseUrl: string,
): string {
  // Sort: key pages first, then by URL length (shorter = more important)
  const sorted = [...pages].sort((a, b) => {
    const aKey = isKeyPage(a.url) ? 0 : 1;
    const bKey = isKeyPage(b.url) ? 0 : 1;
    if (aKey !== bKey) return aKey - bKey;
    return a.url.length - b.url.length;
  });

  const sections: string[] = [];
  let totalChars = 0;

  for (const page of sorted) {
    if (totalChars >= MAX_TOTAL_CHARS) break;

    const charLimit = isKeyPage(page.url) ? KEY_PAGE_CHARS : OTHER_PAGE_CHARS;
    const remaining = MAX_TOTAL_CHARS - totalChars;
    const pageLimit = Math.min(charLimit, remaining);
    const content = page.markdown.slice(0, pageLimit);
    const label = categorize(page.url, baseUrl);
    const heading = page.title ? `${label} — ${page.title}` : label;

    sections.push(`### ${heading} (${page.url})\n${content}`);
    totalChars += content.length;
  }

  if (sections.length === 0) return '';

  return `\n\n--- SCRAPED WEBSITE CONTENT (${sections.length} pages) ---\nThe following is real content scraped directly from the company's website. Use this as your primary source.\n\n${sections.join('\n\n')}\n--- END SCRAPED CONTENT ---`;
}

/**
 * Fallback: scrape key pages individually using batchScrape (the original approach).
 */
async function fallbackBatchScrape(firecrawl: ReturnType<typeof createFirecrawlClient>, baseUrl: string): Promise<string> {
  const urlsToScrape = [...new Set(
    FALLBACK_SCRAPE_PATHS.map(path => `${baseUrl}${path}`)
  )];

  console.log(`[onboarding/research] Fallback: batch-scraping ${urlsToScrape.length} pages from ${baseUrl}`);

  const results = await firecrawl.batchScrape({
    urls: urlsToScrape,
    timeout: SCRAPE_TIMEOUT,
  });

  console.log(
    `[onboarding/research] Fallback scraped ${results.successCount}/${urlsToScrape.length} pages`
  );

  if (results.successCount === 0) return '';

  const pages = Array.from(results.results.entries())
    .filter(([, r]) => r.success && r.markdown)
    .map(([url, r]) => ({
      url: r.url ?? url,
      markdown: r.markdown!,
      title: r.title,
    }));

  return buildStructuredContent(pages, baseUrl);
}

/** URL patterns to skip when selecting pages from map() results */
const SKIP_PATTERNS = [
  /\/blog(\/|$)/i, /\/news(\/|$)/i, /\/press(\/|$)/i,
  /\/terms/i, /\/privacy/i, /\/legal/i, /\/cookie/i,
  /\/careers/i, /\/jobs/i,
  /\/login/i, /\/signup/i, /\/register/i, /\/auth/i,
  /\/404/i, /\/500/i,
  /\.(pdf|png|jpg|svg|xml|json)$/i,
];

function shouldSkipUrl(url: string): boolean {
  return SKIP_PATTERNS.some(p => p.test(url));
}

/** Score a URL for priority — lower = more important */
function scoreUrl(url: string): number {
  if (isKeyPage(url)) return 0;
  // Homepage or short paths are high value
  const path = new URL(url).pathname;
  if (path === '/' || path === '') return 1;
  if (path.split('/').filter(Boolean).length === 1) return 2;
  return 3;
}

/**
 * Scrape company website using map() for discovery + batchScrape for content.
 * map() discovers real pages (~2-5s), then we scrape the best ones (~15-25s).
 * Falls back to hardcoded paths if map fails.
 * Returns a formatted markdown block or empty string if unavailable.
 */
async function scrapeWebsiteContent(websiteUrl: string): Promise<string> {
  const firecrawl = createFirecrawlClient();
  if (!firecrawl.isAvailable()) {
    console.info('[onboarding/research] Firecrawl not available — using search-only mode');
    return '';
  }

  try {
    const parsed = new URL(websiteUrl);
    const baseUrl = `${parsed.protocol}//${parsed.host}`;

    // Pre-check: skip Firecrawl if domain is unreachable
    const reachable = await checkDomainReachable(baseUrl);
    if (!reachable) {
      console.warn(`[onboarding/research] Domain unreachable: ${baseUrl} — skipping Firecrawl`);
      return '';
    }

    // Step 1: Discover pages via map() (~2-5s)
    let urlsToScrape: string[] = [];
    try {
      console.log(`[onboarding/research] Mapping ${baseUrl} to discover pages...`);
      const discovered = await firecrawl.mapSite(baseUrl, 50);

      if (discovered.length > 0) {
        // Filter out junk, score by importance, take top 20
        const selected = discovered
          .filter(url => url.startsWith(baseUrl) && !shouldSkipUrl(url))
          .sort((a, b) => scoreUrl(a) - scoreUrl(b))
          .slice(0, 20);

        if (selected.length > 0) {
          // Ensure homepage is always included
          if (!selected.includes(baseUrl) && !selected.includes(baseUrl + '/')) {
            selected.unshift(baseUrl);
          }
          urlsToScrape = [...new Set(selected)];
          console.log(`[onboarding/research] Map discovered ${discovered.length} URLs, selected ${urlsToScrape.length} to scrape`);
        }
      }
    } catch (error) {
      console.warn(`[onboarding/research] Map failed, falling back to hardcoded paths:`, error instanceof Error ? error.message : error);
    }

    // Fallback: use hardcoded paths if map found nothing
    if (urlsToScrape.length === 0) {
      urlsToScrape = [...new Set(FALLBACK_SCRAPE_PATHS.map(path => `${baseUrl}${path}`))];
      console.log(`[onboarding/research] Using ${urlsToScrape.length} hardcoded paths`);
    }

    // Step 2: Batch scrape the selected pages (~15-25s)
    console.log(`[onboarding/research] Scraping ${urlsToScrape.length} pages from ${baseUrl}`);
    const results = await firecrawl.batchScrape({
      urls: urlsToScrape,
      timeout: SCRAPE_TIMEOUT,
    });

    console.log(
      `[onboarding/research] Scraped ${results.successCount}/${urlsToScrape.length} pages successfully`
    );

    if (results.successCount === 0) return '';

    const pages = Array.from(results.results.entries())
      .filter(([, r]) => r.success && r.markdown)
      .map(([url, r]) => ({
        url: r.url ?? url,
        markdown: r.markdown!,
        title: r.title,
      }));

    return buildStructuredContent(pages, baseUrl);
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

  // Step 3: Stream structured extraction (with retry on transient failures)
  const result = await callWithRetry(
    () => streamObject({
      model: perplexity(MODELS.SONAR_PRO),
      schema: companyResearchSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.1,
      maxOutputTokens: 4000,
    }),
    'Perplexity streamObject',
  );

  return result.toTextStreamResponse();
}
