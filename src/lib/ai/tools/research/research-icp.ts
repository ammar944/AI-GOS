// Research Tool: ICP Validation
// Fire-and-forget: dispatches to Railway worker and returns immediately.

import { tool } from 'ai';
import { z } from 'zod';
import {
  dispatchResearch,
  getActiveRunIdFromToolExecutionOptions,
} from './dispatch';

export const researchICP = tool({
  description:
    'Validate the Ideal Customer Profile for paid media targeting. ' +
    'Runs a sub-agent to assess: targeting feasibility, audience scale, pain-solution fit, ' +
    'economic viability, trigger events, segment sizing, and risk scoring. ' +
    'Call this after researchIndustry results have arrived AND the user has provided a detailed ICP description. ' +
    'Returns immediately with status "queued" — results stream to the UI via Realtime.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled onboarding context — all fields collected so far as a readable string',
      ),
  }),
  execute: async ({ context }, options) => {
    return dispatchResearch('researchICP', 'icpValidation', context, {
      activeRunId: getActiveRunIdFromToolExecutionOptions(options),
    });
  },
});
