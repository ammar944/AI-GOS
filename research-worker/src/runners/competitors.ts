import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { createClient, runWithBackoff, extractJson } from '../runner';
import { adLibraryTool, spyfuTool, pagespeedTool } from '../tools';
import type { ResearchResult } from '../supabase';

const COMPETITOR_ANALYSIS_SKILL = `
## Competitive Analysis Domain Knowledge

### Ad Library Interpretation
- 0-5 active ads: testing phase or low investment
- 5-20 active ads: established presence, iterating
- 20-50 active ads: scaling actively, well-funded
- 50+ active ads: dominant advertiser, heavy investment

### Competitive Positioning Frameworks
- Category leader: focuses on market share ("the #1 X")
- Challenger: attacks leader's weakness ("X without the [pain]")
- Niche specialist: owns a segment ("the only X for [ICP]")
- Price disruptor: "enterprise features at SMB prices"

### Review Mining (G2/Capterra) Patterns
- Look for reviews mentioning "switched from X" — reveals switching triggers
- 1-2 star reviews reveal acute pain points = your messaging hooks
- Feature requests in reviews = product gaps = white space opportunity
- "What do you wish it did" reviews = unmet needs your offer should address

### White Space Identification
- Messaging white space: emotional angles no one owns
- Audience white space: ICP sub-segments being ignored
- Channel white space: platforms with weak competitor presence
- Feature white space: capabilities no one talks about in ads
`;

const COMPETITORS_SYSTEM_PROMPT = `You are an expert competitive analyst researching the competitor landscape for a paid media strategy.

TASK: Research competitors to inform paid media positioning and messaging.

CRITICAL — COMPETITOR DISAMBIGUATION:
- When multiple companies share a similar name, identify which one operates in the SAME product category and serves the SAME target audience as the business being analyzed
- Verify each competitor's PRIMARY product/service matches the market segment described in the context
- Exclude companies that are homonyms serving completely different industries
- ALWAYS include the competitor's official website URL
- When in doubt between similar-named companies, choose the one with the most similar target customer, product category, and go-to-market approach

TOOL USAGE PLAN:
1. Use web_search to identify 3-5 direct competitors, their positioning, and weaknesses from G2/Capterra
2. Use adLibraryTool to check competitor ad creatives (use their domain names)
3. Use spyfuTool for keyword and spend intelligence on the top 1-2 competitors

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
CRITICAL: Your ENTIRE response MUST be the JSON object ONLY. No preamble, no explanation, no markdown code fences. Start your response with { and end with }.

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

export async function runResearchCompetitors(context: string): Promise<ResearchResult> {
  const client = createClient();
  const startTime = Date.now();
  try {
    const finalMsg = await runWithBackoff(
      () => {
        const runner = client.beta.messages.toolRunner({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }, adLibraryTool, spyfuTool, pagespeedTool],
          system: COMPETITOR_ANALYSIS_SKILL + '\n\n---\n\n' + COMPETITORS_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Research competitors for:\n\n${context}` }],
        });
        return Promise.race([
          runner.runUntilDone(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Sub-agent timed out after 240s')), 240_000)),
        ]);
      },
      'researchCompetitors',
    );
    const textBlock = finalMsg.content.findLast((b: BetaContentBlock) => b.type === 'text');
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';
    let data: unknown;
    try { data = extractJson(resultText); } catch {
      console.error('[competitors] JSON extraction failed:', resultText.slice(0, 300));
      data = { summary: resultText };
    }
    return { status: 'complete', section: 'competitors', data, durationMs: Date.now() - startTime };
  } catch (error) {
    return { status: 'error', section: 'competitors', error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startTime };
  }
}
