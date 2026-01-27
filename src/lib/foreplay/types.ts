// Foreplay API Types
// Types for the Foreplay creative intelligence API integration

import type { AdCreative } from '@/lib/ad-library/types';

/**
 * Parameters for searching brands in Foreplay
 */
export interface ForeplayBrandSearchParams {
  /** Domain to search for (e.g., "nike.com") */
  domain?: string;
  /** Brand name to search for */
  name?: string;
}

/**
 * Brand information returned from Foreplay
 * Note: API may return `brand_id` or `id` depending on endpoint
 */
export interface ForeplayBrand {
  /** Unique brand identifier (may be 'id' or 'brand_id' in API response) */
  id: string;
  /** Brand ID (alternative field name used by some endpoints) */
  brand_id?: string;
  /** Brand name */
  name: string;
  /** Primary domain */
  domain: string;
  /** Total number of ads tracked */
  ad_count?: number;
  /** Platforms where brand advertises */
  platforms?: string[];
  /** Optional: Brand logo URL */
  logo_url?: string;
  /** Optional: Industry/category */
  category?: string;
  /** Optional: Page ID for Facebook/Meta */
  page_id?: string;
}

/**
 * Parameters for searching ads in Foreplay
 */
export interface ForeplayAdSearchParams {
  /** Filter by brand ID */
  brand_id?: string;
  /** Filter by domain */
  domain?: string;
  /** Search ad text/copy */
  text_query?: string;
  /** Filter by platforms */
  platforms?: ('facebook' | 'instagram' | 'tiktok' | 'linkedin')[];
  /** Start date for date range filter (YYYY-MM-DD) */
  date_from?: string;
  /** End date for date range filter (YYYY-MM-DD) */
  date_to?: string;
  /** Maximum number of results */
  limit?: number;
  /** Pagination offset */
  offset?: number;
  /** Filter by ad format */
  formats?: ('video' | 'image' | 'carousel')[];
  /** Sort order */
  sort_by?: 'date' | 'relevance' | 'performance';
}

/**
 * Hook analysis for video ads - key differentiator from SearchAPI
 */
export interface ForeplayHookAnalysis {
  /** The hook text (first 3-5 seconds of messaging) */
  hook_text: string;
  /** Duration of the hook in seconds */
  hook_duration_seconds: number;
  /** Type of hook strategy used */
  hook_type: 'problem' | 'benefit' | 'curiosity' | 'social_proof' | 'question' | 'statistic' | 'story';
  /** Confidence score for the classification (0-1) */
  confidence?: number;
}

/**
 * Landing page analysis
 */
export interface ForeplayLandingPage {
  /** Landing page URL */
  url: string;
  /** Screenshot URL */
  screenshot_url?: string;
  /** Page title */
  title?: string;
  /** Primary CTA text */
  cta_text?: string;
}

/**
 * Detailed ad information from Foreplay
 * Contains transcripts, hooks, emotional analysis - key value-add over SearchAPI
 */
export interface ForeplayAdDetails {
  /** Unique ad identifier */
  ad_id: string;
  /** Platform-specific ad library identifier (e.g., Facebook Ad Library ID) */
  ad_library_id?: string;
  /** Brand information */
  brand: {
    id: string;
    name: string;
    domain: string;
    page_id?: string;
  };
  /** Creative asset information */
  creative: {
    /** Creative type */
    type: 'video' | 'image' | 'carousel';
    /** Primary asset URL */
    url: string;
    /** Thumbnail URL for videos */
    thumbnail_url?: string;
    /** ⭐ Video transcript - KEY DIFFERENTIATOR */
    video_transcript?: string;
    /** Duration in seconds (for video) */
    duration_seconds?: number;
    /** Additional carousel images */
    carousel_urls?: string[];
  };
  /** Ad copy/text */
  copy: {
    /** Headline text */
    headline?: string;
    /** Body/description text */
    body?: string;
    /** Call-to-action text */
    cta?: string;
    /** Sponsor/advertiser name as shown */
    sponsor_name?: string;
  };
  /** Metadata and analysis */
  metadata: {
    /** Platform where ad runs */
    platform: 'facebook' | 'instagram' | 'tiktok' | 'linkedin';
    /** First date ad was seen (ISO string) */
    first_seen: string;
    /** Last date ad was seen (ISO string) */
    last_seen: string;
    /** Whether ad is currently running */
    is_active: boolean;
    /** ⭐ Hook analysis - KEY DIFFERENTIATOR */
    hook_analysis?: ForeplayHookAnalysis;
    /** ⭐ Emotional tone tags - KEY DIFFERENTIATOR */
    emotional_tone?: string[];
    /** Landing page information */
    landing_page?: ForeplayLandingPage;
    /** Estimated ad spend (if available) */
    estimated_spend?: {
      min: number;
      max: number;
      currency: string;
    };
    /** Target audience info (if available) */
    targeting?: {
      age_range?: string;
      gender?: string;
      interests?: string[];
      locations?: string[];
    };
  };
  /** Performance indicators (if available) */
  performance?: {
    /** Engagement score (0-100) */
    engagement_score?: number;
    /** Longevity in days */
    days_running?: number;
    /** Estimated impressions */
    estimated_impressions?: number;
  };
}

/**
 * Brand analytics data - strategic insights over time
 */
export interface ForeplayBrandAnalytics {
  /** Brand identifier */
  brand_id: string;
  /** Date range for analytics */
  date_range: {
    from: string;
    to: string;
  };
  /** ⭐ Creative velocity - how fast they test new ads */
  creative_velocity: {
    /** Total ads launched in period */
    total_ads_launched: number;
    /** Average new ads per week */
    avg_new_ads_per_week: number;
    /** Trend direction */
    trend: 'increasing' | 'decreasing' | 'stable';
    /** Week-over-week data points */
    weekly_data?: Array<{
      week_start: string;
      ads_launched: number;
    }>;
  };
  /** Creative format distribution */
  creative_distribution: {
    video_count: number;
    image_count: number;
    carousel_count: number;
    video_percentage: number;
    image_percentage: number;
    carousel_percentage: number;
  };
  /** Platform distribution */
  platform_distribution: {
    facebook: number;
    instagram: number;
    tiktok: number;
    linkedin: number;
  };
  /** ⭐ Top performing hooks - patterns that work */
  top_hooks: Array<{
    text: string;
    frequency: number;
    hook_type: string;
    performance_score?: number;
  }>;
  /** Common emotional tones used */
  emotional_patterns: Array<{
    tone: string;
    frequency: number;
    percentage: number;
  }>;
  /** Average ad lifespan */
  avg_ad_lifespan_days: number;
  /** Most active days for new ads */
  most_active_days?: string[];
}

/**
 * Foreplay enrichment data to be added to existing AdCreative
 */
export interface ForeplayEnrichment {
  /** Video transcript */
  transcript?: string;
  /** Hook analysis */
  hook?: {
    text: string;
    type: string;
    duration: number;
  };
  /** Emotional tone tags */
  emotional_tone?: string[];
  /** Landing page screenshot URL */
  landing_page_screenshot?: string;
  /** Landing page URL */
  landing_page_url?: string;
  /** Foreplay ad ID for reference */
  foreplay_ad_id?: string;
  /** Match confidence score */
  match_confidence?: number;
}

/**
 * Source of the ad - which service it was fetched from
 */
export type AdSource = 'searchapi' | 'foreplay';

/**
 * Extended AdCreative with Foreplay enrichment
 * Combines SearchAPI real-time data with Foreplay intelligence
 */
export interface EnrichedAdCreative extends AdCreative {
  /** Foreplay enrichment data (undefined if not enriched or not available) */
  foreplay?: ForeplayEnrichment;
  /** Source service this ad was fetched from (defaults to 'searchapi' for backward compatibility) */
  source?: AdSource;
}

/**
 * Response metadata for Foreplay operations
 */
export interface ForeplayMetadata {
  /** Number of ads successfully enriched */
  enriched_count: number;
  /** API credits used */
  credits_used: number;
  /** Brand analytics if fetched */
  analytics?: ForeplayBrandAnalytics;
  /** Any errors that occurred (graceful degradation) */
  error?: string;
  /** Time taken in ms */
  duration_ms?: number;
}

/**
 * Cost tracking for API usage
 */
export interface ForeplayCostBreakdown {
  /** Brand search cost */
  brand_search: number;
  /** Ad search cost */
  ad_search: number;
  /** Individual ad detail costs */
  ad_details: number;
  /** Analytics query cost */
  analytics: number;
  /** Total cost */
  total: number;
  /** Currency */
  currency: 'USD';
}

/**
 * Combined response from enhanced ad library service
 */
export interface EnhancedAdLibraryResponse {
  /** Enriched ad creatives */
  ads: EnrichedAdCreative[];
  /** Metadata from both services */
  metadata: {
    searchapi: {
      total_ads: number;
      platforms_queried: string[];
      duration_ms?: number;
    };
    foreplay?: ForeplayMetadata;
    /** When Foreplay is used as a direct source (not just enrichment) */
    foreplay_source?: {
      total_ads: number;
      unique_ads: number; // Ads not found in SearchAPI
      duration_ms?: number;
    };
  };
  /** Cost breakdown */
  costs?: {
    searchapi: number;
    foreplay: number;
    total: number;
  };
}
