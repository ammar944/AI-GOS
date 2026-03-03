// Research Tool: Industry & Market Research
// Async: dispatches to Railway worker, returns immediately

import { tool } from 'ai';
import { z } from 'zod';
import { dispatchResearch } from './dispatch';

export const researchIndustry = tool({
  description:
    'Research the industry landscape and market dynamics for the client\'s business. ' +
    'Runs a Claude sub-agent with live web search to gather: market trends, ' +
    'pain points, buying behaviours, seasonality, and demand drivers. ' +
    'Call this as soon as businessModel and industry are collected.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled onboarding context — all fields collected so far as a readable string',
      ),
  }),
  execute: async ({ context }) => {
    return dispatchResearch('researchIndustry', 'industryMarket', context);
  },
});
