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
import { finalizeRunnerResult } from '../contracts';
import type { ResearchResult } from '../supabase';
import type { RunnerTelemetry } from '../telemetry';

const SYNTHESIS_MODEL =
  process.env.RESEARCH_SYNTHESIS_MODEL ?? 'claude-sonnet-4-6';
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
    downstreamSequence: z.array(z.enum(['keywordIntel', 'mediaPlan'])),
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

export const SYNTHESIS_SYSTEM = `You are synthesizing research into an actionable paid media strategy.

Create a strategic cross-analysis connecting all research insights into actionable paid media strategy.

RULES:
- Extract 4-5 key insights (at least one from each research section)
- Develop a clear positioning strategy with 2-3 alternatives to test
- Mine competitor data — at least ONE insight must reference specific competitor weaknesses
- Keep all strings concise and decision-useful
- Do not fabricate data not present in the research
- When citing statistics, distinguish between independent research (industry surveys, government data, academic studies) and competitor marketing claims. If a statistic originates from a competitor's website or promotional materials, label it as "per [Competitor] estimates" rather than presenting it as independent industry data.

CURRENT MARKETING ACTIVITIES (anti-duplication rule):
- The context may contain a "Current Marketing Activities:" line describing channels, budgets, and creatives the client is ALREADY running.
- If present, your recommendations MUST NOT restate these as "new" strategy.
- Your platformRecommendations, messagingAngles, and positioningStrategy must propose NEW angles, UNTESTED channels, or CONTRARIAN moves relative to what's already in market.
- If the client is already running a channel successfully, you may keep it as a "primary" platform but your rationale MUST explicitly reference what they're doing today and describe the INCREMENTAL change (new audience, new creative system, new bidding strategy) — not repeat their existing playbook.
- If a channel is already running but failing, recommend a structural fix or cutting it — do not silently re-recommend it.
- If the field is empty or absent, ignore this rule and proceed normally.

BUDGET ALLOCATION:
- Under $2K/month: 1 primary platform (70-80%), 1 secondary for retargeting only
- $2K-$5K: 1 primary (50-60%) + 1 secondary (25-30%) + 1 testing (10-20%)
- $5K-$15K: Full multi-platform testing viable
- Over $15K: Aggressive multi-platform strategy
- Show per-platform dollar amounts, not just percentages
- Minimum viable: LinkedIn $500/mo, Google Search $500/mo, Meta $300/mo retargeting / $1K prospecting

CONVERSION RATE BENCHMARKS:
- B2B SaaS demo page: 2-5% landing page to demo request
- B2B SaaS free trial: 5-15% landing page to trial signup
- E-commerce: 2-4% average
- Never estimate demo page CVR above 5% for B2B SaaS without explicit evidence from the research data
- If you include conversion rate estimates in planningContext or strategicNarrative, they MUST fall within these ranges unless you cite a specific data source justifying a higher number

MESSAGING ANGLES:
- Map at least 2 angles as objection → counter-angle → proof
- Use real buyer-language from ICP validation when available
- exampleHook must directly answer the objection
- evidence must name both the objection and proof signal

${SYNTHESIS_INTELLIGENCE_SKILL}`;

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
