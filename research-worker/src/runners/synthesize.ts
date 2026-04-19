// Runner: Strategic Synthesis (generateObject — schema-constrained JSON output)
// Uses Vercel AI SDK generateObject for guaranteed valid JSON, matching
// the pattern used by media-plan.ts and all other runners.

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import {
  emitRunnerProgress,
  type RunnerProgressReporter,
} from '../runner';
import { SYNTHESIS_INTELLIGENCE_SKILL } from '../skills/intelligence-skill';
import { loadRunnerPrompt } from '../skills/loader';
import { finalizeRunnerResult } from '../contracts';
import type { ResearchResult } from '../supabase';
import type { RunnerTelemetry } from '../telemetry';
import { MODELS } from '../models';

const SYNTHESIS_MODEL =
  process.env.RESEARCH_SYNTHESIS_MODEL ?? MODELS.STANDARD;
const SYNTHESIS_MAX_TOKENS = 8000;
const SYNTHESIS_TIMEOUT_MS = 180_000;

// Schema for generateObject — no .min()/.int()/.positive() constraints
// because the Anthropic API rejects those in JSON Schema output_config.
// Post-hoc validation happens in finalizeRunnerResult via contracts.ts.
const synthesisGenerateSchema = z.object({
  keyInsights: z.array(
    z.object({
      insight: z.string(),
      source: z
        .enum([
          'industryResearch',
          'competitorIntel',
          'icpValidation',
          'offerAnalysis',
        ])
        .optional(),
      implication: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    }),
  ),
  positioningStrategy: z.object({
    recommendedAngle: z.string(),
    alternativeAngles: z.array(z.string()),
    leadRecommendation: z.string(),
    keyDifferentiator: z.string(),
  }),
  platformRecommendations: z.array(
    z.object({
      platform: z.string(),
      role: z.enum(['primary', 'secondary', 'testing', 'retargeting']),
      budgetAllocation: z.string(),
      rationale: z.string(),
      priority: z.number(),
    }),
  ),
  messagingAngles: z.array(
    z.object({
      angle: z.string(),
      targetEmotion: z.string(),
      exampleHook: z.string(),
      evidence: z.string(),
    }),
  ),
  planningContext: z.object({
    monthlyBudget: z.string().optional(),
    targetCpl: z.string().optional(),
    targetCac: z.string().optional(),
    estimatedDemoPageCvr: z.number().optional().describe('Estimated demo/trial page conversion rate as a percentage (e.g. 3.5 for 3.5%). Must be within industry benchmarks: 2-5% for B2B SaaS demo pages.'),
    // downstreamSequence is not emitted by the model — it's a deterministic
    // UI label filled in by the contracts layer. Keywords run in parallel
    // with synthesis (see WAVE_2_PARALLEL_SECTIONS), so mediaPlan is the
    // only genuine downstream stage.
  }),
  criticalSuccessFactors: z.array(z.string()),
  nextSteps: z.array(z.string()),
  strategicNarrative: z.string(),
  readinessScorecard: z.object({
    overallScore: z.number(),
    verdict: z.string(),
    verdictLabel: z.string(),
    dimensions: z.array(z.object({
      name: z.string(),
      score: z.number(),
      summary: z.string(),
    })),
  }).optional(),
  topActions: z.object({
    actions: z.array(z.object({
      action: z.string(),
      source: z.string(),
      priority: z.string(),
    })),
  }).optional(),
});

// The CURRENT MARKETING ACTIVITIES block below is a paired guardrail — keep
// in sync with media-plan.ts (CURRENT_ACTIVITIES_GUARDRAIL) and offer.ts
// (OFFER_CURRENT_ACTIVITIES_GUARDRAIL). All three runners react to the same
// "Current Marketing Activities:" line in the context string.
// See docs/superpowers/specs/2026-04-08-current-marketing-activities-design.md
export const SYNTHESIS_SYSTEM =
  `${loadRunnerPrompt('synthesize-system')}\n${SYNTHESIS_INTELLIGENCE_SKILL}`;

interface GenerateObjectUsage {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}

function buildTelemetryFromUsage(
  model: string,
  usage: GenerateObjectUsage,
): RunnerTelemetry {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;

  const pricing = /haiku/i.test(model)
    ? { input: 0.8, output: 4 }
    : /opus/i.test(model)
      ? { input: 15, output: 75 }
      : { input: 3, output: 15 };

  return {
    model,
    stopReason: 'end_turn',
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    estimatedCostUsd:
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output,
  };
}

export async function runSynthesizeResearch(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const startTime = Date.now();

  try {
    await emitRunnerProgress(onProgress, 'runner', 'preparing strategic synthesis brief');
    await emitRunnerProgress(onProgress, 'tool', 'cross-referencing market, ICP, offer, and competitor data');
    await emitRunnerProgress(onProgress, 'tool', 'identifying strategic patterns and positioning gaps');
    await emitRunnerProgress(onProgress, 'tool', 'scoring section confidence levels');
    await emitRunnerProgress(onProgress, 'analysis', 'synthesizing strategic narrative');

    let object: z.infer<typeof synthesisGenerateSchema> | undefined;
    let usage: GenerateObjectUsage | undefined;

    // Emit simulated progress during generation (hyper-agent view needs activity)
    const progressInterval = setInterval(async () => {
      const progressMessages = [
        'draft positioning: mapping competitive differentiation angles',
        'draft messaging: generating ad hook frameworks',
        'draft strategy: aligning ICP pain points with offer strengths',
        'draft insights: scoring cross-section confidence levels',
        'draft channels: evaluating platform-audience fit',
        'draft objections: building objection-handler matrix',
      ];
      const msg = progressMessages[Math.floor(Math.random() * progressMessages.length)];
      await emitRunnerProgress(onProgress, 'analysis', msg);
    }, 4000);

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const abort = AbortSignal.timeout(SYNTHESIS_TIMEOUT_MS);
        const result = await generateObject({
          model: anthropic(SYNTHESIS_MODEL),
          schema: synthesisGenerateSchema,
          maxOutputTokens: SYNTHESIS_MAX_TOKENS,
          system: SYNTHESIS_SYSTEM,
          prompt: `Synthesize all research into a cross-analysis strategic summary:\n\n${context}`,
          abortSignal: abort,
        });
        object = result.object;
        usage = result.usage;
        clearInterval(progressInterval);
        break;
      } catch (err) {
        const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
        if (isTimeout && attempt === 1) {
          await emitRunnerProgress(
            onProgress,
            'runner',
            'strategic synthesis timed out — retrying',
          );
          continue;
        }
        clearInterval(progressInterval);
        throw err;
      }
    }

    clearInterval(progressInterval);

    if (!object || !usage) {
      throw new Error('Strategic synthesis failed after 2 attempts');
    }

    // Cap CVR if hallucinated above B2B SaaS demo page benchmark (5%)
    if (
      object.planningContext?.estimatedDemoPageCvr !== undefined &&
      object.planningContext.estimatedDemoPageCvr > 5
    ) {
      object = {
        ...object,
        planningContext: {
          ...object.planningContext,
          estimatedDemoPageCvr: 5,
        },
      };
    }

    // --- Scorecard enforcement: force score=0 for missing upstream sections ---
    // Match either (a) the section key header written by the legacy summarization
    // fallback (## industryMarket), or (b) wiki topic tags written by the
    // wiki-first context ([market_size], [competitor_profile], etc).
    if (object.readinessScorecard?.dimensions) {
      const DIMENSION_TOKENS: Record<string, string[]> = {
        'Market Opportunity': ['industrymarket', '[market_', '[pain_', '[trend_'],
        'Audience Clarity': ['icpvalidation', '[icp_'],
        'Competitive Position': ['## competitors', '[competitor_'],
        'Offer Strength': ['offeranalysis', '[offer_'],
      };
      const contextLower = context.toLowerCase();
      for (const dim of object.readinessScorecard.dimensions) {
        const tokens = DIMENSION_TOKENS[dim.name];
        if (tokens && !tokens.some((t) => contextLower.includes(t))) {
          dim.score = 0;
          dim.summary = 'Insufficient data — section not completed';
        }
      }
      // Recalculate overall score and verdict
      const scores = object.readinessScorecard.dimensions.map((d: { score: number }) => d.score);
      const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
      object.readinessScorecard.overallScore = Math.round(avg * 10) / 10;
      object.readinessScorecard.verdict =
        avg >= 8 ? 'ready' : avg >= 5 ? 'fix-gaps-first' : 'needs-work';
      object.readinessScorecard.verdictLabel =
        avg >= 8 ? 'Ready to launch' : avg >= 5 ? 'Fix gaps first' : 'Needs significant work';
    }

    await emitRunnerProgress(onProgress, 'runner', 'strategic synthesis complete');

    const telemetry = buildTelemetryFromUsage(SYNTHESIS_MODEL, usage);

    return finalizeRunnerResult({
      section: 'strategicSynthesis',
      durationMs: Date.now() - startTime,
      parsed: object,
      rawText: JSON.stringify(object),
      telemetry,
    });
  } catch (error) {
    return {
      status: 'error',
      section: 'strategicSynthesis',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}
