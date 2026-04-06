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
 * Scrape a competitor's /pricing page with Firecrawl.
 * Tries /pricing first; falls back to the homepage if /pricing returns no
 * useful content (empty, too short, or a hard failure).
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
  const pricingPaths = ['/pricing', '/plans', '/packages'];

  for (const path of pricingPaths) {
    const url = `https://${competitor.domain}${path}`;
    try {
      console.log(`[pricing] scraping ${url} for ${competitor.name}...`);
      const start = Date.now();
      const result = await Promise.race([
        client.scrape(url, {
          formats: ['markdown'],
          blockAds: true,
        }) as Promise<{ success: boolean; markdown?: string; error?: unknown }>,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Pricing scrape timed out')), 20_000),
        ),
      ]);
      const elapsed = Date.now() - start;

      const md = typeof result?.markdown === 'string' ? result.markdown : '';
      if (md.trim().length > 50) {
        const hasPricing = /\$\d+|starting at|\d+\/mo/i.test(md);
        console.log(`[pricing] ${competitor.name} ${path}: OK (${elapsed}ms, ${md.length} chars, pricing=${hasPricing})`);
        if (hasPricing) {
          return {
            competitorName: competitor.name,
            domain: competitor.domain,
            pricingMarkdown: extractPricingWindow(md, 6000),
            success: true,
          };
        }
        // Page exists but no dollar amounts — try next path
        console.log(`[pricing] ${competitor.name} ${path}: no dollar amounts, trying next path`);
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
      }) as Promise<{ success: boolean; markdown?: string }>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Homepage scrape timed out')), 20_000),
      ),
    ]);

    const homeMd = typeof homepage?.markdown === 'string' ? homepage.markdown : '';
    const homeHasPricing = /\$\d+|starting at|\d+\/mo/i.test(homeMd);
    return {
      competitorName: competitor.name,
      domain: competitor.domain,
      pricingMarkdown: homeHasPricing && homeMd.trim().length > 50 ? extractPricingWindow(homeMd, 6000) : null,
      success: homeHasPricing && homeMd.trim().length > 50,
      error: 'Pricing page not found, used homepage',
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
 */
async function fetchAdLibrary(competitor: CompetitorEntry): Promise<AdLibraryResult> {
  try {
    const insight = await fetchCompetitorAds(
      competitor.name,
      competitor.domain ?? undefined,
      !competitor.inferredDomain,
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
  const adLibraryPromise = Promise.allSettled(capped.map(fetchAdLibrary)).then(r => { adLibrarySettled = r; });
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
