// Research Tool: Media Planner
// Async: dispatches to Railway worker, returns immediately

import { tool } from 'ai';
import { z } from 'zod';
import { dispatchResearch } from './dispatch';

export const researchMediaPlan = tool({
  description:
    'Build an execution-ready media plan using live platform data from Google Ads, Meta Ads, and Google Analytics. ' +
    'Generates channel-specific campaign structures, budget allocations, audience strategies, and performance benchmarks. ' +
    'ONLY call this after synthesizeResearch AND researchKeywords have both completed. ' +
    'Pass the full synthesis output and keyword intel in the context parameter.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Full context including onboarding fields, synthesis findings, keyword intel, and any platform credentials context',
      ),
  }),
  execute: async ({ context }) => {
    return dispatchResearch('researchMediaPlan', 'mediaPlan', context);
  },
});
