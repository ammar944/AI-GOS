// One-pass Deep Research Program tool.
// Dispatches the skills/tools/API-backed worker pass that writes the shared
// corpus and six report sections back into journey_sessions.research_results.

import { tool } from 'ai';
import { z } from 'zod';
import {
  dispatchResearch,
  getActiveRunIdFromToolExecutionOptions,
  getBaselineMetricsFromToolExecutionOptions,
  type DispatchResult,
} from './dispatch';

export const runDeepResearchProgram = tool({
  description:
    'Run or refresh the one-pass AI-GOS Deep Research Program for the active /journey workspace. ' +
    'Use this when the user explicitly asks to research further, rerun research, add evidence, ' +
    'refresh the report, or go deeper on the current GTM report. It writes a shared research corpus ' +
    'and section artifacts to Supabase; the workspace hydrates cards asynchronously.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Current company/onboarding context, active section, visible card summaries, and the user-requested research scope.',
      ),
  }),
  execute: async ({ context }, options): Promise<DispatchResult> => {
    return dispatchResearch('runDeepResearchProgram', 'deepResearchProgram', context, {
      activeRunId: getActiveRunIdFromToolExecutionOptions(options),
      baselineMetrics: getBaselineMetricsFromToolExecutionOptions(options),
    });
  },
});
