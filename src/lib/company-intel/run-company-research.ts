import { streamObject } from 'ai';
import { perplexity, MODELS } from '@/lib/ai/providers';
import { companyResearchSchema } from '@/lib/company-intel/schemas';
import { createFirecrawlClient } from '@/lib/firecrawl';

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

const SCRAPE_PATHS = [
  '',
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

const MAX_PAGE_CHARS = 3000;
const MAX_TOTAL_CHARS = 15000;
const SCRAPE_TIMEOUT = 8000; // 8s per page — fast fail to avoid blocking Perplexity stream
const TOTAL_SCRAPE_TIMEOUT = 20000; // 20s max for entire scrape phase

export interface CompanyResearchInput {
  websiteUrl: string;
  linkedinUrl?: string;
}

export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isLinkedInCompanyUrl(str: string): boolean {
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
        console.warn(`[company-research] ${label} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError ?? new Error(`${label} failed after retries`);
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

export async function scrapeWebsiteContent(websiteUrl: string): Promise<string> {
  const firecrawl = createFirecrawlClient();
  if (!firecrawl.isAvailable()) {
    console.info('[company-research] Firecrawl not available — using search-only mode');
    return '';
  }

  try {
    const parsed = new URL(websiteUrl);
    const baseUrl = `${parsed.protocol}//${parsed.host}`;
    const reachable = await checkDomainReachable(baseUrl);
    if (!reachable) {
      console.warn(`[company-research] Domain unreachable: ${baseUrl} — skipping Firecrawl`);
      return '';
    }

    const urlsToScrape = [...new Set(SCRAPE_PATHS.map((path) => `${baseUrl}${path}`))];
    const results = await firecrawl.batchScrape({
      urls: urlsToScrape,
      timeout: SCRAPE_TIMEOUT,
    });

    if (results.successCount === 0) return '';

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
    console.error('[company-research] Firecrawl scraping failed:', error);
    return '';
  }
}

export async function runCompanyResearch({
  websiteUrl,
  linkedinUrl,
}: CompanyResearchInput) {
  // Race scrape against total timeout — never let scraping block the Perplexity stream
  const scrapedContent = await Promise.race([
    scrapeWebsiteContent(websiteUrl),
    new Promise<string>((resolve) => {
      setTimeout(() => {
        console.warn('[company-research] Scrape phase timed out after 20s — continuing with search-only');
        resolve('');
      }, TOTAL_SCRAPE_TIMEOUT);
    }),
  ]);

  const userPrompt = `Research this company thoroughly:
- Website: ${websiteUrl}
${linkedinUrl ? `- LinkedIn: ${linkedinUrl}` : ''}
${scrapedContent}

${scrapedContent
    ? 'I have provided the actual scraped content from their website above. Extract information primarily from this content, and supplement with web search for anything not covered (e.g., LinkedIn data, competitor info).'
    : 'Visit the website and extract factual information for each field in the schema.'}
For any field you cannot verify from actual sources, set the value to null.
Be thorough but honest — a null value is better than a fabricated one.`;

  return callWithRetry(
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
}
