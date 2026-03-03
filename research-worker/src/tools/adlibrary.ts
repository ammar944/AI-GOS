import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

async function searchAds(query: string): Promise<unknown[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({
    engine: 'google_ads_transparency',
    q: query,
    api_key: apiKey,
  });
  const res = await fetch(`https://www.searchapi.io/api/v1/search?${params}`);
  if (!res.ok) return [];
  const data = await res.json() as Record<string, unknown>;
  return (data.ads as unknown[]) ?? [];
}

export const adLibraryTool = betaZodTool({
  name: 'adLibrary',
  description: 'Fetch competitor ads from ad libraries. Use for creative intelligence — understand what messaging, formats, and offers competitors are running.',
  inputSchema: z.object({
    companyName: z.string().describe('The company name to search for ads'),
    domain: z.string().optional().describe('The competitor domain (e.g., "salesforce.com")'),
  }),
  run: async ({ companyName }) => {
    try {
      const ads = await searchAds(companyName);
      return JSON.stringify({ ads, totalFound: ads.length });
    } catch (error) {
      return JSON.stringify({ ads: [], totalFound: 0, error: error instanceof Error ? error.message : String(error) });
    }
  },
});
