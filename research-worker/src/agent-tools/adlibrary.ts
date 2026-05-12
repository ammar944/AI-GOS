/**
 * Meta Ad Library + Google Ads Transparency wrapper. Phase 3a returns a
 * SearchAPI-based variant since direct ad-library scraping requires sessions
 * (the existing tools/adlibrary.ts is 1,429 lines of session machinery). For
 * Phase 3a the SearchAPI fallback gives the subagent enough signal to surface
 * "competitor ran X ads in the last 90 days". Phase 3b extends to the full
 * scrape if needed.
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

const AdLibraryOutputSchema = z.union([
  z.object({
    type: z.literal('result'),
    advertiser: z.string(),
    platform: z.enum(['meta', 'google']),
    ads: z.array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        snippet: z.string().optional(),
      }),
    ),
  }),
  ToolGapSchema,
]);

export const adLibraryAgentTool = tool({
  description:
    'Look up active advertising creative for a brand on Meta Ad Library or Google Ads Transparency. Returns a small set of ad URLs + snippets you can cite as evidence the competitor is running paid acquisition.',
  inputSchema: z.object({
    advertiser: z.string(),
    platform: z.enum(['meta', 'google']).default('meta'),
    max_results: z.number().int().default(8),
  }),
  outputSchema: AdLibraryOutputSchema,
  execute: async (
    { advertiser, platform, max_results },
    { abortSignal },
  ) => {
    const apiKey = process.env.SEARCHAPI_KEY;
    if (!apiKey) return credentialGap('SEARCHAPI_KEY') as ToolGap;
    try {
      const site =
        platform === 'meta'
          ? 'facebook.com/ads/library'
          : 'adstransparency.google.com';
      const query = `${advertiser} site:${site}`;
      const url = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(
        query,
      )}&num=${max_results}&api_key=${apiKey}`;
      const res = await timedFetch(url, { abortSignal, timeoutMs: 15_000 });
      if (!res.ok) {
        return apiErrorGap(`SearchAPI ${res.status}`) as ToolGap;
      }
      const data = (await res.json()) as {
        organic_results?: Array<{
          link?: string;
          title?: string;
          snippet?: string;
        }>;
      };
      return {
        type: 'result' as const,
        advertiser,
        platform,
        ads: (data.organic_results ?? [])
          .filter((r) => r.link)
          .map((r) => ({
            url: r.link!,
            title: r.title,
            snippet: r.snippet,
          })),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return apiErrorGap(`AdLibrary fetch failed: ${message}`) as ToolGap;
    }
  },
});
