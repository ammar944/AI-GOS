/**
 * White-space gap card synthesizer — Phase 6.2.2.
 * Uses Haiku to identify competitive positioning gaps backed by wiki evidence.
 * Gates on thin evidence (<3 entries) AND on missing competitor names.
 * Post-synthesis filter removes any gap whose targetCompetitor is not in the
 * evidence pack's competitor_name entries (case-insensitive substring match).
 */
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../../models';
import { loadMethodology } from '../../skills/loader';
import { formatEvidencePack } from '../evidence-packer';
import type { EvidencePack } from '../types';
import { whiteSpaceGapCardSchema, type WhiteSpaceGapCard } from '../schemas/gap';

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

export async function synthesizeWhiteSpaceGap(
  pack: EvidencePack,
  deps?: { client?: Anthropic },
): Promise<WhiteSpaceGapCard> {
  // Gate 1 — thin evidence
  if (pack.entries.length < 3) {
    return { gaps: [] };
  }

  // Gate 2 — must have at least one known competitor name to target
  const competitorNames = pack.entries
    .filter((e) => e.topic === 'competitor_name')
    .map((e) => e.content.trim())
    .filter((n) => n.length > 0);
  if (competitorNames.length === 0) {
    return { gaps: [] };
  }

  const client = deps?.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const methodology = loadMethodology('positioning-move.md');

  const system = [
    'You are a senior paid-media strategist and competitive positioning expert. Follow the methodology below exactly. Your output must be strict JSON matching the schema the methodology specifies. No preamble. No fences.',
    '',
    methodology,
    '',
    'Every gap MUST be wrapped in { "value": {...}, "evidenceIds": ["topic#N", ...], "confidence": 0-100 } and cite at least 1 evidenceId from the EVIDENCE PACK below.',
    "Every gap's targetCompetitor MUST match a name from the COMPETITORS block below. Do NOT invent competitors.",
  ].join('\n');

  const identityBlock = pack.identityCard
    ? `\nIDENTITY:\n${JSON.stringify(pack.identityCard, null, 2)}\n`
    : '';
  const competitorsBlock = `\nCOMPETITORS (names you may target):\n${competitorNames.map((n) => `- ${n}`).join('\n')}\n`;

  const user = [
    `CARD: ${pack.cardName}`,
    `SECTION: ${pack.section}`,
    '',
    'EVIDENCE PACK:',
    formatEvidencePack(pack),
    identityBlock,
    competitorsBlock,
    '',
    'Return JSON: { "gaps": [ { "value": {...}, "evidenceIds": [...], "confidence": N } ] }. Every gap\'s targetCompetitor must match a name from COMPETITORS. Return {"gaps": []} if fewer than 1 gap passes the quality gate.',
  ].join('\n');

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('[white-space-gap] Anthropic call timed out')), TIMEOUT_MS);
  });

  let rawText = '';
  try {
    const response = await Promise.race([
      client.messages.create({
        model: MODELS.FAST,
        max_tokens: 3000,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      timeoutPromise,
    ]);
    const textBlock = response.content.find((b) => b.type === 'text');
    rawText = textBlock && textBlock.type === 'text' ? textBlock.text : '';
  } catch (err) {
    console.warn('[white-space-gap] Anthropic call failed:', err);
    return { gaps: [] };
  }

  let parsed: unknown;
  try {
    parsed = extractJson(rawText);
  } catch (err) {
    console.warn('[white-space-gap] JSON extraction failed:', err);
    return { gaps: [] };
  }

  let validated: WhiteSpaceGapCard;
  try {
    validated = whiteSpaceGapCardSchema.parse(parsed);
  } catch (err) {
    console.warn('[white-space-gap] schema validation failed:', err);
    return { gaps: [] };
  }

  // Post-synthesis competitor filter — drop gaps whose targetCompetitor doesn't
  // match any name from the evidence pack (case-insensitive substring).
  const validNameSet = competitorNames.map((n) => n.toLowerCase());
  const filteredGaps = validated.gaps.filter((g) => {
    const target = g.value.targetCompetitor.toLowerCase();
    return validNameSet.some((name) => target.includes(name) || name.includes(target));
  });

  const removedCount = validated.gaps.length - filteredGaps.length;
  if (removedCount > 0) {
    console.warn(`[white-space-gap] filtered ${removedCount} gap(s) with unknown competitor`);
  }

  return { gaps: filteredGaps };
}
