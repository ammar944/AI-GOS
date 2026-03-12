// Research Tool: Cross-Analysis Synthesis
// Fire-and-forget: dispatches to Railway worker and returns immediately.

import { tool } from 'ai';
import { z } from 'zod';
import {
  dispatchResearch,
  getActiveRunIdFromToolExecutionOptions,
} from './dispatch';

export const synthesizeResearch = tool({
  description:
    'Synthesise all completed research into a cross-analysis strategic summary. ' +
    'Runs a sub-agent to produce: key insights, recommended platforms, strategic narrative, ' +
    'and media buying priorities. ' +
    'ONLY call this after all 4 prior research tools have been queued. ' +
    'Pass summaries of all 4 prior research outputs in the context parameter. ' +
    'Returns immediately with status "queued" — results stream to the UI via Realtime.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled context including onboarding fields AND summaries of all 4 completed research sections',
      ),
  }),
  execute: async ({ context }, options) => {
    return dispatchResearch('synthesizeResearch', 'crossAnalysis', context, {
      activeRunId: getActiveRunIdFromToolExecutionOptions(options),
    });
  },
});
