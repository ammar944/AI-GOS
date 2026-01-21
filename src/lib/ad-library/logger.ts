// Ad Library Logger
// Structured debug logging for ad library operations

import type { AdPlatform, AdLibraryResponse } from './types';

/**
 * Context for a specific ad library request
 * Used for tracing and debugging across concurrent requests
 */
export interface AdFetchContext {
  /** Unique identifier for this request (for tracing in logs) */
  requestId: string;
  /** Original company name that was searched */
  searchedCompany: string;
  /** Normalized version of company name for matching */
  normalizedCompany: string;
  /** Company domain if available (for validation) */
  searchedDomain?: string;
  /** Request start timestamp */
  timestamp: number;
}

/**
 * Create a new request context
 * Each call to fetchAllPlatforms should create a unique context
 */
export function createAdFetchContext(
  searchedCompany: string,
  searchedDomain?: string
): AdFetchContext {
  // Generate a short unique ID (timestamp + random)
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Normalize company name (basic normalization)
  const normalizedCompany = searchedCompany.toLowerCase().trim();

  return {
    requestId,
    searchedCompany,
    normalizedCompany,
    searchedDomain,
    timestamp: Date.now(),
  };
}

/**
 * Log ad library request start
 */
export function logRequest(
  context: AdFetchContext,
  platform: AdPlatform,
  options: { query: string; domain?: string; limit?: number }
): void {
  console.log(
    `[AdLibrary:${context.requestId}] [${platform.toUpperCase()}] Requesting ads for "${context.searchedCompany}"`,
    { query: options.query, domain: options.domain, limit: options.limit }
  );
}

/**
 * Log ad library response
 */
export function logResponse(
  context: AdFetchContext,
  platform: AdPlatform,
  response: AdLibraryResponse,
  beforeFilterCount?: number,
  afterFilterCount?: number
): void {
  const duration = Date.now() - context.timestamp;

  if (!response.success) {
    console.warn(
      `[AdLibrary:${context.requestId}] [${platform.toUpperCase()}] Failed after ${duration}ms: ${response.error}`
    );
    return;
  }

  const filterInfo =
    beforeFilterCount !== undefined && afterFilterCount !== undefined
      ? ` (filtered ${beforeFilterCount} → ${afterFilterCount})`
      : '';

  console.log(
    `[AdLibrary:${context.requestId}] [${platform.toUpperCase()}] Success: ${response.ads.length} ads returned${filterInfo} in ${duration}ms`
  );
}

/**
 * Log ad filtering details
 */
export function logFiltering(
  context: AdFetchContext,
  platform: AdPlatform,
  beforeCount: number,
  afterCount: number,
  filteredOutAds: Array<{ advertiser: string; similarity: number; reason?: string }>
): void {
  const removedCount = beforeCount - afterCount;

  if (removedCount === 0) {
    console.log(
      `[AdLibrary:${context.requestId}] [${platform.toUpperCase()}] All ${beforeCount} ads passed validation`
    );
    return;
  }

  console.log(
    `[AdLibrary:${context.requestId}] [${platform.toUpperCase()}] FILTERED ${removedCount}/${beforeCount} ads (kept ${afterCount})`
  );

  // Log details of filtered ads (up to 5)
  const samplesToShow = filteredOutAds.slice(0, 5);
  for (const ad of samplesToShow) {
    const reasonInfo = ad.reason ? ` [${ad.reason}]` : '';
    console.log(
      `  ✗ Rejected "${ad.advertiser}" (similarity: ${ad.similarity.toFixed(2)})${reasonInfo} - expected "${context.searchedCompany}"`
    );
  }

  if (filteredOutAds.length > 5) {
    console.log(`  ... and ${filteredOutAds.length - 5} more rejected`);
  }
}

/**
 * Log error during ad fetch
 */
export function logError(
  context: AdFetchContext,
  platform: AdPlatform,
  error: string
): void {
  const duration = Date.now() - context.timestamp;
  console.error(
    `[AdLibrary:${context.requestId}] [${platform.toUpperCase()}] Error after ${duration}ms: ${error}`
  );
}

/**
 * Log rate limiting enforcement
 */
export function logRateLimit(
  context: AdFetchContext,
  platform: AdPlatform,
  delayMs: number
): void {
  console.log(
    `[AdLibrary:${context.requestId}] [${platform.toUpperCase()}] Rate limit: waiting ${delayMs}ms`
  );
}

/**
 * Log summary for multi-platform fetch
 */
export function logMultiPlatformSummary(
  context: AdFetchContext,
  results: AdLibraryResponse[]
): void {
  const duration = Date.now() - context.timestamp;
  const totalAds = results.reduce((sum, r) => sum + r.ads.length, 0);
  const successfulPlatforms = results.filter(r => r.success).length;

  console.log(
    `[AdLibrary:${context.requestId}] Multi-platform fetch complete in ${duration}ms: ${totalAds} total ads from ${successfulPlatforms}/${results.length} platforms`
  );

  // Log per-platform breakdown
  for (const result of results) {
    if (result.success) {
      console.log(
        `  - ${result.platform}: ${result.ads.length} ads (${result.totalCount} available)`
      );
    } else {
      console.log(`  - ${result.platform}: FAILED - ${result.error}`);
    }
  }
}
