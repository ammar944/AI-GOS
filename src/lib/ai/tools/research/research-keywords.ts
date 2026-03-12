// Research Tool: Keyword Intelligence
// Fire-and-forget: dispatches to Railway worker and returns immediately.

import { tool } from 'ai';
import { z } from 'zod';
import {
  dispatchResearch,
  getActiveRunIdFromToolExecutionOptions,
} from './dispatch';

export const researchKeywords = tool({
  description:
    'Research keyword intelligence for paid search campaigns. ' +
    'Runs a sub-agent with SpyFu to identify high-value search terms, ' +
    'competitor keyword gaps, and quick-win opportunities. ' +
    'Call this after synthesizeResearch is queued. ' +
    'Returns immediately with status "queued" — results stream to the UI via Realtime.',
  inputSchema: z.object({
    context: z.string().describe(
      'Business context including product description, competitors identified, and platform recommendations from synthesis',
    ),
  }),
  execute: async ({ context }, options) => {
    return dispatchResearch('researchKeywords', 'keywordIntel', context, {
      activeRunId: getActiveRunIdFromToolExecutionOptions(options),
    });
  },
});
