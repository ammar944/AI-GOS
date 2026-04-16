/**
 * Opportunity card synthesizer — Phase 6.2.1.
 * Uses Haiku to identify 1-3 timing-sensitive market opportunities backed
 * by wiki evidence. Gates on thin evidence (<3 entries) and returns an
 * empty array rather than fabricating. Validation is done by the dispatcher
 * after this function returns — do not validate here.
 */
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../../models';
import { loadMethodology } from '../../skills/loader';
import { formatEvidencePack } from '../evidence-packer';
import type { EvidencePack } from '../types';
import { opportunityCardSchema, type OpportunityCard } from '../schemas/opportunity';

const TIMEOUT_MS = 45_000;

/** Extract JSON from a response that may contain fenced code blocks or prose. */
function extractJson(text: string): string {
  // Try fenced ```json ... ``` first
  const fenceMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try plain ``` ... ```
  const plainFence = text.match(/```\s*([\s\S]*?)```/);
  if (plainFence) return plainFence[1].trim();

  // Fall back to first { ... } block
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }

  return text.trim();
}

export async function synthesizeOpportunity(
  pack: EvidencePack,
  deps?: { client?: Anthropic },
): Promise<OpportunityCard> {
  // Gate on thin evidence — methodology says "fewer than 3 distinct market signals → return empty"
  if (pack.entries.length < 3) {
    return { opportunities: [] };
  }

  const client = deps?.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const methodology = loadMethodology('market-opportunity.md');

  const systemPrompt = [
    'You are a senior paid-media strategist.',
    'Follow the methodology below exactly.',
    'Your output must be strict JSON matching the schema the methodology specifies.',
    'No preamble. No fences.',
    '',
    methodology,
    '',
    'Every opportunity MUST be wrapped in { "value": {...}, "evidenceIds": ["topic#N", ...], "confidence": 0-100 } and cite at least 1 evidenceId from the EVIDENCE PACK below.',
  ].join('\n');

  const evidenceBlock = formatEvidencePack(pack);
  const identityBlock = pack.identityCard
    ? `\n\nIDENTITY:\n${JSON.stringify(pack.identityCard, null, 2)}`
    : '';

  const userPrompt = [
    `EVIDENCE PACK:`,
    evidenceBlock,
    identityBlock,
    '',
    'Return JSON: { "opportunities": [ { "value": {...}, "evidenceIds": [...], "confidence": N } ] }.',
    'Return {"opportunities": []} if fewer than 2 opportunities pass the quality gate.',
  ].join('\n');

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('[opportunity] Anthropic call timed out')), TIMEOUT_MS),
  );

  let rawText: string;
  try {
    const response = await Promise.race([
      client.messages.create({
        model: MODELS.FAST,
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      timeoutPromise,
    ]);

    const textBlock = response.content.find((b) => b.type === 'text');
    rawText = textBlock ? (textBlock as { type: 'text'; text: string }).text : '';
  } catch (err) {
    console.warn('[opportunity] Anthropic call failed:', err);
    return { opportunities: [] };
  }

  try {
    const json = extractJson(rawText);
    const parsed = JSON.parse(json);
    return opportunityCardSchema.parse(parsed);
  } catch (err) {
    console.warn('[opportunity] schema validation failed:', err);
    return { opportunities: [] };
  }
}
