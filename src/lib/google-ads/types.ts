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
    status?: string;
    keyword?: {
      text?: string;
      matchType?: string;
    };
    qualityInfo?: {
      qualityScore?: number;
    };
  };
}
