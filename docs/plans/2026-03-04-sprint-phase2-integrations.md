# Phase 2 Platform Integrations — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build API clients and betaZodTool wrappers for Google Ads, Meta Ads Manager, and Google Analytics 4, then wire them into a new `mediaPlanner` research sub-agent that runs after `synthesizeResearch`.

**Architecture:** All three new integrations follow the existing two-layer pattern: a class-based TypeScript API client with retry logic lives in `src/lib/<service>/client.ts`, and a `betaZodTool` wrapper in `research-worker/src/tools/<service>.ts` exposes it to Anthropic SDK sub-agents running inside the Railway worker. The new `mediaPlanner` runner lives alongside the existing six runners in `research-worker/src/runners/`, registered in the worker's dispatch table and exposed as a 7th lead-agent tool in `src/lib/ai/tools/research/`.

**Tech Stack:** Google Ads API v18 (REST/OAuth2 service account), Meta Marketing API v21 (access token), GA4 Data API (service account JSON), `betaZodTool` from `@anthropic-ai/sdk/helpers/beta/zod`, Zod v3, existing retry patterns from `src/lib/ai/spyfu-client.ts`.

---

## Architecture Notes Before You Start

**Two distinct codebases share tools differently:**

- `src/lib/ai/tools/mcp/*.ts` — betaZodTool wrappers used by the Next.js app directly (not used by the Railway worker)
- `research-worker/src/tools/*.ts` — betaZodTool wrappers used inside the Railway worker's sub-agents

The new platform integrations need wrappers in **both** locations:
- `src/lib/google-ads/client.ts`, `src/lib/meta-ads/client.ts`, `src/lib/ga4/client.ts` — shared API clients (imported by both sides)
- `research-worker/src/tools/google-ads.ts`, `research-worker/src/tools/meta-ads.ts`, `research-worker/src/tools/ga4.ts` — worker-side betaZodTool wrappers

The API clients go in `src/lib/` because the Next.js app may also need them for future dashboard features. The worker imports them via relative paths (the worker has its own tsconfig).

**Graceful degradation contract:** Every new API client MUST check for its env var before making requests and return a structured "unavailable" response rather than throwing. This matches the pattern in `src/lib/firecrawl/client.ts` (`isAvailable()` check pattern) and `research-worker/src/tools/spyfu.ts` (early return pattern).

---

## Task 1: Environment Variables

**Files:**
- Modify: `src/lib/env.ts`

### Step 1: Add Phase 2 optional env vars to the server list

Open `src/lib/env.ts`. The current `OPTIONAL_ENV_VARS.server` array is:

```typescript
server: [
  "PERPLEXITY_API_KEY",
  "FOREPLAY_API_KEY",
  "ENABLE_FOREPLAY",
  "FIRECRAWL_API_KEY",
  "GROQ_API_KEY",
] as const,
```

Replace it with:

```typescript
server: [
  "PERPLEXITY_API_KEY",
  "FOREPLAY_API_KEY",
  "ENABLE_FOREPLAY",
  "FIRECRAWL_API_KEY",
  "GROQ_API_KEY",
  // Phase 2: Google Ads API (OAuth2 service account flow)
  "GOOGLE_ADS_DEVELOPER_TOKEN",   // Required by every Google Ads API request
  "GOOGLE_ADS_CLIENT_ID",         // OAuth2 client ID
  "GOOGLE_ADS_CLIENT_SECRET",     // OAuth2 client secret
  "GOOGLE_ADS_REFRESH_TOKEN",     // Long-lived refresh token from OAuth2 consent
  "GOOGLE_ADS_CUSTOMER_ID",       // Default customer ID (10-digit, no dashes)
  // Phase 2: Meta Marketing API (long-lived access token)
  "META_ACCESS_TOKEN",            // System user access token (never expires)
  "META_BUSINESS_ACCOUNT_ID",     // Meta Business Manager account ID
  // Phase 2: Google Analytics 4 Data API (service account JSON)
  "GA4_PROPERTY_ID",              // GA4 property ID (numeric, e.g. "123456789")
  "GA4_SERVICE_ACCOUNT_JSON",     // Full JSON string of service account credentials
] as const,
```

### Step 2: Add to `.env.local` documentation comment (top of file)

Add a comment block above the `REQUIRED_ENV_VARS` declaration:

```typescript
// Phase 2 optional vars (add to .env.local when ready):
// GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
// GOOGLE_ADS_CLIENT_ID=your-client-id.apps.googleusercontent.com
// GOOGLE_ADS_CLIENT_SECRET=your-client-secret
// GOOGLE_ADS_REFRESH_TOKEN=1//your-refresh-token
// GOOGLE_ADS_CUSTOMER_ID=1234567890
// META_ACCESS_TOKEN=EAAxxxxx...
// META_BUSINESS_ACCOUNT_ID=123456789
// GA4_PROPERTY_ID=123456789
// GA4_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":...}
```

### Step 3: Commit

```bash
git commit -m "feat: add Phase 2 platform integration env vars to env.ts"
```

---

## Task 2: Google Ads API Client

**Files:**
- Create: `src/lib/google-ads/client.ts`
- Create: `src/lib/google-ads/types.ts`

### Step 1: Create `src/lib/google-ads/types.ts`

```typescript
// Google Ads API v18 — Typed response shapes
// REST API docs: https://developers.google.com/google-ads/api/rest/reference/rest

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED' | string;
  advertisingChannelType: string;
  biddingStrategyType: string;
  budgetAmountMicros: number;  // micros = millionths of account currency
  metrics: {
    impressions: number;
    clicks: number;
    cost: number;              // in micros
    conversions: number;
    ctr: number;               // fraction (e.g. 0.035 = 3.5%)
    averageCpc: number;        // in micros
    roas?: number;             // conversion value / cost
  };
}

export interface GoogleAdsKeyword {
  keyword: string;
  matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  campaignName: string;
  adGroupName: string;
  status: string;
  metrics: {
    impressions: number;
    clicks: number;
    cost: number;              // in micros
    conversions: number;
    ctr: number;
    averageCpc: number;        // in micros
    qualityScore?: number;     // 1-10
  };
}

export interface GoogleAdsAdGroupMetrics {
  adGroupId: string;
  adGroupName: string;
  campaignName: string;
  status: string;
  metrics: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: number;
    averageCpc: number;
  };
}

export interface GoogleAdsPerformanceSummary {
  customerId: string;
  dateRange: string;
  totalSpend: number;          // USD (converted from micros)
  totalClicks: number;
  totalImpressions: number;
  totalConversions: number;
  averageCtr: number;
  averageCpc: number;          // USD
  topCampaigns: GoogleAdsCampaign[];
  topKeywords: GoogleAdsKeyword[];
}

// Raw GAQL response row shape
export interface RawGaqlRow {
  campaign?: {
    id?: string;
    name?: string;
    status?: string;
    advertisingChannelType?: string;
    biddingStrategyType?: string;
  };
  campaignBudget?: {
    amountMicros?: string;
  };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
    conversions?: string;
    ctr?: string;
    averageCpc?: string;
    searchImpressionShare?: string;
  };
  adGroup?: {
    id?: string;
    name?: string;
    status?: string;
  };
  adGroupCriterion?: {
    keyword?: {
      text?: string;
      matchType?: string;
    };
    qualityInfo?: {
      qualityScore?: number;
    };
  };
}
```

### Step 2: Create `src/lib/google-ads/client.ts`

```typescript
// Google Ads API Client
// REST API v18 with OAuth2 service account credentials
// Docs: https://developers.google.com/google-ads/api/rest/reference/rest

import { getEnv } from '@/lib/env';
import type {
  GoogleAdsCampaign,
  GoogleAdsKeyword,
  GoogleAdsAdGroupMetrics,
  GoogleAdsPerformanceSummary,
  RawGaqlRow,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

const GOOGLE_ADS_API_VERSION = 'v18';
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;

// =============================================================================
// Types — OAuth2 token response
// =============================================================================

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;  // Unix timestamp ms
}

// =============================================================================
// Helpers
// =============================================================================

/** Convert Google Ads micros (millionths) to dollars */
function microsToUsd(micros: number | string): number {
  return Number(micros) / 1_000_000;
}

/** Convert string metric to number, defaulting to 0 */
function toNumber(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  return Number(val);
}

/** Check if this is a transient error worth retrying */
function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('timeout') ||
    msg.includes('econnreset')
  );
}

// =============================================================================
// Google Ads Client
// =============================================================================

/**
 * Google Ads REST API client using OAuth2 service account credentials.
 *
 * Graceful degradation: if required env vars are missing, all methods
 * return empty/error results without throwing. Check isAvailable() first.
 *
 * Auth flow: exchange refresh_token for short-lived access_token, then use
 * access_token + developer-token header on every request.
 */
export class GoogleAdsClient {
  private readonly developerToken: string | undefined;
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly refreshToken: string | undefined;
  private readonly defaultCustomerId: string | undefined;

  // In-memory token cache — valid for the process lifetime
  private cachedToken: CachedToken | null = null;

  constructor() {
    this.developerToken = getEnv('GOOGLE_ADS_DEVELOPER_TOKEN');
    this.clientId = getEnv('GOOGLE_ADS_CLIENT_ID');
    this.clientSecret = getEnv('GOOGLE_ADS_CLIENT_SECRET');
    this.refreshToken = getEnv('GOOGLE_ADS_REFRESH_TOKEN');
    this.defaultCustomerId = getEnv('GOOGLE_ADS_CUSTOMER_ID');
  }

  /** True if all required credentials are configured */
  isAvailable(): boolean {
    return !!(
      this.developerToken &&
      this.clientId &&
      this.clientSecret &&
      this.refreshToken
    );
  }

  // ---------------------------------------------------------------------------
  // OAuth2 token management
  // ---------------------------------------------------------------------------

  /**
   * Get a valid access token, refreshing if expired.
   * Google access tokens expire in 3600s — we refresh 60s early.
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.accessToken;
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        refresh_token: this.refreshToken!,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Google OAuth2 token refresh failed (${response.status}): ${text.slice(0, 300)}`);
    }

    const token = await response.json() as TokenResponse;
    this.cachedToken = {
      accessToken: token.access_token,
      expiresAt: now + token.expires_in * 1000,
    };

    return token.access_token;
  }

  // ---------------------------------------------------------------------------
  // Generic GAQL query executor
  // ---------------------------------------------------------------------------

  /**
   * Execute a Google Ads Query Language (GAQL) query against a customer.
   * Handles pagination by following nextPageToken automatically.
   * Returns all rows across all pages.
   */
  private async executeGaql(
    customerId: string,
    query: string,
  ): Promise<RawGaqlRow[]> {
    if (!this.isAvailable()) {
      throw new Error('Google Ads credentials not configured');
    }

    const cleanCustomerId = customerId.replace(/-/g, '');
    const endpoint = `${GOOGLE_ADS_BASE_URL}/customers/${cleanCustomerId}/googleAds:searchStream`;

    const allRows: RawGaqlRow[] = [];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const accessToken = await this.getAccessToken();

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': this.developerToken!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });

        if (response.status === 429) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[GoogleAds] Rate limited, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`Google Ads API error ${response.status}: ${text.slice(0, 500)}`);
        }

        // searchStream returns newline-delimited JSON objects
        const text = await response.text();
        const lines = text.trim().split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as { results?: RawGaqlRow[] };
            if (parsed.results) {
              allRows.push(...parsed.results);
            }
          } catch {
            // Skip malformed lines
          }
        }

        return allRows;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < MAX_RETRIES && isTransient(error)) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[GoogleAds] Attempt ${attempt + 1} failed: ${lastError.message.slice(0, 200)}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    throw lastError ?? new Error('Google Ads GAQL query failed');
  }

  // ---------------------------------------------------------------------------
  // Date range helper
  // ---------------------------------------------------------------------------

  private getDateRange(range: '7d' | '30d' | '90d'): { startDate: string; endDate: string } {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    return { startDate: fmt(start), endDate: fmt(end) };
  }

  // ---------------------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------------------

  /**
   * Get all active campaigns with performance metrics for a date range.
   * Returns top 20 campaigns by spend descending.
   */
  async getCampaigns(
    customerId: string,
    dateRange: '7d' | '30d' | '90d' = '30d',
  ): Promise<GoogleAdsCampaign[]> {
    const { startDate, endDate } = this.getDateRange(dateRange);

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        campaign_budget.amount_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE campaign.status != 'REMOVED'
        AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.cost_micros DESC
      LIMIT 20
    `.trim();

    const rows = await this.executeGaql(customerId, query);

    return rows.map((row): GoogleAdsCampaign => ({
      id: row.campaign?.id ?? '',
      name: row.campaign?.name ?? '',
      status: (row.campaign?.status ?? 'UNKNOWN') as GoogleAdsCampaign['status'],
      advertisingChannelType: row.campaign?.advertisingChannelType ?? '',
      biddingStrategyType: row.campaign?.biddingStrategyType ?? '',
      budgetAmountMicros: toNumber(row.campaignBudget?.amountMicros),
      metrics: {
        impressions: toNumber(row.metrics?.impressions),
        clicks: toNumber(row.metrics?.clicks),
        cost: microsToUsd(toNumber(row.metrics?.costMicros)),
        conversions: toNumber(row.metrics?.conversions),
        ctr: toNumber(row.metrics?.ctr),
        averageCpc: microsToUsd(toNumber(row.metrics?.averageCpc)),
      },
    }));
  }

  /**
   * Get top performing keywords by spend for a date range.
   * Returns top 50 keywords descending by cost.
   */
  async getKeywordPerformance(
    customerId: string,
    dateRange: '7d' | '30d' | '90d' = '30d',
  ): Promise<GoogleAdsKeyword[]> {
    const { startDate, endDate } = this.getDateRange(dateRange);

    const query = `
      SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.quality_info.quality_score,
        campaign.name,
        ad_group.name,
        ad_group_criterion.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM keyword_view
      WHERE ad_group_criterion.type = 'KEYWORD'
        AND ad_group_criterion.status != 'REMOVED'
        AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.cost_micros DESC
      LIMIT 50
    `.trim();

    const rows = await this.executeGaql(customerId, query);

    return rows.map((row): GoogleAdsKeyword => ({
      keyword: row.adGroupCriterion?.keyword?.text ?? '',
      matchType: (row.adGroupCriterion?.keyword?.matchType ?? 'BROAD') as GoogleAdsKeyword['matchType'],
      campaignName: row.campaign?.name ?? '',
      adGroupName: row.adGroup?.name ?? '',
      status: row.adGroup?.status ?? 'UNKNOWN',
      metrics: {
        impressions: toNumber(row.metrics?.impressions),
        clicks: toNumber(row.metrics?.clicks),
        cost: microsToUsd(toNumber(row.metrics?.costMicros)),
        conversions: toNumber(row.metrics?.conversions),
        ctr: toNumber(row.metrics?.ctr),
        averageCpc: microsToUsd(toNumber(row.metrics?.averageCpc)),
        qualityScore: row.adGroupCriterion?.qualityInfo?.qualityScore,
      },
    }));
  }

  /**
   * Get ad group metrics for a specific campaign.
   */
  async getAdGroupMetrics(
    customerId: string,
    campaignId: string,
    dateRange: '7d' | '30d' | '90d' = '30d',
  ): Promise<GoogleAdsAdGroupMetrics[]> {
    const { startDate, endDate } = this.getDateRange(dateRange);

    const query = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM ad_group
      WHERE campaign.id = ${campaignId}
        AND ad_group.status != 'REMOVED'
        AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.cost_micros DESC
    `.trim();

    const rows = await this.executeGaql(customerId, query);

    return rows.map((row): GoogleAdsAdGroupMetrics => ({
      adGroupId: row.adGroup?.id ?? '',
      adGroupName: row.adGroup?.name ?? '',
      campaignName: row.campaign?.name ?? '',
      status: row.adGroup?.status ?? 'UNKNOWN',
      metrics: {
        impressions: toNumber(row.metrics?.impressions),
        clicks: toNumber(row.metrics?.clicks),
        cost: microsToUsd(toNumber(row.metrics?.costMicros)),
        conversions: toNumber(row.metrics?.conversions),
        ctr: toNumber(row.metrics?.ctr),
        averageCpc: microsToUsd(toNumber(row.metrics?.averageCpc)),
      },
    }));
  }

  /**
   * High-level summary: top campaigns + top keywords for a customer.
   * Used by the betaZodTool wrapper.
   */
  async getPerformanceSummary(
    customerId: string,
    dateRange: '7d' | '30d' | '90d' = '30d',
  ): Promise<GoogleAdsPerformanceSummary> {
    const [campaigns, keywords] = await Promise.all([
      this.getCampaigns(customerId, dateRange),
      this.getKeywordPerformance(customerId, dateRange),
    ]);

    const totalSpend = campaigns.reduce((sum, c) => sum + c.metrics.cost, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.metrics.clicks, 0);
    const totalImpressions = campaigns.reduce((sum, c) => sum + c.metrics.impressions, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.metrics.conversions, 0);

    return {
      customerId,
      dateRange,
      totalSpend,
      totalClicks,
      totalImpressions,
      totalConversions,
      averageCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      averageCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      topCampaigns: campaigns.slice(0, 5),
      topKeywords: keywords.slice(0, 20),
    };
  }
}

/**
 * Factory — creates a GoogleAdsClient instance.
 * Check isAvailable() before making API calls.
 */
export function createGoogleAdsClient(): GoogleAdsClient {
  return new GoogleAdsClient();
}
```

### Step 3: Commit

```bash
git commit -m "feat: add Google Ads API client (src/lib/google-ads/client.ts)"
```

---

## Task 3: Google Ads betaZodTool Wrapper (Next.js app side)

**Files:**
- Create: `src/lib/ai/tools/mcp/google-ads-tool.ts`

### Step 1: Create the wrapper

```typescript
// MCP Tool Wrapper: Google Ads
// betaZodTool wrapping GoogleAdsClient.getPerformanceSummary() for use by Anthropic SDK sub-agents

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { createGoogleAdsClient } from '@/lib/google-ads/client';

export const googleAdsTool = betaZodTool({
  name: 'googleAds',
  description:
    'Fetch real campaign performance data from a Google Ads account. ' +
    'Returns top campaigns by spend, keyword performance, CTR, CPC, and conversion data. ' +
    'Use for understanding actual paid search performance and identifying optimization opportunities.',
  inputSchema: z.object({
    customerId: z
      .string()
      .describe(
        'Google Ads customer ID (10-digit numeric, no dashes, e.g. "1234567890"). ' +
        'Use the configured default if the user has not specified one.',
      ),
    query: z
      .string()
      .optional()
      .describe(
        'Optional: specific campaign name or keyword theme to focus the analysis on. ' +
        'If omitted, returns the top 5 campaigns and top 20 keywords by spend.',
      ),
    dateRange: z
      .enum(['7d', '30d', '90d'])
      .default('30d')
      .describe('Date range for performance metrics. Default is last 30 days.'),
  }),
  run: async ({ customerId, dateRange }) => {
    try {
      const client = createGoogleAdsClient();

      if (!client.isAvailable()) {
        return JSON.stringify({
          available: false,
          error: 'Google Ads credentials not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN in environment.',
        });
      }

      // Use the provided customerId, or fall back to the env-configured default
      const effectiveCustomerId =
        customerId || process.env.GOOGLE_ADS_CUSTOMER_ID || '';

      if (!effectiveCustomerId) {
        return JSON.stringify({
          available: false,
          error: 'No Google Ads customer ID provided and GOOGLE_ADS_CUSTOMER_ID not configured.',
        });
      }

      const summary = await client.getPerformanceSummary(
        effectiveCustomerId,
        dateRange,
      );

      return JSON.stringify({
        available: true,
        ...summary,
      });
    } catch (error) {
      return JSON.stringify({
        available: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
```

### Step 2: Commit

```bash
git commit -m "feat: add googleAdsTool betaZodTool wrapper (mcp/google-ads-tool.ts)"
```

---

## Task 4: Google Ads betaZodTool Wrapper (Railway worker side)

**Files:**
- Create: `research-worker/src/tools/google-ads.ts`
- Modify: `research-worker/src/tools/index.ts`

### Step 1: Create `research-worker/src/tools/google-ads.ts`

The Railway worker cannot import from `@/lib/` (no path alias, separate tsconfig). It makes its own direct API calls using the same pattern as `research-worker/src/tools/spyfu.ts`.

```typescript
// Research Worker Tool: Google Ads
// betaZodTool for use by Anthropic SDK sub-agents inside the Railway worker
// Makes direct REST calls (cannot import from src/lib — separate process)

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const GOOGLE_ADS_API_VERSION = 'v18';
const GOOGLE_ADS_BASE_URL = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Simple in-memory token cache for the worker process
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN not configured');
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

async function gaqlQuery(customerId: string, query: string): Promise<unknown[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN not configured');

  const cleanId = customerId.replace(/-/g, '');
  const accessToken = await getAccessToken();

  const res = await fetch(`${GOOGLE_ADS_BASE_URL}/customers/${cleanId}/googleAds:searchStream`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Ads API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const text = await res.text();
  const rows: unknown[] = [];
  for (const line of text.trim().split('\n').filter(Boolean)) {
    try {
      const parsed = JSON.parse(line) as { results?: unknown[] };
      if (parsed.results) rows.push(...parsed.results);
    } catch {
      // skip malformed
    }
  }
  return rows;
}

export const googleAdsTool = betaZodTool({
  name: 'googleAds',
  description:
    'Fetch live campaign performance data from a Google Ads account. ' +
    'Returns top campaigns, keywords, spend, CTR, CPC, and conversions.',
  inputSchema: z.object({
    customerId: z
      .string()
      .optional()
      .describe('Google Ads customer ID (numeric, no dashes). Defaults to GOOGLE_ADS_CUSTOMER_ID env var.'),
    dateRange: z
      .enum(['7d', '30d', '90d'])
      .default('30d')
      .describe('Date range for metrics.'),
  }),
  run: async ({ customerId, dateRange }) => {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    if (!developerToken || !clientId || !clientSecret || !refreshToken) {
      return JSON.stringify({
        available: false,
        error: 'Google Ads credentials not configured in worker environment',
      });
    }

    const effectiveCustomerId =
      (customerId || process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');

    if (!effectiveCustomerId) {
      return JSON.stringify({
        available: false,
        error: 'No customer ID provided and GOOGLE_ADS_CUSTOMER_ID not set',
      });
    }

    try {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - days * 86400 * 1000).toISOString().split('T')[0];

      const [campaigns, keywords] = await Promise.all([
        gaqlQuery(effectiveCustomerId, `
          SELECT campaign.name, campaign.status,
            metrics.impressions, metrics.clicks, metrics.cost_micros,
            metrics.conversions, metrics.ctr, metrics.average_cpc
          FROM campaign
          WHERE campaign.status != 'REMOVED'
            AND segments.date BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY metrics.cost_micros DESC LIMIT 10
        `),
        gaqlQuery(effectiveCustomerId, `
          SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
            campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros,
            metrics.conversions, metrics.ctr, metrics.average_cpc
          FROM keyword_view
          WHERE ad_group_criterion.type = 'KEYWORD'
            AND ad_group_criterion.status != 'REMOVED'
            AND segments.date BETWEEN '${startDate}' AND '${endDate}'
          ORDER BY metrics.cost_micros DESC LIMIT 20
        `),
      ]);

      return JSON.stringify({
        available: true,
        customerId: effectiveCustomerId,
        dateRange,
        campaigns,
        keywords,
      });
    } catch (error) {
      return JSON.stringify({
        available: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
```

### Step 2: Add export to `research-worker/src/tools/index.ts`

Add this line at the end of the existing exports (add only `googleAdsTool` now — `metaAdsTool` and `ga4Tool` will be added in Tasks 5 and 6 respectively):

```typescript
export { googleAdsTool } from './google-ads';
```

### Step 3: Commit

```bash
git commit -m "feat: add googleAdsTool for research-worker sub-agents"
```

---

## Task 5: Meta Ads Manager Client

**Files:**
- Create: `src/lib/meta-ads/client.ts`
- Create: `src/lib/meta-ads/types.ts`
- Create: `research-worker/src/tools/meta-ads.ts`

### Step 1: Create `src/lib/meta-ads/types.ts`

```typescript
// Meta Marketing API v21 — Typed response shapes
// API docs: https://developers.facebook.com/docs/marketing-api/reference

export interface MetaCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED' | string;
  objective: string;
  spend: number;               // USD
  impressions: number;
  clicks: number;
  reach: number;
  cpm: number;                 // Cost per 1000 impressions
  cpc: number;                 // Cost per click
  ctr: number;                 // Click-through rate (fraction)
  conversions: number;
  roas?: number;               // Return on ad spend (if conversion value available)
}

export interface MetaAudienceInsight {
  interest: string;
  audienceSize: number;        // Estimated audience size
  relevanceScore?: number;     // 0-100 if available
}

export interface MetaCreativePerformance {
  adId: string;
  adName: string;
  campaignName: string;
  format: string;              // 'image' | 'video' | 'carousel' | 'collection'
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  thumbnailUrl?: string;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  accountStatus: number;       // 1 = ACTIVE
}

export interface MetaInsightsSummary {
  accountId: string;
  dateRange: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCpm: number;
  averageCpc: number;
  averageCtr: number;
  topCampaigns: MetaCampaign[];
  topCreatives: MetaCreativePerformance[];
}

// Raw Meta API response shapes
export interface RawMetaInsight {
  campaign_id?: string;
  campaign_name?: string;
  status?: string;
  objective?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  cpm?: string;
  cpc?: string;
  ctr?: string;
  conversions?: Array<{ action_type: string; value: string }>;
  purchase_roas?: Array<{ action_type: string; value: string }>;
}
```

### Step 2: Create `src/lib/meta-ads/client.ts`

```typescript
// Meta Ads Manager Client
// Meta Marketing API v21 with long-lived access token
// Docs: https://developers.facebook.com/docs/marketing-api

import { getEnv } from '@/lib/env';
import type {
  MetaCampaign,
  MetaAdAccount,
  MetaCreativePerformance,
  MetaInsightsSummary,
  RawMetaInsight,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;

// =============================================================================
// Helpers
// =============================================================================

function toNumber(val: string | number | undefined): number {
  if (!val && val !== 0) return 0;
  return Number(val);
}

function isTransient(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('429') || msg.includes('rate') || msg.includes('timeout') || msg.includes('503');
}

// =============================================================================
// Meta Ads Client
// =============================================================================

/**
 * Meta Marketing API client.
 *
 * Uses a long-lived system user access token (never expires if generated
 * from a System User in Business Manager).
 *
 * Graceful degradation: returns error shape without throwing when credentials
 * are missing.
 *
 * NOTE: This is distinct from the ad-library-tool.ts which uses SearchAPI for
 * read-only COMPETITOR intelligence. This client uses the META_ACCESS_TOKEN
 * for accessing your OWN ad account data (spend, ROAS, audiences, creatives).
 */
export class MetaAdsClient {
  private readonly accessToken: string | undefined;
  private readonly defaultAccountId: string | undefined;

  constructor() {
    this.accessToken = getEnv('META_ACCESS_TOKEN');
    this.defaultAccountId = getEnv('META_BUSINESS_ACCOUNT_ID');
  }

  isAvailable(): boolean {
    return !!this.accessToken;
  }

  // ---------------------------------------------------------------------------
  // Generic fetch with retry
  // ---------------------------------------------------------------------------

  private async metaFetch<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('META_ACCESS_TOKEN not configured');
    }

    const url = new URL(`${META_BASE_URL}/${path}`);
    url.searchParams.set('access_token', this.accessToken);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url.toString());

        if (response.status === 429) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[MetaAds] Rate limited, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`Meta API error ${response.status}: ${text.slice(0, 400)}`);
        }

        return await response.json() as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < MAX_RETRIES && isTransient(error)) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[MetaAds] Attempt ${attempt + 1} failed: ${lastError.message.slice(0, 200)}, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    throw lastError ?? new Error('Meta API request failed');
  }

  // ---------------------------------------------------------------------------
  // Date range helper
  // ---------------------------------------------------------------------------

  private getTimeRange(range: '7d' | '30d'): string {
    const days = range === '7d' ? 7 : 30;
    const since = new Date(Date.now() - days * 86400 * 1000).toISOString().split('T')[0];
    const until = new Date().toISOString().split('T')[0];
    return JSON.stringify({ since, until });
  }

  // ---------------------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------------------

  /**
   * Get ad accounts accessible via the access token.
   */
  async getAdAccounts(): Promise<MetaAdAccount[]> {
    const response = await this.metaFetch<{
      data: Array<{ id: string; name: string; currency: string; timezone_name: string; account_status: number }>;
    }>('me/adaccounts', {
      fields: 'id,name,currency,timezone_name,account_status',
    });

    return response.data.map(acc => ({
      id: acc.id,
      name: acc.name,
      currency: acc.currency,
      timezone: acc.timezone_name,
      accountStatus: acc.account_status,
    }));
  }

  /**
   * Get campaign insights for an ad account.
   * Returns top campaigns sorted by spend descending.
   */
  async getCampaignInsights(
    accountId: string,
    dateRange: '7d' | '30d' = '30d',
  ): Promise<MetaCampaign[]> {
    const timeRange = this.getTimeRange(dateRange);
    // Normalize account ID format (Meta uses 'act_XXXXXXX' format)
    const normalizedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

    const response = await this.metaFetch<{
      data: RawMetaInsight[];
    }>(`${normalizedId}/insights`, {
      level: 'campaign',
      fields: 'campaign_id,campaign_name,objective,spend,impressions,clicks,reach,cpm,cpc,ctr,conversions,purchase_roas',
      time_range: timeRange,
      limit: '20',
      sort: 'spend_descending',
    });

    return response.data.map((raw): MetaCampaign => {
      const conversions =
        raw.conversions?.find(c => c.action_type === 'offsite_conversion.fb_pixel_purchase')?.value ??
        raw.conversions?.[0]?.value ??
        '0';
      const roas = raw.purchase_roas?.[0]?.value;

      return {
        id: raw.campaign_id ?? '',
        name: raw.campaign_name ?? '',
        status: raw.status ?? 'UNKNOWN',
        objective: raw.objective ?? '',
        spend: toNumber(raw.spend),
        impressions: toNumber(raw.impressions),
        clicks: toNumber(raw.clicks),
        reach: toNumber(raw.reach),
        cpm: toNumber(raw.cpm),
        cpc: toNumber(raw.cpc),
        ctr: toNumber(raw.ctr),
        conversions: toNumber(conversions),
        roas: roas ? toNumber(roas) : undefined,
      };
    });
  }

  /**
   * Get audience insights for interests in an account's region.
   * Uses the Targeting Search endpoint to estimate audience sizes.
   */
  async getAudienceInsights(
    accountId: string,
    interests: string[],
  ): Promise<Array<{ interest: string; audienceSize: number }>> {
    // Targeting Search is available at the ad account level
    const normalizedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

    const results: Array<{ interest: string; audienceSize: number }> = [];

    // Meta Targeting Search is one interest at a time for accurate results
    for (const interest of interests.slice(0, 10)) {
      try {
        const response = await this.metaFetch<{
          data: Array<{ id: string; name: string; audience_size_lower_bound?: number; audience_size_upper_bound?: number }>;
        }>(`${normalizedId}/targetingsearch`, {
          q: interest,
          limit: '5',
        });

        const match = response.data[0];
        if (match) {
          const lower = match.audience_size_lower_bound ?? 0;
          const upper = match.audience_size_upper_bound ?? 0;
          results.push({
            interest: match.name,
            audienceSize: Math.round((lower + upper) / 2),
          });
        }
      } catch {
        // Skip failed interest lookups — don't fail the whole batch
      }
    }

    return results;
  }

  /**
   * Get creative performance data (ad-level insights).
   */
  async getCreativePerformance(
    accountId: string,
    dateRange: '7d' | '30d' = '30d',
  ): Promise<MetaCreativePerformance[]> {
    const timeRange = this.getTimeRange(dateRange);
    const normalizedId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

    const response = await this.metaFetch<{
      data: Array<{
        ad_id?: string;
        ad_name?: string;
        campaign_name?: string;
        spend?: string;
        impressions?: string;
        clicks?: string;
        ctr?: string;
        conversions?: Array<{ action_type: string; value: string }>;
      }>;
    }>(`${normalizedId}/insights`, {
      level: 'ad',
      fields: 'ad_id,ad_name,campaign_name,spend,impressions,clicks,ctr,conversions',
      time_range: timeRange,
      limit: '20',
      sort: 'spend_descending',
    });

    return response.data.map((raw): MetaCreativePerformance => ({
      adId: raw.ad_id ?? '',
      adName: raw.ad_name ?? '',
      campaignName: raw.campaign_name ?? '',
      format: 'unknown',  // Would require additional ad creative lookup
      spend: toNumber(raw.spend),
      impressions: toNumber(raw.impressions),
      clicks: toNumber(raw.clicks),
      ctr: toNumber(raw.ctr),
      conversions: toNumber(raw.conversions?.[0]?.value),
    }));
  }

  /**
   * High-level summary for the betaZodTool wrapper.
   */
  async getInsightsSummary(
    accountId: string,
    dateRange: '7d' | '30d' = '30d',
  ): Promise<MetaInsightsSummary> {
    const [campaigns, creatives] = await Promise.all([
      this.getCampaignInsights(accountId, dateRange),
      this.getCreativePerformance(accountId, dateRange),
    ]);

    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);

    return {
      accountId,
      dateRange,
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      averageCpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
      averageCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      averageCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      topCampaigns: campaigns.slice(0, 5),
      topCreatives: creatives.slice(0, 10),
    };
  }
}

export function createMetaAdsClient(): MetaAdsClient {
  return new MetaAdsClient();
}
```

### Step 3: Create `src/lib/ai/tools/mcp/meta-ads-tool.ts`

```typescript
// MCP Tool Wrapper: Meta Ads Manager
// betaZodTool wrapping MetaAdsClient for use by Anthropic SDK sub-agents
// NOTE: This is DIFFERENT from ad-library-tool.ts — that reads COMPETITOR ads via SearchAPI.
// This reads YOUR OWN ad account data via Meta Marketing API.

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { createMetaAdsClient } from '@/lib/meta-ads/client';

export const metaAdsTool = betaZodTool({
  name: 'metaAds',
  description:
    'Fetch live performance data from your Meta Ads Manager account. ' +
    'Returns campaign spend, impressions, CPM, ROAS, and top creative performance. ' +
    'Use for understanding your own Meta advertising performance and audience data.',
  inputSchema: z.object({
    accountId: z
      .string()
      .optional()
      .describe(
        'Meta ad account ID (numeric or prefixed with "act_"). ' +
        'Defaults to META_BUSINESS_ACCOUNT_ID environment variable.',
      ),
    metric: z
      .enum(['campaigns', 'audiences', 'creatives'])
      .describe(
        'campaigns — campaign-level spend/ROAS breakdown. ' +
        'audiences — audience interest sizing. ' +
        'creatives — ad creative performance ranking.',
      ),
    dateRange: z
      .enum(['7d', '30d'])
      .default('30d')
      .describe('Date range for metrics.'),
    interests: z
      .array(z.string())
      .optional()
      .describe('For metric=audiences: list of interest categories to size (max 10).'),
  }),
  run: async ({ accountId, metric, dateRange, interests }) => {
    try {
      const client = createMetaAdsClient();

      if (!client.isAvailable()) {
        return JSON.stringify({
          available: false,
          error: 'Meta Ads credentials not configured. Set META_ACCESS_TOKEN in environment.',
        });
      }

      const effectiveAccountId =
        accountId || process.env.META_BUSINESS_ACCOUNT_ID || '';

      if (!effectiveAccountId) {
        return JSON.stringify({
          available: false,
          error: 'No account ID provided and META_BUSINESS_ACCOUNT_ID not configured.',
        });
      }

      if (metric === 'campaigns') {
        const summary = await client.getInsightsSummary(effectiveAccountId, dateRange);
        return JSON.stringify({ available: true, ...summary });
      }

      if (metric === 'audiences') {
        const audienceInterests = interests ?? [];
        const results = await client.getAudienceInsights(effectiveAccountId, audienceInterests);
        return JSON.stringify({ available: true, audiences: results });
      }

      if (metric === 'creatives') {
        const creatives = await client.getCreativePerformance(effectiveAccountId, dateRange);
        return JSON.stringify({ available: true, creatives });
      }

      return JSON.stringify({ available: false, error: `Unknown metric: ${metric}` });
    } catch (error) {
      return JSON.stringify({
        available: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
```

### Step 4: Create `research-worker/src/tools/meta-ads.ts`

```typescript
// Research Worker Tool: Meta Ads Manager
// betaZodTool for use by Anthropic SDK sub-agents inside the Railway worker

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

async function metaFetch(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error('META_ACCESS_TOKEN not configured');

  const url = new URL(`${META_BASE_URL}/${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Meta API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export const metaAdsTool = betaZodTool({
  name: 'metaAds',
  description:
    'Fetch live Meta Ads Manager performance data: campaign spend, ROAS, CPM, and creative performance.',
  inputSchema: z.object({
    accountId: z
      .string()
      .optional()
      .describe('Meta ad account ID. Defaults to META_BUSINESS_ACCOUNT_ID env var.'),
    metric: z
      .enum(['campaigns', 'audiences', 'creatives'])
      .describe('Which data to fetch.'),
    dateRange: z
      .enum(['7d', '30d'])
      .default('30d'),
    interests: z
      .array(z.string())
      .optional()
      .describe('For metric=audiences: interests to size.'),
  }),
  run: async ({ accountId, metric, dateRange, interests }) => {
    if (!process.env.META_ACCESS_TOKEN) {
      return JSON.stringify({ available: false, error: 'META_ACCESS_TOKEN not configured in worker' });
    }

    const rawId = accountId || process.env.META_BUSINESS_ACCOUNT_ID || '';
    if (!rawId) {
      return JSON.stringify({ available: false, error: 'No account ID available' });
    }
    const normalizedId = rawId.startsWith('act_') ? rawId : `act_${rawId}`;

    const days = dateRange === '7d' ? 7 : 30;
    const since = new Date(Date.now() - days * 86400 * 1000).toISOString().split('T')[0];
    const until = new Date().toISOString().split('T')[0];
    const timeRange = JSON.stringify({ since, until });

    try {
      if (metric === 'campaigns') {
        const data = await metaFetch(`${normalizedId}/insights`, {
          level: 'campaign',
          fields: 'campaign_name,objective,spend,impressions,clicks,reach,cpm,cpc,ctr,conversions,purchase_roas',
          time_range: timeRange,
          limit: '10',
          sort: 'spend_descending',
        });
        return JSON.stringify({ available: true, metric: 'campaigns', data });
      }

      if (metric === 'audiences' && interests?.length) {
        const results: unknown[] = [];
        for (const interest of interests.slice(0, 5)) {
          try {
            const res = await metaFetch(`${normalizedId}/targetingsearch`, { q: interest, limit: '3' });
            results.push({ interest, result: res });
          } catch {
            results.push({ interest, error: 'lookup failed' });
          }
        }
        return JSON.stringify({ available: true, metric: 'audiences', audiences: results });
      }

      if (metric === 'creatives') {
        const data = await metaFetch(`${normalizedId}/insights`, {
          level: 'ad',
          fields: 'ad_name,campaign_name,spend,impressions,clicks,ctr,conversions',
          time_range: timeRange,
          limit: '10',
          sort: 'spend_descending',
        });
        return JSON.stringify({ available: true, metric: 'creatives', data });
      }

      return JSON.stringify({ available: false, error: `Unknown metric: ${metric}` });
    } catch (error) {
      return JSON.stringify({
        available: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
```

### Step 5: Commit

```bash
git commit -m "feat: add Meta Ads Manager client and betaZodTool wrappers"
```

---

## Task 6: Google Analytics 4 Client

**Files:**
- Create: `src/lib/ga4/client.ts`
- Create: `src/lib/ga4/types.ts`
- Create: `src/lib/ai/tools/mcp/ga4-tool.ts`
- Create: `research-worker/src/tools/ga4.ts`

### Step 1: Create `src/lib/ga4/types.ts`

```typescript
// Google Analytics 4 Data API — Typed response shapes
// API docs: https://developers.google.com/analytics/devguides/reporting/data/v1/rest

export interface GA4SessionMetrics {
  sessions: number;
  users: number;
  newUsers: number;
  bounceRate: number;          // fraction (e.g. 0.45 = 45%)
  sessionDuration: number;     // average in seconds
  pagesPerSession: number;
}

export interface GA4ConversionEvent {
  eventName: string;
  eventCount: number;
  conversions: number;
  conversionRate: number;      // fraction
  value?: number;              // if value is tracked
}

export interface GA4AudienceOverview {
  totalUsers: number;
  newUsers: number;
  returningUsers: number;
  topCountries: Array<{ country: string; users: number }>;
  topDevices: Array<{ device: string; sessions: number; percentage: number }>;
  topAgeGroups?: Array<{ ageGroup: string; users: number }>;
  topGenders?: Array<{ gender: string; users: number }>;
}

export interface GA4ChannelBreakdown {
  channel: string;
  sessions: number;
  users: number;
  bounceRate: number;
  conversions: number;
  conversionRate: number;
  percentage: number;          // % of total sessions
}

// Raw GA4 API row
export interface RawGA4Row {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}

export interface RawGA4Response {
  rows?: RawGA4Row[];
  rowCount?: number;
  metadata?: unknown;
}
```

### Step 2: Create `src/lib/ga4/client.ts`

```typescript
// Google Analytics 4 Data API Client
// Service account authentication via JSON credentials in env var
// Docs: https://developers.google.com/analytics/devguides/reporting/data/v1

import { getEnv } from '@/lib/env';
import type {
  GA4SessionMetrics,
  GA4ConversionEvent,
  GA4AudienceOverview,
  GA4ChannelBreakdown,
  RawGA4Row,
  RawGA4Response,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

const GA4_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;

// =============================================================================
// Service Account JWT Types
// =============================================================================

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  token_uri: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

// =============================================================================
// JWT creation for service account auth
// Note: Uses Web Crypto API available in Node.js 18+ and Edge runtime
// =============================================================================

function base64urlEncode(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function createServiceAccountJwt(creds: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64urlEncode(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: creds.token_uri || GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));

  const signingInput = `${header}.${payload}`;

  // Import RSA private key for signing
  const privateKeyPem = creds.private_key.replace(/\\n/g, '\n');
  const keyData = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const signatureBase64 = base64urlEncode(
    String.fromCharCode(...new Uint8Array(signature)),
  );

  return `${signingInput}.${signatureBase64}`;
}

// =============================================================================
// GA4 Client
// =============================================================================

/**
 * Google Analytics 4 Data API client.
 *
 * Auth: service account JSON stored as a single env var (GA4_SERVICE_ACCOUNT_JSON).
 * This avoids the need to manage individual PEM files in serverless environments.
 *
 * Graceful degradation: check isAvailable() before calling methods.
 */
export class GA4Client {
  private readonly credentials: ServiceAccountCredentials | null;
  private readonly defaultPropertyId: string | undefined;
  private cachedToken: CachedToken | null = null;

  constructor() {
    this.defaultPropertyId = getEnv('GA4_PROPERTY_ID');
    const credJson = getEnv('GA4_SERVICE_ACCOUNT_JSON');

    if (credJson) {
      try {
        this.credentials = JSON.parse(credJson) as ServiceAccountCredentials;
      } catch {
        console.error('[GA4] Failed to parse GA4_SERVICE_ACCOUNT_JSON — must be valid JSON');
        this.credentials = null;
      }
    } else {
      this.credentials = null;
    }
  }

  isAvailable(): boolean {
    return this.credentials !== null;
  }

  // ---------------------------------------------------------------------------
  // Token management
  // ---------------------------------------------------------------------------

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 60_000) {
      return this.cachedToken.accessToken;
    }

    if (!this.credentials) {
      throw new Error('GA4 service account credentials not configured');
    }

    const jwt = await createServiceAccountJwt(this.credentials);

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`GA4 service account auth failed (${response.status}): ${text.slice(0, 300)}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.cachedToken = {
      accessToken: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };

    return data.access_token;
  }

  // ---------------------------------------------------------------------------
  // Generic report runner
  // ---------------------------------------------------------------------------

  private async runReport(
    propertyId: string,
    dimensions: string[],
    metrics: string[],
    dateRanges: Array<{ startDate: string; endDate: string }>,
    orderBys?: Array<{ metric: { metricName: string }; desc?: boolean }>,
    limit = 20,
  ): Promise<RawGA4Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const accessToken = await this.getAccessToken();

        const body = {
          dimensions: dimensions.map(name => ({ name })),
          metrics: metrics.map(name => ({ name })),
          dateRanges,
          ...(orderBys && { orderBys }),
          limit,
        };

        const response = await fetch(
          `${GA4_API_BASE}/properties/${propertyId}:runReport`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          },
        );

        if (response.status === 429) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`GA4 API error ${response.status}: ${text.slice(0, 400)}`);
        }

        return await response.json() as RawGA4Response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('GA4 report request failed');
  }

  // ---------------------------------------------------------------------------
  // Date range helper
  // ---------------------------------------------------------------------------

  private getDateRange(range: '7d' | '30d'): Array<{ startDate: string; endDate: string }> {
    const days = range === '7d' ? 7 : 30;
    return [{
      startDate: `${days}daysAgo`,
      endDate: 'today',
    }];
  }

  // ---------------------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------------------

  /**
   * Get overall session and engagement metrics.
   */
  async getSessionMetrics(
    propertyId: string,
    dateRange: '7d' | '30d' = '30d',
  ): Promise<GA4SessionMetrics> {
    const report = await this.runReport(
      propertyId,
      [],  // no dimensions — aggregate totals
      ['sessions', 'totalUsers', 'newUsers', 'bounceRate', 'averageSessionDuration', 'screenPageViewsPerSession'],
      this.getDateRange(dateRange),
    );

    const row = report.rows?.[0];
    const vals = row?.metricValues ?? [];

    return {
      sessions: Number(vals[0]?.value ?? 0),
      users: Number(vals[1]?.value ?? 0),
      newUsers: Number(vals[2]?.value ?? 0),
      bounceRate: Number(vals[3]?.value ?? 0),
      sessionDuration: Number(vals[4]?.value ?? 0),
      pagesPerSession: Number(vals[5]?.value ?? 0),
    };
  }

  /**
   * Get conversion events with counts and rates.
   */
  async getConversionEvents(
    propertyId: string,
    dateRange: '7d' | '30d' = '30d',
  ): Promise<GA4ConversionEvent[]> {
    const report = await this.runReport(
      propertyId,
      ['eventName'],
      ['eventCount', 'conversions', 'sessionConversionRate'],
      this.getDateRange(dateRange),
      [{ metric: { metricName: 'conversions' }, desc: true }],
      20,
    );

    return (report.rows ?? []).map((row: RawGA4Row): GA4ConversionEvent => ({
      eventName: row.dimensionValues?.[0]?.value ?? '',
      eventCount: Number(row.metricValues?.[0]?.value ?? 0),
      conversions: Number(row.metricValues?.[1]?.value ?? 0),
      conversionRate: Number(row.metricValues?.[2]?.value ?? 0),
    }));
  }

  /**
   * Get audience overview: countries, devices, user breakdown.
   */
  async getAudienceOverview(
    propertyId: string,
    dateRange: '7d' | '30d' = '30d',
  ): Promise<GA4AudienceOverview> {
    const dateRanges = this.getDateRange(dateRange);

    const [totalsReport, countryReport, deviceReport] = await Promise.all([
      this.runReport(
        propertyId, [],
        ['totalUsers', 'newUsers'],
        dateRanges,
      ),
      this.runReport(
        propertyId,
        ['country'],
        ['totalUsers'],
        dateRanges,
        [{ metric: { metricName: 'totalUsers' }, desc: true }],
        10,
      ),
      this.runReport(
        propertyId,
        ['deviceCategory'],
        ['sessions'],
        dateRanges,
        [{ metric: { metricName: 'sessions' }, desc: true }],
        5,
      ),
    ]);

    const totalsRow = totalsReport.rows?.[0];
    const totalUsers = Number(totalsRow?.metricValues?.[0]?.value ?? 0);
    const newUsers = Number(totalsRow?.metricValues?.[1]?.value ?? 0);

    const topCountries = (countryReport.rows ?? []).map((row: RawGA4Row) => ({
      country: row.dimensionValues?.[0]?.value ?? '',
      users: Number(row.metricValues?.[0]?.value ?? 0),
    }));

    const totalDeviceSessions = (deviceReport.rows ?? []).reduce(
      (sum, row: RawGA4Row) => sum + Number(row.metricValues?.[0]?.value ?? 0),
      0,
    );

    const topDevices = (deviceReport.rows ?? []).map((row: RawGA4Row) => {
      const sessions = Number(row.metricValues?.[0]?.value ?? 0);
      return {
        device: row.dimensionValues?.[0]?.value ?? '',
        sessions,
        percentage: totalDeviceSessions > 0 ? sessions / totalDeviceSessions : 0,
      };
    });

    return {
      totalUsers,
      newUsers,
      returningUsers: totalUsers - newUsers,
      topCountries,
      topDevices,
    };
  }

  /**
   * Get traffic channel breakdown with conversion data.
   */
  async getChannelBreakdown(
    propertyId: string,
    dateRange: '7d' | '30d' = '30d',
  ): Promise<GA4ChannelBreakdown[]> {
    const report = await this.runReport(
      propertyId,
      ['sessionDefaultChannelGrouping'],
      ['sessions', 'totalUsers', 'bounceRate', 'conversions', 'sessionConversionRate'],
      this.getDateRange(dateRange),
      [{ metric: { metricName: 'sessions' }, desc: true }],
      10,
    );

    const totalSessions = (report.rows ?? []).reduce(
      (sum, row: RawGA4Row) => sum + Number(row.metricValues?.[0]?.value ?? 0),
      0,
    );

    return (report.rows ?? []).map((row: RawGA4Row): GA4ChannelBreakdown => {
      const sessions = Number(row.metricValues?.[0]?.value ?? 0);
      return {
        channel: row.dimensionValues?.[0]?.value ?? '',
        sessions,
        users: Number(row.metricValues?.[1]?.value ?? 0),
        bounceRate: Number(row.metricValues?.[2]?.value ?? 0),
        conversions: Number(row.metricValues?.[3]?.value ?? 0),
        conversionRate: Number(row.metricValues?.[4]?.value ?? 0),
        percentage: totalSessions > 0 ? sessions / totalSessions : 0,
      };
    });
  }
}

export function createGA4Client(): GA4Client {
  return new GA4Client();
}
```

### Step 3: Create `src/lib/ai/tools/mcp/ga4-tool.ts`

```typescript
// MCP Tool Wrapper: Google Analytics 4
// betaZodTool wrapping GA4Client for use by Anthropic SDK sub-agents

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { createGA4Client } from '@/lib/ga4/client';

export const ga4Tool = betaZodTool({
  name: 'ga4',
  description:
    'Fetch live traffic and conversion data from Google Analytics 4. ' +
    'Returns session metrics, conversion events, audience demographics, and channel breakdown. ' +
    'Use for understanding actual website traffic patterns and conversion performance.',
  inputSchema: z.object({
    propertyId: z
      .string()
      .optional()
      .describe(
        'GA4 property ID (numeric, e.g. "123456789"). ' +
        'Defaults to GA4_PROPERTY_ID environment variable.',
      ),
    metric: z
      .enum(['sessions', 'conversions', 'audiences', 'channels'])
      .describe(
        'sessions — overall traffic metrics. ' +
        'conversions — conversion event counts and rates. ' +
        'audiences — geographic and device breakdown. ' +
        'channels — traffic source breakdown with conversion rates.',
      ),
    dateRange: z
      .enum(['7d', '30d'])
      .default('30d')
      .describe('Date range for the report.'),
  }),
  run: async ({ propertyId, metric, dateRange }) => {
    try {
      const client = createGA4Client();

      if (!client.isAvailable()) {
        return JSON.stringify({
          available: false,
          error: 'GA4 credentials not configured. Set GA4_SERVICE_ACCOUNT_JSON and GA4_PROPERTY_ID in environment.',
        });
      }

      const effectivePropertyId =
        propertyId || process.env.GA4_PROPERTY_ID || '';

      if (!effectivePropertyId) {
        return JSON.stringify({
          available: false,
          error: 'No property ID provided and GA4_PROPERTY_ID not configured.',
        });
      }

      if (metric === 'sessions') {
        const data = await client.getSessionMetrics(effectivePropertyId, dateRange);
        return JSON.stringify({ available: true, metric: 'sessions', ...data });
      }

      if (metric === 'conversions') {
        const data = await client.getConversionEvents(effectivePropertyId, dateRange);
        return JSON.stringify({ available: true, metric: 'conversions', events: data });
      }

      if (metric === 'audiences') {
        const data = await client.getAudienceOverview(effectivePropertyId, dateRange);
        return JSON.stringify({ available: true, metric: 'audiences', ...data });
      }

      if (metric === 'channels') {
        const data = await client.getChannelBreakdown(effectivePropertyId, dateRange);
        return JSON.stringify({ available: true, metric: 'channels', channels: data });
      }

      return JSON.stringify({ available: false, error: `Unknown metric: ${metric}` });
    } catch (error) {
      return JSON.stringify({
        available: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
```

### Step 4: Create `research-worker/src/tools/ga4.ts`

```typescript
// Research Worker Tool: Google Analytics 4
// betaZodTool for use by Anthropic SDK sub-agents inside the Railway worker

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const GA4_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function base64urlEncode(data: string): string {
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getGA4AccessToken(creds: ServiceAccountCreds): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.accessToken;

  const nowSec = Math.floor(now / 1000);
  const header = base64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64urlEncode(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: creds.token_uri || GOOGLE_TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  }));
  const signingInput = `${header}.${payload}`;

  const pem = creds.private_key.replace(/\\n/g, '\n');
  const keyData = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s/g, '');
  const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64urlEncode(String.fromCharCode(...new Uint8Array(sig)))}`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });

  if (!res.ok) throw new Error(`GA4 token failed: ${res.status}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { accessToken: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return data.access_token;
}

async function ga4Report(
  propertyId: string,
  accessToken: string,
  body: unknown,
): Promise<unknown> {
  const res = await fetch(`${GA4_API_BASE}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GA4 report error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

export const ga4Tool = betaZodTool({
  name: 'ga4',
  description: 'Fetch live traffic and conversion data from Google Analytics 4.',
  inputSchema: z.object({
    propertyId: z.string().optional().describe('GA4 property ID. Defaults to GA4_PROPERTY_ID env var.'),
    metric: z.enum(['sessions', 'conversions', 'audiences', 'channels']),
    dateRange: z.enum(['7d', '30d']).default('30d'),
  }),
  run: async ({ propertyId, metric, dateRange }) => {
    const credJson = process.env.GA4_SERVICE_ACCOUNT_JSON;
    if (!credJson) {
      return JSON.stringify({ available: false, error: 'GA4_SERVICE_ACCOUNT_JSON not configured in worker' });
    }

    const effectivePropertyId = propertyId || process.env.GA4_PROPERTY_ID || '';
    if (!effectivePropertyId) {
      return JSON.stringify({ available: false, error: 'No GA4 property ID available' });
    }

    try {
      const creds = JSON.parse(credJson) as ServiceAccountCreds;
      const accessToken = await getGA4AccessToken(creds);

      const days = dateRange === '7d' ? 7 : 30;
      const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }];

      let body: unknown;

      if (metric === 'sessions') {
        body = {
          metrics: ['sessions', 'totalUsers', 'newUsers', 'bounceRate', 'averageSessionDuration'].map(n => ({ name: n })),
          dateRanges,
        };
      } else if (metric === 'conversions') {
        body = {
          dimensions: [{ name: 'eventName' }],
          metrics: ['eventCount', 'conversions', 'sessionConversionRate'].map(n => ({ name: n })),
          dateRanges,
          orderBys: [{ metric: { metricName: 'conversions' }, desc: true }],
          limit: 10,
        };
      } else if (metric === 'audiences') {
        body = {
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'totalUsers' }],
          dateRanges,
          orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
          limit: 10,
        };
      } else {
        body = {
          dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
          metrics: ['sessions', 'conversions', 'sessionConversionRate'].map(n => ({ name: n })),
          dateRanges,
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10,
        };
      }

      const data = await ga4Report(effectivePropertyId, accessToken, body);
      return JSON.stringify({ available: true, metric, data });
    } catch (error) {
      return JSON.stringify({
        available: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
```

### Step 5: Update `research-worker/src/tools/index.ts`

Replace the full file content with:

```typescript
export { firecrawlTool } from './firecrawl';
export { spyfuTool } from './spyfu';
export { adLibraryTool } from './adlibrary';
export { chartTool } from './chart';
export { pagespeedTool } from './pagespeed';
export { googleAdsTool } from './google-ads';
export { metaAdsTool } from './meta-ads';
export { ga4Tool } from './ga4';
```

### Step 6: Commit

```bash
git commit -m "feat: add GA4 client, betaZodTool wrappers, and update worker tools index"
```

---

## Task 7: Media Planner Runner (Railway Worker)

**Files:**
- Create: `research-worker/src/runners/media-planner.ts`
- Modify: `research-worker/src/runners/index.ts`

### Step 1: Create `research-worker/src/runners/media-planner.ts`

```typescript
// Runner: Media Planner
// Opus sub-agent with access to live platform data (Google Ads, Meta Ads, GA4)
// Runs after synthesizeResearch to produce a channel-specific media plan with
// real account data where available, benchmarks where not.

import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { createClient, runWithBackoff, extractJson } from '../runner';
import { googleAdsTool, metaAdsTool, ga4Tool } from '../tools';
import type { ResearchResult } from '../supabase';

const MEDIA_PLANNER_SYSTEM_PROMPT = `You are a senior paid media planner building an execution-ready media plan.

You have access to live platform data tools — use them to ground recommendations in actual account performance and real audience data.

AVAILABLE TOOLS:
- googleAds: Live Google Ads campaign performance (if credentials configured)
- metaAds: Live Meta Ads Manager performance (if credentials configured)
- ga4: Live Google Analytics 4 traffic and conversion data (if credentials configured)

TOOL USAGE STRATEGY:
1. Try ga4 first (metric: channels) to understand current traffic source mix and conversion rates
2. Try ga4 (metric: sessions) for baseline traffic metrics
3. Try googleAds (dateRange: 30d) to get current Google Ads performance benchmarks
4. Try metaAds (metric: campaigns) for Meta performance benchmarks
5. If a tool returns available: false, skip it and work with industry benchmarks instead

GRACEFUL DEGRADATION:
When live data is unavailable, use the platform benchmarks from the synthesis context and note that recommendations are based on industry benchmarks rather than account data.

MEDIA PLAN OUTPUT REQUIREMENTS:

For each recommended platform:
1. Budget allocation (dollar amount AND percentage)
2. Campaign structure (campaign types, ad group structure, targeting approach)
3. Audience strategy (who to target, how to build the funnel layers)
4. Creative requirements (format, quantity, key message for each layer)
5. Performance benchmarks (expected CTR, CPC, CPL, ROAS based on real data or industry benchmarks)
6. Launch sequence (which campaigns to launch first and why)
7. Optimization schedule (what to review weekly vs monthly)

BUDGET TIER RULES (same as synthesis):
- Under $2k/month: 1 primary platform, 20-30% retargeting only
- $2k-$5k/month: 1 primary + 1 secondary + 1 testing (if each gets $500+)
- $5k-$15k/month: Full multi-platform
- Over $15k/month: Aggressive multi-platform with funnel stage budgets

OUTPUT FORMAT:
Respond with JSON only. No preamble. Start with {.

{
  "dataSourced": {
    "googleAdsConnected": boolean,
    "metaAdsConnected": boolean,
    "ga4Connected": boolean,
    "note": "string — brief note on data sources used"
  },
  "channelPlan": [
    {
      "platform": "string",
      "role": "primary | secondary | testing | retargeting",
      "monthlyBudget": number,
      "budgetPercentage": number,
      "campaignStructure": {
        "campaigns": [
          {
            "name": "string — e.g. 'Brand_Search_Exact'",
            "type": "string — Search | Display | Performance Max | etc.",
            "dailyBudget": number,
            "targeting": "string — targeting approach",
            "bidStrategy": "string"
          }
        ],
        "totalCampaigns": number
      },
      "audienceStrategy": {
        "coldAudiences": ["string — targeting specs"],
        "warmAudiences": ["string — retargeting specs"],
        "lookalikes": ["string — if applicable"]
      },
      "creativeRequirements": {
        "formats": ["string"],
        "quantity": number,
        "keyMessage": "string",
        "cta": "string"
      },
      "expectedPerformance": {
        "ctr": "string e.g. '2.5-4%'",
        "cpc": "string e.g. '$3.50-5.20'",
        "cpl": "string e.g. '$45-70'",
        "roas": "string e.g. '3.2x' or 'N/A'",
        "dataSource": "live_account | industry_benchmark"
      },
      "launchWeek": number,
      "optimizationCadence": "string"
    }
  ],
  "launchSequence": [
    {
      "week": number,
      "actions": ["string"],
      "budget": number,
      "milestone": "string"
    }
  ],
  "creativeCalendar": {
    "week1to2": ["string — creative deliverables"],
    "week3to4": ["string — creative deliverables"],
    "month2": ["string — creative deliverables"]
  },
  "kpiFramework": {
    "northStar": "string — the one KPI that matters most",
    "leadingIndicators": ["string — early signals"],
    "weeklyReview": ["string — what to check weekly"],
    "monthlyReview": ["string — what to check monthly"],
    "goNoGoCriteria": "string — when to scale vs pause"
  },
  "budgetSummary": {
    "totalMonthly": number,
    "byPlatform": [{ "platform": "string", "amount": number, "percentage": number }],
    "contingency": number,
    "note": "string"
  }
}`;

export async function runMediaPlanner(context: string): Promise<ResearchResult> {
  const client = createClient();
  const startTime = Date.now();

  try {
    const finalMsg = await runWithBackoff(
      () => {
        const runner = client.beta.messages.toolRunner({
          model: 'claude-sonnet-4-6',
          max_tokens: 10000,
          tools: [googleAdsTool, metaAdsTool, ga4Tool],
          system: MEDIA_PLANNER_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `Build an execution-ready media plan based on this research context:\n\n${context}`,
          }],
        });
        return Promise.race([
          runner.runUntilDone(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Media planner timed out after 150s')), 150_000),
          ),
        ]);
      },
      'mediaPlanner',
    );

    const textBlock = finalMsg.content.findLast(
      (b: BetaContentBlock) => b.type === 'text',
    );
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';

    let data: unknown;
    try {
      data = extractJson(resultText);
    } catch {
      console.error('[mediaPlanner] JSON extraction failed:', resultText.slice(0, 300));
      data = { summary: resultText };
    }

    return {
      status: 'complete',
      section: 'mediaPlan',
      data,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'error',
      section: 'mediaPlan',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}
```

### Step 2: Update `research-worker/src/runners/index.ts`

Add the new export:

```typescript
export { runResearchIndustry } from './industry';
export { runResearchCompetitors } from './competitors';
export { runResearchICP } from './icp';
export { runResearchOffer } from './offer';
export { runSynthesizeResearch } from './synthesize';
export { runResearchKeywords } from './keywords';
export { runMediaPlanner } from './media-planner';
```

### Step 3: Commit

```bash
git commit -m "feat: add media planner runner with Google Ads, Meta Ads, GA4 sub-agent tools"
```

---

## Task 8: Wire Into Research Pipeline (Lead Agent + Worker)

**Files:**
- Create: `src/lib/ai/tools/research/research-media-plan.ts`
- Modify: `src/lib/ai/tools/research/index.ts`
- Modify: `src/app/api/journey/stream/route.ts`
- Modify: `research-worker/src/index.ts`
- Modify: `src/lib/ai/prompts/lead-agent-system.ts`

### Step 1: Create `src/lib/ai/tools/research/research-media-plan.ts`

Follow the exact same pattern as `research-competitors.ts`:

```typescript
// Research Tool: Media Planner
// Async: dispatches to Railway worker, returns immediately

import { tool } from 'ai';
import { z } from 'zod';
import { dispatchResearch } from './dispatch';

export const researchMediaPlan = tool({
  description:
    'Build an execution-ready media plan using live platform data from Google Ads, Meta Ads, and Google Analytics. ' +
    'Generates channel-specific campaign structures, budget allocations, audience strategies, and performance benchmarks. ' +
    'ONLY call this after synthesizeResearch AND researchKeywords have both completed. ' +
    'Pass the full synthesis output and keyword intel in the context parameter.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Full context including onboarding fields, synthesis findings, keyword intel, and any platform credentials context',
      ),
  }),
  execute: async ({ context }) => {
    return dispatchResearch('researchMediaPlan', 'mediaPlan', context);
  },
});
```

### Step 2: Update `src/lib/ai/tools/research/index.ts`

Add the new export:

```typescript
export { researchIndustry } from './research-industry';
export { researchCompetitors } from './research-competitors';
export { researchICP } from './research-icp';
export { researchOffer } from './research-offer';
export { synthesizeResearch } from './synthesize-research';
export { researchKeywords } from './research-keywords';
export { researchMediaPlan } from './research-media-plan';
```

### Step 3: Update `src/app/api/journey/stream/route.ts`

Add `researchMediaPlan` to the imports and the tools array.

Find the research tools import block:

```typescript
import {
  researchIndustry,
  researchCompetitors,
  researchICP,
  researchOffer,
  synthesizeResearch,
  researchKeywords,
} from '@/lib/ai/tools/research';
```

Replace with:

```typescript
import {
  researchIndustry,
  researchCompetitors,
  researchICP,
  researchOffer,
  synthesizeResearch,
  researchKeywords,
  researchMediaPlan,
} from '@/lib/ai/tools/research';
```

Find where the tools object is passed to `streamText`. It will look like:

```typescript
tools: {
  askUser,
  competitorFastHits,
  researchIndustry,
  researchCompetitors,
  researchICP,
  researchOffer,
  synthesizeResearch,
  researchKeywords,
},
```

Add `researchMediaPlan` to the tools object:

```typescript
tools: {
  askUser,
  competitorFastHits,
  researchIndustry,
  researchCompetitors,
  researchICP,
  researchOffer,
  synthesizeResearch,
  researchKeywords,
  researchMediaPlan,
},
```

### Step 4: Update `research-worker/src/index.ts`

Add `researchMediaPlan` to the `ToolName` union type and `TOOL_RUNNERS`:

Find the `ToolName` type:

```typescript
type ToolName =
  | 'researchIndustry'
  | 'researchCompetitors'
  | 'researchICP'
  | 'researchOffer'
  | 'synthesizeResearch'
  | 'researchKeywords';
```

Replace with:

```typescript
type ToolName =
  | 'researchIndustry'
  | 'researchCompetitors'
  | 'researchICP'
  | 'researchOffer'
  | 'synthesizeResearch'
  | 'researchKeywords'
  | 'researchMediaPlan';
```

Find the import at the top:

```typescript
import {
  runResearchIndustry,
  runResearchCompetitors,
  runResearchICP,
  runResearchOffer,
  runSynthesizeResearch,
  runResearchKeywords,
} from './runners';
```

Replace with:

```typescript
import {
  runResearchIndustry,
  runResearchCompetitors,
  runResearchICP,
  runResearchOffer,
  runSynthesizeResearch,
  runResearchKeywords,
  runMediaPlanner,
} from './runners';
```

Find the `TOOL_RUNNERS` object:

```typescript
const TOOL_RUNNERS: Record<ToolName, (context: string) => Promise<ResearchResult>> = {
  researchIndustry: runResearchIndustry,
  researchCompetitors: runResearchCompetitors,
  researchICP: runResearchICP,
  researchOffer: runResearchOffer,
  synthesizeResearch: runSynthesizeResearch,
  researchKeywords: runResearchKeywords,
};
```

Replace with:

```typescript
const TOOL_RUNNERS: Record<ToolName, (context: string) => Promise<ResearchResult>> = {
  researchIndustry: runResearchIndustry,
  researchCompetitors: runResearchCompetitors,
  researchICP: runResearchICP,
  researchOffer: runResearchOffer,
  synthesizeResearch: runSynthesizeResearch,
  researchKeywords: runResearchKeywords,
  researchMediaPlan: runMediaPlanner,
};
```

### Step 5: Update `src/lib/ai/prompts/lead-agent-system.ts`

In `LEAD_AGENT_SYSTEM_PROMPT`, find the "Tools and Trigger Thresholds" section and add the new tool:

After the line describing `researchKeywords`:

```
- `researchKeywords` — paid search keyword intelligence, competitor keyword gaps, quick-win opportunities. **Trigger**: synthesizeResearch completed. Pass business description, competitor names, and platform recommendations from synthesis as context.
```

Add:

```
- `researchMediaPlan` — execution-ready media plan with channel budgets, campaign structures, and performance benchmarks using live platform data where available. **Trigger**: researchKeywords completed. Pass synthesis output, keyword intel, and any known platform credentials (customer ID, account ID) in context.
```

In the "Execution Order" section, update the sequence from:

```
Run sections in this order when triggers are met: researchIndustry → researchCompetitors → researchICP → researchOffer → synthesizeResearch → researchKeywords.
```

To:

```
Run sections in this order when triggers are met: researchIndustry → researchCompetitors → researchICP → researchOffer → synthesizeResearch → researchKeywords → researchMediaPlan.
```

Also add `researchMediaPlan` to the completion check rule that reads:

```
If all 8 fields are collected but some research tools haven't been called yet, call the remaining tools before the confirmation flow.
```

This rule already covers the new tool — no change needed, as it refers to "remaining tools."

Update the Stage 3 strategist mode trigger in the system prompt. Find:

```
After **synthesizeResearch** completes — including any charts it generates — you enter Strategist Mode:
```

Replace with:

```
After **researchMediaPlan** completes (the final research step), you enter Strategist Mode:
```

### Step 6: Commit

```bash
git commit -m "feat: wire researchMediaPlan into lead agent and worker dispatch table"
```

---

## Task 9: Verification

**Files:** None (testing only)

### Step 1: TypeScript build check

```bash
npm run build
```

Fix any type errors before proceeding. Common issues to watch for:
- `betaZodTool` import path changes between SDK versions — check `@anthropic-ai/sdk/helpers/beta/zod` is still valid
- `crypto.subtle` availability — Node.js 18+ required (Vercel uses Node 20 by default)
- GA4 JWT signing — `atob`/`btoa` are available globally in Node 18+

### Step 2: Research worker build check

```bash
cd research-worker && npx tsc --noEmit
```

Fix any type errors in the worker TypeScript files.

### Step 3: Lint

```bash
npm run lint
```

### Step 4: Environment check

Confirm the new optional vars appear in the env validation output (development mode logs them):

```bash
NODE_ENV=development node -e "require('./src/lib/env.ts')" 2>&1 | grep -i "GA4\|META\|GOOGLE_ADS"
```

If no credentials are configured, you should see the info-level log lines for each new env var.

### Step 5: Worker integration smoke test (if worker is running)

With the research worker running locally (`cd research-worker && npm run dev`):

```bash
# Test that the new tool is accepted by the dispatch endpoint
curl -s -X POST http://localhost:3001/run \
  -H "Content-Type: application/json" \
  -d '{"tool":"researchMediaPlan","context":"Test context","userId":"test-user","jobId":"test-job-1"}' \
  | jq .
```

Expected: `{"status":"accepted","jobId":"test-job-1"}` (202 response)

### Step 6: Final commit

```bash
git commit -m "feat: Phase 2 platform integrations complete — Google Ads, Meta Ads, GA4 clients + media planner sub-agent"
```

---

## Summary: What Gets Built

| Layer | File | Purpose |
|-------|------|---------|
| Types | `src/lib/google-ads/types.ts` | TypeScript interfaces for Google Ads API responses |
| Types | `src/lib/meta-ads/types.ts` | TypeScript interfaces for Meta API responses |
| Types | `src/lib/ga4/types.ts` | TypeScript interfaces for GA4 Data API responses |
| API Client | `src/lib/google-ads/client.ts` | Google Ads REST client with OAuth2, retry, GAQL execution |
| API Client | `src/lib/meta-ads/client.ts` | Meta Marketing API v21 client with retry |
| API Client | `src/lib/ga4/client.ts` | GA4 Data API client with service account JWT auth |
| Next.js Tool | `src/lib/ai/tools/mcp/google-ads-tool.ts` | betaZodTool for Next.js side sub-agents |
| Next.js Tool | `src/lib/ai/tools/mcp/meta-ads-tool.ts` | betaZodTool for Next.js side sub-agents |
| Next.js Tool | `src/lib/ai/tools/mcp/ga4-tool.ts` | betaZodTool for Next.js side sub-agents |
| Worker Tool | `research-worker/src/tools/google-ads.ts` | betaZodTool for Railway worker sub-agents |
| Worker Tool | `research-worker/src/tools/meta-ads.ts` | betaZodTool for Railway worker sub-agents |
| Worker Tool | `research-worker/src/tools/ga4.ts` | betaZodTool for Railway worker sub-agents |
| Worker Runner | `research-worker/src/runners/media-planner.ts` | Opus sub-agent with all 3 platform tools |
| Lead Agent Tool | `src/lib/ai/tools/research/research-media-plan.ts` | Dispatch wrapper (same pattern as others) |
| Modified | `research-worker/src/tools/index.ts` | Add 3 new tool exports |
| Modified | `research-worker/src/runners/index.ts` | Add media planner runner export |
| Modified | `research-worker/src/index.ts` | Add `researchMediaPlan` to ToolName union + TOOL_RUNNERS |
| Modified | `src/lib/ai/tools/research/index.ts` | Add `researchMediaPlan` export |
| Modified | `src/app/api/journey/stream/route.ts` | Add `researchMediaPlan` to tools object |
| Modified | `src/lib/ai/prompts/lead-agent-system.ts` | Add trigger rule + execution order + strategist mode trigger |
| Modified | `src/lib/env.ts` | Add 9 new optional env vars |

## Graceful Degradation Contract

Every new platform integration degrades gracefully when credentials are absent:
- API clients expose `isAvailable()` — false when env vars missing
- betaZodTool wrappers return `{ available: false, error: "..." }` JSON rather than throwing
- Sub-agent system prompt instructs the model to fall back to industry benchmarks when tools return `available: false`
- New env vars are all `OPTIONAL_ENV_VARS.server` — they do not block app startup
