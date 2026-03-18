import { generateObject } from 'ai';
import { perplexity, MODELS } from '@/lib/ai/providers';
import { companyResearchSchema, type CompanyResearchOutput } from '@/lib/company-intel/schemas';
import { createFirecrawlClient } from '@/lib/firecrawl';

const SYSTEM_PROMPT = `You are a factual business researcher. You extract verifiable information from real web sources.

You may be provided with SCRAPED WEBSITE CONTENT below — this is the actual HTML-to-markdown content of the company's website pages. Use this content as your PRIMARY source for most fields. It is real, verified content from their site.

EXTRACTION RULES (for most fields):
1. For fields extracted from the company's OWN site: ONLY include information you can VERIFY from the scraped website content, LinkedIn page, or credible search results
2. If you cannot find a piece of information, the value MUST be null — NEVER guess, infer, or make up data
3. Every non-null value must have a real sourceUrl where you found it — do NOT fabricate URLs
4. Use the company's own words whenever possible — quote, don't paraphrase
5. Confidence scores must honestly reflect certainty — do NOT inflate scores
6. For testimonial quotes, ONLY use real quotes found on the site with attribution
7. For URLs (case studies, pricing, demo pages), ONLY include URLs that actually exist on the site
8. When scraped content is provided, prefer extracting from it over web search — it is the ground truth
9. You MUST output EVERY field in the schema. If you cannot find a value for a field, output { "value": null, "confidence": 0, "sourceUrl": null, "reasoning": "Not found on website or LinkedIn." }. Never omit a field.

COMPETITOR RESEARCH (EXCEPTION — this field uses web search, not just the company's site):
The topCompetitors field is DIFFERENT from all other fields. For this field you MUST:
- Search the web for "[company name] competitors" and "[company name] alternatives"
- Identify the top 3-5 companies that offer similar products/services to the same target audience
- These are companies prospects would compare against — direct market rivals
- Return as a comma-separated list of company names (e.g., "Kalungi, Directive, Hey Digital")
- The sourceUrl should be the search result or comparison page where you found them
- This field should almost NEVER be null — every company has competitors
- Do NOT limit yourself to competitors mentioned on the company's own website`;

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
const SCRAPE_TIMEOUT = 8000; // 8s per page — fast fail to avoid blocking research
const TOTAL_SCRAPE_TIMEOUT = 20000; // 20s max for entire scrape phase

/**
 * The canonical null field value returned for any field that cannot be found.
 * Ensures every field in the schema is present even when the AI returns nothing.
 */
const NULL_FIELD = {
  value: null,
  confidence: 0,
  sourceUrl: null,
  reasoning: 'Not found on website or LinkedIn.',
} as const;

/**
 * All 25 content fields in CompanyResearchOutput (excludes confidenceNotes).
 * Hoisted to module scope so ensureCompleteOutput and countNonNullFields both
 * iterate the same authoritative list — and log messages derive their count
 * from CONTENT_FIELDS.length instead of a hardcoded magic number.
 */
const CONTENT_FIELDS: Array<keyof Omit<CompanyResearchOutput, 'confidenceNotes'>> = [
  'companyName',
  'businessModel',
  'industryVertical',
  'primaryIcpDescription',
  'jobTitles',
  'companySize',
  'geography',
  'headquartersLocation',
  'productDescription',
  'coreDeliverables',
  'pricingTiers',
  'valueProp',
  'guarantees',
  'topCompetitors',
  'uniqueEdge',
  'marketProblem',
  'situationBeforeBuying',
  'desiredTransformation',
  'commonObjections',
  'brandPositioning',
  'testimonialQuote',
  'caseStudiesUrl',
  'testimonialsUrl',
  'pricingUrl',
  'demoUrl',
];

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

/**
 * Guarantee every schema field is present in the AI output.
 *
 * generateObject() with a Zod schema will throw if required fields are missing,
 * but this guard catches any edge case where the object was mutated or a field
 * slipped through as undefined (possible with Perplexity provider quirks).
 * All CONTENT_FIELDS.length content fields + confidenceNotes are enforced here.
 */
function ensureCompleteOutput(output: CompanyResearchOutput): CompanyResearchOutput {
  // Shallow copy is intentional: we replace top-level field objects, not mutate nested values
  const patched = { ...output };

  for (const field of CONTENT_FIELDS) {
    const existing = patched[field];
    if (
      !existing ||
      typeof existing !== 'object' ||
      !('value' in existing)
    ) {
      // Field is missing or malformed — replace with canonical null value
      (patched as Record<string, unknown>)[field] = { ...NULL_FIELD };
    }
  }

  if (typeof patched.confidenceNotes !== 'string') {
    patched.confidenceNotes = 'Extraction completed. Some fields may not have been found.';
  }

  return patched;
}

/**
 * Count how many content fields have a non-null value.
 */
function countNonNullFields(output: CompanyResearchOutput): number {
  return CONTENT_FIELDS.filter((field) => {
    const val = output[field];
    return val && typeof val === 'object' && 'value' in val && (val as { value: string | null }).value !== null;
  }).length;
}

/**
 * Run company research using generateObject() for deterministic, complete output.
 *
 * Uses generateObject() instead of streamObject() to ensure:
 * - All 25 schema fields are ALWAYS present in the response
 * - temperature: 0 for deterministic extraction
 * - Complete Zod validation before any data leaves this function
 *
 * Returns an object with a `textStream` property that emits the complete JSON
 * as a single chunk — compatible with the route's createTextStreamResponse() call
 * and the frontend's experimental_useObject() consumer.
 */
export async function runCompanyResearch({
  websiteUrl,
  linkedinUrl,
}: CompanyResearchInput): Promise<{ textStream: ReadableStream<string> }> {
  // Race scrape against total timeout — never let scraping block research
  console.log('[company-research] Starting scrape for:', websiteUrl);
  const scrapeStart = Date.now();
  const scrapedContent = await Promise.race([
    scrapeWebsiteContent(websiteUrl),
    new Promise<string>((resolve) => {
      setTimeout(() => {
        console.warn('[company-research] Scrape phase timed out after 20s — continuing with search-only');
        resolve('');
      }, TOTAL_SCRAPE_TIMEOUT);
    }),
  ]);
  console.log(`[company-research] Scrape done in ${Date.now() - scrapeStart}ms, content: ${scrapedContent.length} chars`);

  const userPrompt = `Research this company thoroughly and extract ALL fields in the schema:
- Website: ${websiteUrl}
${linkedinUrl ? `- LinkedIn: ${linkedinUrl}` : ''}
${scrapedContent}

${scrapedContent
    ? 'I have provided the actual scraped content from their website above. Extract information primarily from this content, and supplement with web search for anything not covered (e.g., LinkedIn data, competitor info).'
    : 'Visit the website and extract factual information for each field in the schema.'}

COMPETITOR RESEARCH (IMPORTANT): For topCompetitors, do NOT just check if the company mentions competitors on their own site. Actively search the web to find their top 3-5 direct competitors — companies offering similar products/services to the same target market. Use search queries like "[company name] competitors", "[company name] alternatives", and "[industry] market landscape". Return the competitor names as a comma-separated list (e.g., "Kalungi, Hey Digital, Directive"). Be accurate — verify each competitor is a real company in the same space.

CRITICAL: You MUST output every single field in the schema. For any field you cannot verify from actual sources, output: { "value": null, "confidence": 0, "sourceUrl": null, "reasoning": "Not found on website or LinkedIn." }
Never omit a field — null is correct, missing is not.`;

  console.log('[company-research] Starting Perplexity generateObject...');
  const generateStart = Date.now();

  const { object: rawOutput, usage } = await generateObject({
    model: perplexity(MODELS.SONAR_PRO),
    schema: companyResearchSchema,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0,
    maxOutputTokens: 8000,
  });

  const elapsed = Date.now() - generateStart;
  const output = ensureCompleteOutput(rawOutput);
  const fieldCount = countNonNullFields(output);

  console.log(`[company-research] generateObject finished in ${elapsed}ms — ${fieldCount}/${CONTENT_FIELDS.length} fields with values`, {
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
  });

  // Serialize the complete object to JSON and stream it as a single chunk.
  // The frontend's experimental_useObject() accumulates raw JSON text — emitting
  // the full JSON at once is valid and guarantees a consistent, complete result.
  const jsonPayload = JSON.stringify(output);

  const textStream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(jsonPayload);
      controller.close();
    },
  });

  return { textStream };
}
