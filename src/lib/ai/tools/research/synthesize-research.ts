// Research Tool: Cross-Analysis Synthesis
// Dispatches to Railway worker, polls for result
// Model now controls sequencing — no waitForResearchReadiness needed

import { tool } from 'ai';
import { z } from 'zod';
import { dispatchAndWait } from './dispatch-and-wait';

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
    return dispatchAndWait('synthesizeResearch', 'crossAnalysis', context);
  },
});
