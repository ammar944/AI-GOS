/**
 * Strategic synthesis card synthesizer — Phase 6.2.4.
 * Uses Sonnet (MODELS.STANDARD) to produce a readiness scorecard across 5
 * dimensions, top actions, and a strategic narrative — consuming ALL wiki
 * entries from the evidence pack.
 *
 * DIMENSION_SOURCE_MAP enforcement: dimensions with no matching wiki entries
 * are forced to score=0/verdict='red'/summary='Insufficient data' regardless
 * of what the model returns. Overall score and verdict are recomputed after
 * enforcement.
 *
 * Gates on thin evidence (<5 entries). Returns null when gated or on any
 * failure — callers treat null as "no synthesis available".
 */
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../../models';
import { loadMethodology } from '../../skills/loader';
import { formatEvidencePack } from '../evidence-packer';
import type { EvidencePack } from '../types';
import { strategicSynthesisCardSchema, type StrategicSynthesisCard } from '../schemas/synthesis';

const TIMEOUT_MS = 60_000;

/**
 * Maps each scorecard dimension to the wiki topic prefix that provides
 * its source evidence. A dimension with zero matching entries is forced
 * to score=0/verdict='red' after schema parsing.
 */
const DIMENSION_SOURCE_MAP: Record<string, string> = {
  'Market Opportunity': 'market_',
  'Audience Clarity': 'icp_',
  'Competitive Position': 'competitor_',
  'Offer Strength': 'offer_',
  'Keyword Coverage': 'keyword_',
};

/** Extract JSON from a response that may contain fenced code blocks or prose. */
function extractJson(text: string): unknown {
  // Try fenced ```json ... ``` first
  const fenceMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (fenceMatch) return JSON.parse(fenceMatch[1].trim());

  // Try plain ``` ... ```
  const plainFence = text.match(/```\s*([\s\S]*?)```/);
  if (plainFence) return JSON.parse(plainFence[1].trim());

  // Fall back to first { ... } block
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    return JSON.parse(text.slice(braceStart, braceEnd + 1));
  }

  return JSON.parse(text.trim());
}

/**
 * Compute overall verdict from overall score.
 * red < 4, yellow 4-6, green > 6.
 */
function verdictFromScore(score: number): 'red' | 'yellow' | 'green' {
  if (score > 6) return 'green';
  if (score >= 4) return 'yellow';
  return 'red';
}

export async function synthesizeStrategicSynthesis(
  pack: EvidencePack,
  deps?: { client?: Anthropic },
): Promise<StrategicSynthesisCard | null> {
  // Gate on thin evidence — strategic synthesis needs broad coverage across
  // multiple sections. Fewer than 5 entries means we cannot score meaningfully.
  if (pack.entries.length < 5) {
    return null;
  }

  // Build presence map: which dimensions have supporting wiki entries?
  const sectionsPresent = new Set<string>();
  for (const entry of pack.entries) {
    for (const [dim, prefix] of Object.entries(DIMENSION_SOURCE_MAP)) {
      if (entry.topic.startsWith(prefix)) sectionsPresent.add(dim);
    }
  }

  // Phase 6.3.2 — require at least 3 distinct sections have wiki entries.
  // Sections are keyed by dimension name; each maps to a unique topic prefix.
  // Fewer than 3 sections means the synthesis would span too narrow a base to
  // produce a meaningful cross-dimensional scorecard.
  if (sectionsPresent.size < 3) {
    return null;
  }

  const client = deps?.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const methodology = loadMethodology('readiness-scorecard.md');

  const systemPrompt = [
    'You are a senior paid-media strategist and growth consultant.',
    'Follow the readiness scorecard methodology below exactly.',
    'Output strict JSON matching the schema specified. No preamble. No fences.',
    '',
    methodology,
    '',
    'EVIDENCE WRAPPING: Every dimension in readinessScorecard.dimensions and every item in topActions MUST be wrapped in:',
    '  { "value": {...}, "evidenceIds": ["topic#N", ...], "confidence": 0-100 }',
    'where evidenceIds cite at least 1 entry from the EVIDENCE PACK below.',
    '',
    'You MUST include all 5 dimensions in the scorecard even if some have thin data.',
    'Set score=0 and verdict="red" for dimensions with insufficient evidence.',
    'The 5 required dimensions are: "Market Opportunity", "Audience Clarity", "Competitive Position", "Offer Strength", "Keyword Coverage".',
  ].join('\n');

  const evidenceBlock = formatEvidencePack(pack);
  const identityBlock = pack.identityCard
    ? `\n\nIDENTITY:\n${JSON.stringify(pack.identityCard, null, 2)}`
    : '';

  const userPrompt = [
    `CARD: ${pack.cardName}`,
    `SECTION: ${pack.section}`,
    '',
    'EVIDENCE PACK:',
    evidenceBlock,
    identityBlock,
    '',
    'Return JSON with this exact shape:',
    '{',
    '  "readinessScorecard": {',
    '    "overallScore": <mean of all 5 dimension scores>,',
    '    "overallVerdict": "red"|"yellow"|"green",',
    '    "dimensions": [ { "value": { "dimension": "...", "score": N, "verdict": "...", "summary": "...", "topSignals": [...] }, "evidenceIds": [...], "confidence": N }, ... ]',
    '  },',
    '  "topActions": [ { "value": { "action": "...", "category": "...", "effort": "...", "impact": "...", "rationale": "..." }, "evidenceIds": [...], "confidence": N }, ... ],',
    '  "strategicNarrative": "..."',
    '}',
  ].join('\n');

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error('[strategic-synthesis] Anthropic call timed out')),
      TIMEOUT_MS,
    );
  });

  let rawText = '';
  try {
    const response = await Promise.race([
      client.messages.create({
        model: MODELS.STANDARD,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      timeoutPromise,
    ]);
    const textBlock = response.content.find((b) => b.type === 'text');
    rawText = textBlock && textBlock.type === 'text' ? textBlock.text : '';
  } catch (err) {
    console.warn('[strategic-synthesis] Anthropic call failed:', err);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = extractJson(rawText);
  } catch (err) {
    console.warn('[strategic-synthesis] JSON extraction failed:', err);
    return null;
  }

  let validated: StrategicSynthesisCard;
  try {
    validated = strategicSynthesisCardSchema.parse(parsed);
  } catch (err) {
    console.warn('[strategic-synthesis] schema validation failed:', err);
    return null;
  }

  // DIMENSION_SOURCE_MAP enforcement — force score=0/verdict='red' for any
  // dimension whose source section is absent from the evidence pack.
  const enforcedDimensions = validated.readinessScorecard.dimensions.map((item) => {
    const dim = item.value.dimension;
    if (!sectionsPresent.has(dim)) {
      return {
        ...item,
        value: {
          ...item.value,
          score: 0,
          verdict: 'red' as const,
          summary: 'Insufficient data — section not completed.',
        },
      };
    }
    return item;
  });

  // Recompute overall score as mean of all dimension scores after enforcement.
  const dimensionScores = enforcedDimensions.map((d) => d.value.score);
  const overallScore =
    dimensionScores.length > 0
      ? Math.round((dimensionScores.reduce((a, b) => a + b, 0) / dimensionScores.length) * 10) / 10
      : 0;

  const overallVerdict = verdictFromScore(overallScore);

  const finalCard: StrategicSynthesisCard = {
    ...validated,
    readinessScorecard: {
      overallScore,
      overallVerdict,
      dimensions: enforcedDimensions,
    },
  };

  // Phase 6.3.2 — if overall readiness is critically low, don't render a card.
  // An inferred synthesis from thin data degrades the user's trust more than
  // showing no card at all.
  if (finalCard.readinessScorecard.overallScore < 2) {
    return null;
  }

  return finalCard;
}
