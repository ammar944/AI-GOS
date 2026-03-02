// Research Tool: Competitor Analysis
// Sprint 3 T3.3 — Anthropic SDK sub-agent with perplexitySearch, adLibrary, spyFu, and pageSpeed

import { tool } from 'ai';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { perplexitySearch } from '@/lib/ai/tools/perplexity-search';
import { adLibraryTool, spyfuTool, pagespeedTool } from '@/lib/ai/tools/mcp';

const COMPETITORS_SYSTEM_PROMPT = `You are an expert competitive analyst researching the competitor landscape for a paid media strategy.

TASK: Research competitors to inform paid media positioning and messaging.

CRITICAL — COMPETITOR DISAMBIGUATION:
- When multiple companies share a similar name, identify which one operates in the SAME product category and serves the SAME target audience as the business being analyzed
- Verify each competitor's PRIMARY product/service matches the market segment described in the context
- Exclude companies that are homonyms serving completely different industries
- ALWAYS include the competitor's official website URL
- When in doubt between similar-named companies, choose the one with the most similar target customer, product category, and go-to-market approach

TOOL USAGE PLAN:
1. Use perplexitySearch to identify 3-5 direct competitors and their positioning
2. Use perplexitySearch again to find competitor weaknesses from G2 and Capterra reviews
3. Use adLibraryTool to check competitor ad creatives (use their domain names)
4. Use spyfuTool for keyword and spend intelligence on each competitor
5. Use pagespeedTool to benchmark competitor landing pages

RESEARCH FOCUS:
- Competitor positioning and messaging
- Strengths and weaknesses from G2, Capterra reviews
- Market patterns and gaps (white space)
- Ad strategies and creative angles

COMPETITOR THREAT ASSESSMENT:
For each competitor, score these 5 threat factors (1-10 each):
- marketShareRecognition: Brand recognition and market share
- adSpendIntensity: Estimated monthly ad spend level
- productOverlap: Feature overlap with client offer
- priceCompetitiveness: Price competitiveness vs client
- growthTrajectory: Funding, hiring, feature velocity

WHITE SPACE ANALYSIS:
Identify gaps using this framework:
1. Messaging White Space — messaging angles NO competitor is using
2. Feature/Capability White Space — capabilities unaddressed or addressed poorly
3. Audience White Space — ICP sub-segments competitors are ignoring
4. Channel White Space — platforms with few active competitor ads

OUTPUT FORMAT:
After completing your research, respond with a JSON object. Structure:
{
  "competitors": [
    {
      "name": "string",
      "website": "string — official URL",
      "positioning": "string — their core value proposition",
      "price": "string — pricing tier or 'See pricing page'",
      "strengths": ["string"],
      "weaknesses": ["string"],
      "adPlatforms": ["string — platforms they advertise on"],
      "threatFactors": {
        "marketShareRecognition": 1-10,
        "adSpendIntensity": 1-10,
        "productOverlap": 1-10,
        "priceCompetitiveness": 1-10,
        "growthTrajectory": 1-10
      }
    }
  ],
  "marketPatterns": ["string — patterns across the competitive landscape"],
  "whiteSpaceGaps": [
    {
      "description": "string",
      "type": "messaging | feature | audience | channel",
      "evidence": "string — what competitors do instead",
      "exploitabilityScore": 1-10,
      "impactScore": 1-10,
      "recommendedAction": "string"
    }
  ],
  "overallLandscape": "string — summary of competitive landscape"
}`;

export const researchCompetitors = tool({
  description:
    'Research competitors for the client\'s business using live web data, ad library analysis, ' +
    'SpyFu keyword intelligence, and PageSpeed benchmarks. ' +
    'Runs a Claude Opus sub-agent with perplexitySearch, adLibrary, spyFu, and pageSpeed tools. ' +
    'Call this after researchIndustry completes AND productDescription is collected.',
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
        tools: [perplexitySearch, adLibraryTool, spyfuTool, pagespeedTool],
        system: COMPETITORS_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Research competitors for:\n\n${context}`,
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
        section: 'competitors' as const,
        data,
        sources: [],
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'error' as const,
        section: 'competitors' as const,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
});
