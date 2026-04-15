/**
 * Stage 03 — Hook Generator (focused AI, ~800 tokens context per call)
 *
 * Generates 5 hook variants per script. This is the highest-value creative
 * work in the pipeline — small, focused prompt, one job.
 *
 * ICM contract:
 *   Input:  ScriptPlan + relevant claims + audience triggers + competitor hooks
 *   Output: HookResult — 5 hook variants with rationale
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { ScriptPlan } from '../01-plan/planner';
import type { ExtractedClaim } from '../02-claims/claim-extractor';
import { stripNumericConstraints } from '../../../utils/strip-numeric-constraints';
import { MODELS } from '../../../models';

const HOOK_MODEL = MODELS.STANDARD;
const HOOK_TIMEOUT_MS = 60_000;
const HOOK_MAX_TOKENS = 1500;

// --- Output schema ---

const hookResultSchema = z.object({
  hooks: z.array(z.object({
    text: z.string(),
    hookType: z.string(),
    whyItWorks: z.string(),
  })),
  recommendedIndex: z.number(),
});

export type HookResult = z.infer<typeof hookResultSchema>;

// --- Framework-specific hook guidance ---

const FRAMEWORK_HOOK_GUIDANCE: Record<string, string> = {
  'talking-head-broll': 'Direct-to-camera opener. Speak as if mid-conversation. No warm-up, no company name first.',
  'case-study-snapshot': 'Open with a real result: "How did [Name] go from [Before] to [After] in [Timeframe]?" Use specific numbers from the claims.',
  'objection-first': 'Lead with the biggest objection AS the hook. "You think [objection]? Let me prove you wrong." The objection IS the pattern interrupt.',
  'qa-style': 'Open by stating a real user question: "A lot of people ask me: \'[question]\'" — the question itself must be specific enough to stop a scroller.',
  'demo-screencast': 'Open with step count + result: "[N] steps to [specific result]." Implies they will SEE the process.',
  'interview': 'Start mid-conversation as if the viewer walked into a room where two people are talking. Interviewer challenges a claim.',
  'skit-scenario': 'Open with a character in a relatable frustration: "Meet [type of person]. They just [frustrating action] for the third time this week."',
};

// --- In-market tier hook adjustments ---

const TIER_HOOK_GUIDANCE: Record<string, string> = {
  'in-market': 'They already believe in the category. Do NOT sell the category. Sell your unique method. Use "You already know" or "You\'re doing this, but..." openers. Assume knowledge.',
  'needs-convinced': 'They want the outcome but aren\'t sure about the method. Validate the opportunity, then position your approach. Use "You want [outcome] but..." openers.',
  'cold-mass': 'They don\'t know they have a problem. Lead with their world, not your product. Story-driven. Name the frustration they feel but haven\'t named yet.',
};

// --- Angle-specific guidance (compact) ---

const ANGLE_GUIDANCE: Record<string, string> = {
  painPoint: 'Lead with their specific frustration. Make them feel seen.',
  outcome: 'Paint life after. Concrete, specific, sensory.',
  socialProof: 'Let others sell. Specific results, numbers, timeframes, roles.',
  curiosity: 'Open a gap they need to close. Counterintuitive claim or unexpected stat.',
  urgency: 'Real scarcity or real deadlines only. Never manufactured.',
  identity: '"People like us do X." Speaks to self-concept.',
  contrarian: 'Challenge the dominant belief. "Everyone says X. Here\'s why that\'s wrong."',
};

// --- Build the prompt ---

export interface HookGeneratorInput {
  plan: ScriptPlan;
  companyName: string;
  targetAudience: string;
  audienceTriggers: string[];
  assignedClaims: ExtractedClaim[];
  competitorHooks: string[];
  objectionText: string | null;
}

function buildHookPrompt(input: HookGeneratorInput): { system: string; prompt: string } {
  const { plan, companyName, targetAudience, audienceTriggers, assignedClaims, competitorHooks, objectionText } = input;

  const system = `You are a direct-response copywriter. Your one job: write 5 hook variants for a ${plan.duration} ${plan.format} ad on ${plan.platform}.

## AUDIENCE
${targetAudience}
${TIER_HOOK_GUIDANCE[plan.inMarketTier]}

## ANGLE
${plan.angle}: ${ANGLE_GUIDANCE[plan.angle]}

## FRAMEWORK
${plan.framework}: ${FRAMEWORK_HOOK_GUIDANCE[plan.framework]}

${audienceTriggers.length > 0 ? `## WHAT THEY'RE ALREADY THINKING (Collier)
${audienceTriggers.map(t => `- "${t}"`).join('\n')}
` : ''}
${assignedClaims.length > 0 ? `## CLAIMS TO GROUND IN
${assignedClaims.map(c => `- ${c.claim} (source: ${c.source})`).join('\n')}
` : ''}
${competitorHooks.length > 0 ? `## COMPETITOR HOOKS TO BEAT (differentiate, don't copy)
${competitorHooks.map(h => `- "${h}"`).join('\n')}
` : ''}
${objectionText ? `## OBJECTION TO ADDRESS
"${objectionText}"
` : ''}
## RULES
- Hook = first 3-5 seconds of the ad. Must stop the scroll.
- Every word earns its place or gets cut.
- No em dashes. No "in today's landscape." No company name first.
- ${plan.platform === 'meta' ? 'Max 125 characters for the text hook.' : plan.platform === 'google' ? 'Max 30 characters per headline.' : 'Max 150 characters.'}
- For video: the hook is what they hear/see in seconds 0-3.
- For static: the hook is the headline + subheadline.
- For email: the hook is the subject line + preview text.`;

  const prompt = `Write 5 hook variants for ${companyName}. Each hook should be a genuinely different approach to stopping the scroll for this ${plan.awarenessLevel}-awareness, ${plan.inMarketTier} audience using the ${plan.angle} angle and ${plan.framework} framework. Recommend which one you'd run first.`;

  return { system, prompt };
}

// --- Generator ---

export async function generateHooks(input: HookGeneratorInput): Promise<HookResult> {
  const { system, prompt } = buildHookPrompt(input);

  const result = await generateObject({
    model: anthropic(HOOK_MODEL),
    schema: stripNumericConstraints(hookResultSchema),
    maxOutputTokens: HOOK_MAX_TOKENS,
    system,
    prompt,
    abortSignal: AbortSignal.timeout(HOOK_TIMEOUT_MS),
  });

  return result.object;
}
