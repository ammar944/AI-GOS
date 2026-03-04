// Research Tool: Competitor Analysis
// Dispatches to Railway worker, polls for result

import { tool } from 'ai';
import { z } from 'zod';
import { dispatchAndWait } from './dispatch-and-wait';

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
    return dispatchAndWait('researchCompetitors', 'competitors', context);
  },
});
