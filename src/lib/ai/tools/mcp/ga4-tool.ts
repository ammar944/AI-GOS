// MCP Tool Wrapper: Google Analytics 4
// betaZodTool wrapping GA4Client for use by Anthropic SDK sub-agents

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { createGA4Client } from '@/lib/ga4/client';

export const ga4Tool = betaZodTool({
  name: 'googleAnalytics4',
  description:
    'Fetch website traffic and audience data from Google Analytics 4. ' +
    'Returns session metrics, channel breakdown (organic, paid, social, direct), ' +
    'audience demographics, and device distribution. ' +
    'Use for understanding traffic quality and identifying high-value audience segments.',
  inputSchema: z.object({
    dateRange: z
      .enum(['7d', '30d', '90d'])
      .default('30d')
      .describe('Date range for analytics data.'),
    focus: z
      .enum(['sessions', 'audience', 'channels'])
      .default('channels')
      .describe(
        'Which report to fetch: sessions (KPIs), audience (demographics), or channels (traffic source breakdown).',
      ),
  }),
  run: async ({ dateRange, focus }) => {
    try {
      const client = createGA4Client();

      if (!client.isAvailable()) {
        return JSON.stringify({
          available: false,
          error:
            'GA4 credentials not configured. Set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON in environment.',
        });
      }

      if (focus === 'sessions') {
        const metrics = await client.getSessionMetrics(dateRange);
        return JSON.stringify({ available: true, focus, dateRange, metrics });
      }

      if (focus === 'audience') {
        const audience = await client.getAudienceOverview(dateRange);
        return JSON.stringify({ available: true, focus, dateRange, audience });
      }

      // channels (default)
      const channels = await client.getChannelBreakdown(dateRange);
      return JSON.stringify({ available: true, focus, dateRange, channels });
    } catch (error) {
      return JSON.stringify({
        available: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
