'use server';

import { createEnhancedAdLibraryService } from '@/lib/ad-library';
import type { EnhancedAdLibraryResponse } from '@/lib/foreplay/types';

export interface AdsCompetitorResult {
  success: boolean;
  data?: EnhancedAdLibraryResponse;
  error?: string;
  duration_ms: number;
  debug?: {
    foreplayEnabled: boolean;
    foreplayConfigured: boolean;
    searchQuery: string;
    searchDomain: string;
    foreplayMetadata?: unknown;
    foreplaySourceMetadata?: unknown;
    foreplayError?: string;
  };
}

/**
 * Options for analyzing competitor ads
 */
export interface AnalyzeOptions {
  /** Enable Foreplay enrichment (transcripts, hooks, emotional analysis) */
  enableForeplayEnrichment?: boolean;
  /** Include Foreplay as a direct ad source (fetches ads from Foreplay database) */
  includeForeplayAsSource?: boolean;
}

/**
 * Fetch and analyze competitor ads with optional Foreplay enrichment and/or source
 */
export async function analyzeCompetitorAds(
  domain: string,
  options: AnalyzeOptions = { enableForeplayEnrichment: true, includeForeplayAsSource: false }
): Promise<AdsCompetitorResult> {
  const startTime = Date.now();

  try {
    // Validate input
    if (!domain || domain.trim().length === 0) {
      return {
        success: false,
        error: 'Domain is required',
        duration_ms: Date.now() - startTime,
      };
    }

    // Clean domain
    const cleanDomain = domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .trim();

    // Extract company name from domain for search
    const companyName = cleanDomain.split('.')[0];

    // Check Foreplay status for debug
    const foreplayEnabled = process.env.ENABLE_FOREPLAY?.toLowerCase() === 'true';
    const foreplayConfigured = !!process.env.FOREPLAY_API_KEY;

    const { enableForeplayEnrichment = true, includeForeplayAsSource = false } = options;

    console.log('[AdsCompetitor] Debug:', {
      companyName,
      cleanDomain,
      enableForeplayEnrichment,
      includeForeplayAsSource,
      foreplayEnabled,
      foreplayConfigured,
    });

    // Create enhanced service
    const service = createEnhancedAdLibraryService();

    // Fetch ads with optional Foreplay enrichment and/or source
    // Use default 'image' format for Google (more reliable visual previews)
    // Foreplay enrichment adds video transcripts/hooks from their database
    // Foreplay as source fetches ads directly from their database
    const result = await service.fetchAllPlatforms({
      query: companyName,
      domain: cleanDomain,
      limit: 20,
      // Note: Not specifying googleAdFormat uses default 'image' which has reliable thumbnails
      enableForeplayEnrichment,
      includeForeplayAsSource,
      foreplayDateRange: {
        from: get90DaysAgo(),
        to: getToday(),
      },
    });

    return {
      success: true,
      data: result,
      duration_ms: Date.now() - startTime,
      debug: {
        foreplayEnabled,
        foreplayConfigured,
        searchQuery: companyName,
        searchDomain: cleanDomain,
        foreplayMetadata: result.metadata?.foreplay,
        foreplaySourceMetadata: result.metadata?.foreplay_source,
        foreplayError: result.metadata?.foreplay?.error,
      },
    };
  } catch (error) {
    console.error('[AdsCompetitorAction] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      duration_ms: Date.now() - startTime,
    };
  }
}

/**
 * Check if Foreplay is configured and available
 */
export async function checkForeplayStatus(): Promise<{
  enabled: boolean;
  configured: boolean;
  message: string;
}> {
  const enableFlag = process.env.ENABLE_FOREPLAY?.toLowerCase() === 'true';
  const hasApiKey = !!process.env.FOREPLAY_API_KEY;

  return {
    enabled: enableFlag,
    configured: hasApiKey,
    message: !hasApiKey
      ? 'FOREPLAY_API_KEY not set'
      : !enableFlag
        ? 'ENABLE_FOREPLAY is not true'
        : 'Foreplay is enabled and configured',
  };
}

function get90DaysAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().split('T')[0];
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
