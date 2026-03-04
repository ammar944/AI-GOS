import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { createSign } from 'crypto';

const GA4_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getGA4Token(credentials: ServiceAccountCredentials): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: credentials.token_uri || 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  );

  const signingInput = `${header}.${claimSet}`;
  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign
    .sign(credentials.private_key, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(`GA4 token: ${res.status} ${await res.text()}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export const ga4Tool = betaZodTool({
  name: 'googleAnalytics4',
  description:
    'Fetch website traffic and audience data from Google Analytics 4. Returns session metrics, channel breakdown, and audience demographics.',
  inputSchema: z.object({
    dateRange: z
      .enum(['7d', '30d', '90d'])
      .default('30d')
      .describe('Date range for analytics data.'),
    focus: z
      .enum(['sessions', 'audience', 'channels'])
      .default('channels')
      .describe('Which report to fetch.'),
  }),
  run: async ({ dateRange, focus }) => {
    try {
      const propertyId = process.env.GA4_PROPERTY_ID;
      const credJson = process.env.GA4_SERVICE_ACCOUNT_JSON;

      if (!propertyId || !credJson) {
        return JSON.stringify({
          available: false,
          error: 'GA4 credentials not configured. Set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON.',
        });
      }

      const credentials = JSON.parse(credJson) as ServiceAccountCredentials;
      const token = await getGA4Token(credentials);

      const daysMap = { '7d': '7daysAgo', '30d': '30daysAgo', '90d': '90daysAgo' };
      const startDate = daysMap[dateRange];

      let reportBody: Record<string, unknown>;

      if (focus === 'sessions') {
        reportBody = {
          dateRanges: [{ startDate, endDate: 'today' }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'newUsers' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
          ],
        };
      } else if (focus === 'audience') {
        reportBody = {
          dateRanges: [{ startDate, endDate: 'today' }],
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'totalUsers' }],
          orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
          limit: 10,
        };
      } else {
        reportBody = {
          dateRanges: [{ startDate, endDate: 'today' }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'bounceRate' }, { name: 'conversions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        };
      }

      const res = await fetch(
        `${GA4_API_BASE}/properties/${propertyId}:runReport`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(reportBody),
        },
      );

      if (!res.ok) throw new Error(`GA4 API ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return JSON.stringify({ available: true, focus, dateRange, data });
    } catch (error) {
      return JSON.stringify({
        available: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
