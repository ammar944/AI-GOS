// MCP Tool Wrapper: Firecrawl
// betaZodTool wrapping FirecrawlClient.scrape() for use by Anthropic SDK sub-agents

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { createFirecrawlClient } from '@/lib/firecrawl/client';

export const firecrawlTool = betaZodTool({
  name: 'firecrawl',
  description:
    'Scrape a web page and return its content as markdown. Use for pricing pages, landing pages, and competitor websites.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to scrape'),
  }),
  run: async ({ url }) => {
    try {
      const client = createFirecrawlClient();
      const result = await client.scrape({ url });
      return JSON.stringify({
        success: result.success,
        markdown: result.markdown,
        error: result.error,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
