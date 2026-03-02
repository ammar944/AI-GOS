// Research Tool: Cross-Analysis Synthesis
// Sprint 3 T3.3 — Anthropic SDK sub-agent with no external tools (pure synthesis)

import { tool } from 'ai';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

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

OUTPUT FORMAT:
Respond with a JSON object. Structure:
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
  "strategicNarrative": "string — 2-3 paragraph summary of the complete paid media strategy"
}`;

export const synthesizeResearch = tool({
  description:
    'Synthesise all completed research into a cross-analysis strategic summary. ' +
    'Runs a Claude Opus sub-agent (no external tools — pure synthesis) to produce: ' +
    'key insights, recommended platforms, strategic narrative, and media buying priorities. ' +
    'ONLY call this after all 4 prior research tools have completed successfully. ' +
    'Pass summaries of all 4 prior research outputs in the context parameter.',
  inputSchema: z.object({
    context: z
      .string()
      .describe(
        'Assembled context including onboarding fields AND summaries of all 4 completed research sections',
      ),
  }),
  execute: async ({ context }) => {
    const client = new Anthropic();
    const startTime = Date.now();

    try {
      const stream = client.beta.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 8000,
        tools: [],
        system: SYNTHESIS_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Synthesize all research into a cross-analysis strategic summary:\n\n${context}`,
          },
        ],
      });

      const finalMsg = await stream.finalMessage();

      const textBlock = finalMsg.content.find((b) => b.type === 'text');
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

      return {
        status: 'complete' as const,
        section: 'crossAnalysis' as const,
        data,
        sources: [],
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'error' as const,
        section: 'crossAnalysis' as const,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
});
