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
const SIMILARITY_THRESHOLD = 0.8; // Minimum similarity score (raised from 0.7 to prevent false positives)

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
  // For page search responses
  pages?: Array<{
    id?: string;
    page_id?: string;
    name?: string;
    page_name?: string;
    page_profile_uri?: string;
    likes?: number;
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

      const response: AdLibraryResponse = {
        platform: 'linkedin',
        success: true,
        ads: filteredAds,
        totalCount,
      };

      logResponse(context, 'linkedin', response, normalizedAds.length, filteredAds.length);
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

      const response: AdLibraryResponse = {
        platform: 'meta',
        success: true,
        ads: filteredAds,
        totalCount,
      };

      logResponse(context, 'meta', response, normalizedAds.length, filteredAds.length);
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
   */
  private async lookupMetaPageId(advertiserName: string, context: AdFetchContext): Promise<string | undefined> {
    try {
      const params = new URLSearchParams({
        engine: 'meta_ad_library_page_search',
        q: advertiserName,
        api_key: this.apiKey,
      });

      const data = await this.fetchWithTimeout(`${SEARCHAPI_BASE}?${params}`);

      if (data.error) {
        console.warn(`[AdLibrary:${context.requestId}] [META] Page search error: ${data.error}`);
        return undefined;
      }

      const pages = data.pages || [];
      if (pages.length === 0) {
        return undefined;
      }

      // Find the best matching page using fuzzy matching
      // Prefer exact matches, then highest similarity score
      let bestMatch: { pageId: string; similarity: number } | undefined;

      for (const page of pages) {
        const pageName = page.name || page.page_name || '';
        const pageId = page.id || page.page_id;

        if (!pageId) continue;

        const similarity = calculateSimilarity(pageName, advertiserName);

        // Log each candidate for debugging
        console.log(
          `[AdLibrary:${context.requestId}] [META] Page candidate: "${pageName}" (id: ${pageId}) - similarity: ${similarity.toFixed(2)}`
        );

        // Only consider pages with reasonable similarity
        if (similarity >= SIMILARITY_THRESHOLD) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { pageId, similarity };
          }
        }
      }

      return bestMatch?.pageId;
    } catch (error) {
      console.warn(`[AdLibrary:${context.requestId}] [META] Page lookup failed:`, error);
      return undefined;
    }
  }

  /**
   * Fetch ads from Google Ads Transparency Center with validation
   */
  async fetchGoogleAds(
    options: AdLibraryOptions,
    context: AdFetchContext,
    rateLimitState: RateLimitState
  ): Promise<AdLibraryResponse> {
    logRequest(context, 'google', options);
    await this.enforceRateLimit('google', context, rateLimitState);

    // Google Ads Transparency requires a domain
    const domain = options.domain || this.extractDomain(options.query);
    if (!domain) {
      const errorMsg = 'Domain is required for Google Ads Transparency';
      logError(context, 'google', errorMsg);
      return this.errorResponse('google', errorMsg);
    }

    try {
      const params = new URLSearchParams({
        engine: 'google_ads_transparency_center',
        domain: domain,
        api_key: this.apiKey,
      });

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
      const filteredAds = this.filterValidAds(normalizedAds, 'google', context);

      const response: AdLibraryResponse = {
        platform: 'google',
        success: true,
        ads: filteredAds,
        totalCount,
      };

      logResponse(context, 'google', response, normalizedAds.length, filteredAds.length);
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

    const results = [linkedinResult, metaResult, googleResult];
    const totalAds = results.reduce((sum, r) => sum + r.ads.length, 0);
    const hasCreatives = results.some((r) =>
      r.ads.some((ad) => ad.imageUrl || ad.videoUrl)
    );

    logMultiPlatformSummary(context, results);

    return {
      results,
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
        rawUrl = content?.image as string | undefined;
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
        rawUrl = image?.link as string | undefined;
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
        const format = ad.format as string | undefined;
        if (format?.toLowerCase() === 'video') {
          const video = ad.video as Record<string, unknown> | undefined;
          rawUrl = video?.link as string | undefined;
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
        // LinkedIn: check for video content type
        const content = ad.content as Record<string, unknown> | undefined;
        const contentType = (content?.type as string | undefined)?.toLowerCase();
        if (contentType === 'video' || hasVideo) return 'video';
        if (contentType === 'carousel') return 'carousel';
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

/**
 * Factory function to create an AdLibraryService instance
 */
export function createAdLibraryService(): AdLibraryService {
  return new AdLibraryService();
}
