// Lead Agent Tool: Fast Competitor Intelligence
// Stage 2 — runs a Haiku sub-agent with Firecrawl + Ad Library for quick competitor snapshot
// Target: < 10 seconds from call to result
// Uses toolRunner() (not stream()) so that betaZodTool.run() is executed for client-side tools

import { tool } from 'ai';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { firecrawlTool } from '@/lib/ai/tools/mcp/firecrawl-tool';
import { adLibraryTool } from '@/lib/ai/tools/mcp/ad-library-tool';

const FAST_HIT_PROMPT = `You are a fast competitive intelligence researcher.
Get a quick snapshot of this competitor for a paid media strategist.

TOOLS:
1. Use firecrawl to scrape the competitor's homepage — extract their value prop, key benefits, and any pricing signals
2. Use adLibrary to check their current ad activity on Meta

SPEED RULES:
- Make at most 2 tool calls total (1 firecrawl + 1 adLibrary)
- Do NOT make multiple searches — one shot per tool
- If a tool fails, skip it and use what you have

OUTPUT FORMAT:
Return ONLY valid JSON, no other text:
{
  "name": "string — company name",
  "url": "string — their domain",
  "valueProposition": "string — their core claim in 1 sentence",
  "pricingSignal": "string — any pricing found, or 'not found'",
  "activeAdCount": number or null,
  "adThemes": ["string — 2-3 ad creative themes if found"],
  "trafficEstimate": "string — 'high/medium/low' based on site quality signals, or 'unknown'",
  "keyStrength": "string — single biggest competitive strength from what you found",
  "keyWeakness": "string — single most obvious weakness or gap"
}`;

export const competitorFastHits = tool({
  description:
    'Get a fast competitor intelligence snapshot (< 10s). ' +
    'Scrapes their homepage and checks ad library activity. ' +
    'Call this immediately when the user names a competitor or provides a competitor URL. ' +
    'Pass the competitor domain/URL and any context about the client business.',
  inputSchema: z.object({
    competitorUrl: z
      .string()
      .describe(
        'The competitor domain or URL (e.g., "hubspot.com" or "https://www.hubspot.com")',
      ),
    clientContext: z
      .string()
      .optional()
      .describe(
        'Brief context about the client: business model, industry, ICP. Used to interpret competitor relevance.',
      ),
  }),
  execute: async ({ competitorUrl, clientContext }) => {
    const client = new Anthropic();
    const startTime = Date.now();

    // Normalize URL
    const url = competitorUrl.startsWith('http')
      ? competitorUrl
      : `https://${competitorUrl}`;

    const userContent = clientContext
      ? `Research this competitor: ${url}\n\nClient context: ${clientContext}`
      : `Research this competitor: ${url}`;

    try {
      // Use toolRunner (not stream) so that betaZodTool.run() is called for
      // client-side tools (firecrawlTool, adLibraryTool). stream() only serializes
      // tool schemas but never executes run() — toolRunner handles the full loop.
      const runner = client.beta.messages.toolRunner({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        tools: [firecrawlTool, adLibraryTool],
        system: FAST_HIT_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });

      const finalMsg = await runner.runUntilDone();

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
        data = { summary: resultText };
      }

      return {
        status: 'complete' as const,
        competitor: competitorUrl,
        data,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'error' as const,
        competitor: competitorUrl,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
});
