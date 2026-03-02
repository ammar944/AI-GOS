// MCP Tool Wrapper: Ad Library
// betaZodTool wrapping AdLibraryService.fetchAllPlatforms() for use by Anthropic SDK sub-agents

import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { createAdLibraryService } from '@/lib/ad-library/service';

export const adLibraryTool = betaZodTool({
  name: 'adLibrary',
  description:
    'Fetch competitor ads from LinkedIn, Meta, and Google Ad Libraries. Use for creative intelligence — understand what messaging, formats, and offers competitors are running.',
  inputSchema: z.object({
    companyName: z
      .string()
      .describe('The company name to search for ads (e.g., "Salesforce")'),
    domain: z
      .string()
      .optional()
      .describe(
        'The competitor domain as a fallback for Google lookup (e.g., "salesforce.com")',
      ),
  }),
  run: async ({ companyName, domain }) => {
    try {
      const service = createAdLibraryService();
      const response = await service.fetchAllPlatforms({
        query: companyName,
        domain,
      });

      const allAds = response.results.flatMap((r) => r.ads ?? []);

      return JSON.stringify({
        ads: allAds as unknown[],
        totalFound: allAds.length,
      });
    } catch (error) {
      return JSON.stringify({
        ads: [] as unknown[],
        totalFound: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
