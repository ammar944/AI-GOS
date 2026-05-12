/**
 * GA4 wrapper — placeholder Phase 3a shape. The full integration requires
 * the user's GA4 OAuth + property selection wiring which lands in a
 * follow-up phase. For now the tool surfaces a 'not_implemented' gap so
 * the Offer-Diagnostic subagent can render the data-availability state
 * cleanly without crashing.
 */

import { tool } from 'ai';
import { z } from 'zod';

import { type ToolGap } from './_shared';

export const ga4AgentTool = tool({
  description:
    'Pull funnel and acquisition metrics from a connected Google Analytics 4 property. Use only when GA4 has been linked for this audit.',
  inputSchema: z.object({
    property: z.string().describe('GA4 property ID'),
    metric: z.string().describe('Metric name (e.g. sessions, conversions)'),
  }),
  execute: async (): Promise<ToolGap> => ({
    type: 'gap',
    reason: 'not_implemented',
    message:
      'GA4 OAuth + property selection lands in a follow-up phase. Surface this as a data-availability gap in the artifact.',
  }),
});
