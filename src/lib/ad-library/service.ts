// Ad Library Service
// Unified interface for fetching ads from LinkedIn, Meta, and Google via SearchAPI.io

import { getRequiredEnv } from '@/lib/env';
import type {
  AdPlatform,
  AdFormat,
  AdCreative,
  AdLibraryOptions,
  AdLibraryResponse,
  MultiPlatformAdResponse,
} from './types';
import {
  isAdvertiserMatch,
  calculateSimilarity,
  extractCompanyFromDomain,
} from './name-matcher';
import { assessAdRelevance, sortByRelevance } from './relevance-scorer';
import {
  createAdFetchContext,
  logRequest,
  logResponse,
  logFiltering,
  logError,
  logRateLimit,
  logMultiPlatformSummary,
  type AdFetchContext,
} from './logger';

const SEARCHAPI_BASE = 'https://www.searchapi.io/api/v1/search';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_LIMIT = 50;
const DEFAULT_COUNTRY = 'US';
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests to same platform
const SIMILARITY_THRESHOLD = 0.8; // Minimum similarity score - stricter to avoid false positives like "huel" matching "hula"

/**
 * SearchAPI.io response structure
 */
interface SearchApiResponse {
  error?: string;
  search_information?: {
    total_results?: number;
  };
  ads?: unknown[];
  ad_creatives?: unknown[];
  // For Meta page search responses
  pages?: Array<{
    id?: string;
    page_id?: string;
    name?: string;
    page_name?: string;
    page_profile_uri?: string;
    likes?: number;
  }>;
  // For Google advertiser search responses
  advertisers?: Array<{
    id?: string;
    name?: string;
    region?: string;
    ads_count?: {
      lower?: number;
      upper?: number;
    };
    is_verified?: boolean;
  }>;
  domains?: Array<{
    name?: string;
  }>;
}

/**
 * Rate limiting state for a single request context
 * Tracks when each platform was last called within this request
 */
interface RateLimitState {
  lastRequestTime: Map<AdPlatform, number>;
}

/**
 * Service for fetching competitor ads from multiple ad library platforms
 *
 * KEY FIXES:
 * 1. Request-scoped rate limiting (no shared state between concurrent requests)
 * 2. Advertiser name validation with fuzzy matching
 * 3. Post-fetch filtering to remove unrelated ads
 * 4. Comprehensive debug logging for tracing
 */
export class AdLibraryService {
  private apiKey: string;

  constructor() {
    this.apiKey = getRequiredEnv('SEARCHAPI_KEY');
  }

  /**
   * Fetch ads from LinkedIn Ad Library with validation
   *
   * FIX: Use 'advertiser' parameter instead of 'q' parameter
   * The 'q' parameter searches ad CONTENT (text, headlines)
   * The 'advertiser' parameter filters by COMPANY NAME (what we actually want)
   */
  async fetchLinkedInAds(
    options: AdLibraryOptions,
    context: AdFetchContext,
    rateLimitState: RateLimitState
  ): Promise<AdLibraryResponse> {
    logRequest(context, 'linkedin', options);
    await this.enforceRateLimit('linkedin', context, rateLimitState);

    try {
      // Use 'advertiser' parameter for company name filtering
      // This searches by company/advertiser name, not ad content
      const params = new URLSearchParams({
        engine: 'linkedin_ad_library',
        advertiser: options.query, // Changed from 'q' to 'advertiser'
        api_key: this.apiKey,
      });

      const data = await this.fetchWithTimeout(`${SEARCHAPI_BASE}?${params}`);

      if (data.error) {
        const errorMsg = String(data.error);
        logError(context, 'linkedin', errorMsg);
        return this.errorResponse('linkedin', errorMsg);
      }

      const totalCount = data.search_information?.total_results || data.ads?.length || 0;
      const rawAds = data.ads || [];
      const limit = options.limit || DEFAULT_LIMIT;

      // Normalize ads
      const normalizedAds = rawAds
        .slice(0, limit)
        .map((ad: unknown) => this.normalizeAd('linkedin', ad));

      // Filter ads to only include those matching the searched company
      const filteredAds = this.filterValidAds(normalizedAds, 'linkedin', context);

      // Filter out LinkedIn ads without image preview
      // EXCEPT for text/message ads which are intentionally text-based
      const adsWithImages = filteredAds.filter(ad => {
        const hasVisual = !!ad.imageUrl || !!ad.videoUrl;
        const isTextAd = ad.format === 'text' || ad.format === 'message';

        if (!hasVisual && !isTextAd) {
          console.log(
            `[AdLibrary:${context.requestId}] [LINKEDIN] Filtering out ad without image: "${ad.headline?.slice(0, 50) || ad.id}..."`
          );
        }
        return hasVisual || isTextAd;
      });

      console.log(
        `[AdLibrary:${context.requestId}] [LINKEDIN] Kept ${adsWithImages.length}/${filteredAds.length} ads with visual creatives`
      );

      const response: AdLibraryResponse = {
        platform: 'linkedin',
        success: true,
        ads: adsWithImages,
        totalCount,
      };

      logResponse(context, 'linkedin', response, normalizedAds.length, adsWithImages.length);
      return response;
    } catch (error) {
      const errorMsg = this.getErrorMessage(error);
      logError(context, 'linkedin', errorMsg);
      return this.errorResponse('linkedin', errorMsg);
    }
  }

  /**
   * Fetch ads from Meta Ad Library (Facebook/Instagram) with validation
   *
   * FIX: Two-step approach to get ONLY ads from the specific advertiser:
   * 1. First, search for the page using meta_ad_library_page_search to get page_id
   * 2. Then, fetch ads using that page_id (guarantees ads are from that advertiser only)
   *
   * The 'q' parameter alone searches ALL ad content, returning unrelated ads.
   * Using page_id ensures we only get ads from the exact advertiser we want.
   */
  async fetchMetaAds(
    options: AdLibraryOptions,
    context: AdFetchContext,
    rateLimitState: RateLimitState
  ): Promise<AdLibraryResponse> {
    logRequest(context, 'meta', options);
    await this.enforceRateLimit('meta', context, rateLimitState);

    try {
      // Step 1: Search for the advertiser's page to get their page_id
      const pageId = await this.lookupMetaPageId(options.query, context);

      if (!pageId) {
        // No matching page found - this is not an error, company may not have a Meta page
        console.log(`[AdLibrary:${context.requestId}] [META] No page found for "${options.query}"`);
        return {
          platform: 'meta',
          success: true,
          ads: [],
          totalCount: 0,
        };
      }

      console.log(`[AdLibrary:${context.requestId}] [META] Found page_id ${pageId} for "${options.query}"`);

      // Step 2: Fetch ads using the page_id (guarantees ads are from this advertiser only)
      const params = new URLSearchParams({
        engine: 'meta_ad_library',
        page_id: pageId,
        country: options.country || DEFAULT_COUNTRY,
        api_key: this.apiKey,
      });

      const data = await this.fetchWithTimeout(`${SEARCHAPI_BASE}?${params}`);

      if (data.error) {
        const errorMsg = String(data.error);
        logError(context, 'meta', errorMsg);
        return this.errorResponse('meta', errorMsg);
      }

      const totalCount = data.search_information?.total_results || data.ads?.length || 0;
      const rawAds = data.ads || [];
      const limit = options.limit || DEFAULT_LIMIT;

      // Normalize ads - these are guaranteed to be from the correct advertiser
      const normalizedAds = rawAds
        .slice(0, limit)
        .map((ad: unknown) => this.normalizeAd('meta', ad));

      // Still run validation as a safety net (should pass since we used page_id)
      const filteredAds = this.filterValidAds(normalizedAds, 'meta', context);

      // Filter out Meta ads without image preview
      // Some ads are dynamic catalog templates without embedded images
      const adsWithImages = filteredAds.filter(ad => {
        const hasVisual = !!ad.imageUrl || !!ad.videoUrl;
        if (!hasVisual) {
          console.log(
            `[AdLibrary:${context.requestId}] [META] Filtering out ad without image: "${ad.headline?.slice(0, 50) || ad.id}..."`
          );
        }
        return hasVisual;
      });

      console.log(
        `[AdLibrary:${context.requestId}] [META] Kept ${adsWithImages.length}/${filteredAds.length} ads with visual creatives`
      );

      const response: AdLibraryResponse = {
        platform: 'meta',
        success: true,
        ads: adsWithImages,
        totalCount,
      };

      logResponse(context, 'meta', response, normalizedAds.length, adsWithImages.length);
      return response;
    } catch (error) {
      const errorMsg = this.getErrorMessage(error);
      logError(context, 'meta', errorMsg);
      return this.errorResponse('meta', errorMsg);
    }
  }

  /**
   * Look up Meta page_id for an advertiser name
   * Uses meta_ad_library_page_search to find the official page
   * Returns the best matching page_id or undefined if not found
   *
   * FIX: API returns 'page_results' not 'pages'
   * FIX: Prefer verified pages over unverified ones
   */
  private async lookupMetaPageId(advertiserName: string, context: AdFetchContext): Promise<string | undefined> {
    try {
      const params = new URLSearchParams({
        engine: 'meta_ad_library_page_search',
        q: advertiserName,
        api_key: this.apiKey,
      });

      const data = await this.fetchWithTimeout(`${SEARCHAPI_BASE}?${params}`) as SearchApiResponse & {
        page_results?: Array<{
          page_id?: string;
          name?: string;
          likes?: number;
          verification?: string;
          ig_followers?: number;
        }>;
      };

      if (data.error) {
        console.warn(`[AdLibrary:${context.requestId}] [META] Page search error: ${data.error}`);
        return undefined;
      }

      // API returns 'page_results' not 'pages'
      const pages = data.page_results || data.pages || [];
      if (pages.length === 0) {
        console.log(`[AdLibrary:${context.requestId}] [META] No pages found for "${advertiserName}"`);
        return undefined;
      }

      console.log(`[AdLibrary:${context.requestId}] [META] Found ${pages.length} page candidates`);

      // Find the best matching page using fuzzy matching
      // Prefer: 1) Verified pages, 2) High similarity, 3) More followers/likes
      let bestMatch: {
        pageId: string;
        pageName: string;
        similarity: number;
        isVerified: boolean;
        score: number;
      } | undefined;

      for (const page of pages) {
        const pageName = (page as { name?: string; page_name?: string }).name ||
                        (page as { name?: string; page_name?: string }).page_name || '';
        const pageId = (page as { page_id?: string; id?: string }).page_id ||
                      (page as { page_id?: string; id?: string }).id;

        if (!pageId) continue;

        const similarity = calculateSimilarity(pageName, advertiserName);
        const isVerified = (page as { verification?: string }).verification === 'BLUE_VERIFIED';
        const likes = (page as { likes?: number }).likes || 0;
        const igFollowers = (page as { ig_followers?: number }).ig_followers || 0;

        // Calculate a composite score:
        // - Similarity is most important (0-1, scaled to 0-100)
        // - Verified pages get a big bonus (+50)
        // - More followers/likes is a tiebreaker (log scale)
        const followerScore = Math.log10(Math.max(igFollowers, likes, 1)) / 10; // 0-1 range roughly
        const score = (similarity * 100) + (isVerified ? 50 : 0) + followerScore;

        // Log each candidate for debugging
        console.log(
          `[AdLibrary:${context.requestId}] [META] Page candidate: "${pageName}" (id: ${pageId}) - ` +
          `similarity: ${similarity.toFixed(2)}, verified: ${isVerified}, ` +
          `likes: ${likes}, ig_followers: ${igFollowers}, score: ${score.toFixed(1)}`
        );

        // Only consider pages with reasonable similarity
        if (similarity >= SIMILARITY_THRESHOLD) {
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { pageId, pageName, similarity, isVerified, score };
          }
        }
      }

      if (bestMatch) {
        console.log(
          `[AdLibrary:${context.requestId}] [META] Selected page: "${bestMatch.pageName}" ` +
          `(id: ${bestMatch.pageId}) - verified: ${bestMatch.isVerified}, score: ${bestMatch.score.toFixed(1)}`
        );
        return bestMatch.pageId;
      }

      console.log(`[AdLibrary:${context.requestId}] [META] No pages matched similarity threshold for "${advertiserName}"`);
      return undefined;
    } catch (error) {
      console.warn(`[AdLibrary:${context.requestId}] [META] Page lookup failed:`, error);
      return undefined;
    }
  }

  /**
   * Look up Google advertiser_id for a company name
   * Uses google_ads_transparency_center_advertiser_search to find the official advertiser
   * Returns the best matching advertiser_id or undefined if not found
   *
   * This is more accurate than using domain because:
   * 1. Returns only ads from the exact advertiser (not subsidiaries or similar domains)
   * 2. Works for companies without verified domains
   * 3. Allows filtering by ad format and platform
   */
  private async lookupGoogleAdvertiserId(
    companyName: string,
    context: AdFetchContext
  ): Promise<{ advertiserId: string; advertiserName: string } | undefined> {
    try {
      const params = new URLSearchParams({
        engine: 'google_ads_transparency_center_advertiser_search',
        q: companyName,
        api_key: this.apiKey,
      });

      const data = await this.fetchWithTimeout(`${SEARCHAPI_BASE}?${params}`);

      if (data.error) {
        console.warn(`[AdLibrary:${context.requestId}] [GOOGLE] Advertiser search error: ${data.error}`);
        return undefined;
      }

      const advertisers = data.advertisers || [];
      if (advertisers.length === 0) {
        console.log(`[AdLibrary:${context.requestId}] [GOOGLE] No advertisers found for "${companyName}"`);
        return undefined;
      }

      // Find the best matching advertiser using fuzzy matching
      let bestMatch: { advertiserId: string; advertiserName: string; similarity: number } | undefined;

      for (const advertiser of advertisers) {
        const advName = advertiser.name || '';
        const advId = advertiser.id;

        if (!advId) continue;

        const similarity = calculateSimilarity(advName, companyName);

        // Log each candidate for debugging
        console.log(
          `[AdLibrary:${context.requestId}] [GOOGLE] Advertiser candidate: "${advName}" (id: ${advId}) - ` +
          `similarity: ${similarity.toFixed(2)}, verified: ${advertiser.is_verified}, ` +
          `ads: ${advertiser.ads_count?.lower || 0}-${advertiser.ads_count?.upper || 0}`
        );

        // Only consider advertisers with reasonable similarity
        if (similarity >= SIMILARITY_THRESHOLD) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { advertiserId: advId, advertiserName: advName, similarity };
          }
        }
      }

      if (bestMatch) {
        console.log(
          `[AdLibrary:${context.requestId}] [GOOGLE] Selected advertiser: "${bestMatch.advertiserName}" ` +
          `(id: ${bestMatch.advertiserId}) with similarity ${bestMatch.similarity.toFixed(2)}`
        );
      }

      return bestMatch ? { advertiserId: bestMatch.advertiserId, advertiserName: bestMatch.advertiserName } : undefined;
    } catch (error) {
      console.warn(`[AdLibrary:${context.requestId}] [GOOGLE] Advertiser lookup failed:`, error);
      return undefined;
    }
  }

  /**
   * Fetch ads from Google Ads Transparency Center with validation
   *
   * Uses a two-step approach for better accuracy:
   * 1. First, search for the advertiser by name to get advertiser_id
   * 2. Then, fetch ads using advertiser_id (more accurate than domain)
   * 3. Optionally filter by ad_format to exclude text-only ads
   *
   * Falls back to domain-based search if advertiser lookup fails.
   */
  async fetchGoogleAds(
    options: AdLibraryOptions,
    context: AdFetchContext,
    rateLimitState: RateLimitState
  ): Promise<AdLibraryResponse> {
    logRequest(context, 'google', options);
    await this.enforceRateLimit('google', context, rateLimitState);

    try {
      // Step 1: Look up advertiser_id by company name (more accurate than domain)
      const advertiserInfo = await this.lookupGoogleAdvertiserId(options.query, context);

      // Build request parameters
      const params = new URLSearchParams({
        engine: 'google_ads_transparency_center',
        api_key: this.apiKey,
      });

      if (advertiserInfo) {
        // Use advertiser_id for precise targeting
        params.set('advertiser_id', advertiserInfo.advertiserId);
        console.log(
          `[AdLibrary:${context.requestId}] [GOOGLE] Using advertiser_id: ${advertiserInfo.advertiserId} ` +
          `for "${advertiserInfo.advertiserName}"`
        );
      } else {
        // Fall back to domain-based search
        const domain = options.domain || this.extractDomain(options.query);
        if (!domain) {
          const errorMsg = 'Could not find advertiser and no domain available for Google Ads Transparency';
          logError(context, 'google', errorMsg);
          return this.errorResponse('google', errorMsg);
        }
        params.set('domain', domain);
        console.log(
          `[AdLibrary:${context.requestId}] [GOOGLE] Falling back to domain: ${domain}`
        );
      }

      // Add format filter to exclude text-only ads (domain sponsor garbage)
      // Default to 'image' if not specified - we only want ads with visual previews
      const adFormat = options.googleAdFormat || 'image';
      params.set('ad_format', adFormat);
      console.log(
        `[AdLibrary:${context.requestId}] [GOOGLE] Filtering by format: ${adFormat}`
      );

      // Add optional platform filter
      if (options.googlePlatform) {
        params.set('platform', options.googlePlatform);
        console.log(
          `[AdLibrary:${context.requestId}] [GOOGLE] Filtering by platform: ${options.googlePlatform}`
        );
      }

      const data = await this.fetchWithTimeout(`${SEARCHAPI_BASE}?${params}`);

      if (data.error) {
        const errorMsg = String(data.error);
        logError(context, 'google', errorMsg);
        return this.errorResponse('google', errorMsg);
      }

      // Google uses "ad_creatives" instead of "ads"
      const totalCount = data.search_information?.total_results || data.ad_creatives?.length || 0;
      const rawAds = data.ad_creatives || [];
      const limit = options.limit || DEFAULT_LIMIT;

      // Normalize ads
      const normalizedAds = rawAds
        .slice(0, limit)
        .map((ad: unknown) => this.normalizeAd('google', ad));

      // Filter ads to only include those matching the searched company
      // Note: When using advertiser_id, this should already be accurate
      const filteredAds = this.filterValidAds(normalizedAds, 'google', context);

      // CRITICAL: Remove Google ads without image preview (domain sponsor garbage)
      // Even with format=image filter, API sometimes returns text-only ads
      const adsWithImages = filteredAds.filter(ad => {
        const hasVisual = !!ad.imageUrl || !!ad.videoUrl;
        if (!hasVisual) {
          console.log(
            `[AdLibrary:${context.requestId}] [GOOGLE] Filtering out ad without image: "${ad.headline || ad.id}"`
          );
        }
        return hasVisual;
      });

      console.log(
        `[AdLibrary:${context.requestId}] [GOOGLE] Kept ${adsWithImages.length}/${filteredAds.length} ads with visual creatives`
      );

      const response: AdLibraryResponse = {
        platform: 'google',
        success: true,
        ads: adsWithImages,
        totalCount,
      };

      logResponse(context, 'google', response, normalizedAds.length, adsWithImages.length);
      return response;
    } catch (error) {
      const errorMsg = this.getErrorMessage(error);
      logError(context, 'google', errorMsg);
      return this.errorResponse('google', errorMsg);
    }
  }

  /**
   * Fetch ads from all platforms in parallel
   * Creates request-scoped context and rate limiting state
   *
   * FIX: Each call to fetchAllPlatforms now gets its own context and rate limit state,
   * preventing ads from different competitors from getting mixed up during parallel fetches
   */
  async fetchAllPlatforms(options: AdLibraryOptions): Promise<MultiPlatformAdResponse> {
    // Create a unique context for this request (includes requestId for tracing)
    const context = createAdFetchContext(options.query, options.domain);

    // Create request-scoped rate limiting state (not shared across concurrent requests)
    const rateLimitState: RateLimitState = {
      lastRequestTime: new Map(),
    };

    // Fetch from all platforms in parallel
    // Each platform gets the same context and rate limit state (request-scoped)
    const [linkedinResult, metaResult, googleResult] = await Promise.all([
      this.fetchLinkedInAds(options, context, rateLimitState),
      this.fetchMetaAds(options, context, rateLimitState),
      this.fetchGoogleAds(options, context, rateLimitState),
    ]);

    // Collect all ads from all platforms for deduplication
    const allAds = [
      ...linkedinResult.ads,
      ...metaResult.ads,
      ...googleResult.ads,
    ];

    // Deduplicate ads across platforms (removes same creative appearing on multiple platforms)
    const dedupedAds = deduplicateAds(allAds);

    // Apply relevance scoring to all ads
    const scoredAds = dedupedAds.map(ad => ({
      ...ad,
      relevance: assessAdRelevance(ad, context.searchedCompany, context.searchedDomain),
    }));

    // Sort by relevance (highest first) so most relevant ads appear at top
    const sortedAds = sortByRelevance(scoredAds);

    console.log(
      `[AdLibrary:${context.requestId}] Relevance scoring complete: ` +
      `${sortedAds.filter(a => (a.relevance?.score ?? 0) >= 70).length} high, ` +
      `${sortedAds.filter(a => (a.relevance?.score ?? 0) >= 40 && (a.relevance?.score ?? 0) < 70).length} medium, ` +
      `${sortedAds.filter(a => (a.relevance?.score ?? 0) < 40).length} low relevance`
    );

    // Rebuild per-platform results with scored and sorted ads
    const dedupedResults: AdLibraryResponse[] = [
      {
        ...linkedinResult,
        ads: sortedAds.filter((ad) => ad.platform === 'linkedin'),
      },
      {
        ...metaResult,
        ads: sortedAds.filter((ad) => ad.platform === 'meta'),
      },
      {
        ...googleResult,
        ads: sortedAds.filter((ad) => ad.platform === 'google'),
      },
    ];

    const totalAds = sortedAds.length;
    const hasCreatives = sortedAds.some((ad) => ad.imageUrl || ad.videoUrl);

    logMultiPlatformSummary(context, dedupedResults);

    return {
      results: dedupedResults,
      totalAds,
      hasCreatives,
    };
  }

  /**
   * Filter ads to only include those from the searched company
   * Uses fuzzy matching to handle name variations
   *
   * FIX: Validates that returned ads actually belong to the searched company
   * FIX #2: Stricter validation - reject "Unknown" advertisers and validate against domain
   */
  private filterValidAds(
    ads: AdCreative[],
    platform: AdPlatform,
    context: AdFetchContext
  ): AdCreative[] {
    if (!ads || ads.length === 0) {
      return [];
    }

    const filteredOut: Array<{ advertiser: string; similarity: number; reason: string }> = [];
    const validAds: AdCreative[] = [];

    for (const ad of ads) {
      // STRICT CHECK 1: Reject ads with unknown/missing advertiser
      if (!ad.advertiser || ad.advertiser === 'Unknown' || ad.advertiser.trim() === '') {
        filteredOut.push({
          advertiser: ad.advertiser || '(empty)',
          similarity: 0,
          reason: 'unknown_advertiser',
        });
        continue;
      }

      // Calculate similarity score
      const similarity = calculateSimilarity(ad.advertiser, context.searchedCompany);

      // STRICT CHECK 2: Require high similarity match
      if (!isAdvertiserMatch(ad.advertiser, context.searchedCompany, SIMILARITY_THRESHOLD)) {
        filteredOut.push({
          advertiser: ad.advertiser,
          similarity,
          reason: `low_similarity_${similarity.toFixed(2)}`,
        });
        continue;
      }

      // STRICT CHECK 3: If we have a domain, also validate against it
      if (context.searchedDomain) {
        const domainCompany = extractCompanyFromDomain(context.searchedDomain);
        if (domainCompany) {
          const domainSimilarity = calculateSimilarity(ad.advertiser, domainCompany);
          // If domain-based similarity is very low, be suspicious
          if (domainSimilarity < 0.5 && similarity < 0.9) {
            filteredOut.push({
              advertiser: ad.advertiser,
              similarity,
              reason: `domain_mismatch_${domainSimilarity.toFixed(2)}`,
            });
            continue;
          }
        }
      }

      // Ad passed all checks
      validAds.push(ad);
    }

    // Log filtering details if any ads were filtered out
    if (filteredOut.length > 0) {
      logFiltering(context, platform, ads.length, validAds.length, filteredOut);
    }

    return validAds;
  }

  /**
   * Extract image URL from platform-specific ad format
   *
   * FIX: Validates extracted URLs to prevent broken images in UI
   */
  private extractImageUrl(platform: AdPlatform, ad: Record<string, unknown>): string | undefined {
    let rawUrl: string | undefined;

    switch (platform) {
      case 'linkedin': {
        const content = ad.content as Record<string, unknown> | undefined;
        // Primary: content.image (works for both image and video ads - video ads have cover image)
        rawUrl = content?.image as string | undefined;

        // Fallback: advertiser thumbnail (small but better than nothing)
        if (!rawUrl) {
          const advertiser = ad.advertiser as Record<string, unknown> | undefined;
          rawUrl = advertiser?.thumbnail as string | undefined;
        }
        break;
      }
      case 'meta': {
        const snapshot = ad.snapshot as Record<string, unknown> | undefined;
        const images = snapshot?.images as unknown[] | undefined;
        if (images && images.length > 0) {
          const firstImage = images[0];
          if (typeof firstImage === 'string') {
            rawUrl = firstImage;
          } else if (typeof firstImage === 'object' && firstImage !== null) {
            const imgObj = firstImage as Record<string, unknown>;
            // Check multiple possible field names for image URL
            rawUrl = (
              imgObj.url ||
              imgObj.original_image_url ||
              imgObj.src ||
              imgObj.image_url ||
              imgObj.thumbnail ||
              imgObj.resized_image_url
            ) as string | undefined;
          }
        }
        break;
      }
      case 'google': {
        const image = ad.image as Record<string, unknown> | undefined;
        const video = ad.video as Record<string, unknown> | undefined;
        // Try image.link first, then fallback to video thumbnail for video ads
        rawUrl = (
          image?.link ||
          image?.url ||
          video?.thumbnail ||
          video?.poster ||
          ad.thumbnail ||
          ad.thumbnail_url ||
          ad.preview_image
        ) as string | undefined;
        break;
      }
    }

    // Validate URL before returning
    return rawUrl && this.isValidUrl(rawUrl) ? rawUrl : undefined;
  }

  /**
   * Extract video URL from platform-specific ad format
   *
   * FIX: Validates extracted URLs to prevent broken videos in UI
   */
  private extractVideoUrl(platform: AdPlatform, ad: Record<string, unknown>): string | undefined {
    let rawUrl: string | undefined;

    switch (platform) {
      case 'linkedin': {
        // LinkedIn video ads have ad_type: "video" and content.video_url
        // Also check for video_url even without ad_type flag (some ads may not have it)
        const content = ad.content as Record<string, unknown> | undefined;
        const adType = (ad.ad_type as string | undefined)?.toLowerCase();
        const contentType = (content?.type as string | undefined)?.toLowerCase();

        // Extract video URL if it's a video ad or if video_url exists
        if (adType === 'video' || contentType === 'video' || content?.video_url) {
          rawUrl = (
            content?.video_url ||
            content?.video ||
            content?.media_url ||
            ad.video_url
          ) as string | undefined;
        }
        break;
      }
      case 'meta': {
        const snapshot = ad.snapshot as Record<string, unknown> | undefined;
        const videos = snapshot?.videos as unknown[] | undefined;
        if (videos && videos.length > 0) {
          const firstVideo = videos[0];
          if (typeof firstVideo === 'string') {
            rawUrl = firstVideo;
          } else if (typeof firstVideo === 'object' && firstVideo !== null) {
            const vidObj = firstVideo as Record<string, unknown>;
            // Check multiple possible field names for video URL
            rawUrl = (
              vidObj.video_hd_url ||
              vidObj.video_sd_url ||
              vidObj.video_url ||
              vidObj.src ||
              vidObj.url
            ) as string | undefined;
          }
        }
        break;
      }
      case 'google': {
        // Google video ads have format: "video"
        // Check multiple possible locations for video URL
        const format = ad.format as string | undefined;
        if (format?.toLowerCase() === 'video') {
          const video = ad.video as Record<string, unknown> | undefined;
          rawUrl = (
            video?.link ||
            video?.url ||
            video?.video_url ||
            ad.video_url ||
            ad.video_link ||
            ad.media_url
          ) as string | undefined;
        }
        break;
      }
    }

    // Validate URL before returning
    return rawUrl && this.isValidUrl(rawUrl) ? rawUrl : undefined;
  }

  /**
   * Determine ad format based on platform-specific data
   */
  private determineFormat(platform: AdPlatform, ad: Record<string, unknown>, hasVideo: boolean, hasImage: boolean): AdFormat {
    switch (platform) {
      case 'google': {
        // Google explicitly provides format field
        const format = (ad.format as string | undefined)?.toLowerCase();
        if (format === 'video') return 'video';
        if (format === 'carousel') return 'carousel';
        if (hasImage) return 'image';
        return 'unknown';
      }
      case 'meta': {
        const snapshot = ad.snapshot as Record<string, unknown> | undefined;
        const videos = snapshot?.videos as unknown[] | undefined;
        const images = snapshot?.images as unknown[] | undefined;
        // Check carousel by multiple images/cards
        const cards = snapshot?.cards as unknown[] | undefined;
        if (cards && cards.length > 1) return 'carousel';
        if (videos && videos.length > 0) return 'video';
        if (images && images.length > 0) return 'image';
        return 'unknown';
      }
      case 'linkedin': {
        // LinkedIn: check ad_type FIRST (authoritative field from SearchAPI)
        const adType = (ad.ad_type as string | undefined)?.toLowerCase();

        // Check for message/text ad types BEFORE video/image
        // These are text-based ads that may have thumbnails but aren't image ads
        if (adType === 'message_ad' || adType === 'message' || adType === 'sponsored_inmail') {
          return 'message';
        }
        if (adType === 'text_ad' || adType === 'text') {
          return 'text';
        }
        if (adType === 'conversation_ad' || adType === 'conversation') {
          return 'message'; // Conversation ads are similar to message ads
        }

        if (adType === 'video') return 'video';

        // Then check content.type as fallback
        const content = ad.content as Record<string, unknown> | undefined;
        const contentType = (content?.type as string | undefined)?.toLowerCase();
        if (contentType === 'video' || hasVideo) return 'video';
        if (contentType === 'carousel' || adType === 'carousel') return 'carousel';
        if (hasImage) return 'image';
        return 'unknown';
      }
      default:
        if (hasVideo) return 'video';
        if (hasImage) return 'image';
        return 'unknown';
    }
  }

  /**
   * Normalize ad from platform-specific format to unified AdCreative
   */
  private normalizeAd(platform: AdPlatform, rawAd: unknown): AdCreative {
    const ad = rawAd as Record<string, unknown>;

    switch (platform) {
      case 'linkedin': {
        const advertiser = ad.advertiser as Record<string, unknown> | undefined;
        const content = ad.content as Record<string, unknown> | undefined;
        const imageUrl = this.extractImageUrl(platform, ad);
        const videoUrl = this.extractVideoUrl(platform, ad);
        return {
          platform,
          id: (ad.ad_id || ad.id || String(Math.random())) as string,
          advertiser: (advertiser?.name || 'Unknown') as string,
          headline: content?.headline as string | undefined,
          body: content?.body as string | undefined,
          imageUrl,
          videoUrl,
          format: this.determineFormat(platform, ad, !!videoUrl, !!imageUrl),
          isActive: true, // LinkedIn doesn't provide active status
          firstSeen: ad.first_shown_datetime as string | undefined,
          lastSeen: ad.last_shown_datetime as string | undefined,
          detailsUrl: ad.link as string | undefined,
          rawData: rawAd,
        };
      }
      case 'meta': {
        const snapshot = ad.snapshot as Record<string, unknown> | undefined;
        const body = snapshot?.body as Record<string, unknown> | undefined;
        const imageUrl = this.extractImageUrl(platform, ad);
        const videoUrl = this.extractVideoUrl(platform, ad);
        const adId = (ad.id || String(Math.random())) as string;

        // Try to get details URL from multiple possible fields, or construct from ad ID
        let detailsUrl = (
          ad.link ||
          ad.ad_library_link ||
          ad.library_link ||
          ad.permalink
        ) as string | undefined;

        // If no URL found but we have a valid ad ID, construct the Meta Ad Library URL
        if (!detailsUrl && ad.id) {
          detailsUrl = `https://www.facebook.com/ads/library/?id=${ad.id}`;
        }

        return {
          platform,
          id: adId,
          advertiser: (ad.page_name || snapshot?.page_name || 'Unknown') as string,
          headline: snapshot?.title as string | undefined,
          body: body?.text as string | undefined,
          imageUrl,
          videoUrl,
          format: this.determineFormat(platform, ad, !!videoUrl, !!imageUrl),
          isActive: ad.is_active as boolean || false,
          firstSeen: ad.start_date as string | undefined,
          lastSeen: ad.end_date as string | undefined,
          platforms: ad.publisher_platform as string[] | undefined,
          detailsUrl,
          rawData: rawAd,
        };
      }
      case 'google': {
        const advertiser = ad.advertiser as Record<string, unknown> | undefined;
        const imageUrl = this.extractImageUrl(platform, ad);
        const videoUrl = this.extractVideoUrl(platform, ad);
        return {
          platform,
          id: (ad.creative_id || ad.id || String(Math.random())) as string,
          advertiser: (advertiser?.name || 'Unknown') as string,
          headline: ad.headline as string | undefined,
          body: ad.description as string | undefined,
          imageUrl,
          videoUrl,
          format: this.determineFormat(platform, ad, !!videoUrl, !!imageUrl),
          isActive: true, // Presence in API means it was active
          firstSeen: ad.first_shown_datetime as string | undefined,
          lastSeen: ad.last_shown_datetime as string | undefined,
          detailsUrl: ad.details_link as string | undefined,
          rawData: rawAd,
        };
      }
      default:
        return {
          platform,
          id: String(Math.random()),
          advertiser: 'Unknown',
          format: 'unknown' as AdFormat,
          isActive: false,
          rawData: rawAd,
        };
    }
  }

  /**
   * Fetch URL with timeout and proper error handling
   *
   * FIX: Better error handling for abort errors and HTTP status codes
   */
  private async fetchWithTimeout(url: string): Promise<SearchApiResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, { signal: controller.signal });

      // Check HTTP status
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as SearchApiResponse;
    } catch (error) {
      // Rethrow with better context for abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out after 30 seconds');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Validate that a URL is well-formed
   */
  private isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Enforce minimum delay between requests to the same platform
   *
   * FIX: Now uses request-scoped rate limit state instead of instance-level Map
   * This prevents race conditions when fetching ads for multiple competitors in parallel
   *
   * FIX #2: Set timestamp BEFORE waiting to prevent TOCTOU race condition
   * Multiple parallel requests checking at the same time will all see the updated timestamp
   */
  private async enforceRateLimit(
    platform: AdPlatform,
    context: AdFetchContext,
    rateLimitState: RateLimitState
  ): Promise<void> {
    const now = Date.now();
    const lastTime = rateLimitState.lastRequestTime.get(platform);

    let delay = 0;
    if (lastTime) {
      const elapsed = now - lastTime;
      if (elapsed < MIN_REQUEST_INTERVAL) {
        delay = MIN_REQUEST_INTERVAL - elapsed;
      }
    }

    // Set timestamp BEFORE waiting to prevent race conditions
    // Other parallel requests will see this updated time immediately
    rateLimitState.lastRequestTime.set(platform, now + delay);

    if (delay > 0) {
      logRateLimit(context, platform, delay);
      await this.sleep(delay);
    }
  }

  /**
   * Create an error response for a platform
   * Note: Error is already logged by logError() before calling this
   */
  private errorResponse(platform: AdPlatform, error: string): AdLibraryResponse {
    return {
      platform,
      success: false,
      ads: [],
      totalCount: 0,
      error,
    };
  }

  /**
   * Extract error message from unknown error type
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return 'Request timed out after 30 seconds';
      }
      return error.message;
    }
    return String(error);
  }

  /**
   * Try to extract a domain from a company name (basic heuristic)
   */
  private extractDomain(query: string): string | undefined {
    // Simple heuristic: if query looks like a domain, use it
    if (query.includes('.') && !query.includes(' ')) {
      return query.toLowerCase();
    }
    // Otherwise, try common TLD
    const sanitized = query.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (sanitized.length > 0) {
      return `${sanitized}.com`;
    }
    return undefined;
  }

  /**
   * Sleep helper for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Ad Deduplication Utilities
// ============================================================================

/**
 * Normalize text for deduplication comparison
 * Lowercases, trims, and normalizes whitespace
 */
function normalizeTextForDedup(text: string | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
}

/**
 * Normalize image URL for deduplication
 * Removes query parameters as they often differ but the image is the same
 */
function normalizeImageUrlForDedup(url: string | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    // Remove query params - same image often has different cache-busting params
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Create a unique hash key for an ad based on its creative content
 * This identifies duplicate creatives across platforms with different IDs
 */
function createAdDeduplicationKey(ad: AdCreative): string {
  const advertiser = normalizeTextForDedup(ad.advertiser);
  const headline = normalizeTextForDedup(ad.headline);
  const body = normalizeTextForDedup(ad.body);
  const imageKey = normalizeImageUrlForDedup(ad.imageUrl);

  // Create composite key: advertiser|headline|body|image
  // This catches duplicates where the same creative runs on multiple platforms
  return `${advertiser}|${headline}|${body}|${imageKey}`;
}

/**
 * Deduplicate ads across platforms based on creative content
 * Keeps the first occurrence of each unique creative
 *
 * @param ads Array of ads from all platforms
 * @returns Deduplicated array with duplicates removed
 */
function deduplicateAds(ads: AdCreative[]): AdCreative[] {
  const seen = new Map<string, AdCreative>();
  const duplicateCount = { total: 0, byPlatform: new Map<string, number>() };

  for (const ad of ads) {
    const key = createAdDeduplicationKey(ad);

    if (seen.has(key)) {
      // This is a duplicate
      duplicateCount.total++;
      const platformCount = duplicateCount.byPlatform.get(ad.platform) || 0;
      duplicateCount.byPlatform.set(ad.platform, platformCount + 1);
    } else {
      // First occurrence - keep it
      seen.set(key, ad);
    }
  }

  // Log deduplication stats if any duplicates were found
  if (duplicateCount.total > 0) {
    const platformStats = Array.from(duplicateCount.byPlatform.entries())
      .map(([platform, count]) => `${platform}: ${count}`)
      .join(', ');
    console.log(
      `[AdLibrary] Deduplication: ${ads.length} → ${seen.size} ads ` +
      `(removed ${duplicateCount.total} duplicates: ${platformStats})`
    );
  }

  return Array.from(seen.values());
}

/**
 * Factory function to create an AdLibraryService instance
 */
export function createAdLibraryService(): AdLibraryService {
  return new AdLibraryService();
}
