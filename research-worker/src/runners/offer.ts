import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { createClient, runWithBackoff, extractJson } from '../runner';
import { firecrawlTool } from '../tools';
import type { ResearchResult } from '../supabase';

const OFFER_SYSTEM_PROMPT = `You are an expert offer analyst evaluating viability for paid media campaigns.

TASK: Score and assess whether this offer can convert cold traffic profitably.

EVALUATION APPROACH:
1. Clarity — Can the offer be understood in 10 seconds?
2. Strength — Score 6 dimensions (1-10 each)
3. Market Fit — Does the market want this now?
4. Red Flags — What could hurt ad performance?

TOOL USAGE:
1. Use web_search to research:
   - Market pricing benchmarks for this type of offer
   - Competitor pricing and positioning
   - Customer objections commonly heard in this market
2. If the client has a pricing page URL or website URL in the context, use firecrawlTool to scrape it for actual pricing details
3. Use web_search again to find competitor pricing pages if known

SCORING GUIDELINES:
- Score based on competitive positioning
- Be honest — inflated scores waste ad spend
- Overall score = average of 6 dimension scores
- Dimensions to score: painRelevance, urgency, differentiation, tangibility, proof, pricingLogic

OFFER STRENGTH EVALUATION:
For each dimension (1-10):
- painRelevance: How directly does this offer solve the primary pain?
- urgency: Is there a compelling reason to buy NOW vs later?
- differentiation: How unique is this vs competitors?
- tangibility: Can buyers clearly visualize the outcome?
- proof: How much evidence supports the claims?
- pricingLogic: Does the price make sense relative to the value?

RED FLAGS FOR PAID ADS:
- Vague outcomes ("improve your business")
- No clear differentiator from competitors
- Price point too high for cold traffic conversion
- No social proof or credibility signals
- Long sales cycle for cold traffic

OUTPUT FORMAT:
CRITICAL: Your ENTIRE response MUST be the JSON object ONLY. No preamble, no explanation, no markdown code fences. Start your response with { and end with }.

After completing your research, respond with a JSON object. Structure:
{
  "offerStrength": {
    "overallScore": 1-10,
    "painRelevance": 1-10,
    "urgency": 1-10,
    "differentiation": 1-10,
    "tangibility": 1-10,
    "proof": 1-10,
    "pricingLogic": 1-10
  },
  "recommendation": {
    "status": "strong | proceed | needs-work | do-not-launch",
    "summary": "string — one paragraph assessment",
    "topStrengths": ["string — 2-3 strongest elements"],
    "priorityFixes": ["string — 2-4 most important improvements needed"]
  },
  "redFlags": ["string — specific concerns that could hurt ad performance"],
  "pricingAnalysis": {
    "currentPricing": "string — what client charges",
    "marketBenchmark": "string — what competitors charge",
    "pricingPosition": "premium | mid-market | budget | unclear",
    "coldTrafficViability": "string — assessment of converting cold traffic at this price point"
  },
  "marketFitAssessment": "string — does the market want this offer right now?",
  "messagingRecommendations": ["string — how to frame this offer in ads for maximum conversion"]
}`;

export async function runResearchOffer(context: string): Promise<ResearchResult> {
  const client = createClient();
  const startTime = Date.now();
  try {
    const finalMsg = await runWithBackoff(
      () => {
        const runner = client.beta.messages.toolRunner({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }, firecrawlTool],
          system: OFFER_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Analyze offer viability for paid media:\n\n${context}` }],
        });
        return Promise.race([
          runner.runUntilDone(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Sub-agent timed out after 180s')), 180_000)),
        ]);
      },
      'researchOffer',
    );
    const textBlock = finalMsg.content.findLast((b: BetaContentBlock) => b.type === 'text');
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';
    let data: unknown;
    try { data = extractJson(resultText); } catch {
      console.error('[offer] JSON extraction failed:', resultText.slice(0, 300));
      data = { summary: resultText };
    }
    return { status: 'complete', section: 'offerAnalysis', data, durationMs: Date.now() - startTime };
  } catch (error) {
    return { status: 'error', section: 'offerAnalysis', error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startTime };
  }
}
