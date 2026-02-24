// Web Research Tool
// Auto-execute tool that uses Perplexity Sonar Pro for follow-up research

import { z } from 'zod';
import { tool, generateText } from 'ai';
import { perplexity, MODELS, estimateCost } from '@/lib/ai/providers';

export function createWebResearchTool() {
  return tool({
    description:
      'Search the web for current, real-time information using Perplexity. ' +
      'Use this when the user asks about current market data, recent trends, ' +
      'latest competitor info, or any question that requires up-to-date information ' +
      'beyond what is in the blueprint.',
    inputSchema: z.object({
      query: z.string().describe('The search query for web research'),
      context: z
        .string()
        .optional()
        .describe('Optional context about what the user is looking for to improve results'),
    }),
    execute: async ({ query, context }) => {
      try {
        const systemPrompt = context
          ? `You are a research assistant. The user is working on a strategic business blueprint. Context: ${context}. Provide concise, factual, and actionable information.`
          : 'You are a research assistant. The user is working on a strategic business blueprint. Provide concise, factual, and actionable information.';

        const result = await generateText({
          model: perplexity(MODELS.SONAR_PRO),
          system: systemPrompt,
          prompt: query,
          maxOutputTokens: 2048,
          temperature: 0.3,
        });

        const cost = estimateCost(
          MODELS.SONAR_PRO,
          result.usage?.inputTokens || 0,
          result.usage?.outputTokens || 0
        );

        return {
          research: result.text,
          cost,
        };
      } catch (err) {
        console.error('Web research failed:', err);
        return {
          research: '',
          error: `Research failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          cost: 0,
        };
      }
    },
  });
}
