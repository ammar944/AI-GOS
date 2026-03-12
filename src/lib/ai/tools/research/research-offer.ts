// Research Tool: Offer Analysis
// Fire-and-forget: dispatches to Railway worker and returns immediately.

import { tool } from 'ai';
import { z } from 'zod';
import {
  dispatchResearch,
  getActiveRunIdFromToolExecutionOptions,
} from './dispatch';

export const researchOffer = tool({
  description:
    'Analyse the client\'s offer and pricing for paid media viability. ' +
    'Runs a sub-agent to assess: offer strength, pricing benchmarks, red flags, ' +
    'competitor pricing, and recommendations. ' +
    'Call this after researchIndustry results have arrived AND productDescription + pricingTiers are collected from the user. ' +
    'Returns immediately with status "queued" — results stream to the UI via Realtime.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled onboarding context — all fields collected so far as a readable string',
      ),
  }),
  execute: async ({ context }, options) => {
    return dispatchResearch('researchOffer', 'offerAnalysis', context, {
      activeRunId: getActiveRunIdFromToolExecutionOptions(options),
    });
  },
});
