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
