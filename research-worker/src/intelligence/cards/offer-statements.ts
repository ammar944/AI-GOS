/**
 * Offer statement card synthesizer — Phase 6.2.3.
 * Uses Haiku to generate 1-5 high-signal offer statements backed by wiki evidence.
 * Applies Hormozi Value Equation axes + Schwartz Awareness levels.
 * Gates on thin evidence (<3 entries) and on missing offer evidence.
 * Returns an empty array rather than fabricating — empty is better than fabricated.
 */
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../../models';
import { loadMethodology } from '../../skills/loader';
import { formatEvidencePack } from '../evidence-packer';
import type { EvidencePack } from '../types';
import { offerStatementCardSchema, type OfferStatementCard } from '../schemas/offer-statement';

const TIMEOUT_MS = 45_000;

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

export async function synthesizeOfferStatements(
  pack: EvidencePack,
  deps?: { client?: Anthropic },
): Promise<OfferStatementCard> {
  // Gate 1 — thin evidence: methodology requires at least 3 distinct signals
  if (pack.entries.length < 3) {
    return { statements: [] };
  }

  // Gate 2 — offer presence: this card is meaningless without offer data to riff on
  const hasOfferEvidence = pack.entries.some((e) => e.topic.startsWith('offer_'));
  if (!hasOfferEvidence) {
    return { statements: [] };
  }

  const client = deps?.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const methodology = loadMethodology('offer-statement.md');

  const systemPrompt = [
    'You are a world-class direct-response copywriter and offer strategist.',
    'Follow the methodology below exactly.',
    'Output strict JSON matching the schema the methodology specifies.',
    'No preamble. No fences.',
    '',
    methodology,
    '',
    'Every statement MUST be wrapped in { "value": {...}, "evidenceIds": ["topic#N", ...], "confidence": 0-100 } and cite at least 1 evidenceId from the EVIDENCE PACK below.',
    'Empty is better than fabricated — return {"statements": []} if fewer than 2 statements pass the quality gate.',
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
    'Return JSON: { "statements": [ { "value": {...}, "evidenceIds": [...], "confidence": N } ] }.',
    'Return {"statements": []} if fewer than 2 statements pass the quality gate.',
  ].join('\n');

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('[offer-statements] Anthropic call timed out')), TIMEOUT_MS);
  });

  let rawText = '';
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
    rawText = textBlock && textBlock.type === 'text' ? textBlock.text : '';
  } catch (err) {
    console.warn('[offer-statements] Anthropic call failed:', err);
    return { statements: [] };
  }

  let parsed: unknown;
  try {
    parsed = extractJson(rawText);
  } catch (err) {
    console.warn('[offer-statements] JSON extraction failed:', err);
    return { statements: [] };
  }

  try {
    return offerStatementCardSchema.parse(parsed);
  } catch (err) {
    console.warn('[offer-statements] schema validation failed:', err);
    return { statements: [] };
  }
}
