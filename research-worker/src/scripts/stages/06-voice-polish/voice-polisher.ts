/**
 * Stage 06 — Voice Polisher (focused AI, ~600 tokens context per call)
 *
 * The subjective judgment pass. Handles checks that genuinely need AI:
 * significance inflation, emotional flatline, false concessions,
 * feature-first language, platform-wrong rhythm, voice authenticity.
 *
 * The quality gate (Stage 05) already handled mechanical checks
 * (kill list, dashes, char limits, sentence rhythm, rule of three).
 * This stage focuses ONLY on what code can't catch.
 *
 * ICM contract:
 *   Input:  Quality-gated script + style references + target audience + quality report
 *   Output: Polished script + humanization metadata
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { stripNumericConstraints } from '../../../utils/strip-numeric-constraints';
import type { QualityReport } from '../05-quality-gate/quality-gate';

const POLISH_MODEL = 'claude-sonnet-4-6';
const POLISH_TIMEOUT_MS = 90_000;
const POLISH_MAX_TOKENS = 2500;

// --- Output schema ---

const polishResultSchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  subjectLine: z.string().optional(),
  previewText: z.string().optional(),
  body: z.string(),
  cta: z.string(),
  hookVariants: z.array(z.string()).optional(),
  designDirection: z.string().optional(),
  confidenceScore: z.number(),
  humanizedPass: z.boolean(),
  patternsFixed: z.number(),
  flaggedClaims: z.array(z.object({
    claim: z.string(),
    reason: z.string(),
  })),
});

export type PolishResult = z.infer<typeof polishResultSchema>;

// --- Build the prompt ---

export interface VoicePolisherInput {
  script: Record<string, unknown>;
  platform: string;
  format: string;
  targetAudience: string;
  styleReferences: string | null;
  qualityReport: QualityReport;
}

function buildPolishPrompt(input: VoicePolisherInput): { system: string; prompt: string } {
  const { script, platform, format, targetAudience, styleReferences, qualityReport } = input;

  // Only include warnings from quality gate that need AI judgment
  const warningContext = qualityReport.violations
    .filter((v) => v.severity === 'warning')
    .map((v) => `- [${v.check}] ${v.detail} (field: ${v.field})`)
    .join('\n');

  const system = `You are an ad copy editor doing a final voice polish on a ${format} ad for ${platform}. The mechanical checks (kill list words, dashes, character limits, sentence rhythm) have ALREADY been handled by code. Your job is the subjective judgment that only a human editor can do.

## THE SCRIPT TO POLISH
${JSON.stringify(script, null, 2)}

## AUDIENCE
${targetAudience}

${styleReferences ? `## STYLE BENCHMARK
${styleReferences}
The final copy should feel like it belongs in this set.
` : ''}
${warningContext ? `## WARNINGS FROM QUALITY GATE (address these)
${warningContext}
` : ''}
## YOUR CHECKS (subjective judgment only)

**C1 — Significance inflation**
Is any claim inflated beyond what the grounding data supports? "We changed the industry" when the data shows modest traction. Push to the specific truth.

**C6 — Formulaic challenge-and-triumph arc**
Does the copy follow a predictable struggle → turning point → triumph pattern? Break it. Go specific. Let the mess stay in.

**C7 — Novelty overstatement**
"Unlike anything else" or "completely new" — almost never true. If it's new, say what's new. If not, cut.

**A1 — Weak hooks**
Would someone actually stop scrolling for this? If the hook states what the company does or poses a question without urgency, it's weak.

**A2 — Feature-first language**
Does the copy describe what the product does before establishing why the reader should care? Restructure if so.

**A4 — Platform-wrong rhythm**
Meta = punchy and immediate. LinkedIn = more measured. Google RSAs = modular. Does the rhythm match?

**CM5 — Emotional flatline claims**
"You'll feel confident knowing..." — telling the reader what to feel instead of creating conditions for it. Show the scenario.

**S7 — False concessions**
"While [minor criticism], it more than makes up..." — fake balance. Either address a real objection or make the claim directly.

**Voice check**
Read it aloud. If any sentence sounds like something you'd only write, not say, rewrite it. Would ${targetAudience} think a real person wrote this?

## RULES
- Preserve the core message and structure. This is a polish, not a rewrite.
- Do NOT re-introduce em dashes or kill list words (they were already removed).
- Do NOT change the meaning of grounded claims.
- Flag any claim you cannot verify from the script's groundedIn data.
- Set humanizedPass to true when done.
- Count how many of the above patterns you corrected in patternsFixed.`;

  const prompt = `Polish this ${format} ad for ${platform}. Apply only the subjective checks listed above. Preserve everything that's already clean. Return the complete polished script.`;

  return { system, prompt };
}

// --- Polisher ---

export async function polishVoice(input: VoicePolisherInput): Promise<PolishResult> {
  const { system, prompt } = buildPolishPrompt(input);

  const result = await generateObject({
    model: anthropic(POLISH_MODEL),
    schema: stripNumericConstraints(polishResultSchema),
    maxOutputTokens: POLISH_MAX_TOKENS,
    system,
    prompt,
    abortSignal: AbortSignal.timeout(POLISH_TIMEOUT_MS),
  });

  return result.object;
}

/**
 * Merge polish result back into the script object, preserving non-text fields.
 */
export function mergePolishResult(
  original: Record<string, unknown>,
  polish: PolishResult,
): Record<string, unknown> {
  return {
    ...original,
    headline: polish.headline,
    ...(polish.subheadline !== undefined && { subheadline: polish.subheadline }),
    ...(polish.subjectLine !== undefined && { subjectLine: polish.subjectLine }),
    ...(polish.previewText !== undefined && { previewText: polish.previewText }),
    body: polish.body,
    cta: polish.cta,
    ...(polish.hookVariants && { hookVariants: polish.hookVariants }),
    ...(polish.designDirection !== undefined && { designDirection: polish.designDirection }),
    confidenceScore: polish.confidenceScore,
    humanizedPass: polish.humanizedPass,
    patternsFixed: polish.patternsFixed,
    flaggedClaims: polish.flaggedClaims,
  };
}
