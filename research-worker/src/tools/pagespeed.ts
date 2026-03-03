import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

export const pagespeedTool = betaZodTool({
  name: 'pagespeed',
  description: 'Get PageSpeed performance score and Core Web Vitals metrics for a URL.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to analyze'),
  }),
  run: async ({ url }) => {
    try {
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=desktop`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        return JSON.stringify({ score: undefined, error: `PageSpeed API error: ${response.status}` });
      }
      const data = await response.json() as Record<string, unknown>;
      const lr = data.lighthouseResult as { categories?: { performance?: { score?: number } }; audits?: Record<string, unknown> } | undefined;
      const score = lr?.categories?.performance?.score;
      return JSON.stringify({
        score: score !== undefined ? Math.round(score * 100) : undefined,
        metrics: lr?.audits,
      });
    } catch (error) {
      return JSON.stringify({ score: undefined, error: error instanceof Error ? error.message : String(error) });
    }
  },
});
