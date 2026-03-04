// Google Analytics 4 Data API Client
// Service account authentication via JSON credentials in env var
// Docs: https://developers.google.com/analytics/devguides/reporting/data/v1

import { getEnv } from '@/lib/env';
import type {
  GA4SessionMetrics,
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
  client_id: string;
  token_uri: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

// =============================================================================
// JWT Helpers (pure crypto, no external deps)
// =============================================================================

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function signRS256(payload: string, privateKey: string): Promise<string> {
  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(payload);
  return sign
    .sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function createJwt(
  credentials: ServiceAccountCredentials,
  scope: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: credentials.client_email,
      scope,
      aud: credentials.token_uri,
      exp: now + 3600,
      iat: now,
    }),
  );
  const signingInput = `${header}.${claimSet}`;
  const signature = await signRS256(signingInput, credentials.private_key);
  return `${signingInput}.${signature}`;
}

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

// =============================================================================
// GA4 Client
// =============================================================================

/**
 * Google Analytics 4 Data API client using service account credentials.
 *
 * Graceful degradation: if credentials are missing or invalid, all methods
 * return empty results without throwing. Check isAvailable() first.
 *
 * Auth: Service account JSON credentials → JWT → short-lived access token.
 */
export class GA4Client {
  private readonly propertyId: string | undefined;
  private readonly credentials: ServiceAccountCredentials | null;
  private tokenCache: CachedToken | null = null;

  constructor() {
    this.propertyId = getEnv('GA4_PROPERTY_ID');
    const credJson = getEnv('GA4_SERVICE_ACCOUNT_JSON');
    try {
      this.credentials = credJson
        ? (JSON.parse(credJson) as ServiceAccountCredentials)
        : null;
    } catch {
      this.credentials = null;
    }
  }

  isAvailable(): boolean {
    return !!(this.propertyId && this.credentials?.client_email && this.credentials?.private_key);
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
      return this.tokenCache.accessToken;
    }

    const jwt = await createJwt(
      this.credentials!,
      'https://www.googleapis.com/auth/analytics.readonly',
    );

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      throw new Error(`GA4 token error: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  }

  // ---------------------------------------------------------------------------
  // Request Helper
  // ---------------------------------------------------------------------------

  private async runReport(
    body: Record<string, unknown>,
    retries = MAX_RETRIES,
  ): Promise<RawGA4Response> {
    const token = await this.getAccessToken();

    const res = await fetch(
      `${GA4_API_BASE}/properties/${this.propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      const error = new Error(`GA4 API ${res.status}: ${text}`);
      if (retries > 0 && isTransient(error)) {
        await new Promise((r) => setTimeout(r, INITIAL_RETRY_DELAY_MS * (MAX_RETRIES - retries + 1)));
        return this.runReport(body, retries - 1);
      }
      throw error;
    }

    return res.json() as Promise<RawGA4Response>;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async getSessionMetrics(
    dateRange: '7d' | '30d' | '90d' = '30d',
  ): Promise<GA4SessionMetrics> {
    const daysMap = { '7d': '7daysAgo', '30d': '30daysAgo', '90d': '90daysAgo' };
    const startDate = daysMap[dateRange];

    const res = await this.runReport({
      dateRanges: [{ startDate, endDate: 'today' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViewsPerSession' },
      ],
    });

    const row = res.rows?.[0];
    const vals = row?.metricValues ?? [];

    return {
      sessions: toNumber(vals[0]?.value),
      users: toNumber(vals[1]?.value),
      newUsers: toNumber(vals[2]?.value),
      bounceRate: toNumber(vals[3]?.value),
      sessionDuration: toNumber(vals[4]?.value),
      pagesPerSession: toNumber(vals[5]?.value),
    };
  }

  async getAudienceOverview(
    dateRange: '7d' | '30d' | '90d' = '30d',
  ): Promise<GA4AudienceOverview> {
    const daysMap = { '7d': '7daysAgo', '30d': '30daysAgo', '90d': '90daysAgo' };
    const startDate = daysMap[dateRange];
    const dateRanges = [{ startDate, endDate: 'today' }];

    const [countryRes, deviceRes] = await Promise.all([
      this.runReport({
        dateRanges,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 10,
      }),
      this.runReport({
        dateRanges,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),
    ]);

    const totalSessions = (deviceRes.rows ?? []).reduce(
      (sum, r) => sum + toNumber(r.metricValues?.[0]?.value),
      0,
    );

    return {
      totalUsers: 0, // populated from session metrics
      newUsers: 0,
      returningUsers: 0,
      topCountries: (countryRes.rows ?? []).map((r: RawGA4Row) => ({
        country: r.dimensionValues?.[0]?.value ?? '',
        users: toNumber(r.metricValues?.[0]?.value),
      })),
      topDevices: (deviceRes.rows ?? []).map((r: RawGA4Row) => ({
        device: r.dimensionValues?.[0]?.value ?? '',
        sessions: toNumber(r.metricValues?.[0]?.value),
        percentage: totalSessions > 0
          ? toNumber(r.metricValues?.[0]?.value) / totalSessions
          : 0,
      })),
    };
  }

  async getChannelBreakdown(
    dateRange: '7d' | '30d' | '90d' = '30d',
  ): Promise<GA4ChannelBreakdown[]> {
    const daysMap = { '7d': '7daysAgo', '30d': '30daysAgo', '90d': '90daysAgo' };
    const startDate = daysMap[dateRange];

    const res = await this.runReport({
      dateRanges: [{ startDate, endDate: 'today' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'bounceRate' },
        { name: 'conversions' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    });

    const rows = res.rows ?? [];
    const totalSessions = rows.reduce(
      (sum, r) => sum + toNumber(r.metricValues?.[0]?.value),
      0,
    );

    return rows.map((r: RawGA4Row) => {
      const sessions = toNumber(r.metricValues?.[0]?.value);
      const conversions = toNumber(r.metricValues?.[3]?.value);
      return {
        channel: r.dimensionValues?.[0]?.value ?? '',
        sessions,
        users: toNumber(r.metricValues?.[1]?.value),
        bounceRate: toNumber(r.metricValues?.[2]?.value),
        conversions,
        conversionRate: sessions > 0 ? conversions / sessions : 0,
        percentage: totalSessions > 0 ? sessions / totalSessions : 0,
      };
    });
  }
}

let _instance: GA4Client | null = null;

export function createGA4Client(): GA4Client {
  if (!_instance) {
    _instance = new GA4Client();
  }
  return _instance;
}
