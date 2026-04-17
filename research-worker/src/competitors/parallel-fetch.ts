// research-worker/src/competitors/parallel-fetch.ts
// Runs all external API calls for competitor data in parallel.
// Each call is independent — failures are isolated via Promise.allSettled.

import type { BetaToolResultContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import Firecrawl from '@mendable/firecrawl-js';
import { firecrawlTool } from '../tools/firecrawl';
import { spyfuTool } from '../tools/spyfu';
import { fetchCompetitorAds } from '../tools/apify-ads';
import { fetchReviews, type ReviewResult } from '../tools/reviews';
import type { WorkerAdInsight } from '../tools/adlibrary-types';
import type { CompetitorEntry } from './parse-context';

// SearchAPI calls complete in 2-5s. Firecrawl + SpyFu may take up to 20s.
// 30s is generous for the SearchAPI-only ad path + Firecrawl + SpyFu.
const PARALLEL_TIMEOUT_MS = 45_000;

// Maximum competitors to process — keeps API rate limits sane
const MAX_COMPETITORS = 5;

export interface PricingResult {
  competitorName: string;
  domain: string;
  pricingMarkdown: string | null;
  success: boolean;
  error?: string;
}

export interface SpyfuResult {
  competitorName: string;
  domain: string;
  keywords: unknown;
  domainStats: unknown;
  error?: string;
}

export interface AdLibraryResult {
  competitorName: string;
  domain: string;
  adInsight: WorkerAdInsight | null;
  error?: string;
}

export interface ParallelFetchResults {
  pricing: PricingResult[];
  spyfu: SpyfuResult[];
  adLibrary: AdLibraryResult[];
  reviews: ReviewResult[];
  clientAdLibrary: AdLibraryResult | null;
  durationMs: number;
}

/**
 * betaZodTool.run() is typed as Promise<string | Array<BetaToolResultContentBlockParam>>.
 * In practice all our tool implementations return a JSON string, but TypeScript sees
 * the wider union. This helper narrows to string so callers can safely JSON.parse.
 */
function runResultToString(
  value: string | Array<BetaToolResultContentBlockParam>,
): string {
  if (typeof value === 'string') return value;
  // Structured content block array — join any text blocks as a fallback.
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

/**
 * Extract the pricing-relevant window from a large markdown page.
 * Many pricing pages have 10k+ chars of nav/hero before the actual tiers.
 * This finds where dollar amounts start and extracts a window around them.
 */
function extractPricingWindow(md: string, maxChars: number): string {
  if (md.length <= maxChars) return md;

  // Find the first dollar amount
  const match = md.match(/\$\d+/);
  if (!match || match.index === undefined) return md.slice(0, maxChars);

  // Take a window: 500 chars before the first $ to capture tier names,
  // then fill the rest of maxChars after it to capture all tiers
  const start = Math.max(0, match.index - 500);
  return md.slice(start, start + maxChars);
}

/**
 * Return true if the scraped URL's hostname matches the competitor's verified domain.
 * Strips www. prefix before comparing so fathom.video matches www.fathom.video.
 * Used to reject redirected pages that land on a different company's domain.
 */
function isSameDomain(scrapedUrl: string | undefined, verifiedDomain: string): boolean {
  if (!scrapedUrl) return true; // no URL info — can't reject
  try {
    const hostname = new URL(scrapedUrl).hostname.replace(/^www\./, '');
    const expected = verifiedDomain.replace(/^www\./, '');
    return hostname === expected;
  } catch {
    return true; // unparseable URL — don't reject
  }
}

/**
 * Scrape a competitor's /pricing page with Firecrawl.
 * Tries /pricing first; falls back to the homepage if /pricing returns no
 * useful content (empty, too short, or a hard failure).
 *
 * Domain verification guard: if the competitor domain was inferred (not confirmed
 * by Sonar validation), skip the scrape entirely — an inferred domain like fathom.com
 * for "Fathom AI" would hit the wrong company (Fathom Analytics).
 * After scraping, also verify the response URL still resolves to the expected domain
 * to guard against cross-domain redirects.
 */
async function fetchPricing(competitor: CompetitorEntry): Promise<PricingResult> {
  if (!competitor.domain) {
    return {
      competitorName: competitor.name,
      domain: '',
      pricingMarkdown: null,
      success: false,
      error: 'No domain available',
    };
  }

  // Domain verification guard — mirrors the isDomainVerified check in ad disambiguation.
  // An inferred domain (guessed as name.com) is unreliable: "Fathom AI" → fathom.com
  // is Fathom Analytics, not Fathom AI (fathom.video). Skip scraping entirely.
  if (competitor.inferredDomain) {
    console.log(`[pricing] ${competitor.name}: skipping — domain "${competitor.domain}" is inferred (not Sonar-verified). Would risk scraping wrong company.`);
    return {
      competitorName: competitor.name,
      domain: competitor.domain,
      pricingMarkdown: null,
      success: false,
      error: 'Domain not verified — skipped to avoid scraping wrong company',
    };
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return {
      competitorName: competitor.name,
      domain: competitor.domain,
      pricingMarkdown: null,
      success: false,
      error: 'FIRECRAWL_API_KEY not configured',
    };
  }

  const client = new Firecrawl({ apiKey });
  // Expanded path set covers common SaaS pricing page conventions. Enterprise
  // tools (Gong, Outreach, etc.) often hide pricing behind /request-demo or
  // /contact-sales; we still detect those below via the ENTERPRISE_PRICING_SIGNALS
  // regex and surface the scraped page even without dollar amounts.
  const pricingPaths = ['/pricing', '/plans', '/packages', '/pricing-plans', '/pricing-details'];
  // "Contact sales" / "request a demo" style gates are a real pricing signal
  // for enterprise products (Gong, Outreach, Drift, etc.) that never publish
  // list prices. Treat these as pricing intent when dollar amounts aren't
  // present, so downstream analysis gets "pricing is gated" rather than
  // "pricing unavailable".
  const ENTERPRISE_PRICING_SIGNALS = /contact (?:us for |sales for |our sales team|sales)|talk to sales|request (?:a )?(?:demo|quote|pricing)|get (?:a )?quote|custom pricing|enterprise pricing|book a demo/i;

  for (const path of pricingPaths) {
    const url = `https://${competitor.domain}${path}`;
    try {
      console.log(`[pricing] scraping ${url} for ${competitor.name}...`);
      const start = Date.now();
      const result = await Promise.race([
        client.scrape(url, {
          formats: ['markdown'],
          blockAds: true,
        }) as Promise<{ success: boolean; markdown?: string; url?: string; error?: unknown }>,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Pricing scrape timed out')), 20_000),
        ),
      ]);
      const elapsed = Date.now() - start;

      // Redirect guard: if Firecrawl followed a redirect to a different domain, reject.
      if (!isSameDomain(result?.url, competitor.domain)) {
        console.log(`[pricing] ${competitor.name} ${path}: rejected — redirected to "${result?.url}" (expected domain: ${competitor.domain})`);
        continue;
      }

      const md = typeof result?.markdown === 'string' ? result.markdown : '';
      if (md.trim().length > 50) {
        const hasPricing = /\$\d+|starting at|\d+\/mo/i.test(md);
        const hasEnterpriseGate = ENTERPRISE_PRICING_SIGNALS.test(md);
        console.log(`[pricing] ${competitor.name} ${path}: OK (${elapsed}ms, ${md.length} chars, pricing=${hasPricing}, enterpriseGate=${hasEnterpriseGate})`);
        if (hasPricing) {
          return {
            competitorName: competitor.name,
            domain: competitor.domain,
            pricingMarkdown: extractPricingWindow(md, 6000),
            success: true,
          };
        }
        if (hasEnterpriseGate) {
          // Enterprise-gated pricing page: capture the markdown so downstream
          // analysis can say "pricing is gated behind contact-sales" rather
          // than "no pricing found".
          return {
            competitorName: competitor.name,
            domain: competitor.domain,
            pricingMarkdown: extractPricingWindow(md, 4000),
            success: true,
            error: 'Pricing gated behind contact-sales / request-demo',
          };
        }
        // Page exists but no dollar amounts and no enterprise gate — try next path
        console.log(`[pricing] ${competitor.name} ${path}: no dollar amounts or enterprise gate, trying next path`);
      } else {
        console.log(`[pricing] ${competitor.name} ${path}: empty or failed (${elapsed}ms)`);
      }
    } catch (err) {
      console.log(`[pricing] ${competitor.name} ${path}: error — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // All pricing paths failed — try homepage for pricing signals
  try {
    const homepage = await Promise.race([
      client.scrape(`https://${competitor.domain}`, {
        formats: ['markdown'],
        blockAds: true,
      }) as Promise<{ success: boolean; markdown?: string; url?: string }>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Homepage scrape timed out')), 20_000),
      ),
    ]);

    // Redirect guard on homepage too
    if (!isSameDomain(homepage?.url, competitor.domain)) {
      console.log(`[pricing] ${competitor.name} homepage: rejected — redirected to "${homepage?.url}" (expected domain: ${competitor.domain})`);
      return {
        competitorName: competitor.name,
        domain: competitor.domain,
        pricingMarkdown: null,
        success: false,
        error: 'Homepage redirected to a different domain — likely wrong company',
      };
    }

    const homeMd = typeof homepage?.markdown === 'string' ? homepage.markdown : '';
    const homeHasPricing = /\$\d+|starting at|\d+\/mo/i.test(homeMd);
    const homeHasEnterpriseGate = ENTERPRISE_PRICING_SIGNALS.test(homeMd);
    const homeIsUseful = (homeHasPricing || homeHasEnterpriseGate) && homeMd.trim().length > 50;
    return {
      competitorName: competitor.name,
      domain: competitor.domain,
      pricingMarkdown: homeIsUseful ? extractPricingWindow(homeMd, homeHasPricing ? 6000 : 4000) : null,
      success: homeIsUseful,
      error: homeIsUseful
        ? (homeHasPricing ? 'Pricing page not found, used homepage' : 'Pricing gated behind contact-sales — signals captured from homepage')
        : 'Pricing page not found, used homepage',
    };
  } catch (error) {
    return {
      competitorName: competitor.name,
      domain: competitor.domain,
      pricingMarkdown: null,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get SpyFu keyword intelligence and domain stats for a competitor.
 */
async function fetchSpyfu(competitor: CompetitorEntry): Promise<SpyfuResult> {
  if (!competitor.domain) {
    return {
      competitorName: competitor.name,
      domain: '',
      keywords: [],
      domainStats: null,
      error: 'No domain available',
    };
  }

  try {
    const resultStr = runResultToString(await spyfuTool.run({ domain: competitor.domain }));
    const result = safeJsonParse(resultStr) as {
      keywords?: unknown;
      domainStats?: unknown;
      error?: string;
    } | null;

    return {
      competitorName: competitor.name,
      domain: competitor.domain,
      keywords: result?.keywords ?? [],
      domainStats: result?.domainStats ?? null,
      error: result?.error,
    };
  } catch (error) {
    return {
      competitorName: competitor.name,
      domain: competitor.domain,
      keywords: [],
      domainStats: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get ad creatives for a competitor.
 * Uses Apify for Meta + Google, SearchAPI for LinkedIn.
 * categoryKeywords from identity card enable batch-level sanity check
 * (e.g., "Fathom" terrain ads rejected when searching for "Fathom AI" meeting tool).
 */
async function fetchAdLibrary(
  competitor: CompetitorEntry,
  categoryKeywords?: string[],
): Promise<AdLibraryResult> {
  try {
    const insight = await fetchCompetitorAds(
      competitor.name,
      competitor.domain ?? undefined,
      !competitor.inferredDomain,
      categoryKeywords,
    );

    return {
      competitorName: competitor.name,
      domain: competitor.domain ?? '',
      adInsight: insight,
    };
  } catch (error) {
    return {
      competitorName: competitor.name,
      domain: competitor.domain ?? '',
      adInsight: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run ALL external API calls in parallel for all competitors.
 *
 * Strategy:
 * - Cap input at MAX_COMPETITORS (5) to avoid rate limiting.
 * - Fire every call at once: 5 Firecrawl + 5 SpyFu + 5 Ad Library = 15 calls.
 * - Wall time ≈ max(individual call time) rather than sum — typically 12-15s.
 * - A single global timeout (PARALLEL_TIMEOUT_MS) cuts off the entire batch if
 *   something hangs, so the pipeline never blocks indefinitely.
 * - Promise.allSettled inside each group ensures one slow/failing competitor
 *   never prevents results for the others.
 *
 * Never throws — always returns ParallelFetchResults with whatever succeeded.
 */
export async function fetchAllCompetitorData(
  competitors: CompetitorEntry[],
  clientInfo?: { name: string; domain: string | null },
  categoryKeywords?: string[],
): Promise<ParallelFetchResults> {
  const startTime = Date.now();
  const capped = competitors.slice(0, MAX_COMPETITORS);

  // Build settled-result extractors as typed helpers to avoid repetition below
  function extractPricing(
    settled: PromiseSettledResult<PricingResult>,
    index: number,
  ): PricingResult {
    if (settled.status === 'fulfilled') return settled.value;
    return {
      competitorName: capped[index]?.name ?? 'Unknown',
      domain: capped[index]?.domain ?? '',
      pricingMarkdown: null,
      success: false,
      error:
        settled.reason instanceof Error
          ? settled.reason.message
          : String(settled.reason),
    };
  }

  function extractSpyfu(
    settled: PromiseSettledResult<SpyfuResult>,
    index: number,
  ): SpyfuResult {
    if (settled.status === 'fulfilled') return settled.value;
    return {
      competitorName: capped[index]?.name ?? 'Unknown',
      domain: capped[index]?.domain ?? '',
      keywords: [],
      domainStats: null,
      error:
        settled.reason instanceof Error
          ? settled.reason.message
          : String(settled.reason),
    };
  }

  function extractAdLibrary(
    settled: PromiseSettledResult<AdLibraryResult>,
    index: number,
  ): AdLibraryResult {
    if (settled.status === 'fulfilled') return settled.value;
    return {
      competitorName: capped[index]?.name ?? 'Unknown',
      domain: capped[index]?.domain ?? '',
      adInsight: null,
      error:
        settled.reason instanceof Error
          ? settled.reason.message
          : String(settled.reason),
    };
  }

  function extractReviews(
    settled: PromiseSettledResult<ReviewResult>,
    index: number,
  ): ReviewResult {
    if (settled.status === 'fulfilled') return settled.value;
    return {
      competitorName: capped[index]?.name ?? 'Unknown',
      domain: capped[index]?.domain ?? '',
      trustpilot: null,
      g2: null,
      capterra: null,
      testimonials: [],
      testimonialPages: [],
      negativeReviews: [],
      error:
        settled.reason instanceof Error
          ? settled.reason.message
          : String(settled.reason),
    };
  }

  // Fallback results used when the global timeout fires
  function buildTimeoutResults(reason: string): ParallelFetchResults {
    const empty = capped.map((c) => ({
      competitorName: c.name,
      domain: c.domain ?? '',
    }));
    return {
      pricing: empty.map((e) => ({
        ...e,
        pricingMarkdown: null,
        success: false,
        error: reason,
      })),
      spyfu: empty.map((e) => ({
        ...e,
        keywords: [],
        domainStats: null,
        error: reason,
      })),
      adLibrary: empty.map((e) => ({
        ...e,
        adInsight: null,
        error: reason,
      })),
      reviews: empty.map((e) => ({
        ...e,
        trustpilot: null,
        g2: null,
        capterra: null,
        testimonials: [],
        testimonialPages: [],
        negativeReviews: [],
        error: reason,
      })),
      clientAdLibrary: null,
      durationMs: Date.now() - startTime,
    };
  }

  // Fetch client's own ads in parallel with competitor data
  const clientAdPromise: Promise<AdLibraryResult | null> =
    clientInfo?.name
      ? fetchAdLibrary({
          name: clientInfo.name,
          domain: clientInfo.domain,
          inferredDomain: !clientInfo.domain,
        }).catch(() => null)
      : Promise.resolve(null);

  // Run all fetches in parallel. Each category uses Promise.allSettled so
  // individual failures don't block others. We collect results into mutable
  // arrays so that even if the global timeout fires, already-completed
  // results are preserved instead of being thrown away.
  let pricingSettled: PromiseSettledResult<PricingResult>[] = [];
  let spyfuSettled: PromiseSettledResult<SpyfuResult>[] = [];
  let adLibrarySettled: PromiseSettledResult<AdLibraryResult>[] = [];
  let reviewsSettled: PromiseSettledResult<ReviewResult>[] = [];
  let clientAdResult: AdLibraryResult | null = null;

  const pricingPromise = Promise.allSettled(capped.map(fetchPricing)).then(r => { pricingSettled = r; });
  const spyfuPromise = Promise.allSettled(capped.map(fetchSpyfu)).then(r => { spyfuSettled = r; });
  const adLibraryPromise = Promise.allSettled(capped.map(c => fetchAdLibrary(c, categoryKeywords))).then(r => { adLibrarySettled = r; });
  const reviewsPromise = Promise.allSettled(capped.map(fetchReviews)).then(r => { reviewsSettled = r; });
  const clientAdCaptured = clientAdPromise.then(r => { clientAdResult = r; });

  try {
    await Promise.race([
      Promise.all([pricingPromise, spyfuPromise, adLibraryPromise, reviewsPromise, clientAdCaptured]),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`Parallel fetch timed out after ${PARALLEL_TIMEOUT_MS / 1_000}s`),
            ),
          PARALLEL_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch (error) {
    // Global timeout fired — but partial results are already captured above.
    const reason = error instanceof Error ? error.message : 'Parallel fetch failed';
    console.log(`[parallel-fetch] ${reason} — using ${reviewsSettled.length} reviews, ${adLibrarySettled.length} ads already collected`);
  }

  return {
    pricing: pricingSettled.length > 0 ? pricingSettled.map(extractPricing) : buildTimeoutResults('timeout').pricing,
    spyfu: spyfuSettled.length > 0 ? spyfuSettled.map(extractSpyfu) : buildTimeoutResults('timeout').spyfu,
    adLibrary: adLibrarySettled.length > 0 ? adLibrarySettled.map(extractAdLibrary) : buildTimeoutResults('timeout').adLibrary,
    reviews: reviewsSettled.length > 0 ? reviewsSettled.map(extractReviews) : buildTimeoutResults('timeout').reviews,
    clientAdLibrary: clientAdResult,
    durationMs: Date.now() - startTime,
  };
}
