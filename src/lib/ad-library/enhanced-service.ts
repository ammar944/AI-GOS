// Enhanced Ad Library Service
// Combines SearchAPI (discovery) with Foreplay (intelligence) for enriched ad analysis

import { AdLibraryService } from './service';
import type { AdCreative, AdLibraryOptions, MultiPlatformAdResponse } from './types';
import {
  createForeplayService,
  isForeplayEnabled,
  type ForeplayService,
} from '@/lib/foreplay/service';
import type {
  EnrichedAdCreative,
  ForeplayAdDetails,
  ForeplayBrandAnalytics,
  ForeplayMetadata,
  EnhancedAdLibraryResponse,
  ForeplayCostBreakdown,
} from '@/lib/foreplay/types';
import { calculateSimilarity, normalizeCompanyName } from './name-matcher';

/**
 * Extended options for enhanced ad library operations
 */
export interface EnhancedAdLibraryOptions extends AdLibraryOptions {
  /** Enable Foreplay enrichment (requires FOREPLAY_API_KEY and ENABLE_FOREPLAY=true) */
  enableForeplayEnrichment?: boolean;
  /** Date range for Foreplay analytics (default: last 90 days) */
  foreplayDateRange?: {
    from: string;
    to: string;
  };
  /** Skip analytics query (faster but less strategic insights) */
  skipAnalytics?: boolean;
  /** Maximum ads to enrich (for cost control) */
  maxEnrichments?: number;
}

/**
 * Text similarity threshold for matching SearchAPI ads with Foreplay ads
 */
const AD_MATCH_THRESHOLD = 0.7;

/**
 * Estimated cost per Foreplay credit in USD
 */
const COST_PER_CREDIT = 0.0049;

/**
 * Estimated cost per SearchAPI query in USD
 */
const SEARCHAPI_COST_PER_QUERY = 0.03;

/**
 * Enhanced Ad Library Service
 *
 * Architecture:
 * ┌─────────────────────────────────────────┐
 * │  TIER 1: SearchAPI (Discovery)          │
 * │  "What are they running RIGHT NOW?"     │
 * └─────────────────────────────────────────┘
 *                     ↓
 * ┌─────────────────────────────────────────┐
 * │  TIER 2: Foreplay (Intelligence)        │
 * │  "WHY does this work?"                  │
 * └─────────────────────────────────────────┘
 *                     ↓
 *            EnrichedAdCreative[]
 */
export class EnhancedAdLibraryService {
  private searchApiService: AdLibraryService;
  private foreplayService: ForeplayService | null;

  constructor(foreplayApiKey?: string) {
    this.searchApiService = new AdLibraryService();
    this.foreplayService = createForeplayService(foreplayApiKey);
  }

  /**
   * Fetch ads from SearchAPI and optionally enrich with Foreplay
   * Gracefully degrades if Foreplay is unavailable or disabled
   */
  async fetchAllPlatforms(
    options: EnhancedAdLibraryOptions
  ): Promise<EnhancedAdLibraryResponse> {
    const startTime = Date.now();

    // Step 1: Get ads from SearchAPI (existing logic)
    const searchResults = await this.searchApiService.fetchAllPlatforms(options);

    const searchapiMetadata = {
      total_ads: searchResults.totalAds,
      platforms_queried: ['linkedin', 'meta', 'google'],
      duration_ms: Date.now() - startTime,
    };

    // Check if Foreplay enrichment should be attempted
    const foreplayEnabledFlag = isForeplayEnabled();
    const foreplayServiceAvailable = this.foreplayService !== null;
    const shouldEnrich =
      options.enableForeplayEnrichment &&
      foreplayEnabledFlag &&
      foreplayServiceAvailable &&
      searchResults.totalAds > 0;

    console.log('[EnhancedAdLibrary] Foreplay check:', {
      enableForeplayEnrichment: options.enableForeplayEnrichment,
      foreplayEnabledFlag,
      foreplayServiceAvailable,
      totalAds: searchResults.totalAds,
      shouldEnrich,
    });

    if (!shouldEnrich) {
      // Return SearchAPI results only
      const reason = !options.enableForeplayEnrichment
        ? 'enableForeplayEnrichment is false'
        : !foreplayEnabledFlag
          ? 'ENABLE_FOREPLAY env var is not true'
          : !foreplayServiceAvailable
            ? 'Foreplay service is null (no API key?)'
            : 'No ads to enrich';
      console.log('[EnhancedAdLibrary] Skipping Foreplay enrichment:', reason);

      return {
        ads: this.convertToEnrichedAds(this.flattenResults(searchResults)),
        metadata: {
          searchapi: searchapiMetadata,
        },
        costs: {
          searchapi: SEARCHAPI_COST_PER_QUERY * 3, // 3 platforms
          foreplay: 0,
          total: SEARCHAPI_COST_PER_QUERY * 3,
        },
      };
    }

    // Step 2: Enrich with Foreplay data
    try {
      const enrichmentResult = await this.enrichAdsWithForeplay(
        this.flattenResults(searchResults),
        options.domain || this.extractDomainFromQuery(options.query),
        options.foreplayDateRange,
        options.skipAnalytics,
        options.maxEnrichments
      );

      const foreplayCost = this.foreplayService!.getTotalCreditsUsed() * COST_PER_CREDIT;

      return {
        ads: enrichmentResult.ads,
        metadata: {
          searchapi: searchapiMetadata,
          foreplay: enrichmentResult.metadata,
        },
        costs: {
          searchapi: SEARCHAPI_COST_PER_QUERY * 3,
          foreplay: foreplayCost,
          total: SEARCHAPI_COST_PER_QUERY * 3 + foreplayCost,
        },
      };
    } catch (error) {
      // Graceful degradation - return SearchAPI results if Foreplay fails
      console.error('[EnhancedAdLibrary] Foreplay enrichment failed:', error);

      return {
        ads: this.convertToEnrichedAds(this.flattenResults(searchResults)),
        metadata: {
          searchapi: searchapiMetadata,
          foreplay: {
            enriched_count: 0,
            credits_used: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        costs: {
          searchapi: SEARCHAPI_COST_PER_QUERY * 3,
          foreplay: 0,
          total: SEARCHAPI_COST_PER_QUERY * 3,
        },
      };
    }
  }

  /**
   * Core enrichment logic
   * Matches SearchAPI ads with Foreplay data and adds creative intelligence
   */
  private async enrichAdsWithForeplay(
    ads: AdCreative[],
    domain: string,
    dateRange?: { from: string; to: string },
    skipAnalytics?: boolean,
    maxEnrichments?: number
  ): Promise<{ ads: EnrichedAdCreative[]; metadata: ForeplayMetadata }> {
    const startTime = Date.now();

    if (!this.foreplayService) {
      return {
        ads: this.convertToEnrichedAds(ads),
        metadata: { enriched_count: 0, credits_used: 0, error: 'Foreplay service not available' },
      };
    }

    // Step 1: Find brand in Foreplay by domain
    console.log(`[EnhancedAdLibrary] Searching Foreplay for domain: ${domain}`);
    const brands = await this.foreplayService.searchBrands({ domain });

    if (!brands || brands.length === 0) {
      console.log(`[EnhancedAdLibrary] No Foreplay data found for ${domain}`);
      return {
        ads: this.convertToEnrichedAds(ads),
        metadata: {
          enriched_count: 0,
          credits_used: this.foreplayService.getTotalCreditsUsed(),
          duration_ms: Date.now() - startTime,
        },
      };
    }

    const brand = brands[0];
    // Handle both 'id' and 'brand_id' field names
    const brandId = brand.id || brand.brand_id;
    console.log(`[EnhancedAdLibrary] Found brand: ${brand.name} (id: ${brandId})`);

    // Step 2: Get brand analytics (creative velocity, distribution, top hooks)
    let analytics: ForeplayBrandAnalytics | undefined;
    if (!skipAnalytics && brandId) {
      const from = dateRange?.from ?? this.get90DaysAgo();
      const to = dateRange?.to ?? this.getToday();

      analytics = (await this.foreplayService.getBrandAnalytics(brandId, from, to)) ?? undefined;
      if (analytics) {
        console.log(
          `[EnhancedAdLibrary] Got brand analytics: ${analytics.creative_velocity.total_ads_launched} ads launched, ` +
            `${analytics.creative_velocity.avg_new_ads_per_week} avg/week`
        );
      }
    }

    // Step 3: Get historical ads from Foreplay for matching
    const from = dateRange?.from ?? this.get90DaysAgo();
    const to = dateRange?.to ?? this.getToday();

    if (!brandId) {
      console.log(`[EnhancedAdLibrary] No brand ID found, skipping Foreplay ad search`);
      return {
        ads: this.convertToEnrichedAds(ads),
        metadata: {
          enriched_count: 0,
          credits_used: this.foreplayService.getTotalCreditsUsed(),
          error: 'No brand ID found in Foreplay response',
          duration_ms: Date.now() - startTime,
        },
      };
    }

    const foreplayAds = await this.foreplayService.searchAds({
      brand_id: brandId,
      date_from: from,
      date_to: to,
      limit: 100, // Get recent ads for matching
    });

    console.log(`[EnhancedAdLibrary] Found ${foreplayAds.length} Foreplay ads for matching`);

    // Step 4: Enrich SearchAPI ads with Foreplay intelligence
    const adsToEnrich = maxEnrichments ? ads.slice(0, maxEnrichments) : ads;
    const remainingAds = maxEnrichments ? ads.slice(maxEnrichments) : [];

    const enrichedAds: EnrichedAdCreative[] = [];
    let enrichedCount = 0;

    for (const ad of adsToEnrich) {
      // Try to match SearchAPI ad with Foreplay ad
      const { matchedAd, confidence } = this.findMatchingForeplayAd(ad, foreplayAds);

      if (matchedAd) {
        // Defensive null checks for nested objects
        const creative = matchedAd.creative || {};
        const metadata = matchedAd.metadata || {};
        const hookAnalysis = metadata.hook_analysis;
        const landingPage = metadata.landing_page;

        enrichedAds.push({
          ...ad,
          foreplay: {
            transcript: creative.video_transcript,
            hook: hookAnalysis
              ? {
                  text: hookAnalysis.hook_text,
                  type: hookAnalysis.hook_type,
                  duration: hookAnalysis.hook_duration_seconds,
                }
              : undefined,
            emotional_tone: metadata.emotional_tone,
            landing_page_screenshot: landingPage?.screenshot_url,
            landing_page_url: landingPage?.url,
            foreplay_ad_id: matchedAd.ad_id,
            match_confidence: confidence,
          },
        });
        enrichedCount++;
      } else {
        // No match found - return ad without enrichment
        enrichedAds.push({ ...ad });
      }
    }

    // Add remaining ads without enrichment
    for (const ad of remainingAds) {
      enrichedAds.push({ ...ad });
    }

    console.log(
      `[EnhancedAdLibrary] Enriched ${enrichedCount}/${ads.length} ads with Foreplay data`
    );

    return {
      ads: enrichedAds,
      metadata: {
        enriched_count: enrichedCount,
        credits_used: this.foreplayService.getTotalCreditsUsed(),
        analytics,
        duration_ms: Date.now() - startTime,
      },
    };
  }

  /**
   * Fuzzy match SearchAPI ad with Foreplay ad
   * Match on: headline similarity, body similarity, platform
   */
  private findMatchingForeplayAd(
    searchApiAd: AdCreative,
    foreplayAds: ForeplayAdDetails[]
  ): { matchedAd: ForeplayAdDetails | null; confidence: number } {
    let bestMatch: ForeplayAdDetails | null = null;
    let bestConfidence = 0;

    const searchHeadline = normalizeCompanyName(searchApiAd.headline || '');
    const searchBody = normalizeCompanyName(searchApiAd.body || '');

    for (const fpAd of foreplayAds) {
      // Defensive null checks - API response structure may vary
      const fpCopy = fpAd.copy || {};
      const fpMetadata = fpAd.metadata || {};
      const fpCreative = fpAd.creative || {};

      const fpHeadline = normalizeCompanyName(fpCopy.headline || '');
      const fpBody = normalizeCompanyName(fpCopy.body || '');

      // Calculate similarity scores
      const headlineSimilarity = searchHeadline && fpHeadline
        ? calculateSimilarity(searchApiAd.headline || '', fpCopy.headline || '')
        : 0;

      const bodySimilarity = searchBody && fpBody
        ? calculateSimilarity(searchApiAd.body || '', fpCopy.body || '')
        : 0;

      // Platform match bonus
      const fpPlatform = fpMetadata.platform || 'unknown';
      const platformMatch = this.platformsMatch(searchApiAd.platform, fpPlatform)
        ? 0.1
        : 0;

      // Format match bonus
      const fpFormat = fpCreative.type || 'unknown';
      const formatMatch = searchApiAd.format === fpFormat ? 0.05 : 0;

      // Weighted confidence score
      const confidence =
        headlineSimilarity * 0.5 + // Headline is most important
        bodySimilarity * 0.35 + // Body text
        platformMatch +
        formatMatch;

      if (confidence > bestConfidence && confidence >= AD_MATCH_THRESHOLD) {
        bestMatch = fpAd;
        bestConfidence = confidence;
      }
    }

    return { matchedAd: bestMatch, confidence: bestConfidence };
  }

  /**
   * Check if platforms match (handling naming differences)
   */
  private platformsMatch(
    searchPlatform: string,
    foreplayPlatform: string
  ): boolean {
    const normalize = (p: string) => p.toLowerCase().replace(/[^a-z]/g, '');
    const sp = normalize(searchPlatform);
    const fp = normalize(foreplayPlatform);

    // Direct match
    if (sp === fp) return true;

    // Meta platforms
    if (sp === 'meta' && (fp === 'facebook' || fp === 'instagram')) return true;
    if ((sp === 'facebook' || sp === 'instagram') && fp === 'meta') return true;

    return false;
  }

  /**
   * Convert plain AdCreative array to EnrichedAdCreative array
   */
  private convertToEnrichedAds(ads: AdCreative[]): EnrichedAdCreative[] {
    return ads.map((ad) => ({ ...ad }));
  }

  /**
   * Flatten MultiPlatformAdResponse to single array
   */
  private flattenResults(response: MultiPlatformAdResponse): AdCreative[] {
    return response.results.flatMap((r) => r.ads);
  }

  /**
   * Extract domain from company name (heuristic)
   */
  private extractDomainFromQuery(query: string): string {
    // If already looks like a domain
    if (query.includes('.') && !query.includes(' ')) {
      return query.toLowerCase();
    }
    // Create a domain guess
    const sanitized = query.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${sanitized}.com`;
  }

  /**
   * Get date 90 days ago in YYYY-MM-DD format
   */
  private get90DaysAgo(): string {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date.toISOString().split('T')[0];
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get Foreplay cost breakdown for the current session
   */
  getForeplayCostBreakdown(): ForeplayCostBreakdown | null {
    if (!this.foreplayService) return null;

    const breakdown = this.foreplayService.getCostBreakdown();
    const totals: ForeplayCostBreakdown = {
      brand_search: 0,
      ad_search: 0,
      ad_details: 0,
      analytics: 0,
      total: 0,
      currency: 'USD',
    };

    for (const { operation, credits } of breakdown) {
      if (operation.includes('brands/search')) {
        totals.brand_search += credits * COST_PER_CREDIT;
      } else if (operation.includes('ads/search')) {
        totals.ad_search += credits * COST_PER_CREDIT;
      } else if (operation.includes('/ads/')) {
        totals.ad_details += credits * COST_PER_CREDIT;
      } else if (operation.includes('analytics')) {
        totals.analytics += credits * COST_PER_CREDIT;
      }
    }

    totals.total =
      totals.brand_search + totals.ad_search + totals.ad_details + totals.analytics;

    return totals;
  }

  /**
   * Reset cost tracking (for new analysis session)
   */
  resetCostTracking(): void {
    this.foreplayService?.resetCostTracking();
  }

  /**
   * Check if Foreplay is available and enabled
   */
  isForeplayAvailable(): boolean {
    return isForeplayEnabled() && this.foreplayService !== null;
  }
}

/**
 * Factory function to create an EnhancedAdLibraryService instance
 */
export function createEnhancedAdLibraryService(
  foreplayApiKey?: string
): EnhancedAdLibraryService {
  return new EnhancedAdLibraryService(foreplayApiKey);
}
