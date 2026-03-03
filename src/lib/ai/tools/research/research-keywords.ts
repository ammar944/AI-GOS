// Research Tool: Keyword Intelligence
// Sprint 4 — SpyFu sub-agent for paid search keyword opportunities

import { tool } from 'ai';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { spyfuTool } from '@/lib/ai/tools/mcp/spyfu-tool';

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // Strategy 1: direct parse (model followed JSON-only instruction)
  try { return JSON.parse(trimmed); } catch {}
  // Strategy 2: fenced code block ```json ... ``` or ``` ... ```
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  // Strategy 3: slice from first { to last } (strips prose preamble/suffix)
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) { return JSON.parse(trimmed.slice(first, last + 1)); }
  throw new Error('No parseable JSON found');
}

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

export const researchKeywords = tool({
  description:
    'Research keyword intelligence for paid search campaigns. ' +
    'Runs a Claude Opus sub-agent with SpyFu to identify high-value search terms, ' +
    'competitor keyword gaps, and quick-win opportunities. ' +
    'Call this after synthesizeResearch completes.',
  inputSchema: z.object({
    context: z.string().describe(
      'Business context including product description, competitors identified, and platform recommendations from synthesis'
    ),
  }),
  execute: async ({ context }) => {
    const client = new Anthropic();
    const startTime = Date.now();

    try {
      const stream = client.beta.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 4000,
        tools: [spyfuTool],
        system: KEYWORDS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Find keyword opportunities for:\n\n${context}` }],
      });

      const finalMsg = await stream.finalMessage();
      const textBlock = finalMsg.content.findLast((b) => b.type === 'text');
      const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';

      let data: unknown;
      try { data = extractJson(resultText); } catch {
        console.error('[researchKeywords] JSON extraction failed:', resultText.slice(0, 200));
        data = { summary: resultText };
      }

      return {
        status: 'complete' as const,
        section: 'keywordIntel' as const,
        data,
        sources: [],
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: 'error' as const,
        section: 'keywordIntel' as const,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  },
});
