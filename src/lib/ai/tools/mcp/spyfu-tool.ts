// MCP Tool Wrapper: SpyFu
// betaZodTool wrapping getDomainStats + getMostValuableKeywords for use by Anthropic SDK sub-agents

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { getDomainStats, getMostValuableKeywords } from '@/lib/ai/spyfu-client';

export const spyfuTool = betaZodTool({
  name: 'spyfu',
  description:
    'Get keyword intelligence and domain stats for a competitor domain using SpyFu.',
  inputSchema: z.object({
    domain: z
      .string()
      .describe('The competitor domain to analyze (e.g., example.com)'),
  }),
  run: async ({ domain }) => {
    try {
      const [domainStats, keywords] = await Promise.all([
        getDomainStats(domain),
        getMostValuableKeywords(domain, 20),
      ]);
      return JSON.stringify({ keywords, domainStats });
    } catch (error) {
      return JSON.stringify({
        keywords: [],
        domainStats: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
