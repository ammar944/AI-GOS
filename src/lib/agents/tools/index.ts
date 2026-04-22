// src/lib/agents/tools/index.ts
// Tool registry — thin wrappers over existing service clients

import { tool } from 'ai';
import { generateText } from 'ai';
import { z } from 'zod';

// ── perplexity helper (anthropic-compat endpoint) ──────────────────────────────
function perplexityModel(apiKey: string, modelId: string) {
  return {
    id: `perplexity:${modelId}`,
    provider: 'perplexity',
    specificationVersion: 'v1',
    config: { apiKey, baseURL: 'https://api.perplexity.ai' },
  } as any;
}

// ── tool definitions ──────────────────────────────────────────────────────────

export const webSearchTool = tool({
  description: 'Search the web for real-time competitor intel, industry trends, pricing signals',
  parameters: z.object({
    query: z.string().describe('Search query — max 100 chars'),
  }),
  execute: async ({ query }) => {
    const model = perplexityModel(process.env.PERPLEXITY_API_KEY!, 'sonar-pro');
    const result = await generateText({ model, prompt: query });
    return result.text;
  },
});

export const firecrawlTool = tool({
  description: 'Scrape and extract structured data from a competitor website',
  parameters: z.object({
    url: z.string().url().describe('Competitor URL to scrape'),
  }),
  execute: async ({ url }) => {
    const { FirecrawlClient } = await import('@mendable/firecrawl-js');
    const client = new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY! });
    const result = await client.scrapeUrl(url, { formats: ['markdown'] });
    return result.markdown ?? '';
  },
});

export const spyfuTool = tool({
  description: 'Get competitor ad spend, keywords, and positioning from SpyFu',
  parameters: z.object({
    domain: z.string().describe('Competitor domain'),
  }),
  execute: async ({ domain }) => {
    const { getCompetitorIntel } = await import('@/lib/ai/spyfu-client');
    return await getCompetitorIntel(domain);
  },
});

export const adLibraryTool = tool({
  description: 'Audit active ads on Meta Ad Library and TikTok Creative Center',
  parameters: z.object({
    advertiserName: z.string().describe('Brand or advertiser name'),
    platforms: z.array(z.enum(['meta', 'tiktok'])).optional().default(['meta']),
  }),
  execute: async ({ advertiserName, platforms }) => {
    return { advertiserName, platforms, totalAds: 0, activeAds: [], note: 'WIP — wire to services' };
  },
});

export const sonarTool = tool({
  description: 'Ground a claim with search-backed citations',
  parameters: z.object({
    claim: z.string().describe('Claim to verify'),
  }),
  execute: async ({ claim }) => {
    const model = perplexityModel(process.env.PERPLEXITY_API_KEY!, 'sonar-pro');
    const result = await generateText({
      model,
      prompt: `Verify this claim and return ONLY citations with evidence:\n\n${claim}`,
    });
    return result.text;
  },
});

export const submitResearchReportTool = tool({
  description: 'Submit final structured research report when all sections are complete',
  parameters: z.any(), // Will wire ResearchReportSchema after types.ts exists
  execute: async (report: any) => {
    const { persistAgentReport } = await import('@/lib/agents/persist-report');
    await persistAgentReport(report);
    return { status: 'accepted', sections: Object.keys(report) };
  },
});

export const researchTools = {
  web_search: webSearchTool,
  firecrawl: firecrawlTool,
  spyfu: spyfuTool,
  adLibrary: adLibraryTool,
  sonar: sonarTool,
  submitResearchReport: submitResearchReportTool,
};
