import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const SPYFU_BASE_URL = 'https://api.spyfu.com/apis';
const SPYFU_TIMEOUT_MS = 10_000;
const SPYFU_KEYWORD_PAGE_SIZE = 12;

async function spyfuGet(path: string): Promise<unknown> {
  const apiKey = process.env.SPYFU_API_KEY;
  if (!apiKey) throw new Error('SPYFU_API_KEY not configured');
  const separator = path.includes('?') ? '&' : '?';
  const url = `${SPYFU_BASE_URL}${path}${separator}api_key=${apiKey}`;
  console.log(`[spyfu] GET ${url.replace(apiKey, '***')}`);
  const res = await fetch(url, {
    signal: AbortSignal.timeout(SPYFU_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[spyfu] ${res.status} for ${path}: ${body.slice(0, 200)}`);
    throw new Error(`SpyFu API error: ${res.status}`);
  }
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
        spyfuGet(`/domain_stats_api/v2/getAllDomainStats?domain=${encodeURIComponent(domain)}&countryCode=US`),
        spyfuGet(
          `/serp_api/v2/ppc/getPaidSerps?query=${encodeURIComponent(domain)}&countryCode=US&pageSize=${SPYFU_KEYWORD_PAGE_SIZE}&startingRow=1&excludeTerms=jobs,career,salary&sortBy=SearchVolume&sortOrder=Descending`,
        ),
      ]);
      return JSON.stringify({ keywords, domainStats });
    } catch (error) {
      return JSON.stringify({ keywords: [], domainStats: null, error: error instanceof Error ? error.message : String(error) });
    }
  },
});
