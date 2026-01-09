// Ad Library Service
// Unified interface for fetching ads from LinkedIn, Meta, and Google via SearchAPI.io

import { getRequiredEnv } from '@/lib/env';
import type {
  AdPlatform,
  AdCreative,
  AdLibraryOptions,
  AdLibraryResponse,
  MultiPlatformAdResponse,
} from './types';

const SEARCHAPI_BASE = 'https://www.searchapi.io/api/v1/search';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_LIMIT = 50;
const DEFAULT_COUNTRY = 'US';
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests to same platform

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
}

/**
 * Service for fetching competitor ads from multiple ad library platforms
 */
export class AdLibraryService {
  private apiKey: string;
  private lastRequestTime: Map<AdPlatform, number> = new Map();

  constructor() {
    this.apiKey = getRequiredEnv('SEARCHAPI_KEY');
  }

  /**
   * Fetch ads from LinkedIn Ad Library
   */
  async fetchLinkedInAds(options: AdLibraryOptions): Promise<AdLibraryResponse> {
    await this.enforceRateLimit('linkedin');

    try {
      const params = new URLSearchParams({
        engine: 'linkedin_ad_library',
        q: options.query,
        api_key: this.apiKey,
      });

      const data = await this.fetchWithTimeout(`${SEARCHAPI_BASE}?${params}`);

      if (data.error) {
        return this.errorResponse('linkedin', String(data.error));
      }

      const totalCount = data.search_information?.total_results || data.ads?.length || 0;
      const rawAds = data.ads || [];
      const limit = options.limit || DEFAULT_LIMIT;

      const ads = rawAds.slice(0, limit).map((ad: unknown) => this.normalizeAd('linkedin', ad));

      return {
        platform: 'linkedin',
        success: true,
        ads,
        totalCount,
      };
    } catch (error) {
      return this.errorResponse('linkedin', this.getErrorMessage(error));
    }
  }

  /**
   * Fetch ads from Meta Ad Library (Facebook/Instagram)
   */
  async fetchMetaAds(options: AdLibraryOptions): Promise<AdLibraryResponse> {
    await this.enforceRateLimit('meta');

    try {
      const params = new URLSearchParams({
        engine: 'meta_ad_library',
        q: options.query,
        country: options.country || DEFAULT_COUNTRY,
        api_key: this.apiKey,
      });

      const data = await this.fetchWithTimeout(`${SEARCHAPI_BASE}?${params}`);

      if (data.error) {
        return this.errorResponse('meta', String(data.error));
      }

      const totalCount = data.search_information?.total_results || data.ads?.length || 0;
      const rawAds = data.ads || [];
      const limit = options.limit || DEFAULT_LIMIT;

      const ads = rawAds.slice(0, limit).map((ad: unknown) => this.normalizeAd('meta', ad));

      return {
        platform: 'meta',
        success: true,
        ads,
        totalCount,
      };
    } catch (error) {
      return this.errorResponse('meta', this.getErrorMessage(error));
    }
  }

  /**
   * Fetch ads from Google Ads Transparency Center
   */
  async fetchGoogleAds(options: AdLibraryOptions): Promise<AdLibraryResponse> {
    await this.enforceRateLimit('google');

    // Google Ads Transparency requires a domain
    const domain = options.domain || this.extractDomain(options.query);
    if (!domain) {
      return this.errorResponse('google', 'Domain is required for Google Ads Transparency');
    }

    try {
      const params = new URLSearchParams({
        engine: 'google_ads_transparency_center',
        domain: domain,
        api_key: this.apiKey,
      });

      const data = await this.fetchWithTimeout(`${SEARCHAPI_BASE}?${params}`);

      if (data.error) {
        return this.errorResponse('google', String(data.error));
      }

      // Google uses "ad_creatives" instead of "ads"
      const totalCount = data.search_information?.total_results || data.ad_creatives?.length || 0;
      const rawAds = data.ad_creatives || [];
      const limit = options.limit || DEFAULT_LIMIT;

      const ads = rawAds.slice(0, limit).map((ad: unknown) => this.normalizeAd('google', ad));

      return {
        platform: 'google',
        success: true,
        ads,
        totalCount,
      };
    } catch (error) {
      return this.errorResponse('google', this.getErrorMessage(error));
    }
  }

  /**
   * Fetch ads from all platforms in parallel
   */
  async fetchAllPlatforms(options: AdLibraryOptions): Promise<MultiPlatformAdResponse> {
    const [linkedinResult, metaResult, googleResult] = await Promise.all([
      this.fetchLinkedInAds(options),
      this.fetchMetaAds(options),
      this.fetchGoogleAds(options),
    ]);

    const results = [linkedinResult, metaResult, googleResult];
    const totalAds = results.reduce((sum, r) => sum + r.ads.length, 0);
    const hasCreatives = results.some((r) =>
      r.ads.some((ad) => ad.imageUrl || ad.videoUrl)
    );

    return {
      results,
      totalAds,
      hasCreatives,
    };
  }

  /**
   * Extract image URL from platform-specific ad format
   */
  private extractImageUrl(platform: AdPlatform, ad: Record<string, unknown>): string | undefined {
    switch (platform) {
      case 'linkedin': {
        const content = ad.content as Record<string, unknown> | undefined;
        return content?.image as string | undefined;
      }
      case 'meta': {
        const snapshot = ad.snapshot as Record<string, unknown> | undefined;
        const images = snapshot?.images as unknown[] | undefined;
        if (images && images.length > 0) {
          const firstImage = images[0];
          if (typeof firstImage === 'string') {
            return firstImage;
          }
          if (typeof firstImage === 'object' && firstImage !== null) {
            const imgObj = firstImage as Record<string, unknown>;
            return (imgObj.url || imgObj.original_image_url) as string | undefined;
          }
        }
        return undefined;
      }
      case 'google': {
        const image = ad.image as Record<string, unknown> | undefined;
        return image?.link as string | undefined;
      }
      default:
        return undefined;
    }
  }

  /**
   * Extract video URL from platform-specific ad format
   */
  private extractVideoUrl(platform: AdPlatform, ad: Record<string, unknown>): string | undefined {
    switch (platform) {
      case 'meta': {
        const snapshot = ad.snapshot as Record<string, unknown> | undefined;
        const videos = snapshot?.videos as unknown[] | undefined;
        if (videos && videos.length > 0) {
          const firstVideo = videos[0];
          if (typeof firstVideo === 'string') {
            return firstVideo;
          }
          if (typeof firstVideo === 'object' && firstVideo !== null) {
            const vidObj = firstVideo as Record<string, unknown>;
            return vidObj.video_hd_url as string | undefined || vidObj.video_sd_url as string | undefined;
          }
        }
        return undefined;
      }
      case 'google': {
        // Google video ads have format: "video"
        const format = ad.format as string | undefined;
        if (format?.toLowerCase() === 'video') {
          const video = ad.video as Record<string, unknown> | undefined;
          return video?.link as string | undefined;
        }
        return undefined;
      }
      default:
        return undefined;
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
        return {
          platform,
          id: (ad.ad_id || ad.id || String(Math.random())) as string,
          advertiser: (advertiser?.name || 'Unknown') as string,
          headline: content?.headline as string | undefined,
          body: content?.body as string | undefined,
          imageUrl: this.extractImageUrl(platform, ad),
          videoUrl: this.extractVideoUrl(platform, ad),
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
        return {
          platform,
          id: (ad.id || String(Math.random())) as string,
          advertiser: (ad.page_name || snapshot?.page_name || 'Unknown') as string,
          headline: snapshot?.title as string | undefined,
          body: body?.text as string | undefined,
          imageUrl: this.extractImageUrl(platform, ad),
          videoUrl: this.extractVideoUrl(platform, ad),
          isActive: ad.is_active as boolean || false,
          firstSeen: ad.start_date as string | undefined,
          lastSeen: ad.end_date as string | undefined,
          platforms: ad.publisher_platform as string[] | undefined,
          detailsUrl: ad.link as string | undefined,
          rawData: rawAd,
        };
      }
      case 'google': {
        const advertiser = ad.advertiser as Record<string, unknown> | undefined;
        return {
          platform,
          id: (ad.creative_id || ad.id || String(Math.random())) as string,
          advertiser: (advertiser?.name || 'Unknown') as string,
          headline: ad.headline as string | undefined,
          body: ad.description as string | undefined,
          imageUrl: this.extractImageUrl(platform, ad),
          videoUrl: this.extractVideoUrl(platform, ad),
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
          isActive: false,
          rawData: rawAd,
        };
    }
  }

  /**
   * Fetch URL with timeout
   */
  private async fetchWithTimeout(url: string): Promise<SearchApiResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, { signal: controller.signal });
      const data = await response.json();
      return data as SearchApiResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Enforce minimum delay between requests to the same platform
   */
  private async enforceRateLimit(platform: AdPlatform): Promise<void> {
    const lastTime = this.lastRequestTime.get(platform);
    if (lastTime) {
      const elapsed = Date.now() - lastTime;
      if (elapsed < MIN_REQUEST_INTERVAL) {
        await this.sleep(MIN_REQUEST_INTERVAL - elapsed);
      }
    }
    this.lastRequestTime.set(platform, Date.now());
  }

  /**
   * Create an error response for a platform
   */
  private errorResponse(platform: AdPlatform, error: string): AdLibraryResponse {
    console.error(`[AdLibraryService] ${platform} error: ${error}`);
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
