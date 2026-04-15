/**
 * Stage 04 — Body Writer (focused AI, ~1200 tokens context per call)
 *
 * Given a hook + assigned claims + objection + proof point + framework structure,
 * writes the body following Hook → Reasons → CTA temporal flow.
 *
 * ICM contract:
 *   Input:  ScriptPlan + selected hook + claims + proof point + style refs
 *   Output: ScriptBody — complete script with all fields
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { ScriptPlan } from '../01-plan/planner';
import type { ExtractedClaim } from '../02-claims/claim-extractor';
import { formatClaimsForScript } from '../02-claims/claim-extractor';
import { stripNumericConstraints } from '../../../utils/strip-numeric-constraints';
import { MODELS } from '../../../models';

const BODY_MODEL = MODELS.STANDARD;
const BODY_TIMEOUT_MS = 120_000;
const BODY_MAX_TOKENS = 2500;

// --- Output schema ---

const videoBodySchema = z.object({
  headline: z.string(),
  body: z.string(),
  cta: z.string(),
  hookVariants: z.array(z.string()),
  designDirection: z.string().optional(),
  groundedIn: z.array(z.object({
    section: z.string(),
    claim: z.string(),
  })),
  confidenceScore: z.number(),
});

const staticBodySchema = z.object({
  headline: z.string(),
  subheadline: z.string().optional(),
  body: z.string(),
  cta: z.string(),
  designDirection: z.string(),
  groundedIn: z.array(z.object({
    section: z.string(),
    claim: z.string(),
  })),
  confidenceScore: z.number(),
});

const emailBodySchema = z.object({
  subjectLine: z.string(),
  previewText: z.string(),
  headline: z.string(),
  body: z.string(),
  cta: z.string(),
  groundedIn: z.array(z.object({
    section: z.string(),
    claim: z.string(),
  })),
  confidenceScore: z.number(),
});

export type ScriptBody = z.infer<typeof videoBodySchema> | z.infer<typeof staticBodySchema> | z.infer<typeof emailBodySchema>;

function getSchemaForFormat(format: string) {
  switch (format) {
    case 'video': return videoBodySchema;
    case 'static': return staticBodySchema;
    case 'email': return emailBodySchema;
    default: return videoBodySchema;
  }
}

// --- Framework body structure guidance ---

const FRAMEWORK_BODY_GUIDANCE: Record<string, string> = {
  'talking-head-broll': `Structure: Hook (on camera) → 2-3 reasons with B-roll moments noted in brackets → return to camera for CTA. Mark B-roll cues as [B-ROLL: description].`,
  'case-study-snapshot': `Structure: Hook (name the result) → 15-20 second client snapshot (before state, what they did, after state) → "Watch the same method" CTA. Keep the case study portion TIGHT.`,
  'objection-first': `Structure: Hook IS the objection → 15-20 seconds addressing it with logic + one quick proof point → pivot to CTA. Do NOT end on the objection. End on the invitation.`,
  'qa-style': `Structure: Hook is the question → short, direct answer with one anecdote or stat → "Got more questions?" CTA. Feels organic, like responding to real DMs.`,
  'demo-screencast': `Structure: Hook (step count + result) → show 2-3 key steps as if on screen [SCREEN: description] → CTA to see the full version. Describe what they'd SEE.`,
  'interview': `Structure: Start mid-conversation. Interviewer line → your answer → interviewer: "Where can people learn more?" → CTA. Keep it 30-60 seconds.`,
  'skit-scenario': `Structure: Character in frustration (5 sec) → you appear with the shift (10-15 sec) → CTA. Tight. Don't over-explain the scenario.`,
};

// --- Platform-specific writing rules ---

const PLATFORM_RULES: Record<string, string> = {
  meta: `Primary text: 125 characters visible before "See more". Headline: max 40 chars. Description: max 30 chars. Punchy, immediate, thumb-stopping.`,
  google: `RSA: headlines max 30 chars each, descriptions max 90 chars each. Headlines must work independently — any combination must make sense. No headline should depend on another.`,
  linkedin: `Intro text: 150 chars optimal. Headline: 70 chars optimal. More measured tone than Meta. Professional but not corporate. Peer-to-peer.`,
};

// --- Duration guidance ---

const DURATION_GUIDANCE: Record<string, string> = {
  '30s': 'Very short. Offer-forward. 3-4 sentences max in the body. Every word must earn its place.',
  '60s': 'Medium. Room for one reason + one proof point + one objection handle. No fluff.',
  '90s': 'Longer. Story-driven. Build slowly for unaware audiences. Can include a micro-case-study in the body.',
};

// --- Build the prompt ---

export interface BodyWriterInput {
  plan: ScriptPlan;
  companyName: string;
  targetAudience: string;
  selectedHook: string;
  allHookVariants: string[];
  assignedClaims: ExtractedClaim[];
  proofPoint: { type: string; headline: string; detail: string; clientName?: string } | null;
  objectionText: string | null;
  styleReferences: string | null;
}

function buildBodyPrompt(input: BodyWriterInput): { system: string; prompt: string } {
  const { plan, companyName, targetAudience, selectedHook, allHookVariants, assignedClaims, proofPoint, objectionText, styleReferences } = input;

  const claimsBlock = formatClaimsForScript(assignedClaims, assignedClaims.map((_, i) => i));

  const system = `You are a direct-response copywriter writing the body of a ${plan.duration} ${plan.format} ad for ${plan.platform}.

## THE HOOK (already written — build from this)
"${selectedHook}"

## FRAMEWORK STRUCTURE
${FRAMEWORK_BODY_GUIDANCE[plan.framework]}

## PLATFORM RULES
${PLATFORM_RULES[plan.platform]}

## DURATION
${DURATION_GUIDANCE[plan.duration]}

## AUDIENCE
${targetAudience} | Awareness: ${plan.awarenessLevel} | Tier: ${plan.inMarketTier}

## CLAIMS TO WEAVE IN (cite these, don't invent)
${claimsBlock}

${proofPoint ? `## PROOF POINT TO USE
[${proofPoint.type}] ${proofPoint.headline}: ${proofPoint.detail}${proofPoint.clientName ? ` — ${proofPoint.clientName}` : ''}
Use this proof naturally. Don't force it if it doesn't fit the flow.
` : `## PROOF
No verified proof assigned. Do not fabricate testimonials or case studies. Write benefit-driven copy.
`}
${objectionText ? `## OBJECTION TO HANDLE IN THE BODY
"${objectionText}"
Address this briefly (1-2 sentences) in the reasons section. Don't let the ad end on the objection.
` : ''}
${styleReferences ? `## STYLE REFERENCES
${styleReferences}
Match their voice and rhythm. Mirror the pattern, not the words.
` : ''}
## RULES
- Follow Hook → Reasons → CTA flow. The hook is already written.
- Every factual claim must include a groundedIn entry citing its source.
- No em dashes or en dashes. Use commas, periods, or new sentences.
- No rule of three ("X, Y, and Z"). Pick the strongest and say it once.
- Vary sentence length. At least one sentence under 5 words. At least one over 20 words.
- Use contractions. Write like a human who respects the reader's time.
- CTA must be benefit-framed ("Get your [outcome]"), not action-framed ("Click here").`;

  const prompt = `Write the complete ${plan.format} ad body for ${companyName}. The hook is: "${selectedHook}". Build the reasons section and CTA from there.${plan.format === 'video' ? ` Include the hook variants array with all 5 provided hooks: ${JSON.stringify(allHookVariants)}` : ''}`;

  return { system, prompt };
}

// --- Writer ---

export async function writeBody(input: BodyWriterInput): Promise<ScriptBody> {
  const { system, prompt } = buildBodyPrompt(input);
  const schema = getSchemaForFormat(input.plan.format);

  const result = await generateObject({
    model: anthropic(BODY_MODEL),
    schema: stripNumericConstraints(schema),
    maxOutputTokens: BODY_MAX_TOKENS,
    system,
    prompt,
    abortSignal: AbortSignal.timeout(BODY_TIMEOUT_MS),
  });

  return result.object;
}
