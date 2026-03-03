// Research Tool: Offer Analysis
// Async: dispatches to Railway worker, returns immediately

import { tool } from 'ai';
import { z } from 'zod';
import { dispatchResearch } from './dispatch';

export const researchOffer = tool({
  description:
    'Analyse the client\'s offer and pricing for paid media viability. ' +
    'Runs a sub-agent to assess: offer strength, pricing benchmarks, red flags, ' +
    'competitor pricing, and recommendations. ' +
    'Call this after researchIndustry completes AND productDescription + offerPricing are collected.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled onboarding context — all fields collected so far as a readable string',
      ),
  }),
  execute: async ({ context }) => {
    return dispatchResearch('researchOffer', 'offerAnalysis', context);
  },
});
