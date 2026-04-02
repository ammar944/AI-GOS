import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import {
  createClient,
  buildRunnerTelemetry,
  emitRunnerProgress,
  extractJson,
  runStreamedToolRunner,
  runWithBackoff,
  type RunnerProgressReporter,
} from '../runner';
import { finalizeRunnerResult } from '../contracts';
import type { ResearchResult } from '../supabase';
import { ICP_INTELLIGENCE_SKILL } from '../skills/intelligence-skill';

const ICP_MODEL = process.env.RESEARCH_ICP_MODEL ?? 'claude-sonnet-4-6';
const ICP_MAX_TOKENS = 10000;
const ICP_TIMEOUT_MS = 120_000;

const ICP_SYSTEM_PROMPT = `You are an expert ICP analyst validating whether a target audience is viable for paid media.

TASK: Critically assess whether this ICP can be profitably targeted with paid ads.

VALIDATION APPROACH:
1. Check targeting feasibility on Meta, LinkedIn, and Google
2. Verify adequate audience scale for testing
3. Assess pain-solution fit strength
4. Evaluate economic feasibility (budget authority, purchasing power)

TOOL USAGE:
Use web_search for up to 2 focused searches:
1. Audience size, reachability on major ad platforms, and economic profile
2. Industry pain points, buying behavior, and decision process from buyer-language sources

SPEED / SCOPE RULES:
- Reuse persisted competitor and offer context instead of re-researching the competitive landscape
- Stop once you have enough evidence to fill the schema confidently
- Keep verdict-first reasoning tight and decision-useful

BE CRITICAL:
- Flag real concerns, do not sugarcoat
- "validated" = truly ready for ads
- "workable" = proceed with caution
- "invalid" = do not spend money until fixed
- Each objection must be specific, buyer-language, and tied to the proof or reassurance required before purchase
- Avoid generic objections like "price" or "trust" without context

COMPRESSION RULES (STRICT — violating these causes JSON truncation failures):
- validatedPersona: ONE sentence, under 40 words. No parenthetical elaboration.
- demographics: 2 sentences max, under 50 words total
- channels: max 3
- triggers: max 4, each under 15 words
- objections: max 4, each under 20 words
- decisionFactors: max 4
- decisionProcess: 1-2 sentences, under 30 words
- finalVerdict.reasoning: 2 sentences max, under 40 words
- finalVerdict.recommendations: max 3, each under 15 words
- audienceRefinements: max 3 entries. Each field (refinement, testMethod, risk) under 20 words.
- segments: max 3 segments. Each segment's validatedPersona under 25 words.
- citations: max 4
- DO NOT repeat the same information across validatedPersona, demographics, and segments[0].validatedPersona

OUTPUT FORMAT:
CRITICAL: Your ENTIRE response MUST be the JSON object ONLY. No preamble, no explanation, no markdown code fences. Start your response with { and end with }.

After completing your research, respond with a JSON object. Structure:
{
  "validatedPersona": "string — the primary paid-media-ready ICP (always required — set to the primary segment's persona description)",
  "demographics": "string — firmographics / geography / team profile summary",
  "channels": ["string — the best paid channels to reach this ICP"],
  "triggers": ["string — the most reliable buying triggers"],
  "objections": ["string — top objections this ICP will raise, written in buyer language and naming the proof they need before buying"],
  "decisionFactors": [
    {
      "factor": "string — why this ICP buys / what matters most",
      "relevance": 0-100
    }
  ],
  "audienceSize": "Small | Medium | Large",
  "confidenceScore": 0-100,
  "decisionProcess": "string — who drives evaluation and approval",
  "finalVerdict": {
    "status": "validated | workable | invalid",
    "reasoning": "string — why this verdict was reached",
    "recommendations": ["string — how to target or de-risk this ICP"]
  },
  "audienceRefinements": [
    {
      "refinement": "string — 1 sentence: what to change about targeting or messaging",
      "segment": "string — which audience slice this applies to",
      "expectedLift": "low | moderate | high",
      "testMethod": "string — 1 sentence: how to validate this refinement",
      "risk": "string — 1 sentence: what happens if wrong"
    }
  ],
  "segments": [
    {
      "productLine": "string — the product or service line this segment targets",
      "validatedPersona": "string — the paid-media-ready ICP for this product line",
      "audienceSize": "Small | Medium | Large",
      "confidence": 0-100,
      "channels": ["string — top channels for this segment"],
      "triggers": ["string — buying triggers for this segment"],
      "objections": ["string — common objections from this segment"]
    }
  ],
  "citations": [
    {
      "url": "https://example.com/source",
      "title": "Source title"
    }
  ]
}

SEGMENTS GUIDANCE: If the business has distinct product lines targeting different audiences, identify and validate each as a separate ICP segment in the segments array. Most businesses have one primary ICP — only create multiple segments when the products target genuinely different buyer personas. Always set the top-level validatedPersona to the primary segment's persona description.

${ICP_INTELLIGENCE_SKILL}`;

export async function runResearchICP(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const client = createClient();
  const startTime = Date.now();
  try {
    await emitRunnerProgress(onProgress, 'runner', 'preparing ICP validation brief');
    const finalMsg = await runWithBackoff(
      () => {
        const runner = client.beta.messages.toolRunner({
          model: ICP_MODEL,
          max_tokens: ICP_MAX_TOKENS,
          stream: true,
          tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
          system: ICP_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Validate the ICP for paid media:\n\n${context}` }],
        });
        return Promise.race([
          runStreamedToolRunner(runner, {
            onProgress,
            synthesisMessage: 'synthesizing ICP validation',
            maxToolIterations: 3,
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Sub-agent timed out after ${ICP_TIMEOUT_MS / 1000}s`)), ICP_TIMEOUT_MS)),
        ]);
      },
      'researchICP',
    );
    const textBlock = finalMsg.content.findLast((b: BetaContentBlock) => b.type === 'text');
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';
    let parsed: unknown;
    let parseError: unknown;
    try {
      parsed = extractJson(resultText);
    } catch (error) {
      console.error('[icp] JSON extraction failed:', resultText.slice(0, 300));
      parseError = error;
    }
    return finalizeRunnerResult({
      section: 'icpValidation',
      durationMs: Date.now() - startTime,
      parsed,
      rawText: resultText,
      parseError,
      telemetry: buildRunnerTelemetry(finalMsg),
    });
  } catch (error) {
    return {
      status: 'error',
      section: 'icpValidation',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}
