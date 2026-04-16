/**
 * Strategic synthesis card — readiness scorecard + top-N actions.
 *
 * Input: EvidencePack spanning ALL topics ('*' filter).
 * Output: StrategicSynthesisCard with per-action evidence citations.
 * Model: Sonnet (MODELS.STANDARD). Cross-section reasoning — Haiku not enough.
 */
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '../../models';
import { formatEvidencePack } from '../evidence-packer';
import {
  strategicSynthesisCardSchema,
  type StrategicSynthesisCard,
} from '../schemas/synthesis';
import type { EvidencePack } from '../types';
import { callCardLLM, extractJsonObject, parseCardOutput } from './_shared';
import { assertEvidenceIdsValid } from './_evidence-check';

const SYSTEM_PROMPT = `You are a CMO-level strategy synthesist. Produce a readiness scorecard + top-5 actions across the whole research corpus.

For the readinessScorecard, score 4 dimensions (Market, Offer, Competitive Position, Execution) on 0-10. Call out blockers. verdict is 1 short sentence.

For topActions, extract the 3-5 highest-leverage next moves. Each MUST cite at least one evidenceId.

Output STRICT JSON only:
{
  "readinessScorecard": {
    "dimensions": [
      { "dimension": "<name>", "score": 0-10, "summary": "<1 sentence>", "blockers": ["..."] }
    ],
    "overallScore": 0-10,
    "verdict": "<1 sentence>"
  },
  "topActions": [
    {
      "value": {
        "action": "<specific action>",
        "owner": "<role/person>",         // optional
        "timeline": "<duration>",         // optional
        "impact": "low" | "medium" | "high"  // optional
      },
      "evidenceIds": ["topic#N", ...],
      "confidence": 0-100
    }
  ],
  "strategicNarrative": "<1-3 sentence summary>"  // optional
}`;

interface Deps {
  client?: Anthropic;
}

export async function synthesizeStrategicSynthesis(
  pack: EvidencePack,
  deps: Deps = {},
): Promise<StrategicSynthesisCard> {
  const user = `EVIDENCE PACK:\n${formatEvidencePack(pack)}\n\nReturn the synthesis JSON.`;

  const text = await callCardLLM({
    model: MODELS.STANDARD,
    maxTokens: 6144,
    system: SYSTEM_PROMPT,
    user,
    client: deps.client,
  });

  const raw = extractJsonObject(text);
  if (!raw) throw new Error('strategic-synthesis: no json in model response');

  const draft = parseCardOutput(strategicSynthesisCardSchema, raw);
  assertEvidenceIdsValid(draft, pack.entryIds);
  return draft;
}
