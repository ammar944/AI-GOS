import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { createClient, runWithBackoff, extractJson } from '../runner';
import { spyfuTool } from '../tools';
import type { ResearchResult } from '../supabase';

const KEYWORDS_SYSTEM_PROMPT = `You are a paid search keyword intelligence specialist.

TASK: Find the highest-value keyword opportunities for this business to target with paid search.

RESEARCH FOCUS:
1. Head terms with buying intent ("inventory forecasting software", "stockout prevention")
2. Competitor alternative terms ("[competitor name] alternative", "[competitor] vs [product]")
3. Pain-point terms ("prevent stockouts", "reduce inventory costs")
4. Long-tail terms with lower competition and clear intent

TOOL USAGE:
Use the spyfu tool to:
1. Look up organic/paid keywords for the main category
2. Find what competitor keywords they rank for that you don't
3. Identify high-volume, lower-difficulty opportunities

OUTPUT FORMAT:
Respond with JSON only. No preamble. No markdown fences. Start with {.

{
  "totalKeywordsFound": number,
  "competitorGapCount": number,
  "topOpportunities": [
    {
      "keyword": "string",
      "searchVolume": number,
      "difficulty": "low | medium | high",
      "estimatedCpc": "string e.g. $4.20"
    }
  ],
  "competitorGaps": [
    {
      "keyword": "string",
      "competitorName": "string",
      "volume": number
    }
  ],
  "quickWins": ["string — 3 immediately actionable recommendations"]
}`;

export async function runResearchKeywords(context: string): Promise<ResearchResult> {
  const client = createClient();
  const startTime = Date.now();
  try {
    const finalMsg = await runWithBackoff(
      () => {
        const runner = client.beta.messages.toolRunner({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          tools: [spyfuTool],
          system: KEYWORDS_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Find keyword opportunities for:\n\n${context}` }],
        });
        return Promise.race([
          runner.runUntilDone(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Sub-agent timed out after 120s')), 120_000)),
        ]);
      },
      'researchKeywords',
    );
    const textBlock = finalMsg.content.findLast((b: BetaContentBlock) => b.type === 'text');
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';
    let data: unknown;
    try { data = extractJson(resultText); } catch {
      console.error('[keywords] JSON extraction failed:', resultText.slice(0, 300));
      data = { summary: resultText };
    }
    return { status: 'complete', section: 'keywordIntel', data, durationMs: Date.now() - startTime };
  } catch (error) {
    return { status: 'error', section: 'keywordIntel', error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startTime };
  }
}
