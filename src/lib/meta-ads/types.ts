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
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
}

export interface RawMetaAd {
  id?: string;
  name?: string;
  creative?: {
    thumbnail_url?: string;
  };
}
