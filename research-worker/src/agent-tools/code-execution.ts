/**
 * code_execution wrapper — decision documented in design doc Open Question 9
 * and Phase 3a hour 1 spike.
 *
 * Strategy: Anthropic's `code_execution_20250825` tool is a runtime container
 * feature, not an AI SDK tool() directly. To preserve it for the Offer-Diagnostic
 * subagent (chart math + GA4 number crunching), the wrapper makes a single
 * sub-call to anthropic.beta.messages.create with code_execution enabled, then
 * surfaces the textual output.
 *
 * For Phase 3a we keep this minimal — the spike in market-category demonstrates
 * the pattern. Phase 3b extends it when Offer-Diagnostic actually lands.
 */

import Anthropic from '@anthropic-ai/sdk';
import { tool } from 'ai';
import { z } from 'zod';

import {
  ToolGapSchema,
  apiErrorGap,
  credentialGap,
  type ToolGap,
} from './_shared';

const CodeExecutionOutputSchema = z.union([
  z.object({
    type: z.literal('result'),
    prompt: z.string(),
    output: z.string(),
  }),
  ToolGapSchema,
]);

export const codeExecutionAgentTool = tool({
  description:
    'Run a small Python computation in an Anthropic sandbox. Use for arithmetic on tool outputs (averages, growth rates, chart prep). Do NOT use for arbitrary code — only for deterministic math on already-fetched data.',
  inputSchema: z.object({
    prompt: z
      .string()
      .describe(
        'Plain English description of the computation. Include the input numbers or data inline; the sandbox has no internet access.',
      ),
  }),
  outputSchema: CodeExecutionOutputSchema,
  execute: async ({ prompt }, { abortSignal }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return credentialGap('ANTHROPIC_API_KEY') as ToolGap;
    }
    try {
      const client = new Anthropic({ apiKey });
      const response = await client.beta.messages.create(
        {
          model: 'claude-opus-4-6',
          max_tokens: 1024,
          tools: [{ type: 'code_execution_20250825', name: 'code_execution' }],
          messages: [{ role: 'user', content: prompt }],
        },
        { signal: abortSignal },
      );

      const textParts = response.content
        .filter((part) => part.type === 'text')
        .map((part) => ('text' in part ? part.text : ''));

      return {
        type: 'result' as const,
        prompt,
        output: textParts.join('\n').trim() || '(no text output)',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return apiErrorGap(`code_execution failed: ${message}`) as ToolGap;
    }
  },
});
