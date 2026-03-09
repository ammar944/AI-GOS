// Research Tool: Competitor Analysis
// Fire-and-forget: dispatches to Railway worker and returns immediately.

import { tool } from 'ai';
import { z } from 'zod';
import { dispatchResearch } from './dispatch';

export const researchCompetitors = tool({
  description:
    'Research competitors for the client\'s business using live web data, ad library analysis, ' +
    'SpyFu keyword intelligence, and PageSpeed benchmarks. ' +
    'Call this after researchIndustry results have arrived AND productDescription + topCompetitors are collected from the user. ' +
    'Returns immediately with status "queued" — results stream to the UI via Realtime.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled onboarding context — all fields collected so far as a readable string',
      ),
  }),
  execute: async ({ context }) => {
    return dispatchResearch('researchCompetitors', 'competitors', context);
  },
});
