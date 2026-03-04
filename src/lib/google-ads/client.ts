// Google Ads API Client
// REST API v18 with OAuth2 service account credentials
// Docs: https://developers.google.com/google-ads/api/rest/reference/rest

import { getEnv } from '@/lib/env';
import type {
  GoogleAdsCampaign,
  GoogleAdsKeyword,
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
  private tokenCache: CachedToken | null = null;

  constructor() {
    this.developerToken = getEnv('GOOGLE_ADS_DEVELOPER_TOKEN');
    this.clientId = getEnv('GOOGLE_ADS_CLIENT_ID');
    this.clientSecret = getEnv('GOOGLE_ADS_CLIENT_SECRET');
    this.refreshToken = getEnv('GOOGLE_ADS_REFRESH_TOKEN');
    this.defaultCustomerId = getEnv('GOOGLE_ADS_CUSTOMER_ID');
  }

  /** Returns true only if all required credentials are present */
  isAvailable(): boolean {
    return !!(
      this.developerToken &&
      this.clientId &&
      this.clientSecret &&
      this.refreshToken
    );
  }

  // ---------------------------------------------------------------------------
  // OAuth2 Token Management
  // ---------------------------------------------------------------------------

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.accessToken;
    }

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        refresh_token: this.refreshToken!,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google OAuth2 token refresh failed: ${res.status} ${body}`);
    }

    const data = (await res.json()) as TokenResponse;
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  // ---------------------------------------------------------------------------
  // Request Helper with Retry
  // ---------------------------------------------------------------------------

  private async request<T>(
    path: string,
    options: RequestInit = {},
    retries = MAX_RETRIES,
  ): Promise<T> {
    const accessToken = await this.getAccessToken();

    const res = await fetch(`${GOOGLE_ADS_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'developer-token': this.developerToken!,
        ...(options.headers ?? {}),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      const error = new Error(`Google Ads API ${res.status}: ${body}`);
      if (retries > 0 && isTransient(error)) {
        const delay = INITIAL_RETRY_DELAY_MS * (MAX_RETRIES - retries + 1);
        await new Promise((r) => setTimeout(r, delay));
        return this.request<T>(path, options, retries - 1);
      }
      throw error;
    }

    return res.json() as Promise<T>;
  }

  // ---------------------------------------------------------------------------
  // GAQL Query Helper
  // ---------------------------------------------------------------------------

  private async runGaql(
    customerId: string,
    query: string,
  ): Promise<{ results: RawGaqlRow[] }> {
    return this.request<{ results: RawGaqlRow[] }>(
      `/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        body: JSON.stringify({ query }),
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get a comprehensive performance summary for the specified customer.
   * Returns top campaigns by spend and top keywords by spend.
   */
  async getPerformanceSummary(
    customerId?: string,
    dateRange: '7d' | '30d' | '90d' = '30d',
  ): Promise<GoogleAdsPerformanceSummary> {
    const cid = customerId ?? this.defaultCustomerId;
    if (!cid) {
      throw new Error('No Google Ads customer ID provided');
    }

    const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[dateRange];
    const dateCondition = `segments.date DURING LAST_${days}_DAYS`;

    const campaignQuery = `
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
      WHERE ${dateCondition}
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 5
    `;

    const keywordQuery = `
      SELECT
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        campaign.name,
        ad_group.name,
        ad_group_criterion.status,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc,
        ad_group_criterion.quality_info.quality_score
      FROM keyword_view
      WHERE ${dateCondition}
        AND ad_group_criterion.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 20
    `;

    const [campaignRes, keywordRes] = await Promise.all([
      this.runGaql(cid, campaignQuery),
      this.runGaql(cid, keywordQuery),
    ]);

    const topCampaigns: GoogleAdsCampaign[] = (campaignRes.results ?? []).map(
      (row) => ({
        id: row.campaign?.id ?? '',
        name: row.campaign?.name ?? '',
        status: row.campaign?.status ?? '',
        advertisingChannelType: row.campaign?.advertisingChannelType ?? '',
        biddingStrategyType: row.campaign?.biddingStrategyType ?? '',
        budgetAmountMicros: toNumber(row.campaignBudget?.amountMicros),
        metrics: {
          impressions: toNumber(row.metrics?.impressions),
          clicks: toNumber(row.metrics?.clicks),
          cost: toNumber(row.metrics?.costMicros),
          conversions: toNumber(row.metrics?.conversions),
          ctr: toNumber(row.metrics?.ctr),
          averageCpc: toNumber(row.metrics?.averageCpc),
        },
      }),
    );

    const topKeywords: GoogleAdsKeyword[] = (keywordRes.results ?? []).map(
      (row) => ({
        keyword: row.adGroupCriterion?.keyword?.text ?? '',
        matchType: (row.adGroupCriterion?.keyword?.matchType ?? 'BROAD') as
          | 'EXACT'
          | 'PHRASE'
          | 'BROAD',
        campaignName: row.campaign?.name ?? '',
        adGroupName: row.adGroup?.name ?? '',
        status: row.adGroupCriterion?.status ?? '',
        metrics: {
          impressions: toNumber(row.metrics?.impressions),
          clicks: toNumber(row.metrics?.clicks),
          cost: toNumber(row.metrics?.costMicros),
          conversions: toNumber(row.metrics?.conversions),
          ctr: toNumber(row.metrics?.ctr),
          averageCpc: toNumber(row.metrics?.averageCpc),
          qualityScore: row.adGroupCriterion?.qualityInfo?.qualityScore,
        },
      }),
    );

    // Aggregate totals from campaign results
    const totalSpendMicros = topCampaigns.reduce(
      (sum, c) => sum + c.metrics.cost,
      0,
    );
    const totalClicks = topCampaigns.reduce(
      (sum, c) => sum + c.metrics.clicks,
      0,
    );
    const totalImpressions = topCampaigns.reduce(
      (sum, c) => sum + c.metrics.impressions,
      0,
    );
    const totalConversions = topCampaigns.reduce(
      (sum, c) => sum + c.metrics.conversions,
      0,
    );

    return {
      customerId: cid,
      dateRange,
      totalSpend: microsToUsd(totalSpendMicros),
      totalClicks,
      totalImpressions,
      totalConversions,
      averageCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      averageCpc: totalClicks > 0 ? microsToUsd(totalSpendMicros) / totalClicks : 0,
      topCampaigns,
      topKeywords,
    };
  }
}

// Singleton factory — avoids re-reading env vars on every call
let _instance: GoogleAdsClient | null = null;

export function createGoogleAdsClient(): GoogleAdsClient {
  if (!_instance) {
    _instance = new GoogleAdsClient();
  }
  return _instance;
}
