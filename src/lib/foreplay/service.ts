// Foreplay API Service
// Provides access to Foreplay's creative intelligence API for ad enrichment

import { getEnv } from '@/lib/env';
import type {
  ForeplayBrand,
  ForeplayBrandSearchParams,
  ForeplayAdDetails,
  ForeplayAdSearchParams,
  ForeplayBrandAnalytics,
} from './types';

const FOREPLAY_API_BASE = 'https://public.api.foreplay.co';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

/**
 * Configuration for ForeplayService
 */
export interface ForeplayServiceConfig {
  /** API key for Foreplay */
  apiKey: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * API response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  credits_used?: number;
}

/**
 * Cost tracking for a single operation
 */
interface OperationCost {
  operation: string;
  credits: number;
  timestamp: number;
}

/**
 * Raw ad structure from Foreplay API
 * The actual API returns a flat structure that we transform to ForeplayAdDetails
 */
interface RawForeplayAd {
  // Core identifiers
  id?: string;
  ad_id?: string;
  brand_id?: string;

  // Brand info (flat)
  name?: string;
  brand_name?: string;
  page_name?: string;
  website?: string;
  domain?: string;

  // Ad copy (flat, not nested)
  headline?: string;
  title?: string;
  description?: string;
  body?: string;
  primary_text?: string;
  cta?: string;
  call_to_action?: string;

  // Creative assets (flat)
  type?: string;
  video_url?: string;
  image_url?: string;
  media_url?: string;
  thumbnail?: string;
  transcript?: string;
  video_transcript?: string;
  duration?: number;
  video_duration?: number;
  carousel_images?: string[];
  images?: string[];

  // Metadata (flat)
  platform?: string;
  source?: string;
  first_seen?: string;
  last_seen?: string;
  created_at?: string;
  updated_at?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  status?: string;

  // Analysis (may be flat or nested)
  hook?: {
    text?: string;
    duration?: number;
    type?: string;
  };
  hook_text?: string;
  emotional_tone?: string[];
  emotions?: string[];
  tones?: string[];

  // Landing page
  landing_page_url?: string;
  landing_page_screenshot?: string;
}

/**
 * Service for interacting with the Foreplay API
 * Provides creative intelligence: transcripts, hooks, emotional analysis, brand analytics
 */
export class ForeplayService {
  private apiKey: string;
  private timeout: number;
  private debug: boolean;
  private costLog: OperationCost[] = [];

  constructor(config: ForeplayServiceConfig) {
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.debug = config.debug ?? false;
  }

  /**
   * Internal fetch wrapper with timeout, retries, and error handling
   */
  private async fetch<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST';
      params?: Record<string, string | number | boolean | string[] | undefined>;
      body?: unknown;
      retries?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', params, body, retries = MAX_RETRIES } = options;

    // Build URL with query parameters
    const url = new URL(`${FOREPLAY_API_BASE}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Handle arrays by appending multiple values with same key
          if (Array.isArray(value)) {
            value.forEach(v => url.searchParams.append(key, String(v)));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      });
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': this.apiKey, // Foreplay uses API key directly, not Bearer token
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(this.timeout),
    };

    if (body && method === 'POST') {
      fetchOptions.body = JSON.stringify(body);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Always log for debugging API issues
        console.log(`[Foreplay] ${method} ${url.toString()} (attempt ${attempt + 1})`);

        const response = await fetch(url.toString(), fetchOptions);
        console.log(`[Foreplay] Response status: ${response.status} ${response.statusText}`);

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : RETRY_DELAY * (attempt + 1);
          console.warn(`[Foreplay] Rate limited, retrying after ${delay}ms`);
          await this.sleep(delay);
          continue;
        }

        // Handle other errors with detailed messages
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          const errorContext = this.getErrorContext(response.status);
          console.error(`[Foreplay] API Error: ${response.status} ${response.statusText}`);
          console.error(`[Foreplay] Error body: ${errorText}`);
          console.error(`[Foreplay] Likely cause: ${errorContext}`);
          throw new Error(`Foreplay API error: ${response.status} ${response.statusText} - ${errorContext} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`[Foreplay] Response data keys:`, Object.keys(data));

        // Track credits if returned (may be in metadata)
        const creditsUsed = data.credits_used ?? data.metadata?.credits_used;
        if (creditsUsed) {
          this.logCost(endpoint, creditsUsed);
        }

        return {
          success: true,
          data: data, // Return raw data, let callers handle structure
          credits_used: creditsUsed,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on timeout or abort
        if (lastError.name === 'AbortError' || lastError.name === 'TimeoutError') {
          break;
        }

        // Don't retry on client errors (4xx) - these won't change on retry
        // 401 = bad auth, 402 = no credits, 403 = no permission, 404 = not found, 422 = validation
        if (lastError.message.includes('401') ||
            lastError.message.includes('402') ||
            lastError.message.includes('403') ||
            lastError.message.includes('404') ||
            lastError.message.includes('422')) {
          console.log(`[Foreplay] Not retrying - client error won't change on retry`);
          break;
        }

        // Wait before retry (only for transient errors like 500, network issues)
        if (attempt < retries) {
          await this.sleep(RETRY_DELAY * (attempt + 1));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message ?? 'Unknown error',
    };
  }

  /**
   * Search for brands by domain
   * Returns brand_id needed for subsequent queries
   * Tries multiple domain formats if initial search fails
   *
   * Cost: ~1 credit per request
   */
  async searchBrands(params: ForeplayBrandSearchParams): Promise<ForeplayBrand[]> {
    console.log('[Foreplay] searchBrands called with:', params);

    if (!params.domain) {
      console.error('[Foreplay] searchBrands: domain is required');
      return [];
    }

    // Normalize domain - try different formats if needed
    const domainVariants = this.getDomainVariants(params.domain);
    console.log('[Foreplay] Will try domain variants:', domainVariants);

    for (const domain of domainVariants) {
      console.log(`[Foreplay] Trying domain: ${domain}`);

      // Foreplay API: GET /api/brand/getBrandsByDomain?domain=...
      // Valid order values: 'most_ranked' or 'least_ranked'
      const response = await this.fetch<unknown>('/api/brand/getBrandsByDomain', {
        params: {
          domain: domain,
          limit: 10,
          order: 'most_ranked',
        },
      });

      console.log('[Foreplay] searchBrands response:', {
        success: response.success,
        error: response.error,
        dataType: typeof response.data,
        rawData: response.data ? JSON.stringify(response.data).substring(0, 500) : 'undefined',
      });

      if (!response.success) {
        console.warn(`[Foreplay] Brand search for "${domain}" failed: ${response.error}`);
        continue; // Try next variant
      }

      // Parse response - API returns { data: [...], metadata: {...} }
      const rawData = response.data as Record<string, unknown>;
      let brands: ForeplayBrand[] = [];

      if (Array.isArray(rawData)) {
        brands = rawData as ForeplayBrand[];
      } else if (rawData && typeof rawData === 'object') {
        if (Array.isArray(rawData.data)) {
          brands = rawData.data as ForeplayBrand[];
        } else if (rawData.data && typeof rawData.data === 'object') {
          // Single brand returned as object
          brands = [rawData.data as ForeplayBrand];
        }
      }

      // Normalize brand IDs (some responses use brand_id, others use id)
      brands = brands.map((b) => ({
        ...b,
        id: b.id ?? b.brand_id ?? '',
      }));

      if (brands.length > 0) {
        console.log('[Foreplay] Found brands:', brands.length, brands.map(b => ({ name: b.name, id: b.id })));
        return brands;
      }
    }

    console.log('[Foreplay] No brands found for any domain variant');
    return [];
  }

  /**
   * Generate domain variants to try for brand search
   * Handles various input formats
   */
  private getDomainVariants(input: string): string[] {
    // Clean the input
    const domain = input
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];

    const variants: string[] = [];

    // Try the cleaned domain first
    variants.push(domain);

    // If it doesn't have a TLD, try with .com
    if (!domain.includes('.')) {
      variants.push(`${domain}.com`);
    }

    // Try with www prefix
    if (!domain.startsWith('www.')) {
      variants.push(`www.${domain}`);
    }

    // Try https:// prefix (API says it accepts URLs)
    variants.push(`https://${domain}`);
    variants.push(`https://www.${domain}`);

    // Remove duplicates
    return [...new Set(variants)];
  }

  /**
   * Search for ads by brand
   * Uses /api/brand/getAdsByBrandId which works for any brand (no subscription required)
   * Returns list of ads matching criteria
   *
   * Cost: ~1 credit per ad returned
   */
  async searchAds(params: ForeplayAdSearchParams): Promise<ForeplayAdDetails[]> {
    console.log('[Foreplay] searchAds called with:', params);

    if (!params.brand_id) {
      console.error('[Foreplay] searchAds: brand_id is required');
      return [];
    }

    // Build params - only include date filters if provided
    const requestParams: Record<string, string | number | boolean | string[] | undefined> = {
      brand_ids: [params.brand_id], // API expects array format
      limit: params.limit ?? 50,
      order: 'newest',
    };

    // Only add date filters if both are provided
    if (params.date_from && params.date_to) {
      requestParams.start_date = params.date_from;
      requestParams.end_date = params.date_to;
    }

    // Foreplay API: GET /api/brand/getAdsByBrandId?brand_ids=...
    // This endpoint works for any brand without requiring subscription
    // Valid order values: 'newest', 'oldest', 'longest_running', 'most_relevant'
    let response = await this.fetch<unknown>('/api/brand/getAdsByBrandId', {
      params: requestParams,
    });

    // If date-filtered search returns 0 ads, try without date filters
    let rawData = response.data as Record<string, unknown>;
    const hasDateFilter = params.date_from && params.date_to;
    const count = (rawData?.metadata as Record<string, unknown>)?.count as number ?? 0;

    if (response.success && count === 0 && hasDateFilter) {
      console.log('[Foreplay] No ads found with date filter, retrying without date constraints...');
      const retryParams = {
        brand_ids: [params.brand_id],
        limit: params.limit ?? 50,
        order: 'newest',
      };
      response = await this.fetch<unknown>('/api/brand/getAdsByBrandId', {
        params: retryParams,
      });
    }

    console.log('[Foreplay] searchAds response:', {
      success: response.success,
      error: response.error,
      rawDataPreview: response.data ? JSON.stringify(response.data).substring(0, 500) : 'undefined',
    });

    if (!response.success) {
      console.error(`[Foreplay] Ad search failed: ${response.error}`);
      return [];
    }

    // Parse response - API returns { data: [...], metadata: {...} }
    rawData = response.data as Record<string, unknown>;
    let rawAds: RawForeplayAd[] = [];

    if (Array.isArray(rawData)) {
      rawAds = rawData as RawForeplayAd[];
    } else if (rawData && typeof rawData === 'object') {
      if (Array.isArray(rawData.data)) {
        rawAds = rawData.data as RawForeplayAd[];
      }
    }

    // Transform raw API response to our expected ForeplayAdDetails structure
    const ads = rawAds.map(raw => this.transformRawAdToForeplayAdDetails(raw));

    console.log('[Foreplay] Found ads:', ads.length);
    if (ads.length > 0) {
      console.log('[Foreplay] Sample transformed ad:', JSON.stringify(ads[0], null, 2).substring(0, 500));
    }
    return ads;
  }

  /**
   * Transform raw Foreplay API ad response to our ForeplayAdDetails structure
   * The API returns a flat structure, we need nested copy/metadata/creative objects
   */
  private transformRawAdToForeplayAdDetails(raw: RawForeplayAd): ForeplayAdDetails {
    return {
      ad_id: raw.ad_id || raw.id || '',
      brand: {
        id: raw.brand_id || '',
        name: raw.name || raw.brand_name || '',
        domain: raw.website || raw.domain || '',
      },
      copy: {
        headline: raw.headline || raw.title || '',
        body: raw.description || raw.body || raw.primary_text || '',
        cta: raw.cta || raw.call_to_action || '',
        sponsor_name: raw.name || raw.brand_name || raw.page_name || '',
      },
      creative: {
        type: this.inferCreativeType(raw),
        url: raw.video_url || raw.image_url || raw.media_url || raw.thumbnail || '',
        thumbnail_url: raw.thumbnail || raw.image_url || '',
        video_transcript: raw.transcript || raw.video_transcript || '',
        duration_seconds: raw.duration || raw.video_duration,
        carousel_urls: raw.carousel_images || raw.images || [],
      },
      metadata: {
        platform: this.normalizePlatform(raw.platform || raw.source || 'unknown'),
        first_seen: raw.first_seen || raw.created_at || raw.start_date || '',
        last_seen: raw.last_seen || raw.updated_at || raw.end_date || '',
        is_active: raw.is_active !== undefined ? raw.is_active : (raw.status === 'active'),
        hook_analysis: raw.hook ? {
          hook_text: raw.hook.text || raw.hook_text || '',
          hook_duration_seconds: raw.hook.duration || 3,
          hook_type: this.normalizeHookType(raw.hook.type),
        } : undefined,
        emotional_tone: raw.emotional_tone || raw.emotions || raw.tones || [],
        landing_page: raw.landing_page_url ? {
          url: raw.landing_page_url,
          screenshot_url: raw.landing_page_screenshot,
        } : undefined,
      },
    };
  }

  /**
   * Infer creative type from raw ad data
   */
  private inferCreativeType(raw: RawForeplayAd): 'video' | 'image' | 'carousel' {
    if (raw.type) {
      const t = raw.type.toLowerCase();
      if (t.includes('video')) return 'video';
      if (t.includes('carousel')) return 'carousel';
      if (t.includes('image')) return 'image';
    }
    if (raw.video_url || raw.transcript || raw.video_transcript) return 'video';
    if (raw.carousel_images?.length || (raw.images && raw.images.length > 1)) return 'carousel';
    return 'image';
  }

  /**
   * Normalize hook type to expected union type
   */
  private normalizeHookType(type?: string): 'problem' | 'benefit' | 'curiosity' | 'social_proof' | 'question' | 'statistic' | 'story' {
    if (!type) return 'benefit';
    const t = type.toLowerCase();
    if (t.includes('problem')) return 'problem';
    if (t.includes('benefit')) return 'benefit';
    if (t.includes('curiosity')) return 'curiosity';
    if (t.includes('social') || t.includes('proof')) return 'social_proof';
    if (t.includes('question')) return 'question';
    if (t.includes('stat')) return 'statistic';
    if (t.includes('story')) return 'story';
    return 'benefit'; // default
  }

  /**
   * Normalize platform name to expected format
   */
  private normalizePlatform(platform: string): 'facebook' | 'instagram' | 'tiktok' | 'linkedin' {
    const p = platform.toLowerCase();
    if (p.includes('facebook') || p === 'fb' || p === 'meta') return 'facebook';
    if (p.includes('instagram') || p === 'ig') return 'instagram';
    if (p.includes('tiktok') || p === 'tt') return 'tiktok';
    if (p.includes('linkedin') || p === 'li') return 'linkedin';
    return 'facebook'; // default
  }

  /**
   * Get detailed information for a specific ad
   * Includes full transcript, hook analysis, emotional tone
   *
   * Cost: ~1 credit per ad
   */
  async getAdDetails(adId: string): Promise<ForeplayAdDetails | null> {
    // Foreplay API: GET /api/ad/{ad_id}
    const response = await this.fetch<unknown>(`/api/ad/${adId}`);

    if (!response.success) {
      console.error(`[Foreplay] Get ad details failed: ${response.error}`);
      return null;
    }

    // Parse response - may be wrapped in { data: ... } or direct
    const rawData = response.data as Record<string, unknown> | null;
    if (!rawData) return null;

    if ('data' in rawData && rawData.data && typeof rawData.data === 'object') {
      return rawData.data as ForeplayAdDetails;
    }

    // Check if it looks like an ad directly (has ad_id field)
    if ('ad_id' in rawData) {
      return rawData as unknown as ForeplayAdDetails;
    }

    return null;
  }

  /**
   * Get brand details (not full analytics - Foreplay doesn't have a dedicated analytics endpoint)
   * Returns brand info which may include some metrics
   *
   * Cost: ~1 credit per query
   */
  async getBrandAnalytics(
    brandId: string,
    _dateFrom: string,
    _dateTo: string
  ): Promise<ForeplayBrandAnalytics | null> {
    // Note: Foreplay API doesn't have a dedicated analytics endpoint
    // GET /api/spyder/brand?brand_id=... returns brand details
    // For now, return null - analytics would need to be computed from ads data
    console.log('[Foreplay] getBrandAnalytics: No dedicated analytics endpoint in Foreplay API');
    console.log('[Foreplay] Brand analytics would need to be computed from ad data');

    // Try to get brand details as fallback
    const response = await this.fetch<{ data: unknown }>('/api/spyder/brand', {
      params: {
        brand_id: brandId,
      },
    });

    if (!response.success) {
      console.error(`[Foreplay] Brand details failed: ${response.error}`);
      return null;
    }

    // Foreplay doesn't return analytics in this format, so return null
    // The enhanced service will work without analytics
    console.log('[Foreplay] Brand details response (no analytics):', response.data);
    return null;
  }

  /**
   * Get ads from user's saved boards (swipe file)
   * Useful for accessing curated ad collections
   *
   * Cost: ~1 credit per ad returned
   */
  async getSavedAds(boardId?: string): Promise<ForeplayAdDetails[]> {
    // Foreplay API: GET /api/board/ads?board_id=... or GET /api/swipefile/ads
    const endpoint = boardId ? '/api/board/ads' : '/api/swipefile/ads';
    const response = await this.fetch<{ data: ForeplayAdDetails[] }>(endpoint, {
      params: boardId ? { board_id: boardId, limit: 50 } : { limit: 50 },
    });

    if (!response.success) {
      console.error(`[Foreplay] Get saved ads failed: ${response.error}`);
      return [];
    }

    return response.data?.data ?? (Array.isArray(response.data) ? response.data : []);
  }

  /**
   * Batch fetch ad details for multiple ads
   * More efficient than individual calls
   *
   * Cost: ~1 credit per ad
   */
  async batchGetAdDetails(adIds: string[]): Promise<Map<string, ForeplayAdDetails>> {
    const results = new Map<string, ForeplayAdDetails>();

    // Process in batches of 10 to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < adIds.length; i += batchSize) {
      const batch = adIds.slice(i, i + batchSize);
      const promises = batch.map(async (id) => {
        const ad = await this.getAdDetails(id);
        if (ad) {
          results.set(id, ad);
        }
      });
      await Promise.all(promises);

      // Small delay between batches
      if (i + batchSize < adIds.length) {
        await this.sleep(100);
      }
    }

    return results;
  }

  /**
   * Get total credits used in this session
   */
  getTotalCreditsUsed(): number {
    return this.costLog.reduce((sum, entry) => sum + entry.credits, 0);
  }

  /**
   * Get detailed cost breakdown
   */
  getCostBreakdown(): { operation: string; credits: number }[] {
    const breakdown = new Map<string, number>();
    for (const entry of this.costLog) {
      const current = breakdown.get(entry.operation) ?? 0;
      breakdown.set(entry.operation, current + entry.credits);
    }
    return Array.from(breakdown.entries()).map(([operation, credits]) => ({
      operation,
      credits,
    }));
  }

  /**
   * Reset cost tracking
   */
  resetCostTracking(): void {
    this.costLog = [];
  }

  /**
   * Log cost for an operation
   */
  private logCost(operation: string, credits: number): void {
    this.costLog.push({
      operation,
      credits,
      timestamp: Date.now(),
    });

    if (this.debug) {
      console.log(`[Foreplay] Cost: ${credits} credits for ${operation}`);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get human-readable error context for HTTP status codes
   */
  private getErrorContext(status: number): string {
    switch (status) {
      case 400:
        return 'Bad Request - malformed parameters or invalid request format';
      case 401:
        return 'Unauthorized - API key is invalid or missing';
      case 402:
        return 'Payment Required - insufficient credits on your Foreplay plan';
      case 403:
        return 'Forbidden - you do not have permission for this feature';
      case 404:
        return 'Not Found - the requested resource (brand/ad) does not exist';
      case 422:
        return 'Unprocessable Entity - parameter validation failed (check domain format, date format, or required fields)';
      case 429:
        return 'Rate Limited - too many requests, please slow down';
      case 500:
        return 'Internal Server Error - Foreplay API is experiencing issues';
      default:
        return `HTTP ${status} - unexpected error`;
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}

/**
 * Factory function to create a ForeplayService instance
 * Uses environment variable if apiKey not provided
 * Returns null if not configured (allows graceful degradation)
 */
export function createForeplayService(apiKey?: string): ForeplayService | null {
  const key = apiKey ?? getEnv('FOREPLAY_API_KEY');

  if (!key) {
    console.log('[Foreplay] Service not configured - FOREPLAY_API_KEY not set');
    return null;
  }

  return new ForeplayService({
    apiKey: key,
    debug: getEnv('NODE_ENV') === 'development',
  });
}

/**
 * Check if Foreplay enrichment is enabled via feature flag
 */
export function isForeplayEnabled(): boolean {
  const enabled = getEnv('ENABLE_FOREPLAY');
  return enabled?.toLowerCase() === 'true';
}
