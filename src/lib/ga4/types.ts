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
