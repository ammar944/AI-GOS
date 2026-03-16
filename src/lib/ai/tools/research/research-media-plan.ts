// Research Tool: Media Planner
// Fire-and-forget: dispatches to Railway worker and returns immediately.

import { tool } from 'ai';
import { z } from 'zod';
import {
  dispatchResearch,
  getActiveRunIdFromToolExecutionOptions,
} from './dispatch';

export const researchMediaPlan = tool({
  description:
    'Build a 6-block execution-ready media plan from onboarding data and approved research results. ' +
    'Generates channel mix & budget, audience & campaign design, creative system, measurement & guardrails, rollout roadmap, and strategy snapshot. ' +
    'All benchmarks come from vendored reference data — no live API calls. ' +
    'ONLY call this after synthesizeResearch has completed successfully. ' +
    'Pass ALL approved research results and onboarding context in the context parameter. ' +
    'Returns immediately with status "queued" — blocks stream progressively to the workspace.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Full context including all onboarding fields and all approved research results (industry, competitors, ICP, offer, synthesis, keywords)',
      ),
  }),
  execute: async ({ context }, options) => {
    return dispatchResearch('researchMediaPlan', 'mediaPlan', context, {
      activeRunId: getActiveRunIdFromToolExecutionOptions(options),
    });
  },
});
