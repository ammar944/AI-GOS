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
  AdSource,
} from '@/lib/foreplay/types';
import { calculateSimilarity, normalizeCompanyName } from './name-matcher';
import { assessAdRelevance, sortByRelevance } from './relevance-scorer';

/**
 * Extended options for enhanced ad library operations
 */
export interface EnhancedAdLibraryOptions extends AdLibraryOptions {
  /** Enable Foreplay enrichment (requires FOREPLAY_API_KEY and ENABLE_FOREPLAY=true) */
  enableForeplayEnrichment?: boolean;
  /**
   * Include Foreplay as a direct ad source (not just enrichment)
   * This fetches ads directly from Foreplay's database and merges them with SearchAPI results
   * Requires FOREPLAY_API_KEY and ENABLE_FOREPLAY=true
   */
  includeForeplayAsSource?: boolean;
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
   *
   * Supports two Foreplay modes:
   * 1. enableForeplayEnrichment: Enrich SearchAPI ads with Foreplay intelligence
   * 2. includeForeplayAsSource: Also fetch ads directly from Foreplay database
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

    // Check Foreplay availability
    const foreplayEnabledFlag = isForeplayEnabled();
    const foreplayServiceAvailable = this.foreplayService !== null;
    const foreplayAvailable = foreplayEnabledFlag && foreplayServiceAvailable;

    // Determine what Foreplay operations to perform
    const shouldEnrich =
      options.enableForeplayEnrichment && foreplayAvailable && searchResults.totalAds > 0;
    const shouldFetchFromForeplay =
      options.includeForeplayAsSource && foreplayAvailable;

    console.log('[EnhancedAdLibrary] Foreplay check:', {
      enableForeplayEnrichment: options.enableForeplayEnrichment,
      includeForeplayAsSource: options.includeForeplayAsSource,
      foreplayEnabledFlag,
      foreplayServiceAvailable,
      totalAds: searchResults.totalAds,
      shouldEnrich,
      shouldFetchFromForeplay,
    });

    // Initialize response data
    let allAds: EnrichedAdCreative[] = [];
    let foreplayMetadata: ForeplayMetadata | undefined;
    let foreplaySourceMetadata: { total_ads: number; unique_ads: number; duration_ms?: number } | undefined;
    let totalForeplayCost = 0;

    // Mark SearchAPI ads with source
    const searchApiAds = this.flattenResults(searchResults).map((ad) => ({
      ...ad,
      source: 'searchapi' as AdSource,
    }));

    // Step 2a: Fetch directly from Foreplay (if enabled)
    if (shouldFetchFromForeplay) {
      try {
        const domain = options.domain || this.extractDomainFromQuery(options.query);
        const foreplayResult = await this.fetchAdsFromForeplay(
          domain,
          options.foreplayDateRange,
          options.limit ?? 100
        );

        console.log(
          `[EnhancedAdLibrary] Foreplay source fetch: ${foreplayResult.ads.length} ads`
        );

        // Combine and deduplicate
        const combinedAds = [...searchApiAds, ...foreplayResult.ads];
        allAds = this.deduplicateAds(combinedAds);

        // Track unique Foreplay ads (not found in SearchAPI)
        const uniqueForeplayAds = allAds.filter(
          (ad) => ad.source === 'foreplay'
        ).length;

        foreplaySourceMetadata = {
          total_ads: foreplayResult.ads.length,
          unique_ads: uniqueForeplayAds,
          duration_ms: foreplayResult.durationMs,
        };

        totalForeplayCost = foreplayResult.creditsUsed * COST_PER_CREDIT;
      } catch (error) {
        console.error('[EnhancedAdLibrary] Foreplay source fetch failed:', error);
        allAds = searchApiAds;
        foreplaySourceMetadata = {
          total_ads: 0,
          unique_ads: 0,
        };
      }
    } else {
      allAds = searchApiAds;
    }

    // Step 2b: Enrich with Foreplay data (if enabled)
    if (shouldEnrich) {
      try {
        // Reset credits tracking if we already fetched from Foreplay
        // to track enrichment cost separately
        const preEnrichCredits = this.foreplayService?.getTotalCreditsUsed() ?? 0;

        const enrichmentResult = await this.enrichAdsWithForeplay(
          // Only enrich SearchAPI ads (Foreplay-sourced ads already have enrichment)
          allAds.filter((ad) => ad.source !== 'foreplay'),
          options.domain || this.extractDomainFromQuery(options.query),
          options.foreplayDateRange,
          options.skipAnalytics,
          options.maxEnrichments
        );

        // Merge enriched SearchAPI ads with Foreplay-sourced ads
        const foreplaySourcedAds = allAds.filter((ad) => ad.source === 'foreplay');
        allAds = [...enrichmentResult.ads, ...foreplaySourcedAds];

        foreplayMetadata = enrichmentResult.metadata;

        // Calculate enrichment cost (credits used after source fetch)
        const enrichmentCredits =
          (this.foreplayService?.getTotalCreditsUsed() ?? 0) - preEnrichCredits;
        totalForeplayCost += enrichmentCredits * COST_PER_CREDIT;
      } catch (error) {
        console.error('[EnhancedAdLibrary] Foreplay enrichment failed:', error);
        foreplayMetadata = {
          enriched_count: 0,
          credits_used: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    } else if (!shouldFetchFromForeplay) {
      // No Foreplay operations at all - return SearchAPI results only
      const reason = !options.enableForeplayEnrichment && !options.includeForeplayAsSource
        ? 'Both Foreplay options disabled'
        : !foreplayEnabledFlag
          ? 'ENABLE_FOREPLAY env var is not true'
          : !foreplayServiceAvailable
            ? 'Foreplay service is null (no API key?)'
            : 'No ads to enrich';
      console.log('[EnhancedAdLibrary] Skipping Foreplay operations:', reason);
    }

    // Apply relevance scoring to all ads (both SearchAPI and Foreplay-sourced)
    const domain = options.domain || this.extractDomainFromQuery(options.query);
    const adsWithRelevance = allAds.map(ad => ({
      ...ad,
      // Only score if not already scored (SearchAPI ads may already have scores from base service)
      relevance: ad.relevance ?? assessAdRelevance(ad, options.query, domain),
    }));

    // Sort by relevance (highest first)
    const sortedAds = sortByRelevance(adsWithRelevance);

    // Build final response
    const totalForeplayCredits = this.foreplayService?.getTotalCreditsUsed() ?? 0;
    const foreplayCostFinal = totalForeplayCredits * COST_PER_CREDIT;

    return {
      ads: sortedAds,
      metadata: {
        searchapi: searchapiMetadata,
        foreplay: foreplayMetadata,
        foreplay_source: foreplaySourceMetadata,
      },
      costs: {
        searchapi: SEARCHAPI_COST_PER_QUERY * 3, // 3 platforms
        foreplay: foreplayCostFinal,
        total: SEARCHAPI_COST_PER_QUERY * 3 + foreplayCostFinal,
      },
    };
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
    return ads.map((ad) => ({ ...ad, source: 'searchapi' as AdSource }));
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
   * Fetch ads directly from Foreplay (not just for enrichment)
   * Returns normalized EnrichedAdCreative[] with source='foreplay'
   */
  async fetchAdsFromForeplay(
    domain: string,
    dateRange?: { from: string; to: string },
    limit: number = 100
  ): Promise<{ ads: EnrichedAdCreative[]; creditsUsed: number; durationMs: number }> {
    const startTime = Date.now();

    if (!this.foreplayService) {
      console.log('[EnhancedAdLibrary] Foreplay service not available for direct fetch');
      return { ads: [], creditsUsed: 0, durationMs: Date.now() - startTime };
    }

    // Step 1: Find brand by domain
    console.log(`[EnhancedAdLibrary] Foreplay direct fetch - searching for brand: ${domain}`);
    const brands = await this.foreplayService.searchBrands({ domain });

    if (!brands || brands.length === 0) {
      console.log(`[EnhancedAdLibrary] No Foreplay brand found for ${domain}`);
      return {
        ads: [],
        creditsUsed: this.foreplayService.getTotalCreditsUsed(),
        durationMs: Date.now() - startTime,
      };
    }

    const brand = brands[0];
    const brandId = brand.id || brand.brand_id;

    if (!brandId) {
      console.log(`[EnhancedAdLibrary] Brand found but no ID: ${brand.name}`);
      return {
        ads: [],
        creditsUsed: this.foreplayService.getTotalCreditsUsed(),
        durationMs: Date.now() - startTime,
      };
    }

    console.log(`[EnhancedAdLibrary] Found Foreplay brand: ${brand.name} (id: ${brandId})`);

    // Step 2: Fetch ads from Foreplay
    const from = dateRange?.from ?? this.get90DaysAgo();
    const to = dateRange?.to ?? this.getToday();

    const foreplayAds = await this.foreplayService.searchAds({
      brand_id: brandId,
      date_from: from,
      date_to: to,
      limit,
    });

    console.log(`[EnhancedAdLibrary] Fetched ${foreplayAds.length} ads directly from Foreplay`);

    // Step 3: Transform Foreplay ads to EnrichedAdCreative format
    const enrichedAds: EnrichedAdCreative[] = foreplayAds.map((fpAd) =>
      this.transformForeplayAdToEnriched(fpAd)
    );

    return {
      ads: enrichedAds,
      creditsUsed: this.foreplayService.getTotalCreditsUsed(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Transform a Foreplay ad to EnrichedAdCreative format
   */
  private transformForeplayAdToEnriched(fpAd: ForeplayAdDetails): EnrichedAdCreative {
    const creative = fpAd.creative || {};
    const copy = fpAd.copy || {};
    const metadata = fpAd.metadata || {};
    const brand = fpAd.brand || {};
    const hookAnalysis = metadata.hook_analysis;
    const landingPage = metadata.landing_page;

    // Map Foreplay platform to our AdPlatform type
    const platformMap: Record<string, 'linkedin' | 'meta' | 'google'> = {
      facebook: 'meta',
      instagram: 'meta',
      tiktok: 'meta', // Closest match for TikTok
      linkedin: 'linkedin',
    };

    const platform = platformMap[metadata.platform] || 'meta';

    // Determine best image URL (prefer full image over thumbnail)
    const imageUrl = creative.type === 'video'
      ? creative.thumbnail_url || creative.url // For videos, use thumbnail
      : creative.url || creative.thumbnail_url; // For images, use full URL first

    // Determine best video URL
    const videoUrl = creative.type === 'video' ? creative.url : undefined;

    // Construct platform ad library URL
    // Priority: 1) Direct ad link via ad_library_id, 2) Page view, 3) Search by name
    let detailsUrl: string | undefined;

    if (metadata.platform === 'facebook' || metadata.platform === 'instagram') {
      // Meta Ad Library - try direct link first, then page, then search
      if (fpAd.ad_library_id) {
        // Direct link to the specific ad using Meta's ad library ID
        detailsUrl = `https://www.facebook.com/ads/library/?id=${fpAd.ad_library_id}`;
      } else if (brand.page_id && /^\d+$/.test(brand.page_id)) {
        // Link to advertiser's page showing all their ads
        detailsUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${brand.page_id}&search_type=page&media_type=all`;
      } else if (brand.name) {
        // Fall back to search by brand name
        detailsUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(brand.name)}&search_type=keyword_unordered&media_type=all`;
      }
    } else if (metadata.platform === 'linkedin') {
      // LinkedIn Ad Library doesn't have public ad URLs, fall back to landing page
      detailsUrl = landingPage?.url;
    } else if (metadata.platform === 'tiktok') {
      // TikTok Creative Center - search by brand name
      if (brand.name) {
        detailsUrl = `https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/en?keyword=${encodeURIComponent(brand.name)}&period=180&sort_by=like`;
      }
    }

    // Fall back to landing page URL if no ad library URL available
    if (!detailsUrl) {
      detailsUrl = landingPage?.url;
    }

    return {
      // Base AdCreative fields
      platform,
      id: fpAd.ad_id,
      advertiser: brand.name || copy.sponsor_name || 'Unknown',
      headline: copy.headline,
      body: copy.body,
      imageUrl,
      videoUrl,
      format: creative.type || 'unknown',
      isActive: metadata.is_active ?? false,
      firstSeen: metadata.first_seen,
      lastSeen: metadata.last_seen,
      platforms: [metadata.platform],
      detailsUrl, // Landing page URL for Foreplay ads
      rawData: fpAd,
      // Source tracking
      source: 'foreplay' as AdSource,
      // Foreplay enrichment (always included for Foreplay-sourced ads)
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
        foreplay_ad_id: fpAd.ad_id,
        match_confidence: 1.0, // Direct from Foreplay = 100% match
      },
    };
  }

  /**
   * Deduplicate ads from multiple sources
   * Uses composite key: advertiser + headline + body (normalized)
   */
  private deduplicateAds(ads: EnrichedAdCreative[]): EnrichedAdCreative[] {
    const seen = new Map<string, EnrichedAdCreative>();

    for (const ad of ads) {
      const key = this.createAdDedupeKey(ad);

      if (!seen.has(key)) {
        seen.set(key, ad);
      } else {
        // Prefer Foreplay-sourced ads (they have enrichment data)
        const existing = seen.get(key)!;
        if (ad.source === 'foreplay' && existing.source !== 'foreplay') {
          seen.set(key, ad);
        }
        // If both from same source, or existing is Foreplay, keep existing
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Create a deduplication key for an ad
   */
  private createAdDedupeKey(ad: EnrichedAdCreative): string {
    const normalize = (s?: string) =>
      (s || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 100); // Limit length for efficiency

    return `${normalize(ad.advertiser)}|${normalize(ad.headline)}|${normalize(ad.body)}`;
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
