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

const ICP_MODEL = process.env.RESEARCH_ICP_MODEL ?? 'claude-sonnet-4-6';
const ICP_MAX_TOKENS = 5200;
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

COMPRESSION RULES:
- channels: max 3
- triggers: max 4
- objections: max 4
- decisionFactors: max 4
- finalVerdict.recommendations: max 3
- citations: max 4
- Keep demographics, decisionProcess, and finalVerdict.reasoning to 2-3 sentences each

OUTPUT FORMAT:
CRITICAL: Your ENTIRE response MUST be the JSON object ONLY. No preamble, no explanation, no markdown code fences. Start your response with { and end with }.

After completing your research, respond with a JSON object. Structure:
{
  "validatedPersona": "string — the single best paid-media-ready ICP",
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
  }
  "citations": [
    {
      "url": "https://example.com/source",
      "title": "Source title"
    }
  ]
}`;

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
