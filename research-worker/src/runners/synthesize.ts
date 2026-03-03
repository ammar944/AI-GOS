import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { createClient, runWithBackoff } from '../runner';
import { chartTool } from '../tools';
import type { ResearchResult } from '../supabase';

const PAID_ADS_SKILL = `
## Paid Media Domain Knowledge

### Platform Benchmarks (2024-2025)
- Google Search: avg CPC $2-8 for mid-market SaaS, CTR 3-6% for branded terms
- LinkedIn Ads: CPL $150-400 for B2B, CPC $8-20, best for titles/functions targeting
- Meta Ads: CPM $20-50 for B2B audiences, CPL $30-80 for SMB, $100-200 for enterprise
- YouTube: CPV $0.03-0.10, 25-40% view-through rate on 30s ads

### CAC by Business Model
- B2B SaaS: $800-3,000 (SMB), $3,000-15,000 (mid-market), $15,000+ (enterprise)
- B2C SaaS: $20-150 (consumer), $50-500 (prosumer)
- E-commerce: $15-80 (impulse buys), $50-200 (considered purchases)
- Marketplace: $20-100 (supply side), $5-30 (demand side)

### ROAS Benchmarks
- Minimum viable ROAS: 2x (covering ad spend)
- Target ROAS: 3-4x for scaling, 5x+ for profitable growth
- Cold traffic ROAS is always lower than retargeting (expect 30-50% lower)

### Creative Performance Patterns
- Hook quality determines 80% of ad performance — first 3 seconds on video, first line on static
- Pain-agitation-solution outperforms feature-benefit for B2B
- Social proof (customer logos, review counts) lifts CTR 15-25% on landing pages
- Specificity beats generality: "$47K saved" > "save money", "3x faster" > "saves time"

### Budget Allocation by Funnel Stage
- Awareness (cold traffic): 50-60% of budget
- Consideration (warm/retargeting): 25-30%
- Conversion (hot retargeting): 15-20%
`;

const SYNTHESIS_SYSTEM_PROMPT = `You are synthesizing research into an actionable paid media strategy.

TASK: Create a strategic cross-analysis that connects all research insights into actionable strategy.

SYNTHESIS APPROACH:
1. Extract 5-7 key insights (at least one from each research section)
2. Develop a clear positioning strategy with 2-3 alternatives to test
3. Mine competitor data for positioning gold — at least ONE key insight must reference specific competitor weaknesses or review data
4. Identify the strongest messaging angles supported by the research

BUDGET ALLOCATION RULES:
When recommending platform allocation, follow these budget-tier rules:

- UNDER $2,000/month: Recommend 1 PRIMARY platform only (70-80% of budget). Allocate remaining 20-30% to ONE secondary platform for retargeting only. Do NOT split across 3+ platforms. State explicitly: "At this budget level, concentrate spend for faster learning."

- $2,000-$5,000/month: Recommend 1 primary (50-60%) + 1 secondary (25-30%) + 1 testing (10-20%). Only recommend 3 platforms if each gets minimum $500/month.

- $5,000-$15,000/month: Full multi-platform testing viable. Recommend allocation based on audience concentration and intent signals.

- OVER $15,000/month: Recommend aggressive multi-platform strategy with dedicated budgets per funnel stage.

MINIMUM VIABLE SPEND PER PLATFORM:
- LinkedIn Ads: $500/month minimum for B2B
- Google Search: $500/month minimum for competitive terms
- Meta Ads: $300/month minimum for retargeting, $1,000+ for prospecting

If the client's total budget does not support minimum viable spend on a platform, do NOT recommend that platform.

KEY INSIGHTS REQUIREMENTS:
- At least one insight from industry research
- At least one insight from ICP validation
- At least one insight from offer analysis
- At least one insight from competitor research
- Each insight must be actionable for paid media

POSITIONING STRATEGY:
- Identify the strongest differentiation angle from the research
- Provide 2-3 alternative positioning hypotheses to test
- Recommend which to lead with and why

PLATFORM RECOMMENDATIONS:
- Match platform to where the ICP actually spends time
- Calculate and show per-platform dollar amounts (not just percentages)
- Explain why each recommended platform fits this audience

CHART GENERATION:
After completing your strategic analysis but BEFORE writing your final JSON output, generate 2-3 charts using the generateChart tool to visualize key insights:

1. Budget allocation pie chart (if budget is known):
   - chartType: "pie"
   - title: "Recommended Budget Allocation"
   - data: array of { channel, percentage } from your platformRecommendations
   - colorField: "channel", valueField: "percentage"

2. Competitor positioning radar chart (if competitor data available):
   - chartType: "radar"
   - title: "Competitive Positioning"
   - data: array of { competitor, metric, score } for 3-5 positioning dimensions
   - colorField: "competitor", valueField: "score"

3. Channel performance comparison bar chart:
   - chartType: "bar"
   - title: "Channel Priority by ICP Concentration"
   - data: array of { channel, score } from your platform recommendations
   - xField: "channel", yField: "score"

Call generateChart for each chart. Collect the returned imageUrl values — you will include them in the "charts" array of your final JSON output. If a chart fails, skip it — do not fail the whole synthesis.

OUTPUT FORMAT:
Once you have called generateChart for each chart, respond with a single JSON object. Structure:
{
  "keyInsights": [
    {
      "insight": "string — specific actionable insight",
      "source": "industryMarket | icpValidation | offerAnalysis | competitors",
      "implication": "string — what this means for paid media strategy"
    }
  ],
  "positioningStrategy": {
    "recommendedAngle": "string — primary positioning hypothesis",
    "alternativeAngles": ["string — 2-3 alternatives to test"],
    "leadRecommendation": "string — why the recommended angle was chosen",
    "keyDifferentiator": "string — the single strongest differentiator to lead with"
  },
  "platformRecommendations": [
    {
      "platform": "string — platform name",
      "role": "primary | secondary | testing",
      "budgetAllocation": "string — percentage and dollar amount",
      "rationale": "string — why this platform for this audience",
      "priority": 1
    }
  ],
  "messagingAngles": [
    {
      "angle": "string — specific messaging angle",
      "targetEmotion": "string — emotional driver",
      "exampleHook": "string — example ad hook using this angle",
      "evidence": "string — research evidence supporting this angle"
    }
  ],
  "criticalSuccessFactors": ["string — 3-5 factors that will determine campaign success"],
  "nextSteps": ["string — 5-7 specific actions achievable in the next 2 weeks"],
  "strategicNarrative": "string — 2-3 paragraph summary of the complete paid media strategy",
  "charts": [
    {
      "chartType": "pie | radar | bar | funnel | word_cloud",
      "title": "string",
      "imageUrl": "string — URL returned by generateChart tool",
      "description": "string — 1 sentence explaining what this chart shows"
    }
  ]
}`;

export async function runSynthesizeResearch(context: string): Promise<ResearchResult> {
  const client = createClient();
  const startTime = Date.now();
  try {
    const finalMsg = await runWithBackoff(
      () => {
        const runner = client.beta.messages.toolRunner({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          tools: [chartTool],
          system: PAID_ADS_SKILL + '\n\n---\n\n' + SYNTHESIS_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Synthesize all research into a cross-analysis strategic summary:\n\n${context}` }],
        });
        return Promise.race([
          runner.runUntilDone(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Sub-agent timed out after 120s')), 120_000)),
        ]);
      },
      'synthesizeResearch',
    );
    const textBlock = finalMsg.content.findLast((b: BetaContentBlock) => b.type === 'text');
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';
    let data: unknown;
    try {
      const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/) ??
        resultText.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : resultText.trim();
      data = JSON.parse(jsonStr);
    } catch {
      data = { summary: resultText };
    }
    return { status: 'complete', section: 'crossAnalysis', data, durationMs: Date.now() - startTime };
  } catch (error) {
    return { status: 'error', section: 'crossAnalysis', error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startTime };
  }
}
