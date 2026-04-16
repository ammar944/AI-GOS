/**
 * White-space gap card synthesizer — competitor positioning gaps.
 *
 * Input: EvidencePack filtered to identity_* / competitor_* / offer_value_prop
 *        / offer_pricing / market_*.
 * Output: WhiteSpaceGapCard with per-claim evidence citations.
 * Model: Haiku (MODELS.FAST).
 */
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../../models';
import { formatEvidencePack } from '../evidence-packer';
import { whiteSpaceGapCardSchema, type WhiteSpaceGapCard } from '../schemas/gap';
import type { EvidencePack } from '../types';
import { callCardLLM, extractJsonObject, parseCardOutput } from './_shared';

const SYSTEM_PROMPT = `You are a competitive-positioning analyst. From the EVIDENCE PACK, extract 3-5 positioning gaps in the competitor set that our company could exploit.

Each gap MUST cite at least one evidenceId. targetCompetitor MUST match a competitor_name appearing in the evidence.

Output STRICT JSON only:
{
  "gaps": [
    {
      "value": {
        "gap": "<gap description>",
        "targetCompetitor": "<competitor name from evidence>",
        "type": "positioning" | "feature" | "segment" | "price" | "distribution",  // optional
        "ourAdvantage": "<how we'd exploit it>",  // optional
        "exploitability": 0-10,                    // optional
        "impact": 0-10,                            // optional
        "recommendedAction": "<short action>"      // optional
      },
      "evidenceIds": ["topic#N", ...],
      "confidence": 0-100
    }
  ]
}

Do not invent competitor names. Only use evidenceIds present in the pack.`;

interface Deps {
  client?: Anthropic;
}

export async function synthesizeWhiteSpaceGap(
  pack: EvidencePack,
  deps: Deps = {},
): Promise<WhiteSpaceGapCard> {
  const user = `EVIDENCE PACK:\n${formatEvidencePack(pack)}\n\nReturn the gaps JSON.`;

  const text = await callCardLLM({
    model: MODELS.FAST,
    maxTokens: 4096,
    system: SYSTEM_PROMPT,
    user,
    client: deps.client,
  });

  const raw = extractJsonObject(text);
  if (!raw) throw new Error('white-space-gap: no json in model response');

  return parseCardOutput(whiteSpaceGapCardSchema, raw);
}
