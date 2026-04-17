// research-worker/src/tools/reviews.ts
// Fetches Trustpilot, G2, and Capterra reviews for competitor analysis.
// Trustpilot: Firecrawl scrape (predictable URL) + individual review extraction
// G2/Capterra: SearchAPI Google for URL discovery + Firecrawl scrape for content
// Never throws.

import Firecrawl from '@mendable/firecrawl-js';

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

export interface CapterraResult {
  rating: number | null;
  reviewCount: number | null;
  categories: string[];
  url: string | null;
}

export interface NegativeReview {
  text: string;
  rating: number;
  date?: string;
  source: 'g2' | 'capterra' | 'trustpilot';
}

export interface ExtractedTestimonial {
  quote: string;
  author?: string;
  role?: string;
  company?: string;
  sourceUrl: string;
}

export interface ReviewResult {
  competitorName: string;
  domain: string;
  trustpilot: TrustpilotResult | null;
  g2: G2Result | null;
  capterra: CapterraResult | null;
  testimonials: ExtractedTestimonial[];
  testimonialPages: string[];
  negativeReviews: NegativeReview[];
  error?: string;
}

// ── Helpers ──

const SCRAPE_TIMEOUT_MS = 20_000;

/**
 * Scrape a URL with Firecrawl directly (not through the tool wrapper).
 * The tool wrapper truncates to 8k chars and strips non-pricing content,
 * which destroys review data. We need the full markdown for review pages.
 */
async function firecrawlScrape(url: string, timeoutMs = SCRAPE_TIMEOUT_MS): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return '';

  try {
    const client = new Firecrawl({ apiKey });
    const result = await Promise.race([
      client.scrape(url, { formats: ['markdown'], blockAds: true }) as Promise<{
        success: boolean;
        markdown?: string;
      }>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Scrape timeout after ${timeoutMs / 1000}s`)), timeoutMs),
      ),
    ]);
    return typeof result.markdown === 'string' ? result.markdown : '';
  } catch (error) {
    console.log(`[reviews] scrape error for ${url}: ${error instanceof Error ? error.message : error}`);
    return '';
  }
}

/** Filter out non-product reviews (employment/HR reviews) */
function isProductReview(text: string): boolean {
  const lower = text.toLowerCase();
  const employmentKeywords = [
    'applying for a job', 'job application', 'job interview', 'hiring process',
    'interview process', 'as an employee', 'working there', 'work environment',
    'got hired', 'got fired', 'called me a', 'applied for',
  ];
  const productKeywords = [
    'software', 'tool', 'platform', 'dashboard', 'data', 'integration',
    'report', 'analytics', 'feature', 'api', 'subscription', 'billing',
    'pricing', 'support ticket', 'bug', 'app', 'product',
  ];
  const hasEmploymentSignal = employmentKeywords.some(kw => lower.includes(kw));
  if (!hasEmploymentSignal) return true;
  return productKeywords.some(kw => lower.includes(kw));
}

// ── SearchAPI Google (URL discovery for G2/Capterra) ──

interface GoogleSearchResult {
  title: string;
  link: string;
}

async function searchGoogle(query: string, num = 5): Promise<GoogleSearchResult[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      engine: 'google',
      q: query,
      api_key: apiKey,
      num: String(num),
    });

    const res = await Promise.race([
      fetch(`https://www.searchapi.io/api/v1/search?${params}`),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SearchAPI timeout')), 10_000),
      ),
    ]);
    const data = await res.json() as { organic_results?: GoogleSearchResult[]; error?: string };

    if (data.error) {
      console.log(`[reviews] SearchAPI: ${data.error}`);
      return [];
    }

    return data.organic_results ?? [];
  } catch (error) {
    console.log(`[reviews] SearchAPI error: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

// ── Trustpilot (Firecrawl scrape + individual review extraction) ──

const TRUSTPILOT_404_PATTERN = /(?:page you're looking for could not be found|Whoops!|404)/i;
const TRUSTPILOT_MIN_CHARS = 300;

function parseTrustpilotRating(markdown: string): number | null {
  const patterns = [
    /TrustScore\s*(\d+\.?\d*)/i,
    /(\d+\.?\d*)\s*(?:out of\s*5|\/\s*5)/i,
    /rated?\s+(\d+\.?\d*)/i,
  ];
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (match?.[1]) {
      const rating = parseFloat(match[1]);
      if (rating >= 1.0 && rating <= 5.0) return rating;
    }
  }
  return null;
}

function parseTrustpilotCount(markdown: string): number | null {
  const match = markdown.match(/(\d[\d,]*)\s*(?:total\s+)?reviews?/i);
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

/**
 * Extract individual reviews from Trustpilot markdown.
 * Ported from main branch review-mining.ts.
 * Splits on "Rated X out of 5 stars" blocks.
 */
function extractTrustpilotReviews(markdown: string): NegativeReview[] {
  const reviewBlocks = markdown.split(/(?=Rated \d out of 5 stars)/);
  const reviews: NegativeReview[] = [];

  for (const block of reviewBlocks.slice(1)) {
    const ratingMatch = block.match(/Rated (\d) out of 5 stars/);
    if (!ratingMatch) continue;
    const rating = parseInt(ratingMatch[1], 10);

    // Only keep negative reviews (1-3 stars)
    if (rating > 3) continue;

    const lines = block.split('\n').filter(l => l.trim().length > 0);
    const textLines: string[] = [];
    let date = '';

    for (const line of lines.slice(1)) {
      if (line.includes('Useful') || line.includes('Share') || line.includes('Flag')) continue;
      if (line.includes('Reply from')) break;
      if (line.includes('Date of experience')) {
        date = line.replace('Date of experience:', '').replace('Date of experience', '').trim();
        continue;
      }
      if (line.trim().length > 15) textLines.push(line.trim());
    }

    const text = textLines.join(' ').trim();
    if (text.length > 30 && isProductReview(text)) {
      reviews.push({
        rating,
        text: text.slice(0, 500),
        date: date || undefined,
        source: 'trustpilot',
      });
    }

    if (reviews.length >= 5) break;
  }

  return reviews;
}

async function scrapeTrustpilot(domain: string): Promise<{ result: TrustpilotResult | null; negativeReviews: NegativeReview[] }> {
  const url = `https://www.trustpilot.com/review/${domain}`;
  console.log(`[reviews] scraping Trustpilot: ${url}`);

  try {
    const markdown = await firecrawlScrape(url);

    if (markdown.trim().length < TRUSTPILOT_MIN_CHARS || TRUSTPILOT_404_PATTERN.test(markdown)) {
      console.log(`[reviews] Trustpilot ${domain}: skipped (${markdown.length} chars, 404=${TRUSTPILOT_404_PATTERN.test(markdown)})`);
      return { result: null, negativeReviews: [] };
    }

    const rating = parseTrustpilotRating(markdown);
    const reviewCount = parseTrustpilotCount(markdown);
    const recentThemes = parseTrustpilotThemes(markdown);

    // Extract individual negative reviews (ported from main branch)
    const negativeReviews = extractTrustpilotReviews(markdown);

    if (rating === null && reviewCount === null) {
      console.log(`[reviews] Trustpilot ${domain}: page found but no rating/count parseable`);
      return { result: null, negativeReviews };
    }

    console.log(`[reviews] Trustpilot ${domain}: rating=${rating}, count=${reviewCount}, themes=${recentThemes.length}, negativeReviews=${negativeReviews.length}`);
    return {
      result: { rating, reviewCount, recentThemes, url },
      negativeReviews,
    };
  } catch (error) {
    console.error(`[reviews] Trustpilot error for ${domain}:`, error instanceof Error ? error.message : error);
    return { result: null, negativeReviews: [] };
  }
}

// ── G2 (SearchAPI URL discovery + Firecrawl scrape) ──

const G2_NO_REVIEWS_PATTERNS = [
  /hasn't been reviewed yet/i,
  /be the first to share your experience/i,
  /0\/5\s*\(0\)/,
  /0 out of 5/i,
];

/**
 * Find the G2 product URL using SearchAPI Google search.
 * Falls back to slug guessing if SearchAPI is unavailable.
 */
async function findG2Url(companyName: string): Promise<string | null> {
  // Strategy 1: SearchAPI Google
  const results = await searchGoogle(`site:g2.com/products "${companyName}"`);
  for (const r of results) {
    const match = r.link.match(/g2\.com\/products\/([a-z0-9-]+)/i);
    if (match) {
      const slug = match[1];
      const url = `https://www.g2.com/products/${slug}/reviews`;
      console.log(`[reviews] G2 URL found via SearchAPI: ${url}`);
      return url;
    }
  }

  // Strategy 2: Slug guessing (fast, free)
  const slugs = [
    companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    companyName.toLowerCase().replace(/[^a-z0-9]/g, ''),
  ];
  // Deduplicate
  const uniqueSlugs = [...new Set(slugs)];

  for (const slug of uniqueSlugs) {
    const url = `https://www.g2.com/products/${slug}/reviews`;
    try {
      const markdown = await firecrawlScrape(url, 10_000);
      if (markdown.length > 200 && !/not found|404/i.test(markdown)) {
        console.log(`[reviews] G2 URL found via slug guess: ${url}`);
        return url;
      }
    } catch {
      // Slug didn't work, try next
    }
  }

  console.log(`[reviews] G2: no product page found for ${companyName}`);
  return null;
}

/**
 * Extract review content from G2 markdown.
 * G2 reviews have "What do you like" / "What do you dislike" structure.
 */
function extractG2Reviews(markdown: string): { likes: string[]; dislikes: NegativeReview[] } {
  const likes: string[] = [];
  const dislikes: NegativeReview[] = [];

  // Split on "What do you like" / "What do you dislike" boundaries
  const sections = markdown.split(/(?=What do you (?:like|dislike))/i);

  for (const section of sections) {
    const isDislike = /^What do you dislike/i.test(section);
    const isLike = /^What do you like/i.test(section);
    if (!isLike && !isDislike) continue;

    // Extract text after the question heading, up to the next section
    const lines = section.split('\n').slice(1);
    const textLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Stop at next section boundary
      if (/^(?:What (?:do you|problems)|Review collected|Show More|Validated Reviewer)/i.test(trimmed)) break;
      if (trimmed.length > 10 && !trimmed.startsWith('#') && !trimmed.startsWith('[')
        && trimmed !== 'N/A' && !/^N\/A\s/i.test(trimmed)
        && !/^Review collected by/i.test(trimmed)) {
        textLines.push(trimmed);
      }
    }

    let text = textLines.join(' ').trim();
    // Strip trailing G2 boilerplate
    text = text.replace(/\s*Review collected by and hosted on G2\.com\.?\s*/gi, '').trim();
    if (text.length < 20 || /^N\/A$/i.test(text)) continue;

    if (isDislike) {
      dislikes.push({
        text: text.slice(0, 500),
        rating: 2, // G2 doesn't show per-review star ratings in markdown, use 2 as default for dislikes
        source: 'g2',
      });
    } else if (isLike) {
      likes.push(text.slice(0, 500));
    }
  }

  return { likes: likes.slice(0, 5), dislikes: dislikes.slice(0, 5) };
}

async function scrapeG2(companyName: string): Promise<{ result: G2Result | null; negativeReviews: NegativeReview[] }> {
  console.log(`[reviews] searching G2 for: ${companyName}`);

  try {
    const productUrl = await findG2Url(companyName);
    if (!productUrl) {
      return { result: null, negativeReviews: [] };
    }

    // Try the primary /reviews path first, then fall back to a couple of
    // alternate G2 URL shapes before giving up. G2 frequently serves bot-
    // blocked stubs (~43 chars) for high-traffic products; a second attempt
    // at a different path occasionally punches through.
    const pathCandidates = [productUrl];
    const slugMatch = productUrl.match(/g2\.com\/products\/([a-z0-9-]+)/i);
    if (slugMatch) {
      const slug = slugMatch[1];
      pathCandidates.push(`https://www.g2.com/products/${slug}/reviews?order=most_recent`);
      pathCandidates.push(`https://www.g2.com/products/${slug}`);
    }

    let markdown = '';
    let scrapedFromUrl = productUrl;
    for (const candidate of pathCandidates) {
      const attempt = await firecrawlScrape(candidate);
      if (attempt.length >= 200) {
        markdown = attempt;
        scrapedFromUrl = candidate;
        break;
      }
      console.log(`[reviews] G2 ${companyName}: ${candidate} too short (${attempt.length} chars) — trying next`);
    }

    if (markdown.length < 200) {
      // All paths returned bot-blocked / empty stubs. Return null instead of
      // a link-only card so the UI doesn't show a broken G2 entry.
      console.log(`[reviews] G2 ${companyName}: all paths blocked/empty — skipping G2`);
      return { result: null, negativeReviews: [] };
    }

    for (const pattern of G2_NO_REVIEWS_PATTERNS) {
      if (pattern.test(markdown)) {
        console.log(`[reviews] G2 ${companyName}: no reviews on page`);
        return { result: { rating: null, reviewCount: null, categories: [], url: scrapedFromUrl }, negativeReviews: [] };
      }
    }

    // Parse aggregate data
    const ratingMatch = markdown.match(/(\d+\.?\d*)\/5/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
    const validRating = rating && rating >= 1 && rating <= 5 ? rating : null;

    const countMatch = markdown.match(/\((\d[\d,]*)\)/);
    const reviewCount = countMatch ? parseInt(countMatch[1].replace(/,/g, ''), 10) : null;

    const catPattern = /(?:category|categories|#\d+ in)\s*[:\-]?\s*([A-Z][A-Za-z\s&/]+(?:Software|Platform|Tool|Service|Solution)s?)/i;
    const catMatch = markdown.match(catPattern);
    const category = catMatch?.[1]?.trim() ?? null;

    // Extract individual review content
    const { dislikes } = extractG2Reviews(markdown);

    console.log(`[reviews] G2 ${companyName}: rating=${validRating}, count=${reviewCount}, category=${category}, dislikes=${dislikes.length}`);

    return {
      result: {
        rating: validRating,
        reviewCount,
        categories: category ? [category] : [],
        url: scrapedFromUrl,
      },
      negativeReviews: dislikes,
    };
  } catch (error) {
    console.error(`[reviews] G2 error for ${companyName}:`, error instanceof Error ? error.message : error);
    return { result: null, negativeReviews: [] };
  }
}

// ── Capterra (SearchAPI URL discovery + Firecrawl scrape) ──

async function findCapterraUrl(companyName: string, domain: string): Promise<string | null> {
  const results = await searchGoogle(`site:capterra.com "${companyName}" reviews`);
  for (const r of results) {
    const match = r.link.match(/capterra\.com\/(?:p|software)\/(\d+)\/([a-z0-9-]+)/i);
    if (match) {
      const url = `https://www.capterra.com/p/${match[1]}/${match[2]}/reviews/`;
      // Basic name sanity check to avoid wrong products
      const slug = match[2].replace(/-/g, '').toLowerCase();
      const nameClean = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (slug.includes(nameClean) || nameClean.includes(slug) || slug.length < 4) {
        console.log(`[reviews] Capterra URL found via SearchAPI: ${url}`);
        return url;
      }
      console.log(`[reviews] Capterra URL found but slug mismatch: ${slug} vs ${nameClean}, skipping`);
    }
  }

  console.log(`[reviews] Capterra: no product page found for ${companyName}`);
  return null;
}

async function scrapeCapterra(companyName: string, domain: string): Promise<{ result: CapterraResult | null; negativeReviews: NegativeReview[] }> {
  console.log(`[reviews] searching Capterra for: ${companyName}`);

  try {
    const productUrl = await findCapterraUrl(companyName, domain);
    if (!productUrl) {
      return { result: null, negativeReviews: [] };
    }

    const markdown = await firecrawlScrape(productUrl);

    if (markdown.length < 200) {
      console.log(`[reviews] Capterra ${companyName}: product page too short`);
      return { result: { rating: null, reviewCount: null, categories: [], url: productUrl }, negativeReviews: [] };
    }

    // Parse aggregate data
    const ratingMatch = markdown.match(/(\d+\.?\d*)\s*(?:out of\s*5|\/\s*5)/i);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
    const validRating = rating && rating >= 1 && rating <= 5 ? rating : null;

    const countMatch = markdown.match(/(\d[\d,]*)\s*(?:total\s+)?reviews?/i);
    const reviewCount = countMatch ? parseInt(countMatch[1].replace(/,/g, ''), 10) : null;

    const catPattern = /(?:category|categories|listed in)\s*[:\-]?\s*([A-Z][A-Za-z\s&/]+(?:Software|Platform|Tool|Service|Solution)s?)/i;
    const catMatch = markdown.match(catPattern);
    const category = catMatch?.[1]?.trim() ?? null;

    console.log(`[reviews] Capterra ${companyName}: rating=${validRating}, count=${reviewCount}, category=${category}`);

    return {
      result: {
        rating: validRating,
        reviewCount,
        categories: category ? [category] : [],
        url: productUrl,
      },
      negativeReviews: [], // Capterra review parsing can be added later
    };
  } catch (error) {
    console.error(`[reviews] Capterra error for ${companyName}:`, error instanceof Error ? error.message : error);
    return { result: null, negativeReviews: [] };
  }
}

// ── Testimonial Discovery & Extraction (Firecrawl map + scrape) ──

/** Parse "Name, Role at Company" attribution strings */
function parseAttribution(attr: string): { author?: string; role?: string; company?: string } {
  if (!attr) return {};
  const atMatch = attr.match(/^([^,]+),\s*([^,]+?)(?:\s+at\s+|\s*,\s*)(.+)$/i);
  if (atMatch) return { author: atMatch[1].trim(), role: atMatch[2].trim(), company: atMatch[3].trim() };
  const simpleMatch = attr.match(/^([^,—–-]+)[,—–-]\s*(.+)$/);
  if (simpleMatch) return { author: simpleMatch[1].trim(), company: simpleMatch[2].trim() };
  return { author: attr.trim() };
}

/** Extract individual testimonials from page markdown */
function extractTestimonialsFromMarkdown(markdown: string, sourceUrl: string): ExtractedTestimonial[] {
  const testimonials: ExtractedTestimonial[] = [];
  let match: RegExpExecArray | null;

  // Pattern 1: Blockquotes (> "quote" — Author, Role at Company)
  const blockquotePattern = />\s*["""](.{30,500}?)["""]\s*(?:—|--|–|-)\s*([^\n]+)/g;
  while ((match = blockquotePattern.exec(markdown)) !== null) {
    const { author, role, company } = parseAttribution(match[2].trim());
    testimonials.push({ quote: match[1].trim(), author, role, company, sourceUrl });
  }

  // Pattern 2: Quoted testimonials ("quote" — attribution)
  const quotedPattern = /["""](.{40,500}?)["""]\s*(?:—|--|–|-)\s*([^\n]+)/g;
  while ((match = quotedPattern.exec(markdown)) !== null) {
    const quote = match[1].trim();
    if (testimonials.some(t => t.quote === quote)) continue;
    const { author, role, company } = parseAttribution(match[2].trim());
    testimonials.push({ quote, author, role, company, sourceUrl });
  }

  // Pattern 3: First-person positive statements in headed sections
  const sectionPattern = /#{1,4}\s+["""]?([^"\n]+)["""]?\n+([^#]{40,400})/g;
  while ((match = sectionPattern.exec(markdown)) !== null) {
    const text = match[2].trim();
    if (/\b(we|our|i|my)\b/i.test(text) &&
        /\b(helped|improved|saved|love|great|amazing|excellent|recommend|transformed)\b/i.test(text)) {
      if (testimonials.some(t => t.quote === text)) continue;
      testimonials.push({ quote: text.slice(0, 500), author: match[1].trim(), sourceUrl });
    }
  }

  return testimonials;
}

/**
 * Use Firecrawl map() to discover testimonial/case-study pages across
 * the company's site including subdomains, then scrape and extract
 * individual testimonials as structured data.
 */
async function discoverAndExtractTestimonials(
  domain: string,
): Promise<{ pages: string[]; testimonials: ExtractedTestimonial[] }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return { pages: [], testimonials: [] };

  const client = new Firecrawl({ apiKey });

  // Step 1: Discover testimonial/case-study pages via map()
  let discoveredPages: string[] = [];
  try {
    const mapResult = await Promise.race([
      client.map(`https://${domain}`, {
        search: 'testimonials case studies reviews customers success stories',
        limit: 8,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firecrawl map timeout')), 15_000),
      ),
    ]);
    discoveredPages = (mapResult as any)?.links ?? [];
  } catch (error) {
    console.log(`[reviews] map() error for ${domain}: ${error instanceof Error ? error.message : error}`);
  }

  // Filter to likely testimonial/case-study URLs
  const testimonialPatterns = /testimonial|case.?stud|success.?stor|customer.?stor|review|clients?\/|customers?\//i;
  const relevant = discoveredPages.filter(url => testimonialPatterns.test(url)).slice(0, 5);

  if (relevant.length === 0) {
    return { pages: discoveredPages, testimonials: [] };
  }

  console.log(`[reviews] found ${relevant.length} testimonial pages for ${domain}`);

  // Step 2: Scrape discovered pages and extract testimonials
  const testimonials: ExtractedTestimonial[] = [];
  const scrapeResults = await Promise.allSettled(
    relevant.map(async (url) => {
      const markdown = await firecrawlScrape(url, 15_000);
      if (!markdown || markdown.length < 100) return [];
      return extractTestimonialsFromMarkdown(markdown, url);
    }),
  );

  for (const result of scrapeResults) {
    if (result.status === 'fulfilled') testimonials.push(...result.value);
  }

  console.log(`[reviews] extracted ${testimonials.length} testimonials from ${relevant.length} pages for ${domain}`);
  return { pages: discoveredPages, testimonials: testimonials.slice(0, 10) };
}

// ── Public API ──

interface ReviewInput {
  name: string;
  domain: string | null;
}

/**
 * Fetch Trustpilot, G2, and Capterra reviews for a single competitor.
 * Phase 1: Scrape all 3 platforms in parallel (SearchAPI for URL discovery, Firecrawl for content).
 * Phase 2: Merge negative reviews from all sources.
 * Never throws.
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
      capterra: null,
      testimonials: [],
      testimonialPages: [],
      negativeReviews: [],
      error: 'No domain available',
    };
  }

  console.log(`[reviews] fetching reviews for ${competitor.name} (${domain})`);

  try {
    // Phase 1: Scrape all platforms + discover testimonials in parallel
    const [tpData, g2Data, capData, testimonialData] = await Promise.all([
      scrapeTrustpilot(domain),
      scrapeG2(competitor.name),
      scrapeCapterra(competitor.name, domain),
      discoverAndExtractTestimonials(domain),
    ]);

    const trustpilot = tpData.result;
    const g2 = g2Data.result;
    const capterra = capData.result;
    const { pages: testimonialPages, testimonials } = testimonialData;

    const hasTrustpilot = trustpilot && (trustpilot.rating !== null || trustpilot.reviewCount !== null);
    const hasG2Data = g2 && (g2.rating !== null || g2.reviewCount !== null);
    const hasG2Link = g2 && g2.url !== null;
    const hasCapterraData = capterra && (capterra.rating !== null || capterra.reviewCount !== null);
    const hasCapterraLink = capterra && capterra.url !== null;

    console.log(
      `[reviews] ${competitor.name}: trustpilot=${hasTrustpilot ? 'data' : 'none'}, ` +
      `g2=${hasG2Data ? 'data' : hasG2Link ? 'link-only' : 'none'}, ` +
      `capterra=${hasCapterraData ? 'data' : hasCapterraLink ? 'link-only' : 'none'}, ` +
      `testimonials=${testimonials.length}, pages=${testimonialPages.length}`,
    );

    // Phase 2: Merge negative reviews from all sources
    const negativeReviews = [
      ...tpData.negativeReviews,
      ...g2Data.negativeReviews,
      ...capData.negativeReviews,
    ]
      .sort((a, b) => a.rating - b.rating) // Worst first
      .slice(0, 5);

    if (negativeReviews.length > 0) {
      console.log(`[reviews] ${competitor.name}: ${negativeReviews.length} negative reviews (tp=${tpData.negativeReviews.length}, g2=${g2Data.negativeReviews.length}, cap=${capData.negativeReviews.length})`);
    }

    return {
      competitorName: competitor.name,
      domain,
      trustpilot: hasTrustpilot ? trustpilot : null,
      g2: (hasG2Data || hasG2Link) ? g2 : null,
      capterra: (hasCapterraData || hasCapterraLink) ? capterra : null,
      testimonials,
      testimonialPages,
      negativeReviews,
    };
  } catch (error) {
    console.error(`[reviews] ${competitor.name} failed:`, error instanceof Error ? error.message : error);
    return {
      competitorName: competitor.name,
      domain,
      trustpilot: null,
      g2: null,
      capterra: null,
      testimonials: [],
      testimonialPages: [],
      negativeReviews: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
