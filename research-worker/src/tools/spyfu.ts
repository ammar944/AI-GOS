import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const SPYFU_BASE_URL = 'https://api.spyfu.com/apis';

async function spyfuGet(path: string): Promise<unknown> {
  const apiKey = process.env.SPYFU_API_KEY;
  if (!apiKey) throw new Error('SPYFU_API_KEY not configured');
  const res = await fetch(`${SPYFU_BASE_URL}${path}&api_key=${apiKey}`);
  if (!res.ok) throw new Error(`SpyFu API error: ${res.status}`);
  return res.json();
}

export const spyfuTool = betaZodTool({
  name: 'spyfu',
  description: 'Get keyword intelligence and domain stats for a competitor domain using SpyFu.',
  inputSchema: z.object({
    domain: z.string().describe('The competitor domain to analyze (e.g., example.com)'),
  }),
  run: async ({ domain }) => {
    try {
      const [domainStats, keywords] = await Promise.all([
        spyfuGet(`/domain_stats/v2/getDomainStatsForQuery?query=${domain}&countryCode=US&_p=1&_pageSize=1`),
        spyfuGet(`/keyword_snake/v2/getMostValuableKeywordsForQuery?query=${domain}&countryCode=US&_p=1&_pageSize=20&excludeTerms=jobs,career,salary`),
      ]);
      return JSON.stringify({ keywords, domainStats });
    } catch (error) {
      return JSON.stringify({ keywords: [], domainStats: null, error: error instanceof Error ? error.message : String(error) });
    }
  },
});
