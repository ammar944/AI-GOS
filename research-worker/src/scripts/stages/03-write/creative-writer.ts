/**
 * Stage B — Creative Writer (unified AI, full context)
 *
 * Single integrated generateObject() call per awareness level,
 * producing 3 complete scripts. Combines:
 * - v1's full-context creative depth (founder-to-founder voice)
 * - v2's Haynes frameworks + in-market tier targeting
 * - v2's pre-extracted claims as a supplemental grounding menu
 * - Cross-level angle/hook dedup tracking
 * - Integrated self-audit (v1 Pass 2's 43 checks in one pass)
 *
 * The AI conceives hook + body + CTA as ONE integrated thought per script.
 * The quality gate (Stage C) handles mechanical enforcement after.
 */

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { ScriptPlan, AwarenessLevel } from '../01-plan/planner';
import type { ExtractedClaim } from '../02-claims/claim-extractor';
import { formatClaimsForScript } from '../02-claims/claim-extractor';
import { stripNumericConstraints } from '../../../utils/strip-numeric-constraints';
import { loadRefFile } from '../../../skills/loader';

const WRITER_MODEL = 'claude-sonnet-4-6';
const WRITER_TIMEOUT_MS = 180_000;
const WRITER_MAX_TOKENS = 6000;

// --- Output schema (3 scripts per level) ---

const scriptOutputSchema = z.object({
  scripts: z.array(z.object({
    headline: z.string(),
    subheadline: z.string().optional(),
    subjectLine: z.string().optional(),
    previewText: z.string().optional(),
    body: z.string(),
    cta: z.string(),
    hookVariants: z.array(z.string()).optional(),
    hookType: z.string(),
    designDirection: z.string().optional(),
    angle: z.string(),
    type: z.string(),
    platform: z.string(),
    framework: z.string(),
    duration: z.string(),
    groundedIn: z.array(z.object({
      section: z.string(),
      claim: z.string(),
    })),
    confidenceScore: z.number(),
    humanizedPass: z.boolean(),
    patternsFixed: z.number(),
    flaggedClaims: z.array(z.object({
      claim: z.string(),
      reason: z.string(),
    })),
  })),
});

export type CreativeWriterOutput = z.infer<typeof scriptOutputSchema>;

// --- Framework guidance for prompts ---

const FRAMEWORK_GUIDANCE: Record<string, string> = {
  'talking-head-broll': 'Talking Head + B-Roll: Direct-to-camera hook, B-roll overlay for reasons, return to camera for CTA. Mark B-roll cues as [B-ROLL: description].',
  'case-study-snapshot': 'Case Study Snapshot: Open with a real result ("How did [Name] go from X to Y in Z?"). 15-20 second client story. Close with "Watch the same method."',
  'objection-first': 'Objection-First: Lead with the biggest objection AS the hook. Address it in 15-20 seconds. Pivot to CTA. Don\'t end on the objection.',
  'qa-style': 'Q&A Style: Open by stating a real user question. Short, direct answer with anecdote. "Got more questions?" CTA.',
  'demo-screencast': 'Demo/Screencast: Open with step count + result. Show 2-3 key steps as [SCREEN: description]. CTA to see full version.',
  'interview': '2-Person Interview: Start mid-conversation. Interviewer challenges a claim. You answer. Interviewer: "Where can people learn more?" CTA.',
  'skit-scenario': 'Skit/Scenario: Character in frustration (5 sec). You appear with the solution. "If you feel like [character], watch how we solved it." Tight, not cheesy.',
};

const TIER_GUIDANCE: Record<string, string> = {
  'in-market': 'IN-MARKET (3-4% of audience): They already believe in the category. Do NOT sell the category. Sell your unique method. Use "You already know" or "You\'re doing this, but..." openers. Assume knowledge. Short sales cycle.',
  'needs-convinced': 'NEEDS CONVINCED (30%): They want the outcome but aren\'t sure about the method. Validate the opportunity, then position your approach. More "why" content. Medium copy.',
  'cold-mass': 'COLD MASS: They don\'t know they have a problem. Lead with their world, not your product. Story-driven. Name the frustration they haven\'t named. Long copy, build slowly.',
};

// --- Build the prompt ---

export interface CreativeWriterInput {
  level: AwarenessLevel;
  levelPlans: ScriptPlan[];
  companyName: string;
  trimmedResearchContext: string;
  targetAudience: string;
  targetAudienceMonologue?: string[];
  styleReferences: string | null;
  proofPoints?: Array<{ type: string; headline: string; detail: string; clientName?: string; verified: boolean }>;
  usedProofPoints?: Map<string, number>;
  competitorAdIntel?: Array<{
    advertiser: string;
    topAdHooks: string[];
    adCreatives: Array<{ platform: string; headline?: string; body?: string; format: string }>;
  }>;
  researchStatsSubset?: Array<{ stat: string; source: string }>;
  usedAnglesAndHooks: { angle: string; hook: string }[];
  allClaims: ExtractedClaim[];
  platformSpecs?: string;
  adCopyTemplates?: string;
  brandVoiceNotes?: {
    tone: string;
    constraints: string;
    goodExample: string;
    badExample: string;
  } | null;
}

function buildCreativePrompt(input: CreativeWriterInput): { system: string; prompt: string } {
  const {
    level, levelPlans, companyName, trimmedResearchContext, targetAudience,
    targetAudienceMonologue, styleReferences, proofPoints, usedProofPoints,
    competitorAdIntel, researchStatsSubset, usedAnglesAndHooks, allClaims,
    platformSpecs, adCopyTemplates, brandVoiceNotes,
  } = input;

  // Build the planner suggestions block
  const plannerSuggestions = levelPlans.map((p, i) => {
    const parts = [
      `Script ${i + 1}: ${p.angle} angle, ${p.platform}/${p.format}, ${p.framework} framework`,
      p.inMarketTier !== 'cold-mass' ? `(${TIER_GUIDANCE[p.inMarketTier].split(':')[0].trim()})` : '(COLD)',
      p.objectionToHandle ? `| Handle objection: "${p.objectionToHandle}"` : '',
      p.subSegment ? `| Sub-segment: ${p.subSegment}` : '',
    ].filter(Boolean);
    return parts.join(' ');
  }).join('\n');

  // Build claims menu
  const claimsMenu = allClaims.length > 0
    ? allClaims.map((c) => `- [${c.source}] ${c.claim}${c.stat ? ` (stat: ${c.stat})` : ''}`).join('\n')
    : 'No pre-extracted claims. Ground all claims in the research context below.';

  // Build proof section
  const proofSection = proofPoints && proofPoints.length > 0
    ? `## AVAILABLE PROOF (use these, do not fabricate)
${proofPoints.map(p => `[${p.type}] ${p.headline}: ${p.detail}${p.clientName ? ` — ${p.clientName}` : ''}`).join('\n')}
${usedProofPoints && usedProofPoints.size > 0 ? `
Proof usage so far:
${Array.from(usedProofPoints.entries()).map(([h, c]) => `- "${h}" (used ${c}x)`).join('\n')}
Prefer unused proof points. If only one is available, use it in at most 1 of 3 scripts.
` : ''}`
    : `## AVAILABLE PROOF
NO VERIFIED PROOF AVAILABLE. Do not fabricate case studies, testimonials, or specific client outcomes. Use research-grounded claims only. Flag any claim that would benefit from proof in flaggedClaims.`;

  // Build used angles section
  const anglesUsedSection = usedAnglesAndHooks.length > 0
    ? `## ANGLES AND HOOKS ALREADY USED — DO NOT REPEAT
${usedAnglesAndHooks.map(a => `- [${a.angle}]: "${a.hook}"`).join('\n')}
Minimum 2 of 3 scripts must use angles NOT in the list above. Write hooks that sound NOTHING like these.`
    : '';

  // Build competitor intel
  const competitorSection = competitorAdIntel && competitorAdIntel.length > 0
    ? `## COMPETITOR AD INTELLIGENCE
These are real ads competitors are currently running. Your scripts must be BETTER, not similar.
${competitorAdIntel.map(c => `### ${c.advertiser}
${c.topAdHooks.length > 0 ? `Top hooks:\n${c.topAdHooks.map(h => `- "${h}"`).join('\n')}` : ''}
${c.adCreatives.length > 0 ? `Active ads:\n${c.adCreatives.map(ad => `- [${ad.platform}/${ad.format}] ${ad.headline ? `"${ad.headline}"` : ''}${ad.body ? ` — ${ad.body.slice(0, 150)}` : ''}`).join('\n')}` : ''}`).join('\n\n')}
Do NOT copy competitor hooks. Use them as counter-positioning intelligence.`
    : '';

  // Build framework guidance for this level's plans
  const frameworkBlocks = [...new Set(levelPlans.map(p => p.framework))]
    .map(fw => FRAMEWORK_GUIDANCE[fw] ?? '')
    .filter(Boolean)
    .join('\n\n');

  // Build tier guidance for this level
  const tierKey = levelPlans[0]?.inMarketTier ?? 'needs-convinced';
  const tierBlock = TIER_GUIDANCE[tierKey] ?? '';

  // Research stats subset
  const statsSection = researchStatsSubset && researchStatsSubset.length > 0
    ? `## RESEARCH STATS FOR THIS LEVEL (rotate across batch)
${researchStatsSubset.map(s => `- "${s.stat}" (source: ${s.source})`).join('\n')}
Use these to ground claims. Don't use the same stat in every script.`
    : '';

  const brandVoiceText = brandVoiceNotes && (brandVoiceNotes.tone || brandVoiceNotes.constraints)
    ? brandVoiceNotes
    : null;

  const brandConstraintsSection = brandVoiceText?.constraints
    ? `\n## BRAND VOICE — HARD RULES (NEVER VIOLATE)\n${brandVoiceText.constraints}\nThese are non-negotiable. Every script must comply.\n`
    : '';

  const brandToneSection = brandVoiceText?.tone
    ? `\n## BRAND VOICE — TONE\n${brandVoiceText.tone}\nWrite in this register. Match this personality throughout.\n`
    : '';

  const brandExamplesSection = brandVoiceText?.goodExample || brandVoiceText?.badExample
    ? `\n## BRAND VOICE — EXAMPLES\n${brandVoiceText.goodExample ? `GOOD (match this): ${brandVoiceText.goodExample}` : ''}\n${brandVoiceText.badExample ? `BAD (never this): ${brandVoiceText.badExample}` : ''}\nStudy the difference. Your output should read like the "good" example.\n`
    : '';

  const system = `You are a direct-response copywriter who sounds like a founder talking to another founder. You write for paid media agencies. Your job is to write ads that make people stop scrolling and take action. Every word earns its place or gets cut.

You are writing for the **${level}** awareness level. Write like you understand this person's world, not like you're pitching them.

---

## RESEARCH CONTEXT (your source of truth)

Everything below is your source of truth. Every claim MUST trace here. Do not invent statistics, testimonials, or outcomes.

${trimmedResearchContext}

${targetAudienceMonologue && targetAudienceMonologue.length > 0
    ? `## THE CONVERSATION ALREADY IN THEIR HEAD (Collier Framework)
Your prospect is already having this internal conversation. Enter it, don't start a new one:
${targetAudienceMonologue.map(t => `- "${t}"`).join('\n')}

The best hook mirrors what they're already thinking at 11pm on a Sunday.
`
    : ''}

## PRE-VERIFIED CLAIMS MENU
These claims have been extracted and source-attributed from the research. Use them for easy grounding. You may also cite other findings from the full research context above.

${claimsMenu}

${proofSection}
${brandToneSection}
${brandExamplesSection}
${statsSection}
${brandConstraintsSection}
${styleReferences ? `## STYLE REFERENCES
Study these carefully. Match their voice, cadence, and rhythm. Mirror the pattern, not the words.

${styleReferences}
` : ''}

${competitorSection}

---

## AUDIENCE TIER
${tierBlock}

## SCRIPT FRAMEWORKS FOR THIS BATCH
${frameworkBlocks}

---

## PLANNER SUGGESTIONS (guidance, not constraints)
The diversity planner recommends these assignments. Override if the research suggests a better combination. Hard constraints: all 3 platforms must appear, all 3 formats must appear, no duplicate angles within this level.

${plannerSuggestions}

---

## COPYWRITING FRAMEWORKS
Apply these. Never reference them by name in the copy.

### SCHWARTZ — Awareness Levels
${level === 'unaware' ? 'They don\'t know they have a problem. Lead with their world. Story-driven. Build slowly. Do not mention the product until the end.' :
  level === 'problem' ? 'They know the pain but not the solution. Name the pain precisely. Validate it. Then introduce the solution category.' :
  level === 'solution' ? 'They know solutions exist but haven\'t found the right one. Position against alternatives. Specific differentiators.' :
  level === 'product' ? 'They know your product but haven\'t bought. Handle objections. Reinforce proof. Make action feel safe.' :
  'They\'re ready. Just give them a reason to act now. Very short. Offer-forward.'}

### HOPKINS — Reason-Why Copy
Specific numbers create credibility. "43% faster" beats "much faster." Mine the research for every specific number.

### OGILVY — The Fascinating Truth
Find the single most interesting true thing and lead with it.

### CAPLES — Headline Weight
The headline carries 80% of conversion. Write it last, after you know what the ad is really about.

### SUGARMAN — The Slippery Slide
Every sentence exists to make them read the next one. Forward motion. Open loops.

### COLLIER — Enter the Conversation
Join the conversation already in their head. Don't start a new one.

### HAYNES — Hook → Reasons → CTA
Every ad: Hook (3-5 seconds, stop the scroll) → Reasons (why your approach is better) → CTA (benefit-framed, not action-framed). Keep it short, direct, and situational.

${anglesUsedSection}

---

## ANGLES
Each script uses ONE primary angle. 3 distinct angles, not word-swapped versions.
- **painPoint**: Lead with the specific frustration. Make them feel seen.
- **outcome**: Paint life after. Concrete, specific, sensory.
- **socialProof**: Let others sell. Specific results, numbers, timeframes.
- **curiosity**: Open a gap. Counterintuitive claim. Unexpected stat.
- **urgency**: Real scarcity only. Never manufactured.
- **identity**: "People like us do X." Speaks to self-concept.
- **contrarian**: Challenge the dominant belief. "Everyone says X. Here's why that's wrong."

---

## PLATFORM SPECIFICATIONS
${platformSpecs || 'Meta: 125 char primary, 40 char headline. Google RSA: 30 char headlines, 90 char descriptions. LinkedIn: 150 char intro, 70 char headline.'}

## FORMAT RULES
### VIDEO: Hook (0-3s pattern interrupt) → Body (one idea per paragraph, curiosity gaps) → CTA. Duration: unaware=90s, problem/solution=60s, product/mostAware=30s. Provide 5 hook variants.
### STATIC: Headline + Subheadline + CTA + Design direction (one sentence). Google RSAs: any headline combo must be coherent.
### EMAIL: Subject (<50 chars) + Preview (<90 chars) + Body (conversational, short paragraphs) + Single CTA.

${adCopyTemplates ? `## AD COPY TEMPLATES REFERENCE\n${adCopyTemplates}\n` : ''}

---

## SELF-AUDIT (apply DURING writing, not after)
As you write each script, actively check for and eliminate:
- Significance inflation ("We changed the industry" when data shows modest traction)
- AI vocabulary (leverage, utilize, robust, comprehensive, streamline, empower, showcase, delve)
- Template openers ("In today's landscape", "Picture this:", "Here's the thing:")
- Rule of three ("fast, reliable, and affordable" — pick ONE)
- Em dashes — use commas or periods instead. ZERO em dashes.
- Chatbot closers ("Let me know if you have any questions")
- Formulaic arcs (struggle → turning point → triumph — break the pattern)
- Feature-first language (establish why they should care BEFORE what the product does)
- False concessions ("While [minor criticism], it more than makes up for it...")
- Emotional flatline claims ("You'll feel confident knowing..." — SHOW, don't tell)
- Sentence length uniformity (vary deliberately: short punches mixed with longer builds)
- Passive voice ("results are achieved" → "you achieve results")
- Same paragraph length throughout (vary intentionally)

The goal: it should sound like a human who is good at their job wrote this. Not clever. Not poetic. Professional, warm, and specific.

Read each script aloud mentally. If any sentence sounds like something you'd only write, not say, rewrite it. Would ${targetAudience} think a real person wrote this?
`;

  const prompt = `Write 3 scripts for ${companyName} at the ${level} awareness level.

The planner suggests these assignments (override if better):
${plannerSuggestions}

Requirements:
- 3 genuinely distinct scripts. Each must come from a different angle and feel like a different ad, not a word-swapped variation.
- Mix formats: include video, static, and email across the batch.
- Mix platforms: cover meta, google, and linkedin across the batch.
- Every factual claim must include a groundedIn entry citing which research section it comes from.
- For video scripts, provide 5 hook variants per script.
- Apply the self-audit checks as you write. Set humanizedPass to true and count patternsFixed.
- Flag any claims you cannot fully ground in the research context in flaggedClaims with specific reasons.
- Respect all platform character limits.
- Each script must specify its framework, angle, type (video/static/email), platform, and duration.`;

  return { system, prompt };
}

// --- Generator ---

export async function writeCreativeLevel(input: CreativeWriterInput): Promise<CreativeWriterOutput> {
  const { system, prompt } = buildCreativePrompt(input);

  const result = await generateObject({
    model: anthropic(WRITER_MODEL),
    schema: stripNumericConstraints(scriptOutputSchema),
    maxOutputTokens: WRITER_MAX_TOKENS,
    system,
    prompt,
    abortSignal: AbortSignal.timeout(WRITER_TIMEOUT_MS),
  });

  return result.object;
}
