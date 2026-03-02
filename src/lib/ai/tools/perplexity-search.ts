import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { generateText } from 'ai';
import { z } from 'zod';
import { perplexity, MODELS } from '@/lib/ai/providers';

export const perplexitySearch = betaZodTool({
  name: 'perplexitySearch',
  description:
    'Search the web using Perplexity Sonar Pro for up-to-date market research, competitor intelligence, and industry data.',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    context: z
      .string()
      .optional()
      .describe('Additional context to refine the search'),
  }),
  run: async ({ query, context }) => {
    try {
      const prompt = context ? `${query}\n\nContext: ${context}` : query;
      const response = await generateText({
        model: perplexity(MODELS.SONAR_PRO),
        prompt,
        maxOutputTokens: 4000,
        temperature: 0.3,
      });

      // Extract sources if available (Vercel AI SDK v6 format)
      const sources: { url: string; title: string }[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawSources = (response as any).sources;
      if (rawSources && Array.isArray(rawSources)) {
        for (const src of rawSources) {
          if (src && typeof src === 'object' && 'url' in src) {
            sources.push({
              url: String((src as { url: unknown }).url ?? ''),
              title: String((src as { title?: unknown }).title ?? ''),
            });
          }
        }
      }

      return JSON.stringify({ results: response.text, sources });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ results: `Search failed: ${msg}`, sources: [] });
    }
  },
});
