/**
 * Claim validator — batch Haiku call that checks each claim in a card
 * draft cites a real evidenceId AND aligns with the entry's content.
 *
 * Kill switch: INTELLIGENCE_VALIDATOR=false bypasses (returns draft as-is,
 * confidence 100). Useful for emergency rollback without code change.
 */
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../models';
import { formatEvidencePack } from './evidence-packer';
import { extractJsonObject } from './cards/_shared';
import type { EvidencePack } from './types';

export interface ValidationResult<T> {
  validated: T;
  rejected: string[];
  confidence: number;
}

interface ValidatorDeps {
  client?: Anthropic;
  now?: () => number;
}

/**
 * Validate claims in a card draft against its evidence pack.
 * Returns the draft with unsupported claims filtered OR the original draft
 * when the kill switch is set.
 */
export async function validateCardClaims<T>(
  cardName: string,
  draft: T,
  pack: EvidencePack,
  deps: ValidatorDeps = {},
): Promise<ValidationResult<T>> {
  if (process.env.INTELLIGENCE_VALIDATOR === 'false') {
    return { validated: draft, rejected: [], confidence: 100 };
  }

  if (pack.entries.length === 0) {
    // No evidence → every claim is unsupported. Caller should have gated.
    return { validated: draft, rejected: ['no_evidence_available'], confidence: 0 };
  }

  const client = deps.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const system = `You are a claims auditor for marketing research synthesis.

Your task: audit each claim in the provided DRAFT JSON. For each claim:
1. Confirm it cites at least one evidenceId from the EVIDENCE PACK.
2. Confirm the cited evidence actually supports the claim's content.
3. Reject claims that fail either check.

Return STRICT JSON only:
{
  "validated": <the DRAFT with unsupported claims removed>,
  "rejected": ["short description of each rejected claim"],
  "confidence": 0-100
}

Confidence reflects overall evidence coverage, not per-claim. 100 = every claim tightly grounded; 0 = no grounding.`;

  const user = `CARD: ${cardName}

EVIDENCE PACK:
${formatEvidencePack(pack)}

DRAFT:
${JSON.stringify(draft, null, 2)}

Audit the DRAFT. Return the validated JSON.`;

  try {
    const response = await client.messages.create({
      model: MODELS.FAST,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textBlock = response.content.findLast((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return { validated: draft, rejected: ['validator_no_output'], confidence: 50 };
    }

    const parsed = extractJsonObject(textBlock.text);
    if (!parsed || typeof parsed !== 'object') {
      return { validated: draft, rejected: ['validator_parse_failed'], confidence: 50 };
    }

    const obj = parsed as Record<string, unknown>;
    return {
      validated: (obj.validated as T) ?? draft,
      rejected: Array.isArray(obj.rejected) ? (obj.rejected as string[]) : [],
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 50,
    };
  } catch (err) {
    console.warn(`[validator] ${cardName}: non-fatal validator failure:`, err);
    return { validated: draft, rejected: ['validator_error'], confidence: 50 };
  }
}

// ---------------------------------------------------------------------------
// Batch validator (Phase 2.5)
//
// Collapses up to N card-audit calls into a single Haiku request. Same auditor
// semantics per card; the model returns an object keyed by cardName. Falls
// back to per-card validation on parse failure so behavior degrades gracefully.
//
// Enable with INTELLIGENCE_VALIDATOR_BATCH=true. Dispatcher routes here when
// the flag is set; otherwise it keeps calling validateCardClaims per card.
// ---------------------------------------------------------------------------

export interface BatchValidationInput<T> {
  cardName: string;
  draft: T;
  pack: EvidencePack;
}

export type BatchValidationOutput<T> = Record<string, ValidationResult<T>>;

export async function validateCardsBatch<T>(
  inputs: BatchValidationInput<T>[],
  deps: ValidatorDeps = {},
): Promise<BatchValidationOutput<T>> {
  if (process.env.INTELLIGENCE_VALIDATOR === 'false') {
    const out: BatchValidationOutput<T> = {};
    for (const i of inputs) {
      out[i.cardName] = { validated: i.draft, rejected: [], confidence: 100 };
    }
    return out;
  }

  if (inputs.length === 0) return {};

  const nonEmpty = inputs.filter((i) => i.pack.entries.length > 0);
  if (nonEmpty.length === 0) {
    const out: BatchValidationOutput<T> = {};
    for (const i of inputs) {
      out[i.cardName] = { validated: i.draft, rejected: ['no_evidence_available'], confidence: 0 };
    }
    return out;
  }

  const client = deps.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const system = `You are a claims auditor for marketing research synthesis, running a batch audit.

You will receive multiple CARDS, each with its own EVIDENCE PACK and DRAFT JSON.
For each card:
1. Confirm each claim cites at least one evidenceId from its EVIDENCE PACK.
2. Confirm the cited evidence actually supports the claim.
3. Reject claims that fail either check.

Return STRICT JSON only, keyed by cardName:
{
  "<cardName1>": { "validated": <draft with unsupported claims removed>, "rejected": [...], "confidence": 0-100 },
  "<cardName2>": { ... },
  ...
}

Confidence per card = overall evidence coverage for that card. Do not mix evidence across cards.`;

  const userParts = nonEmpty.map((i) =>
    `=== CARD: ${i.cardName} ===\n\nEVIDENCE PACK:\n${formatEvidencePack(i.pack)}\n\nDRAFT:\n${JSON.stringify(i.draft, null, 2)}`,
  );
  const user = `Audit the following ${nonEmpty.length} card(s). Return the batched JSON.\n\n${userParts.join('\n\n')}`;

  try {
    const response = await client.messages.create({
      model: MODELS.FAST,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const textBlock = response.content.findLast((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return fallbackPerCard(inputs, deps);
    }

    const parsed = extractJsonObject(textBlock.text);
    if (!parsed || typeof parsed !== 'object') {
      return fallbackPerCard(inputs, deps);
    }

    const obj = parsed as Record<string, unknown>;
    const out: BatchValidationOutput<T> = {};
    for (const i of inputs) {
      const cardOut = obj[i.cardName];
      if (!cardOut || typeof cardOut !== 'object') {
        // Missing this card in the batch response — degrade to draft passthrough.
        out[i.cardName] = { validated: i.draft, rejected: ['validator_batch_missing'], confidence: 50 };
        continue;
      }
      const c = cardOut as Record<string, unknown>;
      out[i.cardName] = {
        validated: (c.validated as T) ?? i.draft,
        rejected: Array.isArray(c.rejected) ? (c.rejected as string[]) : [],
        confidence: typeof c.confidence === 'number' ? c.confidence : 50,
      };
    }
    return out;
  } catch (err) {
    console.warn('[validator:batch] non-fatal failure, falling back to per-card:', err);
    return fallbackPerCard(inputs, deps);
  }
}

async function fallbackPerCard<T>(
  inputs: BatchValidationInput<T>[],
  deps: ValidatorDeps,
): Promise<BatchValidationOutput<T>> {
  const entries = await Promise.all(
    inputs.map(async (i) => [i.cardName, await validateCardClaims(i.cardName, i.draft, i.pack, deps)] as const),
  );
  const out: BatchValidationOutput<T> = {};
  for (const [k, v] of entries) out[k] = v;
  return out;
}
