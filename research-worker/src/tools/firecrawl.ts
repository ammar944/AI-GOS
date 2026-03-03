import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import Firecrawl from '@mendable/firecrawl-js';
import { z } from 'zod';

export const firecrawlTool = betaZodTool({
  name: 'firecrawl',
  description: 'Scrape a web page and return its content as markdown. Use for pricing pages, landing pages, and competitor websites.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to scrape'),
  }),
  run: async ({ url }) => {
    try {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) return JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' });
      const client = new Firecrawl({ apiKey });
      const result = await client.scrape(url, { formats: ['markdown'] }) as { success: boolean; markdown?: string; error?: unknown };
      return JSON.stringify({ success: result.success, markdown: result.markdown, error: result.error });
    } catch (error) {
      return JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
});
