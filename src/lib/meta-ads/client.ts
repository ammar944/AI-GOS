// Meta Marketing API Client
// Meta Marketing API v21 with long-lived access token
// Docs: https://developers.facebook.com/docs/marketing-api

import { getEnv } from '@/lib/env';
import type {
  MetaCampaign,
  MetaCreativePerformance,
  MetaInsightsSummary,
  RawMetaInsight,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;

// =============================================================================
// Helpers
// =============================================================================

function toNumber(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  return Number(val);
}

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

function getConversionCount(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;
  const conversionTypes = ['purchase', 'lead', 'complete_registration', 'offsite_conversion.fb_pixel_purchase'];
  const conversions = actions.filter((a) => conversionTypes.some((t) => a.action_type.includes(t)));
  return conversions.reduce((sum, a) => sum + toNumber(a.value), 0);
}

// =============================================================================
// Meta Ads Client
// =============================================================================

/**
 * Meta Marketing API client using a long-lived system user access token.
 *
 * Graceful degradation: if credentials are missing, all methods return
 * empty/error results without throwing. Check isAvailable() first.
 */
export class MetaAdsClient {
  private readonly accessToken: string | undefined;
  private readonly businessAccountId: string | undefined;

  constructor() {
    this.accessToken = getEnv('META_ACCESS_TOKEN');
    this.businessAccountId = getEnv('META_BUSINESS_ACCOUNT_ID');
  }

  isAvailable(): boolean {
    return !!(this.accessToken && this.businessAccountId);
  }

  // ---------------------------------------------------------------------------
  // Request Helper with Retry
  // ---------------------------------------------------------------------------

  private async request<T>(
    path: string,
    params: Record<string, string> = {},
    retries = MAX_RETRIES,
  ): Promise<T> {
    const url = new URL(`${META_API_BASE}${path}`);
    url.searchParams.set('access_token', this.accessToken!);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url.toString());

    if (!res.ok) {
      const body = await res.text();
      const error = new Error(`Meta API ${res.status}: ${body}`);
      if (retries > 0 && isTransient(error)) {
        const delay = INITIAL_RETRY_DELAY_MS * (MAX_RETRIES - retries + 1);
        await new Promise((r) => setTimeout(r, delay));
        return this.request<T>(path, params, retries - 1);
      }
      throw error;
    }

    return res.json() as Promise<T>;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async getInsightsSummary(
    dateRange: '7d' | '30d' | '90d' = '30d',
  ): Promise<MetaInsightsSummary> {
    const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[dateRange];

    const today = new Date();
    const since = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    const timeRange = JSON.stringify({
      since: since.toISOString().split('T')[0],
      until: today.toISOString().split('T')[0],
    });

    const accountId = `act_${this.businessAccountId}`;

    const [insightsRes, adsRes] = await Promise.all([
      this.request<{ data: RawMetaInsight[] }>(`/${accountId}/insights`, {
        fields:
          'campaign_id,campaign_name,spend,impressions,clicks,reach,cpm,cpc,ctr,actions,action_values,objective',
        time_range: timeRange,
        level: 'campaign',
        limit: '10',
      }),
      this.request<{ data: Array<{ id?: string; name?: string; creative?: { thumbnail_url?: string }; campaign?: { name?: string }; insights?: { data?: RawMetaInsight[] } }> }>(
        `/${accountId}/ads`,
        {
          fields: 'id,name,creative{thumbnail_url},campaign{name},insights{spend,impressions,clicks,ctr,actions}',
          limit: '20',
        },
      ),
    ]);

    const rawInsights = insightsRes.data ?? [];
    const rawAds = adsRes.data ?? [];

    const topCampaigns: MetaCampaign[] = rawInsights.map((row) => ({
      id: row.campaign_id ?? '',
      name: row.campaign_name ?? '',
      status: row.status ?? '',
      objective: row.objective ?? '',
      spend: toNumber(row.spend),
      impressions: toNumber(row.impressions),
      clicks: toNumber(row.clicks),
      reach: toNumber(row.reach),
      cpm: toNumber(row.cpm),
      cpc: toNumber(row.cpc),
      ctr: toNumber(row.ctr),
      conversions: getConversionCount(row.actions),
    }));

    const topCreatives: MetaCreativePerformance[] = rawAds
      .filter((ad) => ad.insights?.data?.length)
      .map((ad) => {
        const insight = ad.insights!.data![0];
        return {
          adId: ad.id ?? '',
          adName: ad.name ?? '',
          campaignName: ad.campaign?.name ?? '',
          format: 'image',
          spend: toNumber(insight.spend),
          impressions: toNumber(insight.impressions),
          clicks: toNumber(insight.clicks),
          ctr: toNumber(insight.ctr),
          conversions: getConversionCount(insight.actions),
          thumbnailUrl: ad.creative?.thumbnail_url,
        };
      });

    const totalSpend = topCampaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalImpressions = topCampaigns.reduce((sum, c) => sum + c.impressions, 0);
    const totalClicks = topCampaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalConversions = topCampaigns.reduce((sum, c) => sum + c.conversions, 0);

    return {
      accountId: this.businessAccountId!,
      dateRange,
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      averageCpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
      averageCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      averageCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      topCampaigns,
      topCreatives,
    };
  }
}

let _instance: MetaAdsClient | null = null;

export function createMetaAdsClient(): MetaAdsClient {
  if (!_instance) {
    _instance = new MetaAdsClient();
  }
  return _instance;
}
