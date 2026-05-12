/**
 * Google PageSpeed Insights wrapper. No API key required for low-volume use;
 * Google rate-limits anonymous calls. Returns the performance score 0-100 +
 * Core Web Vitals audits for the URL.
 */

import { tool } from 'ai';
import { z } from 'zod';

import {
  ToolGapSchema,
  apiErrorGap,
  timedFetch,
  type ToolGap,
} from './_shared';

const PAGESPEED_BASE =
  'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const PageSpeedOutputSchema = z.union([
  z.object({
    type: z.literal('result'),
    url: z.string(),
    score: z.number().nullable(),
    audits: z.unknown(),
  }),
  ToolGapSchema,
]);

export const pagespeedAgentTool = tool({
  description:
    'Run Google PageSpeed Insights against a public URL. Returns the desktop performance score (0-100) and Lighthouse audit details (LCP, CLS, TBT, etc).',
  inputSchema: z.object({
    url: z.string().url().describe('Public URL to audit'),
  }),
  outputSchema: PageSpeedOutputSchema,
  execute: async ({ url }, { abortSignal }) => {
    try {
      const apiUrl = `${PAGESPEED_BASE}?url=${encodeURIComponent(
        url,
      )}&strategy=desktop`;
      const res = await timedFetch(apiUrl, { abortSignal, timeoutMs: 25_000 });
      if (!res.ok) {
        return apiErrorGap(
          `PageSpeed API ${res.status}`,
        ) as ToolGap;
      }
      const data = (await res.json()) as Record<string, unknown>;
      const lr = data.lighthouseResult as
        | {
            categories?: { performance?: { score?: number } };
            audits?: Record<string, unknown>;
          }
        | undefined;
      const rawScore = lr?.categories?.performance?.score;
      return {
        type: 'result' as const,
        url,
        score: typeof rawScore === 'number' ? Math.round(rawScore * 100) : null,
        audits: lr?.audits ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return apiErrorGap(`PageSpeed request failed: ${message}`) as ToolGap;
    }
  },
});
