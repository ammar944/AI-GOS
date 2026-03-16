import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import Firecrawl from '@mendable/firecrawl-js';
import { z } from 'zod';

const EXTRACT_TIMEOUT_MS = 20_000;

export const firecrawlExtractTool = betaZodTool({
  name: 'firecrawlExtract',
  description:
    'Extract structured data from a web page using AI. Best for pricing pages, feature lists, and structured content. Returns data matching the requested schema instead of raw markdown.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to extract data from'),
    prompt: z
      .string()
      .describe(
        'What data to extract (e.g., "Extract pricing tiers with names, prices, and features")',
      ),
  }),
  run: async ({ url, prompt }) => {
    try {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) return JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' });

      const client = new Firecrawl({ apiKey });

      const result = await Promise.race([
        client.extract({
          urls: [url],
          prompt,
          schema: {
            type: 'object',
            properties: {
              extractedData: { description: 'The extracted structured data' },
            },
          } as Record<string, unknown>,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Firecrawl extract timed out after ${EXTRACT_TIMEOUT_MS}ms`)),
            EXTRACT_TIMEOUT_MS,
          ),
        ),
      ]);

      return JSON.stringify({
        success: result.success !== false,
        data: result.data ?? result,
        error: (result as Record<string, unknown>).error,
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
});
