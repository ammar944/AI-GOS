// Research Tool: Industry & Market Research
// Fire-and-forget: dispatches to Railway worker and returns immediately.
// Results arrive via Supabase Realtime on the frontend.

import { tool } from 'ai';
import { z } from 'zod';
import {
  dispatchResearch,
  getActiveRunIdFromToolExecutionOptions,
} from './dispatch';

export const researchIndustry = tool({
  description:
    'Research the industry landscape and market dynamics for the client\'s business. ' +
    'Runs a Claude sub-agent with live web search to gather: market trends, ' +
    'pain points, buying behaviours, seasonality, and demand drivers. ' +
    'Call this as soon as businessModel and industry are collected. ' +
    'Returns immediately with status "queued" — results stream to the UI via Realtime.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled onboarding context — all fields collected so far as a readable string',
      ),
  }),
  execute: async ({ context }, options) => {
    return dispatchResearch('researchIndustry', 'industryMarket', context, {
      activeRunId: getActiveRunIdFromToolExecutionOptions(options),
    });
  },
});
