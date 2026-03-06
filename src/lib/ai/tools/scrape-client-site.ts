// Lead Agent Tool: Scrape Client Site
// Scrapes the CLIENT'S OWN website to extract structured onboarding data.
// Runs as the FIRST intelligence action when the user provides their website URL.
// Uses toolRunner() with Haiku sub-agent + Firecrawl (same pattern as competitorFastHits).

import { tool } from 'ai';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { firecrawlTool } from '@/lib/ai/tools/mcp/firecrawl-tool';

const CLIENT_SCRAPE_PROMPT = `You are a business intelligence analyst extracting structured data from a company's own website.

TOOLS:
1. Use firecrawl to scrape the company's homepage — extract everything about the business
2. Use firecrawl AGAIN to scrape their /pricing page (append "/pricing" to the base URL) — extract pricing tiers and model

SPEED RULES:
- Make at most 2 firecrawl calls (homepage + /pricing page)
- If /pricing fails, try /plans or skip pricing — do NOT retry
- If a tool fails, use what you have and note gaps

EXTRACTION RULES:
- NEVER hallucinate data — only extract what is explicitly on the page
- If something is not found, do NOT guess — leave it empty/null and add it to the "gaps" array
- Be specific and factual — quote the site where possible

OUTPUT FORMAT:
Return ONLY valid JSON, no other text:
{
  "companyName": "string — exact company name from the site",
  "businessModel": "B2B SaaS | B2C | D2C | Marketplace | Agency | Other",
  "industryVertical": "string — specific industry vertical",
  "productDescription": "string — what the product/service does, 2-3 sentences",
  "coreDeliverables": "string — what customers get",
  "valueProp": "string — main value proposition from the site",
  "pricingSignals": {
    "hasPricingPage": boolean,
    "tiers": [{ "name": "string", "price": "string", "billing": "string" }],
    "model": "monthly | annual | usage_based | one_time | custom"
  },
  "targetAudience": {
    "inferredIcp": "string — who the site seems to target",
    "jobTitles": "string — inferred buyer titles",
    "companySize": "string — inferred company size"
  },
  "competitors": ["string — any competitors mentioned or implied on the site"],
  "socialProof": {
    "testimonials": number,
    "caseStudies": number,
    "logos": ["string — customer logos found"],
    "metrics": ["string — any stats like '10,000+ users'"]
  },
  "techSignals": {
    "hasFreeTrial": boolean,
    "hasDemo": boolean,
    "hasBlog": boolean,
    "socialLinks": ["string"]
  },
  "brandVoice": "string — 1-2 sentence description of how they communicate",
  "gaps": ["string — things NOT found on the site that we'll need to ask about"]
}`;

export const scrapeClientSite = tool({
  description:
    'Scrape the client\'s OWN website to extract structured business intelligence for onboarding. ' +
    'Analyzes homepage and pricing page to pre-fill onboarding fields. ' +
    'Call this as the FIRST action when the user provides their website URL.',
  inputSchema: z.object({
    websiteUrl: z.string().describe('The client website URL to analyze'),
    companyName: z.string().optional().describe('Company name if already known'),
  }),
  execute: async ({ websiteUrl, companyName }) => {
    const startTime = Date.now();

    // Guard against empty/whitespace-only URLs
    const trimmedUrl = websiteUrl.trim();
    if (!trimmedUrl) {
      return {
        status: 'error' as const,
        websiteUrl: websiteUrl,
        error: 'No website URL provided',
        durationMs: Date.now() - startTime,
      };
    }

    const client = new Anthropic();

    // Normalize URL
    const url = trimmedUrl.startsWith('http')
      ? trimmedUrl
      : `https://${trimmedUrl}`;

    const userContent = companyName
      ? `Analyze this company's website: ${url}\nCompany name: ${companyName}\n\nExtract all structured business intelligence from their homepage and pricing page.`
      : `Analyze this company's website: ${url}\n\nExtract all structured business intelligence from their homepage and pricing page.`;

    try {
      const runner = client.beta.messages.toolRunner({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        tools: [firecrawlTool],
        system: CLIENT_SCRAPE_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });

      const finalMsg = await Promise.race([
        runner.runUntilDone(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Client site scrape timed out after 30s')), 30_000)
        ),
      ]);

      const textBlock = finalMsg.content.findLast((b) => b.type === 'text');
      const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';

      let data: unknown;
      try {
        const trimmed = resultText.trim();
        const first = trimmed.indexOf('{');
        const last = trimmed.lastIndexOf('}');
        data = JSON.parse(
          first >= 0 && last > first ? trimmed.slice(first, last + 1) : trimmed,
        );
      } catch {
        data = { summary: resultText, gaps: ['Failed to parse structured data from site'] };
      }

      return {
        status: 'complete' as const,
        websiteUrl: url,
        data,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'error' as const,
        websiteUrl: url,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
});
