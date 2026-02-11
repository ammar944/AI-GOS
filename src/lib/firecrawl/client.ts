// Firecrawl Client
// Wraps @mendable/firecrawl-js SDK with AI-GOS error handling patterns

import Firecrawl from '@mendable/firecrawl-js';
import { getEnv } from '@/lib/env';
import type {
  ScrapeOptions,
  ScrapeResult,
  PricingPageResult,
  BatchScrapeOptions,
  BatchScrapeResult,
} from './types';

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const PRICING_PATHS = ['/pricing', '/plans', '/buy'] as const;

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;

function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('abort') ||
    msg.includes('econnreset') ||
    msg.includes('enotfound') ||
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('fetch failed')
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = MAX_RETRIES,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries && isTransientError(error)) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[Firecrawl] ${label} attempt ${attempt + 1} failed: ${lastError.message.slice(0, 200)}, retrying in ${delay}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw lastError;
      }
    }
  }
  throw lastError ?? new Error(`${label} failed after ${maxRetries + 1} attempts`);
}

/**
 * Firecrawl client for scraping web pages with JavaScript rendering
 *
 * Graceful degradation: If FIRECRAWL_API_KEY is not set, all methods
 * return failure results without throwing. Callers should check
 * isAvailable() before making requests if they need to know upfront.
 */
export class FirecrawlClient {
  private client: Firecrawl | null = null;
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = getEnv('FIRECRAWL_API_KEY');
    if (this.apiKey) {
      this.client = new Firecrawl({ apiKey: this.apiKey });
    }
  }

  /**
   * Check if Firecrawl is available (API key is configured)
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Scrape a single URL and return markdown content
   *
   * @param options - Scrape options including URL and timeout
   * @returns ScrapeResult with markdown or error
   */
  async scrape(options: ScrapeOptions): Promise<ScrapeResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Firecrawl not available: FIRECRAWL_API_KEY not configured',
      };
    }

    const timeout = options.timeout ?? DEFAULT_TIMEOUT;

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const document = await withRetry(
        () => this.client!.scrape(options.url, {
          formats: options.formats ?? ['markdown'],
          // Force US geolocation to get consistent pricing (avoid regional price variations)
          // NOTE: Full geo-location requires Firecrawl Growth plan ($99/mo)
          // Headers help hint US locale even on hobby plan
          ...(options.forceUSLocation && {
            location: { country: 'US', languages: ['en-US'] },
            headers: {
              'Accept-Language': 'en-US,en;q=0.9',
              'CF-IPCountry': 'US', // Cloudflare country hint
            },
            // Don't use cached data - force fresh scrape
            storeInCache: false,
            maxAge: 0,
          }),
        }),
        `scrape ${options.url}`,
      );

      clearTimeout(timeoutId);

      // Extract markdown from document
      const markdown = document.markdown;
      if (!markdown || markdown.trim().length === 0) {
        return {
          success: false,
          url: options.url,
          error: 'Scrape returned empty content',
        };
      }

      // Warn if content seems too short (possible JS rendering issue)
      const wordCount = markdown.split(/\s+/).length;
      if (wordCount < 100) {
        console.warn(
          `[Firecrawl] Low word count (${wordCount}) for ${options.url} - may indicate rendering issue`
        );
      }

      return {
        success: true,
        markdown,
        html: (document as any).html ?? undefined,
        metadata: document.metadata ? {
          title: document.metadata.title,
          description: document.metadata.description,
          language: document.metadata.language,
          robots: document.metadata.robots,
          ogTitle: document.metadata.ogTitle,
          ogDescription: document.metadata.ogDescription,
          ogUrl: document.metadata.ogUrl,
          ogImage: document.metadata.ogImage,
          sourceURL: document.metadata.sourceURL,
        } : undefined,
        title: document.metadata?.title,
        url: document.metadata?.url ?? options.url,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check for specific error types
      if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
        console.error(`[Firecrawl] Timeout scraping ${options.url} after ${timeout}ms`);
        return {
          success: false,
          url: options.url,
          error: `Request timed out after ${timeout}ms`,
        };
      }

      console.error(`[Firecrawl] Error scraping ${options.url}:`, errorMessage);
      return {
        success: false,
        url: options.url,
        error: errorMessage,
      };
    }
  }

  /**
   * Find and scrape a pricing page for a given website
   *
   * Tries common pricing page paths in order: /pricing, /plans, /buy
   * Returns the first successful result or error if all fail.
   *
   * @param websiteUrl - Base website URL (e.g., https://example.com)
   * @returns PricingPageResult with markdown or error
   */
  async scrapePricingPage(websiteUrl: string): Promise<PricingPageResult> {
    if (!this.client) {
      return {
        found: false,
        error: 'Firecrawl not available: FIRECRAWL_API_KEY not configured',
        attemptedUrls: [],
      };
    }

    // Normalize base URL
    const baseUrl = this.normalizeBaseUrl(websiteUrl);
    const attemptedUrls: string[] = [];

    for (const path of PRICING_PATHS) {
      const url = `${baseUrl}${path}`;
      attemptedUrls.push(url);

      console.log(`[Firecrawl] Trying pricing page: ${url}`);

      // Always use US location for pricing pages to get consistent USD pricing
      const result = await this.scrape({ url, forceUSLocation: true });

      if (result.success && result.markdown) {
        console.log(`[Firecrawl] Found pricing page: ${url} (${result.markdown.length} chars)`);
        return {
          found: true,
          url: result.url ?? url,
          markdown: result.markdown,
          title: result.title,
          attemptedUrls,
        };
      }

      // Log specific failure for debugging
      console.log(`[Firecrawl] ${path} failed: ${result.error ?? 'unknown error'}`);
    }

    // All paths failed
    console.warn(`[Firecrawl] No pricing page found for ${baseUrl}`);
    return {
      found: false,
      error: `No pricing page found. Tried: ${PRICING_PATHS.join(', ')}`,
      attemptedUrls,
    };
  }

  /**
   * Scrape multiple URLs in batch (parallel execution)
   *
   * @param options - Batch scrape options
   * @returns BatchScrapeResult with individual results
   */
  async batchScrape(options: BatchScrapeOptions): Promise<BatchScrapeResult> {
    if (!this.client) {
      const results = new Map<string, ScrapeResult>();
      for (const url of options.urls) {
        results.set(url, {
          success: false,
          error: 'Firecrawl not available: FIRECRAWL_API_KEY not configured',
        });
      }
      return {
        results,
        successCount: 0,
        failureCount: options.urls.length,
      };
    }

    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const formats = options.formats;
    const results = new Map<string, ScrapeResult>();

    // Scrape all URLs in parallel with concurrency limit of 3
    // (Firecrawl Hobby plan has 5 concurrent browsers)
    const CONCURRENCY = 3;
    const chunks = this.chunkArray(options.urls, CONCURRENCY);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(url => this.scrape({ url, timeout, ...(formats && { formats }) }))
      );

      for (let i = 0; i < chunk.length; i++) {
        results.set(chunk[i], chunkResults[i]);
      }
    }

    const successCount = Array.from(results.values()).filter(r => r.success).length;

    return {
      results,
      successCount,
      failureCount: options.urls.length - successCount,
    };
  }

  /**
   * Normalize a website URL to ensure consistent base URL format
   */
  private normalizeBaseUrl(url: string): string {
    // Add protocol if missing
    let normalized = url.startsWith('http') ? url : `https://${url}`;

    // Remove trailing slash
    normalized = normalized.replace(/\/+$/, '');

    // Remove any path (we want just the base)
    try {
      const parsed = new URL(normalized);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      // If URL parsing fails, return as-is
      return normalized;
    }
  }

  /**
   * Split array into chunks for controlled concurrency
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Factory function to create a FirecrawlClient instance
 *
 * Usage:
 * ```typescript
 * const client = createFirecrawlClient();
 * if (client.isAvailable()) {
 *   const result = await client.scrapePricingPage('https://example.com');
 * }
 * ```
 */
export function createFirecrawlClient(): FirecrawlClient {
  return new FirecrawlClient();
}
