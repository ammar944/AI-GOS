// Company research corpus tool.
// Dispatches the skills/tools/API-backed worker pass that refreshes the shared
// corpus used by onboarding extraction and later section-specific synthesis.

import { tool } from 'ai';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import {
  getActiveRunIdFromToolExecutionOptions,
  getBaselineMetricsFromToolExecutionOptions,
  type DispatchResult,
} from './dispatch';
import { dispatchJourneyResearchForUser } from '@/lib/journey/server/dispatch-research';

export const runDeepResearchProgram = tool({
  description:
    'Run or refresh the AI-GOS company research corpus for the active /journey workspace. ' +
    'Use this when the user explicitly asks to research further, rerun research, add evidence, ' +
    'refresh the company context, or go deeper on the current company. It writes a shared research corpus ' +
    'to Supabase; section artifacts are created by section-specific synthesis jobs.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Current company/onboarding context, active section, visible card summaries, and the user-requested research scope.',
      ),
  }),
  execute: async ({ context }, options): Promise<DispatchResult> => {
    const { userId } = await auth();
    if (!userId) {
      return {
        status: 'error',
        section: 'deepResearchProgram',
        error: 'Unauthorized',
      };
    }

    return dispatchJourneyResearchForUser({
      userId,
      section: 'deepResearchProgram',
      runId: getActiveRunIdFromToolExecutionOptions(options),
      context,
      baselineMetrics: getBaselineMetricsFromToolExecutionOptions(options),
    });
  },
});
