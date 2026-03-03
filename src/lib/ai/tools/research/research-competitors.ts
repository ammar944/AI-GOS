// Research Tool: Competitor Analysis
// Async: dispatches to Railway worker, returns immediately

import { tool } from 'ai';
import { z } from 'zod';
import { dispatchResearch } from './dispatch';

export const researchCompetitors = tool({
  description:
    'Research competitors for the client\'s business using live web data, ad library analysis, ' +
    'SpyFu keyword intelligence, and PageSpeed benchmarks. ' +
    'Call this after researchIndustry completes AND productDescription is collected.',
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
