// src/lib/agents/tools/index.ts
// Tool registry — thin wrappers over existing service clients
// Tool-to-section mapping documented in REFACTOR-HANDOFF.md
// NOTE: ai-sdk v6 uses inputSchema (not parameters) and execute receives the parsed args.

import { tool } from 'ai';
import { generateText } from 'ai';
import { z } from 'zod';
import { ResearchBundleSchema } from '../types';

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

// 01 / 05 — Market intelligence + intent signals
export const webSearchTool = tool({
  description:
    'Search the web for current category intelligence, competitor landscape, keyword trends, and buyer signals.',
  inputSchema: z.object({
    query: z.string().describe('Search query — max 100 chars'),
  }),
  execute: async ({ query }: { query: string }) => {
    const model = perplexityModel(process.env.PERPLEXITY_API_KEY!, 'sonar-pro');
    const result = await generateText({ model, prompt: query });
    return result.text;
  },
});

// 03 / 04 — Deep competitor site scrape + review mining
export const firecrawlTool = tool({
  description:
    'Scrape and extract structured data from a URL — competitor sites, review platforms, forums, client properties.',
  inputSchema: z.object({
    url: z.string().url().describe('URL to scrape'),
  }),
  execute: async ({ url }: { url: string }) => {
    const { FirecrawlClient } = await import('@mendable/firecrawl-js');
    const client = new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY! });
    const result = await client.scrape(url, { formats: ['markdown'] });
    return result.markdown ?? '';
  },
});

// 03 — Competitor ad spend + keyword intelligence
export const spyfuTool = tool({
  description:
    'Get competitor ad spend, keywords, and organic positioning from SpyFu.',
  inputSchema: z.object({
    domain: z.string().describe('Competitor domain'),
  }),
  execute: async ({ domain }: { domain: string }) => {
    const { getDomainStats } = await import('@/lib/ai/spyfu-client');
    return await getDomainStats(domain);
  },
});

// 03 — Active ad creative audit
export const adLibraryTool = tool({
  description:
    'Audit active ads on Meta Ad Library, TikTok Creative Center, and LinkedIn for a given advertiser.',
  inputSchema: z.object({
    advertiserName: z.string().describe('Brand or advertiser name'),
    platforms: z.array(z.enum(['meta', 'tiktok', 'linkedin'])).optional().default(['meta']),
  }),
  execute: async ({ advertiserName, platforms }: { advertiserName: string; platforms: ('meta' | 'tiktok' | 'linkedin')[] }) => {
    return { advertiserName, platforms, totalAds: 0, activeAds: [], note: 'WIP — wire to services' };
  },
});

// 01 / 05 — Grounding / verification
export const sonarTool = tool({
  description:
    'Ground a claim with search-backed citations. Use this before trusting any uncertain fact.',
  inputSchema: z.object({
    claim: z.string().describe('Claim to verify'),
  }),
  execute: async ({ claim }: { claim: string }) => {
    const model = perplexityModel(process.env.PERPLEXITY_API_KEY!, 'sonar-pro');
    const result = await generateText({
      model,
      prompt: `Verify this claim and return ONLY citations with evidence:\n\n${claim}`,
    });
    return result.text;
  },
});

// Terminal tool — validates Layer 1 ResearchBundle
export const submitResearchReportTool = tool({
  description:
    'Submit final structured research report when all 6 sections are populated with facts and citations.',
  inputSchema: ResearchBundleSchema,
  execute: async (report) => {
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

// Tool-to-section mapping for reference:
// 01 Market Intelligence     → sonar, web_search
// 02 Buyer Validation        → sonar, web_search (Apollo/Clearbit proxies)
// 03 Competitor Landscape    → firecrawl, spyfu, adLibrary, web_search, sonar
// 04 Voice of Customer       → firecrawl (review sites), sonar (Reddit/Quora)
// 05 Demand Signals          → sonar, web_search (keyword APIs via search)
// 06 Offer Diagnostic        → firecrawl (client site), sonar (verify gaps)
