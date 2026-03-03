// Research Tool: Cross-Analysis Synthesis
// Async: dispatches to Railway worker, returns immediately

import { tool } from 'ai';
import { z } from 'zod';
import { dispatchResearch } from './dispatch';

export const synthesizeResearch = tool({
  description:
    'Synthesise all completed research into a cross-analysis strategic summary. ' +
    'Runs a sub-agent to produce: key insights, recommended platforms, strategic narrative, ' +
    'and media buying priorities. ' +
    'ONLY call this after all 4 prior research tools have completed successfully. ' +
    'Pass summaries of all 4 prior research outputs in the context parameter.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled context including onboarding fields AND summaries of all 4 completed research sections',
      ),
  }),
  execute: async ({ context }) => {
    return dispatchResearch('synthesizeResearch', 'crossAnalysis', context);
  },
});
