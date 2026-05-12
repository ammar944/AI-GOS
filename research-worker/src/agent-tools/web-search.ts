/**
 * Anthropic native web_search tool, exposed as an AI SDK v6 tool() so
 * subagents can include it in their per-zone tool map.
 *
 * Implementation strategy: Anthropic's web_search is a model-side tool
 * invoked by the Claude API directly (via `tools: [{ type: 'web_search_20250901' }]`).
 * AI SDK v6 supports passing provider-native tools straight through. For the
 * positioning subagents, we register web_search as a provider tool reference
 * the agent forwards to Anthropic without manual execute.
 *
 * The wrapper below is the SDK-native fallback shape for tests and any
 * non-Anthropic provider — production subagents prefer the provider tool
 * configured in the agent's anthropic({ tools: [{ type: 'web_search_20250901' }] })
 * options.
 */

import { tool } from 'ai';
import { z } from 'zod';

import {
  ToolGapSchema,
  type ToolGap,
} from './_shared';

const WebSearchOutputSchema = z.union([
  z.object({
    type: z.literal('result'),
    query: z.string(),
    notice: z.string(),
  }),
  ToolGapSchema,
]);

/**
 * The AI SDK fallback wrapper. The real production path uses Anthropic's
 * server-side web_search_20250901 tool, configured at the agent level rather
 * than as an AI SDK tool() — this stub exists for parity and tests.
 */
export const webSearchAgentTool = tool({
  description:
    'Search the public web for a query. Use when you need fresh information not in your training data (announcements, pricing, headcount, recent reviews). Returns a small set of relevant URLs + snippets.',
  inputSchema: z.object({
    query: z.string().describe('Search query (be specific — date, region, etc).'),
    max_results: z
      .number()
      .int()
      .default(5)
      .describe('Maximum number of results to return.'),
  }),
  outputSchema: WebSearchOutputSchema,
  execute: async ({ query }) => {
    // Subagents in Phase 3b configure web_search at the Anthropic provider
    // level — this fallback only runs in test contexts.
    return {
      type: 'result' as const,
      query,
      notice:
        'webSearchAgentTool fallback hit. Production agents should invoke Anthropic web_search_20250901 via provider tools instead of this AI SDK shim.',
    };
  },
});

/**
 * Provider tool spec for direct injection into the Anthropic call. Use this
 * when configuring the subagent's anthropic() model options.
 */
export const ANTHROPIC_WEB_SEARCH_PROVIDER_TOOL = {
  type: 'web_search_20250901' as const,
  name: 'web_search' as const,
};
