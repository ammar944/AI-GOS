/**
 * Offer statement card synthesizer — Hormozi Value Equation + Schwartz Awareness.
 *
 * Input: EvidencePack filtered to identity_* / offer_* / icp_trigger /
 *        icp_objection / competitor_positioning.
 * Output: OfferStatementCard with per-claim evidence citations.
 * Model: Haiku (MODELS.FAST).
 */
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../../models';
import { formatEvidencePack } from '../evidence-packer';
import {
  offerStatementCardSchema,
  type OfferStatementCard,
} from '../schemas/offer-statement';
import type { EvidencePack } from '../types';
import { callCardLLM, extractJsonObject, parseCardOutput } from './_shared';
import { assertEvidenceIdsValid } from './_evidence-check';

const SYSTEM_PROMPT = `You are a direct-response copy strategist trained on Hormozi's Value Equation (dream_outcome, likelihood, time_delay, effort_sacrifice) and Eugene Schwartz's 5 levels of awareness (unaware, problem_aware, solution_aware, product_aware, most_aware).

From the EVIDENCE PACK, produce 5-8 offer statements across the types below. Each MUST cite at least one evidenceId.

Statement types:
  - "hero"         — headline promise
  - "stack"        — value stack bullet
  - "guarantee"    — risk-reversal
  - "urgency"      — why-act-now
  - "social_proof" — customer/result proof

Output STRICT JSON only:
{
  "statements": [
    {
      "value": {
        "type": "hero" | "stack" | "guarantee" | "urgency" | "social_proof",
        "statement": "<the copy itself>",
        "valueEquationAxis": "dream_outcome" | "likelihood" | "time_delay" | "effort_sacrifice",  // optional
        "awarenessLevel": "unaware" | "problem_aware" | "solution_aware" | "product_aware" | "most_aware",  // optional
        "rationale": "<why this works>",    // optional
        "targetEmotion": "<named emotion>"  // optional
      },
      "evidenceIds": ["topic#N", ...],
      "confidence": 0-100
    }
  ]
}

Use only evidenceIds from the pack. Do not fabricate statistics or customer names.`;

interface Deps {
  client?: Anthropic;
}

export async function synthesizeOfferStatements(
  pack: EvidencePack,
  deps: Deps = {},
): Promise<OfferStatementCard> {
  const user = `EVIDENCE PACK:\n${formatEvidencePack(pack)}\n\nReturn the statements JSON.`;

  const text = await callCardLLM({
    model: MODELS.FAST,
    maxTokens: 4096,
    system: SYSTEM_PROMPT,
    user,
    client: deps.client,
  });

  const raw = extractJsonObject(text);
  if (!raw) throw new Error('offer-statement: no json in model response');

  const draft = parseCardOutput(offerStatementCardSchema, raw);
  assertEvidenceIdsValid(draft, pack.entryIds);
  return draft;
}
