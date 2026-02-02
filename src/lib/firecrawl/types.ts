// Firecrawl Types and Interfaces
// Types for pricing page scraping via Firecrawl SDK

/**
 * Options for scraping a single URL
 */
export interface ScrapeOptions {
  /** URL to scrape */
  url: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to wait for JavaScript rendering (default: true) */
  waitForJs?: boolean;
  /** Force US geolocation for consistent pricing data (default: false) */
  forceUSLocation?: boolean;
}

/**
 * Result of scraping a single URL
 */
export interface ScrapeResult {
  /** Whether the scrape succeeded */
  success: boolean;
  /** Scraped content as markdown (undefined if failed) */
  markdown?: string;
  /** Page title if available */
  title?: string;
  /** Page URL (may differ from input if redirected) */
  url?: string;
  /** Error message if failed */
  error?: string;
  /** HTTP status code if available */
  statusCode?: number;
}

/**
 * Result of attempting to find and scrape a pricing page
 */
export interface PricingPageResult {
  /** Whether a pricing page was found and scraped */
  found: boolean;
  /** The URL that successfully returned content */
  url?: string;
  /** Scraped markdown content */
  markdown?: string;
  /** Page title if available */
  title?: string;
  /** Error message if all attempts failed */
  error?: string;
  /** URLs that were attempted */
  attemptedUrls: string[];
}

/**
 * Options for batch scraping multiple URLs
 */
export interface BatchScrapeOptions {
  /** URLs to scrape */
  urls: string[];
  /** Timeout per URL in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Result of batch scraping
 */
export interface BatchScrapeResult {
  /** Individual results keyed by URL */
  results: Map<string, ScrapeResult>;
  /** Number of successful scrapes */
  successCount: number;
  /** Number of failed scrapes */
  failureCount: number;
}
