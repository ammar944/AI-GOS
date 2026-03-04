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
