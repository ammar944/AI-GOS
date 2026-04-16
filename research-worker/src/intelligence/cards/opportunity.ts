/**
 * Opportunity card synthesizer — Blue Ocean ERRC + JTBD extraction.
 *
 * Input: EvidencePack filtered to identity_* / market_* / pain_* / trend_*.
 * Output: OpportunityCard with per-claim evidence citations.
 * Model: Haiku (MODELS.FAST). Extraction task, no cross-section reasoning.
 */
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../../models';
import { formatEvidencePack } from '../evidence-packer';
import { opportunityCardSchema, type OpportunityCard } from '../schemas/opportunity';
import type { EvidencePack } from '../types';
import { callCardLLM, extractJsonObject, parseCardOutput } from './_shared';
import { assertEvidenceIdsValid } from './_evidence-check';

const SYSTEM_PROMPT = `You are a market-opportunity analyst using Blue Ocean ERRC (Eliminate, Reduce, Raise, Create) and Jobs-To-Be-Done frameworks.

Your task: from the EVIDENCE PACK below, extract 3-5 concrete market opportunities. Each opportunity MUST cite at least one evidenceId.

Output STRICT JSON only, matching this schema:
{
  "opportunities": [
    {
      "value": {
        "opportunity": "<short name, 4-10 words>",
        "size": "small" | "medium" | "large",
        "timing": "now" | "3-6 months" | "6-12 months",
        "difficulty": "low" | "medium" | "high",
        "errc": "eliminate" | "reduce" | "raise" | "create",  // optional
        "jtbd": "<the job the customer is hiring this for>"   // optional
      },
      "evidenceIds": ["topic#N", ...],  // at least one
      "confidence": 0-100
    }
  ]
}

Do NOT invent evidenceIds — only use ones present in the EVIDENCE PACK. If the pack is too thin for a claim, omit the claim.`;

interface Deps {
  client?: Anthropic;
}

export async function synthesizeOpportunity(
  pack: EvidencePack,
  deps: Deps = {},
): Promise<OpportunityCard> {
  const user = `EVIDENCE PACK:\n${formatEvidencePack(pack)}\n\nReturn the opportunities JSON.`;

  const text = await callCardLLM({
    model: MODELS.FAST,
    maxTokens: 4096,
    system: SYSTEM_PROMPT,
    user,
    client: deps.client,
  });

  const raw = extractJsonObject(text);
  if (!raw) throw new Error('opportunity: no json in model response');

  const draft = parseCardOutput(opportunityCardSchema, raw);
  assertEvidenceIdsValid(draft, pack.entryIds);
  return draft;
}
