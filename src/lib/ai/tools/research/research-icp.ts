// Research Tool: ICP Validation
// Dispatches to Railway worker, polls for result

import { tool } from 'ai';
import { z } from 'zod';
import { dispatchAndWait } from './dispatch-and-wait';

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
    return dispatchAndWait('researchICP', 'icpValidation', context);
  },
});
