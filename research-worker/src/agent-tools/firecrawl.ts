/**
 * Firecrawl scrape wrapper — fetches a URL's rendered markdown content.
 * Used by every positioning subagent for "open this page and read it"
 * tasks where Anthropic's native web_search snippet isn't deep enough.
 */

import { tool } from 'ai';
import { z } from 'zod';

import {
  ToolGapSchema,
  apiErrorGap,
  credentialGap,
  timedFetch,
  type ToolGap,
} from './_shared';

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape';

const FirecrawlOutputSchema = z.union([
  z.object({
    type: z.literal('result'),
    url: z.string(),
    markdown: z.string(),
    title: z.string().optional(),
    sourceUrl: z.string().optional(),
  }),
  ToolGapSchema,
]);

export const firecrawlAgentTool = tool({
  description:
    "Scrape a public URL and return its rendered markdown content. Use when web_search snippets aren't enough and you need the page body. JS-rendered SPAs are supported.",
  inputSchema: z.object({
    url: z.string().url().describe('URL to scrape'),
    onlyMainContent: z
      .boolean()
      .default(true)
      .describe(
        'When true, strip nav/footer/sidebar to return only the main article content.',
      ),
  }),
  outputSchema: FirecrawlOutputSchema,
  execute: async ({ url, onlyMainContent }, { abortSignal }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      return credentialGap('FIRECRAWL_API_KEY') as ToolGap;
    }
    try {
      const res = await timedFetch(FIRECRAWL_SCRAPE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent,
        }),
        abortSignal,
        timeoutMs: 60_000,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return apiErrorGap(
          `Firecrawl ${res.status}: ${body.slice(0, 200)}`,
        ) as ToolGap;
      }
      const data = (await res.json()) as {
        data?: {
          markdown?: string;
          metadata?: { title?: string; sourceURL?: string };
        };
      };
      return {
        type: 'result' as const,
        url,
        markdown: data.data?.markdown ?? '',
        title: data.data?.metadata?.title,
        sourceUrl: data.data?.metadata?.sourceURL,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return apiErrorGap(`Firecrawl request failed: ${message}`) as ToolGap;
    }
  },
});
