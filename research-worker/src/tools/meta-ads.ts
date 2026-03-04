import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

function toNumber(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  return Number(val);
}

function getConversionCount(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;
  const conversionTypes = ['purchase', 'lead', 'complete_registration', 'offsite_conversion.fb_pixel_purchase'];
  return actions
    .filter((a) => conversionTypes.some((t) => a.action_type.includes(t)))
    .reduce((sum, a) => sum + toNumber(a.value), 0);
}

async function metaGet(path: string, params: Record<string, string>): Promise<unknown> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const businessAccountId = process.env.META_BUSINESS_ACCOUNT_ID;
  if (!accessToken || !businessAccountId) {
    throw new Error('META_ACCESS_TOKEN or META_BUSINESS_ACCOUNT_ID not configured');
  }
  const url = new URL(`${META_API_BASE}${path}`);
  url.searchParams.set('access_token', accessToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Meta API ${res.status}: ${await res.text()}`);
  return res.json();
}

export const metaAdsTool = betaZodTool({
  name: 'metaAds',
  description:
    'Fetch campaign performance data from a Meta Ads Manager account. Returns spend, impressions, clicks, CTR, CPM, and conversions by campaign. Use for understanding paid social performance on Facebook and Instagram.',
  inputSchema: z.object({
    dateRange: z
      .enum(['7d', '30d', '90d'])
      .default('30d')
      .describe('Date range for performance metrics.'),
  }),
  run: async ({ dateRange }) => {
    try {
      const businessAccountId = process.env.META_BUSINESS_ACCOUNT_ID;
      if (!businessAccountId) {
        return JSON.stringify({
          available: false,
          error: 'Meta Ads credentials not configured. Set META_ACCESS_TOKEN and META_BUSINESS_ACCOUNT_ID.',
        });
      }

      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const days = daysMap[dateRange];
      const today = new Date();
      const since = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
      const timeRange = JSON.stringify({
        since: since.toISOString().split('T')[0],
        until: today.toISOString().split('T')[0],
      });

      const accountId = `act_${businessAccountId}`;
      const data = await metaGet(`/${accountId}/insights`, {
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,reach,cpm,cpc,ctr,actions,objective',
        time_range: timeRange,
        level: 'campaign',
        limit: '10',
      }) as { data?: Array<Record<string, unknown>> };

      const campaigns = (data.data ?? []).map((row) => ({
        name: row.campaign_name,
        spend: toNumber(row.spend as string),
        impressions: toNumber(row.impressions as string),
        clicks: toNumber(row.clicks as string),
        cpm: toNumber(row.cpm as string),
        cpc: toNumber(row.cpc as string),
        ctr: toNumber(row.ctr as string),
        conversions: getConversionCount(row.actions as Array<{ action_type: string; value: string }>),
        objective: row.objective,
      }));

      return JSON.stringify({ available: true, dateRange, campaigns });
    } catch (error) {
      return JSON.stringify({
        available: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
