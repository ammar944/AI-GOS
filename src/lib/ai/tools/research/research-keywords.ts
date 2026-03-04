// Research Tool: Keyword Intelligence
// Dispatches to Railway worker, polls for result

import { tool } from 'ai';
import { z } from 'zod';
import { dispatchAndWait } from './dispatch-and-wait';

export const researchKeywords = tool({
  description:
    'Research keyword intelligence for paid search campaigns. ' +
    'Runs a sub-agent with SpyFu to identify high-value search terms, ' +
    'competitor keyword gaps, and quick-win opportunities. ' +
    'Call this after synthesizeResearch completes.',
  inputSchema: z.object({
    context: z.string().describe(
      'Business context including product description, competitors identified, and platform recommendations from synthesis',
    ),
  }),
  execute: async ({ context }) => {
    return dispatchAndWait('researchKeywords', 'keywordIntel', context);
  },
});
