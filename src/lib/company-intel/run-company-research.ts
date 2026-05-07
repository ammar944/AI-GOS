import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { generateObject, generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createGateway } from '@ai-sdk/gateway';
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
const BASIC_FETCH_TIMEOUT = 8000;
const AI_PREFILL_TIMEOUT = 45000;
const MAX_BASIC_FETCH_REDIRECTS = 2;
const GATEWAY_ANTHROPIC_MODEL = 'anthropic/claude-sonnet-4.6';

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

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMetaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return null;
}

function inferCompanyName(websiteUrl: string, title?: string | null): string {
  if (title) {
    const cleaned = title.split(/[|—–-]/)[0]?.trim();
    if (cleaned && cleaned.length <= 80) return cleaned;
  }
  try {
    const host = new URL(websiteUrl).hostname.replace(/^www\./, '');
    const root = host.split('.')[0] ?? host;
    return root.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return 'Company';
  }
}

function makeField(value: string | null, sourceUrl: string, reasoning: string, confidence = 70) {
  return value
    ? { value, confidence, sourceUrl, reasoning }
    : { ...NULL_FIELD };
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Anthropic prefill response did not contain a JSON object');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function completeAndValidateOutput(raw: unknown): CompanyResearchOutput {
  const completed = ensureCompleteOutput(raw as CompanyResearchOutput);
  return companyResearchSchema.parse(completed);
}

function safeLogUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

function isPrivateOrReservedIPv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = octets as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateOrReservedIPv6(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const mappedIpv4 = host.match(/(?:::ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)?.[1];
  if (mappedIpv4) return isPrivateOrReservedIPv4(mappedIpv4);
  return (
    host === '::' ||
    host === '::1' ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('fe8') ||
    host.startsWith('fe9') ||
    host.startsWith('fea') ||
    host.startsWith('feb') ||
    host.startsWith('ff') ||
    host.startsWith('2001:db8')
  );
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === 'metadata.google.internal' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) return isPrivateOrReservedIPv4(host);
  if (ipVersion === 6) return isPrivateOrReservedIPv6(host);
  return false;
}

async function isSafePublicHttpUrl(value: string): Promise<boolean> {
  try {
    const url = new URL(value);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password || isBlockedHostname(url.hostname)) {
      return false;
    }

    // Block DNS names resolving to private/link-local/metadata IPs before the
    // server-side homepage fallback fetches user-controlled URLs.
    if (!isIP(url.hostname)) {
      const records = await lookup(url.hostname, { all: true, verbatim: true });
      if (!records.length) return false;
      return records.every((record) => !isBlockedHostname(record.address));
    }

    return true;
  } catch {
    return false;
  }
}

function createTimeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function createJsonTextStream(output: CompanyResearchOutput): { textStream: ReadableStream<string> } {
  const jsonPayload = JSON.stringify(output);
  return {
    textStream: new ReadableStream<string>({
      start(controller) {
        controller.enqueue(jsonPayload);
        controller.close();
      },
    }),
  };
}

function createAllNullOutput(confidenceNotes: string): CompanyResearchOutput {
  return completeAndValidateOutput({
    ...Object.fromEntries(CONTENT_FIELDS.map((field) => [field, { ...NULL_FIELD }])),
    confidenceNotes,
  });
}

function hasGatewayAuthContext(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL_ENV ||
    process.env.VERCEL_URL
  );
}

async function runGatewayAnthropicWebSearchPrefill(websiteUrl: string, linkedinUrl?: string): Promise<CompanyResearchOutput | null> {
  if (!hasGatewayAuthContext()) return null;

  // Important: Vercel OIDC is not an API key. Passing VERCEL_OIDC_TOKEN as
  // apiKey makes @ai-sdk/gateway authenticate with the wrong method. When the
  // app is running on Vercel, create the provider with no apiKey and let the SDK
  // read request-context/deployment OIDC itself.
  const gateway = process.env.AI_GATEWAY_API_KEY
    ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
    : createGateway();

  // AI SDK v6's deprecated generateObject() API does not accept tools; structured
  // generateText({ output: output.object(...) }) is the v6 path that supports both
  // Zod-validated output and Anthropic's native provider-defined web search tool.
  const { output: rawOutput } = await generateText({
    model: gateway(GATEWAY_ANTHROPIC_MODEL),
    output: Output.object({ schema: companyResearchSchema }),
    system: SYSTEM_PROMPT,
    prompt: `Use Anthropic native web search and the company's website to fill the onboarding schema.\n\nWebsite: ${websiteUrl}\n${linkedinUrl ? `LinkedIn: ${linkedinUrl}\n` : ''}\n\nReturn ONLY valid JSON. Include every schema field. Every field must be an object: {"value": string|null, "confidence": number, "sourceUrl": string|null, "reasoning": string}. Use null when not verified. Do not invent data. Prefer the company's own site and credible sources.\n\nCOMPETITOR RESEARCH (IMPORTANT): Actively search the web for direct competitors using queries like "[company name] competitors" and "[company name] alternatives".`,
    tools: {
      web_search: anthropic.tools.webSearch_20250305({ maxUses: 5 }),
    },
    temperature: 0,
    maxOutputTokens: 8000,
    abortSignal: createTimeoutSignal(AI_PREFILL_TIMEOUT),
  });

  return completeAndValidateOutput(rawOutput);
}

async function runAnthropicWebSearchPrefill(websiteUrl: string, linkedinUrl?: string): Promise<CompanyResearchOutput | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: createTimeoutSignal(AI_PREFILL_TIMEOUT),
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.MODEL_FAST ?? MODELS.CLAUDE_HAIKU,
      max_tokens: 7000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [
        {
          role: 'user',
          content: `Use Anthropic web search and the company's website to fill the onboarding schema.\n\nWebsite: ${websiteUrl}\n${linkedinUrl ? `LinkedIn: ${linkedinUrl}\n` : ''}\n\nReturn ONLY valid JSON. Include every schema field. Every field must be an object: {"value": string|null, "confidence": number, "sourceUrl": string|null, "reasoning": string}. Use null when not verified. Do not invent data. Prefer the company's own site and credible sources.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Anthropic prefill failed: HTTP ${response.status} ${errorText.slice(0, 500)}`);
  }

  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.filter((part) => part.type === 'text').map((part) => part.text ?? '').join('\n') ?? '';
  if (!text.trim()) {
    throw new Error('Anthropic prefill returned no text content');
  }

  return completeAndValidateOutput(extractJsonObject(text));
}

async function fetchBasicHomepageIntel(websiteUrl: string, redirects = 0): Promise<CompanyResearchOutput | null> {
  if (!await isSafePublicHttpUrl(websiteUrl)) {
    console.warn('[company-research] Basic homepage fallback blocked unsafe URL:', safeLogUrl(websiteUrl));
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BASIC_FETCH_TIMEOUT);
  try {
    const response = await fetch(websiteUrl, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-GOS/1.0; +https://aigos.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects >= MAX_BASIC_FETCH_REDIRECTS) return null;
      const nextUrl = new URL(location, websiteUrl).toString();
      return fetchBasicHomepageIntel(nextUrl, redirects + 1);
    }
    if (!response.ok) return null;
    const html = await response.text();
    const title = decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    const description = extractMetaContent(html, 'description') ?? extractMetaContent(html, 'og:description');
    const ogTitle = extractMetaContent(html, 'og:title');
    const companyName = inferCompanyName(websiteUrl, ogTitle || title);
    const productDescription = description || title || null;

    return completeAndValidateOutput({
      companyName: makeField(companyName, websiteUrl, 'Derived from homepage title/OG title.', 75),
      businessModel: makeField(null, websiteUrl, 'Not found in basic homepage metadata.'),
      industryVertical: makeField(null, websiteUrl, 'Not verified in basic homepage metadata.'),
      primaryIcpDescription: makeField(description, websiteUrl, 'Derived from homepage meta description.', 55),
      jobTitles: makeField(null, websiteUrl, 'Not found in basic homepage metadata.'),
      companySize: makeField(null, websiteUrl, 'Not found in basic homepage metadata.'),
      geography: makeField(null, websiteUrl, 'Not found in basic homepage metadata.'),
      headquartersLocation: makeField(null, websiteUrl, 'Not found in basic homepage metadata.'),
      productDescription: makeField(productDescription, websiteUrl, 'Derived from homepage title/meta description.', 65),
      coreDeliverables: makeField(description, websiteUrl, 'Derived from homepage meta description.', 50),
      pricingTiers: makeField(null, websiteUrl, 'Not found in basic homepage metadata.'),
      valueProp: makeField(title || description, websiteUrl, 'Derived from homepage title/meta description.', 65),
      guarantees: makeField(null, websiteUrl, 'Not found in basic homepage metadata.'),
      topCompetitors: makeField(null, websiteUrl, 'Requires web research; not available in basic fallback.'),
      uniqueEdge: makeField(null, websiteUrl, 'Not found in basic homepage metadata.'),
      marketProblem: makeField(description, websiteUrl, 'Derived from homepage meta description.', 45),
      situationBeforeBuying: makeField(null, websiteUrl, 'Not found in basic homepage metadata.'),
      desiredTransformation: makeField(description, websiteUrl, 'Derived from homepage meta description.', 45),
      commonObjections: makeField(null, websiteUrl, 'Not found in basic homepage metadata.'),
      brandPositioning: makeField(title || description, websiteUrl, 'Derived from homepage title/meta description.', 55),
      testimonialQuote: makeField(null, websiteUrl, 'Not found in basic homepage metadata.'),
      caseStudiesUrl: makeField(null, websiteUrl, 'Not verified in basic fallback.'),
      testimonialsUrl: makeField(null, websiteUrl, 'Not verified in basic fallback.'),
      pricingUrl: makeField(null, websiteUrl, 'Not verified in basic fallback.'),
      demoUrl: makeField(null, websiteUrl, 'Not verified in basic fallback.'),
      confidenceNotes: 'Basic homepage metadata fallback used because AI research credentials were unavailable or research returned zero fields. Review before launch.',
    });
  } catch (error) {
    console.warn('[company-research] Basic homepage fallback failed:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
  if (hasGatewayAuthContext()) {
    try {
      console.log('[company-research] Starting Gateway Anthropic web-search prefill for:', safeLogUrl(websiteUrl));
      const gatewayOutput = await runGatewayAnthropicWebSearchPrefill(websiteUrl, linkedinUrl);
      if (gatewayOutput) {
        const fieldCount = countNonNullFields(gatewayOutput);
        console.log(`[company-research] Gateway Anthropic web-search prefill produced ${fieldCount}/${CONTENT_FIELDS.length} fields with values`);
        if (fieldCount > 0) return createJsonTextStream(gatewayOutput);
        console.warn('[company-research] Gateway prefill produced zero fields — falling back');
      }
    } catch (error) {
      console.error('[company-research] Gateway Anthropic web-search prefill failed:', error);
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log('[company-research] Starting Anthropic web-search prefill for:', safeLogUrl(websiteUrl));
      const anthropicOutput = await runAnthropicWebSearchPrefill(websiteUrl, linkedinUrl);
      if (anthropicOutput) {
        const fieldCount = countNonNullFields(anthropicOutput);
        console.log(`[company-research] Anthropic web-search prefill produced ${fieldCount}/${CONTENT_FIELDS.length} fields with values`);
        if (fieldCount > 0) return createJsonTextStream(anthropicOutput);
        console.warn('[company-research] Anthropic prefill produced zero fields — falling back');
      }
    } catch (error) {
      console.error('[company-research] Anthropic web-search prefill failed:', error);
    }
  }

  if (!process.env.PERPLEXITY_API_KEY) {
    console.warn('[company-research] PERPLEXITY_API_KEY missing — using basic homepage fallback');
    const fallbackOutput = await fetchBasicHomepageIntel(websiteUrl);
    if (fallbackOutput) {
      const fieldCount = countNonNullFields(fallbackOutput);
      console.log(`[company-research] Basic fallback produced ${fieldCount}/${CONTENT_FIELDS.length} fields with values`);
      return createJsonTextStream(fallbackOutput);
    }

    return createJsonTextStream(createAllNullOutput('AI research credentials were unavailable and basic homepage metadata fallback failed. Continue manually or configure Vercel AI Gateway.'));
  }

  // Race scrape against total timeout — never let scraping block research
  console.log('[company-research] Starting scrape for:', safeLogUrl(websiteUrl));
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
  const output = completeAndValidateOutput(rawOutput);
  const fieldCount = countNonNullFields(output);

  console.log(`[company-research] generateObject finished in ${elapsed}ms — ${fieldCount}/${CONTENT_FIELDS.length} fields with values`, {
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
  });

  // Serialize the complete object to JSON and stream it as a single chunk.
  // The frontend's experimental_useObject() accumulates raw JSON text — emitting
  // the full JSON at once is valid and guarantees a consistent, complete result.
  return createJsonTextStream(output);
}
