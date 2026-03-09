import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { createClient, runWithBackoff, extractJson } from '../runner';
import type { ResearchResult } from '../supabase';

const INDUSTRY_SYSTEM_PROMPT = `You are an expert market researcher with real-time web search capabilities.

TASK: Research the industry and market landscape to inform a paid media strategy.

RESEARCH FOCUS:
- Current market trends and statistics (2024+)
- Pain points sourced from G2, Capterra, Reddit, and community forums
- Buying behaviors and triggers specific to this market
- Seasonal patterns and sales cycles
- Demand drivers and barriers

TOOL USAGE:
Use the web_search tool to gather live market data. Run 3 focused searches:
1. Industry overview, market size, and key demand drivers
2. Customer pain points and complaints (search G2/Reddit/forums)
3. Buying behavior, decision process, and seasonal patterns

QUALITY STANDARDS:
- Be specific with real data points and statistics
- Include statistics when available
- Source pain points from actual customer feedback
- Make insights actionable for paid media targeting

OUTPUT FORMAT:
CRITICAL: Your ENTIRE response MUST be the JSON object ONLY. No preamble, no explanation, no markdown code fences. Start your response with { and end with }.

After completing your research, respond with a JSON object containing your findings. Structure:
{
  "categorySnapshot": {
    "category": "string — specific market category name",
    "marketSize": "string — estimated TAM/SAM (e.g. '$50B', '$2.3B SAM')",
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
  "marketDynamics": {
    "demandDrivers": ["string — key demand drivers fueling the market (3-5 items)"],
    "buyingTriggers": ["string — specific events/moments that trigger a purchase decision (3-5 items)"],
    "barriersToPurchase": ["string — common objections and friction points that delay or prevent purchase (3-5 items)"]
  },
  "trendSignals": [
    {
      "trend": "string — name of the trend",
      "direction": "rising | stable | declining",
      "evidence": "string — brief supporting data point or source"
    }
  ],
  "messagingOpportunities": {
    "angles": ["string — strong messaging angles for paid ads"],
    "summaryRecommendations": ["string — actionable recommendations for paid media strategy"]
  }
}`;

export async function runResearchIndustry(context: string): Promise<ResearchResult> {
  const client = createClient();
  const startTime = Date.now();
  try {
    const finalMsg = await runWithBackoff(
      () => {
        const runner = client.beta.messages.toolRunner({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
          system: INDUSTRY_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Research the industry and market for:\n\n${context}` }],
        });
        return Promise.race([
          runner.runUntilDone(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Sub-agent timed out after 180s')), 180_000)),
        ]);
      },
      'researchIndustry',
    );
    const textBlock = finalMsg.content.findLast((b: BetaContentBlock) => b.type === 'text');
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';
    let data: unknown;
    try { data = extractJson(resultText); } catch {
      console.error('[industry] JSON extraction failed:', resultText.slice(0, 300));
      data = { summary: resultText };
    }
    return { status: 'complete', section: 'industryMarket', data, durationMs: Date.now() - startTime };
  } catch (error) {
    return { status: 'error', section: 'industryMarket', error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startTime };
  }
}
