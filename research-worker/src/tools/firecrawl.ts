import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import Firecrawl from '@mendable/firecrawl-js';
import { z } from 'zod';

const FIRECRAWL_TIMEOUT_MS = 12_000;
const FIRECRAWL_MAX_MARKDOWN_CHARS = 8_000;
const PRICING_SIGNAL_PATTERN =
  /\b(price|pricing|plan|plans|package|packages|retainer|monthly|annual|yearly|per month|per seat|starting at|\$)\b/i;

function compactFirecrawlMarkdown(markdown: string): string {
  const normalized = markdown.trim();
  if (normalized.length <= FIRECRAWL_MAX_MARKDOWN_CHARS) {
    return normalized;
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const pricingLines = lines.filter((line) => PRICING_SIGNAL_PATTERN.test(line));

  if (pricingLines.length > 0) {
    return pricingLines.join('\n').slice(0, FIRECRAWL_MAX_MARKDOWN_CHARS).trimEnd();
  }

  return normalized.slice(0, FIRECRAWL_MAX_MARKDOWN_CHARS).trimEnd();
}

export const firecrawlTool = betaZodTool({
  name: 'firecrawl',
  description: 'Scrape a web page and return its content as markdown with an AI-generated summary. Use for pricing pages, landing pages, and competitor websites.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to scrape'),
  }),
  run: async ({ url }) => {
    try {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) return JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' });
      const client = new Firecrawl({ apiKey });
      const result = await Promise.race([
        client.scrape(url, { formats: ['markdown', 'summary'] }) as Promise<{
          success: boolean;
          markdown?: string;
          summary?: string;
          error?: unknown;
        }>,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Firecrawl scrape timed out after ${FIRECRAWL_TIMEOUT_MS}ms`)),
            FIRECRAWL_TIMEOUT_MS,
          ),
        ),
      ]);
      return JSON.stringify({
        success: result.success,
        summary: typeof result.summary === 'string' ? result.summary : undefined,
        markdown: typeof result.markdown === 'string' ? compactFirecrawlMarkdown(result.markdown) : undefined,
        error: result.error,
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  },
});
