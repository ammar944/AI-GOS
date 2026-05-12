/**
 * Reviews scraping wrapper. Uses SearchAPI to pull G2/Capterra/Trustpilot
 * pages matching a brand query, then returns aggregated review excerpts.
 * Domain-scoped to the Buyer-ICP, Voice-of-Customer, and Offer-Diagnostic
 * subagents.
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

const ReviewsOutputSchema = z.union([
  z.object({
    type: z.literal('result'),
    brand: z.string(),
    excerpts: z.array(
      z.object({
        source: z.string(),
        url: z.string(),
        snippet: z.string(),
      }),
    ),
  }),
  ToolGapSchema,
]);

export const reviewsAgentTool = tool({
  description:
    "Find recent customer reviews about a brand across G2, Capterra, and Trustpilot. Returns short excerpts + source URLs. Use when you need verbatim voice-of-customer signals.",
  inputSchema: z.object({
    brand: z.string().describe('Brand or product name'),
    max_results: z.number().int().default(8),
  }),
  outputSchema: ReviewsOutputSchema,
  execute: async ({ brand, max_results }, { abortSignal }) => {
    const apiKey = process.env.SEARCHAPI_KEY;
    if (!apiKey) return credentialGap('SEARCHAPI_KEY') as ToolGap;
    try {
      const query = `${brand} reviews (site:g2.com OR site:capterra.com OR site:trustpilot.com)`;
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
      const excerpts = (data.organic_results ?? [])
        .filter((r) => r.link && r.snippet)
        .map((r) => ({
          source: r.link!.includes('g2.com')
            ? 'G2'
            : r.link!.includes('capterra')
              ? 'Capterra'
              : r.link!.includes('trustpilot')
                ? 'Trustpilot'
                : 'Web',
          url: r.link!,
          snippet: r.snippet!,
        }));
      return { type: 'result' as const, brand, excerpts };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return apiErrorGap(`Reviews fetch failed: ${message}`) as ToolGap;
    }
  },
});
