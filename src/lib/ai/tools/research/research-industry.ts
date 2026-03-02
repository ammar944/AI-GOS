// Research Tool: Industry & Market Research
// Sprint 3 T3.3 — Anthropic SDK sub-agent with perplexitySearch betaZodTool

import { tool } from 'ai';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { perplexitySearch } from '@/lib/ai/tools/perplexity-search';

const INDUSTRY_SYSTEM_PROMPT = `You are an expert market researcher with real-time web search capabilities.

TASK: Research the industry and market landscape to inform a paid media strategy.

RESEARCH FOCUS:
- Current market trends and statistics (2024+)
- Pain points sourced from G2, Capterra, Reddit, and community forums
- Buying behaviors and triggers specific to this market
- Seasonal patterns and sales cycles
- Demand drivers and barriers

TOOL USAGE:
Use the perplexitySearch tool to gather live market data. Run multiple searches:
1. Industry overview and market size
2. Customer pain points and complaints (search G2/Reddit/forums)
3. Buying behavior and decision process
4. Seasonal/cyclical patterns
5. Key demand drivers in this space

QUALITY STANDARDS:
- Be specific with real data points and statistics
- Include statistics when available
- Source pain points from actual customer feedback
- Make insights actionable for paid media targeting

OUTPUT FORMAT:
After completing your research, respond with a JSON object containing your findings. Structure:
{
  "categorySnapshot": {
    "category": "string — specific market category name",
    "marketMaturity": "emerging | growing | mature | declining",
    "buyingBehavior": "string — how buyers evaluate and purchase",
    "awarenessLevel": "unaware | problem-aware | solution-aware | product-aware | most-aware",
    "averageSalesCycle": "string — typical sales cycle length"
  },
  "painPoints": {
    "primary": ["string — top pain points (4-6 items)"],
    "secondary": ["string — secondary pain points (2-4 items)"],
    "triggers": ["string — events that trigger purchase consideration"]
  },
  "marketTrends": ["string — key market trends (3-5 items)"],
  "seasonalPatterns": "string — seasonal buying patterns if any",
  "messagingOpportunities": {
    "angles": ["string — strong messaging angles for paid ads"],
    "summaryRecommendations": ["string — actionable recommendations for paid media strategy"]
  }
}`;

export const researchIndustry = tool({
  description:
    'Research the industry landscape and market dynamics for the client\'s business. ' +
    'Runs a Claude Opus sub-agent with live Perplexity web search to gather: market trends, ' +
    'pain points, buying behaviours, seasonality, and demand drivers. ' +
    'Call this as soon as businessModel and industry are collected.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled onboarding context — all fields collected so far as a readable string',
      ),
  }),
  execute: async ({ context }) => {
    const client = new Anthropic();
    const startTime = Date.now();

    try {
      const stream = client.beta.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 8000,
        tools: [perplexitySearch],
        system: INDUSTRY_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Research the industry and market for:\n\n${context}`,
          },
        ],
      });

      const finalMsg = await stream.finalMessage();

      const textBlock = finalMsg.content.find((b) => b.type === 'text');
      const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';

      let data: unknown;
      try {
        // Extract JSON from the text — it may be wrapped in markdown code fences
        const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/) ??
          resultText.match(/(\{[\s\S]*\})/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : resultText.trim();
        data = JSON.parse(jsonStr);
      } catch {
        data = { summary: resultText };
      }

      return {
        status: 'complete' as const,
        section: 'industryMarket' as const,
        data,
        sources: [],
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'error' as const,
        section: 'industryMarket' as const,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
});
