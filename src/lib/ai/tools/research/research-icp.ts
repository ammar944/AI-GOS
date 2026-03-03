// Research Tool: ICP Validation
// Async: dispatches to Railway worker, returns immediately

import { tool } from 'ai';
import { z } from 'zod';
import { dispatchResearch } from './dispatch';

export const researchICP = tool({
  description:
    'Validate the Ideal Customer Profile for paid media targeting. ' +
    'Runs a sub-agent to assess: targeting feasibility, audience scale, pain-solution fit, ' +
    'economic viability, trigger events, segment sizing, and risk scoring. ' +
    'Call this after researchIndustry completes AND icpDescription is collected.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled onboarding context — all fields collected so far as a readable string',
      ),
  }),
  execute: async ({ context }) => {
    return dispatchResearch('researchICP', 'icpValidation', context);
  },
});
