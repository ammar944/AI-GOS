/**
 * SpyFu PPC + organic intelligence wrapper.
 *
 * Phase 3a — exposes existing tools/spyfu.ts fetch logic as an AI SDK v6
 * tool() consumable by the Competitor Landscape subagent. Source fetch
 * is duplicated locally rather than imported from the betaZodTool wrapper
 * (the existing spyfuGet is private to tools/spyfu.ts). Cleanup wedge after
 * Phase 3b removes the legacy wrapper entirely.
 */

import { tool } from 'ai';
import { z } from 'zod';

import {
  ToolGapSchema,
  credentialGap,
  errorToGap,
  timedFetch,
  type ToolGap,
} from './_shared';

const SPYFU_BASE_URL = 'https://api.spyfu.com/apis';
const SPYFU_TIMEOUT_MS = 10_000;
const SPYFU_KEYWORD_PAGE_SIZE = 12;

async function spyfuGet(
  path: string,
  abortSignal?: AbortSignal,
): Promise<unknown> {
  const apiKey = process.env.SPYFU_API_KEY;
  if (!apiKey) throw new Error('missing_credential:SPYFU_API_KEY');
  const separator = path.includes('?') ? '&' : '?';
  const url = `${SPYFU_BASE_URL}${path}${separator}api_key=${apiKey}`;
  const res = await timedFetch(url, {
    timeoutMs: SPYFU_TIMEOUT_MS,
    abortSignal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `spyfu_error:${res.status}:${body.slice(0, 200)}`,
    );
  }
  return res.json();
}

const SpyfuOutputSchema = z.union([
  z.object({
    type: z.literal('result'),
    domain: z.string(),
    domainStats: z.unknown(),
    keywords: z.unknown(),
  }),
  ToolGapSchema,
]);

export const spyfuAgentTool = tool({
  description:
    'Look up SpyFu keyword + PPC intelligence for a competitor domain. Returns paid SERP keywords sorted by search volume and overall domain stats.',
  inputSchema: z.object({
    domain: z
      .string()
      .describe('Competitor domain to analyze (e.g. example.com)'),
  }),
  outputSchema: SpyfuOutputSchema,
  execute: async ({ domain }, { abortSignal }) => {
    try {
      const [domainStats, keywords] = await Promise.all([
        spyfuGet(
          `/domain_stats_api/v2/getAllDomainStats?domain=${encodeURIComponent(
            domain,
          )}&countryCode=US`,
          abortSignal,
        ),
        spyfuGet(
          `/serp_api/v2/ppc/getPaidSerps?query=${encodeURIComponent(
            domain,
          )}&countryCode=US&pageSize=${SPYFU_KEYWORD_PAGE_SIZE}&startingRow=1&excludeTerms=jobs,career,salary&sortBy=SearchVolume&sortOrder=Descending`,
          abortSignal,
        ),
      ]);
      return {
        type: 'result' as const,
        domain,
        domainStats,
        keywords,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('missing_credential:')) {
        return credentialGap('SPYFU_API_KEY') as ToolGap;
      }
      return errorToGap(err, 'SpyFu request failed');
    }
  },
});
