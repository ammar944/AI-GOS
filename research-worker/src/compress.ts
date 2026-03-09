import Anthropic from '@anthropic-ai/sdk';
import { CompressedSummarySchema, type CompressedSummary } from './schemas/compressed-summary';
import { extractJson } from './runner';

const COMPRESSION_PROMPT = `Condense this research output into a structured summary.
Focus on actionable findings for a paid media strategy. Max 1500 tokens total.

Rules:
- keyFindings: 3-7 bullet points, most important first
- dataPoints: Extract specific numbers, percentages, dollar amounts
- confidence: high (multiple quality sources), medium (some sources), low (limited data)
- sources: List URLs/references used
- gaps: What couldn't be found or verified

Respond with JSON only. No preamble.`;

export async function compressResearchOutput(
  section: string,
  rawData: unknown,
): Promise<CompressedSummary> {
  try {
    const client = new Anthropic({ maxRetries: 1 });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `${COMPRESSION_PROMPT}\n\nSection: ${section}\n\nRaw research data:\n${JSON.stringify(rawData, null, 2)}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';
    const parsed = extractJson(text);
    const validated = CompressedSummarySchema.parse(parsed);
    return validated;
  } catch (error) {
    console.warn(`[compress] Haiku compression failed for ${section}:`, error);
    return buildFallbackSummary(section, rawData);
  }
}

function buildFallbackSummary(section: string, rawData: unknown): CompressedSummary {
  const dataStr = JSON.stringify(rawData);

  return {
    keyFindings: [`Raw ${section} data available (compression failed)`],
    dataPoints: { rawLength: `${dataStr.length} chars` },
    confidence: 'low',
    sources: [],
    gaps: ['Compression failed — raw data preserved but not structured'],
  };
}
