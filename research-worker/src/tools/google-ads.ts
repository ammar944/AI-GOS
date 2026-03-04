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
