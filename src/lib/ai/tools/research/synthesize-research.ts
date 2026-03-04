// src/lib/ai/tools/research/synthesize-research.ts
// Research Tool: Cross-Analysis Synthesis
// Async: waits for prerequisites, then dispatches to Railway worker

import { tool } from 'ai';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { dispatchResearch } from './dispatch';
import { waitForResearchReadiness } from '@/lib/journey/research-readiness';

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
    const { userId } = await auth();
    if (!userId) {
      return { status: 'error', section: 'crossAnalysis', error: 'Unauthorized' };
    }

    // Poll Supabase until all 4 prerequisites are complete (max 5 min)
    const readiness = await waitForResearchReadiness(userId);

    if (!readiness.ready) {
      console.warn(
        '[synthesizeResearch] Proceeding despite incomplete prerequisites:',
        readiness.missingSections,
      );
    }

    return dispatchResearch('synthesizeResearch', 'crossAnalysis', context);
  },
});
