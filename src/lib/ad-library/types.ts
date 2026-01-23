// Ad Library Types and Interfaces
// Unified types for multi-platform ad library operations via SearchAPI.io

/**
 * Supported ad library platforms
 */
export type AdPlatform = 'linkedin' | 'meta' | 'google';

/**
 * Ad format/type classification
 */
export type AdFormat = 'video' | 'image' | 'carousel' | 'unknown';

/**
 * Unified ad creative interface
 * Normalizes different platform formats into a common structure
 */
export interface AdCreative {
  /** Platform this ad was fetched from */
  platform: AdPlatform;
  /** Unique identifier for the ad */
  id: string;
  /** Name of the advertiser/company */
  advertiser: string;
  /** Ad headline text */
  headline?: string;
  /** Ad body/description text */
  body?: string;
  /** URL to the ad's image creative */
  imageUrl?: string;
  /** URL to the ad's video creative (if applicable) */
  videoUrl?: string;
  /** Ad format/type (video, image, carousel) */
  format: AdFormat;
  /** Whether the ad is currently active */
  isActive: boolean;
  /** First date the ad was seen (ISO string) */
  firstSeen?: string;
  /** Last date the ad was seen (ISO string) */
  lastSeen?: string;
  /** Platforms where the ad appears (Meta: Facebook, Instagram, etc.) */
  platforms?: string[];
  /** URL to view ad details on the platform */
  detailsUrl?: string;
  /** Original API response data for debugging/advanced use */
  rawData: unknown;
}

/**
 * Google Ads Transparency ad format filter
 * Used to exclude text-only ads and focus on rich creatives
 */
export type GoogleAdFormat = 'text' | 'image' | 'video';

/**
 * Google Ads Transparency platform filter
 * Specifies where the ads appear
 */
export type GoogleAdPlatform = 'google_play' | 'google_maps' | 'google_search' | 'youtube' | 'google_shopping';

/**
 * Options for fetching ads from ad libraries
 */
export interface AdLibraryOptions {
  /** Company name to search for (used by LinkedIn and Meta) */
  query: string;
  /** Domain to search for (used by Google Ads Transparency as fallback) */
  domain?: string;
  /** Maximum number of ads to fetch per platform (default: 50) */
  limit?: number;
  /** Country filter (default: US) */
  country?: string;
  /**
   * Google Ads Transparency: ad formats to include
   * Default: 'image' (excludes text-only domain sponsor ads which are useless)
   * Set to 'video' for video-only, or 'text' if you really want text ads
   */
  googleAdFormat?: GoogleAdFormat;
  /**
   * Google Ads Transparency: platform to filter by
   * e.g., 'youtube' for video-heavy results
   * Default: undefined (all platforms)
   */
  googlePlatform?: GoogleAdPlatform;
}

/**
 * Response from a single platform's ad library
 */
export interface AdLibraryResponse {
  /** Platform that was queried */
  platform: AdPlatform;
  /** Whether the API call succeeded */
  success: boolean;
  /** Normalized ad creatives */
  ads: AdCreative[];
  /** Total number of ads found (may be higher than returned count) */
  totalCount: number;
  /** Error message if success is false */
  error?: string;
}

/**
 * Aggregated response from multiple platforms
 */
export interface MultiPlatformAdResponse {
  /** Individual platform results */
  results: AdLibraryResponse[];
  /** Total ads returned across all platforms */
  totalAds: number;
  /** Whether any ads have image/video creatives */
  hasCreatives: boolean;
}
