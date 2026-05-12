/**
 * Demand-Intent keyword probe. Combines a SearchAPI Google query against a
 * keyword with a check for paid-ad presence on that SERP. Used by the
 * Demand & Intent subagent.
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

const KeywordAdProbeOutputSchema = z.union([
  z.object({
    type: z.literal('result'),
    keyword: z.string(),
    organic_count: z.number(),
    ad_count: z.number(),
    top_organic: z.array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        snippet: z.string().optional(),
      }),
    ),
  }),
  ToolGapSchema,
]);

export const keywordAdProbeAgentTool = tool({
  description:
    'Run a Google search for a keyword and report (a) number of organic results, (b) number of paid ads present, (c) top 5 organic URLs. Use to confirm a keyword has buyer intent and competitors are paying for it.',
  inputSchema: z.object({
    keyword: z.string(),
    location: z.string().default('United States'),
  }),
  outputSchema: KeywordAdProbeOutputSchema,
  execute: async ({ keyword, location }, { abortSignal }) => {
    const apiKey = process.env.SEARCHAPI_KEY;
    if (!apiKey) return credentialGap('SEARCHAPI_KEY') as ToolGap;
    try {
      const url = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(
        keyword,
      )}&location=${encodeURIComponent(location)}&api_key=${apiKey}`;
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
        ads?: unknown[];
      };
      const organic = data.organic_results ?? [];
      return {
        type: 'result' as const,
        keyword,
        organic_count: organic.length,
        ad_count: Array.isArray(data.ads) ? data.ads.length : 0,
        top_organic: organic.slice(0, 5).map((r) => ({
          url: r.link ?? '',
          title: r.title,
          snippet: r.snippet,
        })),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return apiErrorGap(`Keyword probe failed: ${message}`) as ToolGap;
    }
  },
});
