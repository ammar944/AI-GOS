// research-worker/src/competitors/parallel-fetch.ts
// Runs all external API calls for competitor data in parallel.
// Each call is independent — failures are isolated via Promise.allSettled.

import type { BetaToolResultContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { firecrawlTool } from '../tools/firecrawl';
import { spyfuTool } from '../tools/spyfu';
import { fetchCompetitorAds } from '../tools/apify-ads';
import { fetchReviews, type ReviewResult } from '../tools/reviews';
import type { WorkerAdInsight } from '../tools/adlibrary-types';
import type { CompetitorEntry } from './parse-context';

// SearchAPI calls complete in 2-5s. Firecrawl + SpyFu may take up to 20s.
// 30s is generous for the SearchAPI-only ad path + Firecrawl + SpyFu.
const PARALLEL_TIMEOUT_MS = 30_000;

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

  const pricingUrl = `https://${competitor.domain}/pricing`;

  try {
    const resultStr = runResultToString(await firecrawlTool.run({ url: pricingUrl }));
    const result = safeJsonParse(resultStr) as {
      success?: boolean;
      markdown?: string;
      error?: unknown;
    } | null;

    if (result?.success && typeof result.markdown === 'string' && result.markdown.trim().length > 50) {
      return {
        competitorName: competitor.name,
        domain: competitor.domain,
        pricingMarkdown: result.markdown,
        success: true,
      };
    }

    // Pricing page returned nothing useful — fall back to the homepage for
    // any pricing signals embedded there (e.g. "Starting at $X/mo").
    const homepageStr = runResultToString(await firecrawlTool.run({ url: `https://${competitor.domain}` }));
    const homepage = safeJsonParse(homepageStr) as {
      success?: boolean;
      markdown?: string;
    } | null;

    return {
      competitorName: competitor.name,
      domain: competitor.domain,
      pricingMarkdown:
        homepage?.success && typeof homepage.markdown === 'string'
          ? homepage.markdown
          : null,
      success: Boolean(homepage?.success),
      error: result?.success
        ? undefined
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
 */
async function fetchAdLibrary(competitor: CompetitorEntry): Promise<AdLibraryResult> {
  try {
    const insight = await fetchCompetitorAds(
      competitor.name,
      competitor.domain ?? undefined,
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
        error: reason,
      })),
      durationMs: Date.now() - startTime,
    };
  }

  try {
    const [pricingSettled, spyfuSettled, adLibrarySettled, reviewsSettled] = await Promise.race([
      Promise.all([
        Promise.allSettled(capped.map(fetchPricing)),
        Promise.allSettled(capped.map(fetchSpyfu)),
        Promise.allSettled(capped.map(fetchAdLibrary)),
        Promise.allSettled(capped.map(fetchReviews)),
      ]),
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

    return {
      pricing: pricingSettled.map(extractPricing),
      spyfu: spyfuSettled.map(extractSpyfu),
      adLibrary: adLibrarySettled.map(extractAdLibrary),
      reviews: reviewsSettled.map(extractReviews),
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    // Global timeout or unexpected failure — return empty results rather than
    // propagating so the competitor runner can still proceed with Sonar data.
    const reason =
      error instanceof Error ? error.message : 'Parallel fetch failed';
    return buildTimeoutResults(reason);
  }
}
