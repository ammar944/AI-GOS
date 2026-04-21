// Runner: Media Plan (6-block sequential generator)
// Replaces the old media-planner.ts. Same tool name (researchMediaPlan).
// Produces 6 blocks sequentially, writing partial results to Supabase after each.
// No live API calls — all evidence comes from vendored reference data + approved research.

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import {
  channelMixBudgetSchema,
  audienceCampaignSchema,
  creativeSystemSchema,
  measurementGuardrailsSchema,
  rolloutRoadmapSchema,
  strategySnapshotSchema,
  type MediaPlanBlock,
} from '../contracts';
import { writeResearchResult } from '../supabase';
import type { ResearchResult } from '../supabase';
import type { RunnerProgressReporter } from '../runner';
import { emitRunnerProgress } from '../runner';
import {
  loadBlockRefs,
  loadIndustryTemplate,
  loadRunnerPrompt,
  loadBusinessModelTemplate,
  loadMediaPlanMethodology,
} from '../skills/loader';
import { CHANNEL_MIX_SKILL } from '../skills/channel-mix-skill';
import { AUDIENCE_CAMPAIGN_SKILL } from '../skills/audience-campaign-skill';
import { CREATIVE_SYSTEM_SKILL } from '../skills/creative-system-skill';
import { MEASUREMENT_SKILL } from '../skills/measurement-skill';
import { ROLLOUT_SKILL } from '../skills/rollout-skill';
import { STRATEGY_SNAPSHOT_SKILL } from '../skills/strategy-snapshot-skill';
import {
  validateBudgetMath,
  validateTargetingHeuristics,
  validatePhaseBudgets,
  reconcileBudgetAcrossBlocks,
  validateSnapshotConsistency,
  validateCampaignCountByBudget,
  validatePlatformCountByBudget,
  validateChannelGrounding,
  validateNoRetargetingWithoutPool,
  validateIndustryBenchmarks,
  validateLtvCacViability,
  validateStrategicFrame,
} from '../validators/media-plan';

import { stripNumericConstraints } from '../utils/strip-numeric-constraints';
import { cachedSystemForAiSdk } from '../utils/prompt-cache';
import { MODELS } from '../models';
import { emitTelemetry } from '../telemetry';

const MODEL = MODELS.STANDARD;

// Per-block maxOutputTokens caps. Infrastructure added 2026-04-20 so per-block
// tightening is possible once real telemetry data shows p95 output size per
// block. Initial cap-by-schema-guess broke measurementGuardrails (actual
// output ~5-7k tokens) on 2026-04-20 18:06 UTC — Sonnet writes more verbose
// structured output than schema shape predicts, particularly for arrays of
// objects with detailed nested fields (risks, improvementLevers). All blocks
// default to 8000 (the pre-session value) until research_telemetry.cache_creation_input_tokens
// and output_tokens rows accumulate enough data for evidence-based tightening.
// DO NOT tighten these caps without telemetry data — generation failures
// cascade through retries and silently burn ~3 minutes + $0.30 per attempt.
const BLOCK_MAX_TOKENS: Record<string, number> = {
  channelMixBudget: 8000,
  audienceCampaign: 8000,
  creativeSystem: 8000,
  measurementGuardrails: 8000,
  rolloutRoadmap: 8000,
  strategySnapshot: 8000,
};
const DEFAULT_MAX_TOKENS = 8000;

const ANTI_HALLUCINATION = `\n\nIMPORTANT: Use only the provided reference data and research results. Do not infer unsupported facts. All benchmark numbers must be labeled as 'industry benchmark'.`;

// Paired guardrail — keep in sync with synthesize.ts (SYNTHESIS_SYSTEM) and
// offer.ts (OFFER_CURRENT_ACTIVITIES_GUARDRAIL). All three runners react to
// the same "Current Marketing Activities:" line in the context string.
// See docs/superpowers/specs/2026-04-08-current-marketing-activities-design.md
export const CURRENT_ACTIVITIES_GUARDRAIL =
  loadRunnerPrompt('media-plan-system') ||
  `
CURRENT MARKETING ACTIVITIES (anti-duplication rule):
- The context may contain a "Current Marketing Activities:" line describing channels, budgets, and creatives the client is ALREADY running.
- For Channel Mix & Budget: do not propose a budget allocation that mirrors the current one. If 60% of current spend is on Meta, your recommendation should either (a) cut Meta to open room for untested channels or (b) restructure the Meta spend into a materially different audience/creative mix, with explicit rationale.
- For Audience & Campaign: do not re-propose audience layers the client confirms they're already running. New lookalike seeds, new interest stacks, new exclusions — yes. Same targeting — no.
- For Creative System: do not recommend a creative format (UGC, static, carousel, VSL) the client explicitly says is already working or already tested. Pick a different format or a different angle on the same format.
- For Rollout Roadmap: phase 1 should not be "launch [channel they're already running]" — phase 1 is the INCREMENTAL change.
- If the field is empty or absent, ignore this rule.`;

interface BlockConfig {
  name: MediaPlanBlock;
  label: string;
  skill: string;
  schema: z.ZodType;
}

const BLOCK_SEQUENCE: BlockConfig[] = [
  { name: 'channelMixBudget', label: 'Channel Mix & Budget', skill: CHANNEL_MIX_SKILL, schema: channelMixBudgetSchema },
  { name: 'audienceCampaign', label: 'Audience & Campaign Design', skill: AUDIENCE_CAMPAIGN_SKILL, schema: audienceCampaignSchema },
  { name: 'creativeSystem', label: 'Creative System', skill: CREATIVE_SYSTEM_SKILL, schema: creativeSystemSchema },
  { name: 'measurementGuardrails', label: 'Measurement & Guardrails', skill: MEASUREMENT_SKILL, schema: measurementGuardrailsSchema },
  { name: 'rolloutRoadmap', label: 'Rollout Roadmap', skill: ROLLOUT_SKILL, schema: rolloutRoadmapSchema },
  { name: 'strategySnapshot', label: 'Strategy Snapshot', skill: STRATEGY_SNAPSHOT_SKILL, schema: strategySnapshotSchema },
];

// Detect industry vertical from onboarding context
function detectIndustry(context: string): string {
  const lower = context.toLowerCase();
  const patterns: [string, RegExp][] = [
    ['saas', /\b(saas|software as a service|subscription software|cloud software)\b/],
    ['ecommerce', /\b(e-?commerce|online store|shopify|woocommerce|dtc|direct.to.consumer)\b/],
    ['b2b-enterprise', /\b(b2b enterprise|enterprise software|enterprise sales)\b/],
    ['local-service', /\b(local service|plumber|hvac|roofing|landscaping|cleaning service|home service)\b/],
    ['healthcare', /\b(healthcare|medical|health tech|telehealth|dental|clinic)\b/],
    ['finance', /\b(finance|fintech|banking|insurance|investment|lending|mortgage)\b/],
    ['real-estate', /\b(real estate|realtor|property|brokerage|housing)\b/],
    ['mobile-app', /\b(mobile app|ios app|android app|app install|app download)\b/],
    ['info-products', /\b(info product|online course|digital product|coaching|webinar|ebook)\b/],
    ['agency', /\b(agency|consulting|consultancy|professional services|marketing agency)\b/],
  ];

  for (const [industry, pattern] of patterns) {
    if (pattern.test(lower)) return industry;
  }

  return 'generic';
}

// Extract userId, sessionId, and runId from the context string.
// The dispatch system prepends these as metadata lines; the worker entry
// (research-worker/src/index.ts) injects [runId:...] and [jobId:...] so
// per-call telemetry emitted here can correlate with the parent run.
function extractMetadata(
  context: string,
): { userId: string; sessionId?: string; runId?: string } {
  const userIdMatch = context.match(/\[userId:([^\]]+)\]/);
  const sessionIdMatch = context.match(/\[sessionId:([^\]]+)\]/);
  const runIdMatch = context.match(/\[runId:([^\]]+)\]/);
  return {
    userId: userIdMatch?.[1] ?? '',
    sessionId: sessionIdMatch?.[1],
    runId: runIdMatch?.[1],
  };
}

// Business model classification — populated by the identity resolver and
// prepended to the context string by the dispatch route as `[businessModelType:X]`.
// Defaults to 'unknown' if the field is missing, causing the runner to flag
// classificationConfidence: low and default the funnel to SLG.
type BusinessModelType = 'plg' | 'slg' | 'ecommerce' | 'transactional' | 'marketplace' | 'unknown';

function extractBusinessModel(context: string): BusinessModelType {
  const match = context.match(/\[businessModelType:([^\]]+)\]/);
  const value = match?.[1]?.trim().toLowerCase();
  const valid: BusinessModelType[] = ['plg', 'slg', 'ecommerce', 'transactional', 'marketplace', 'unknown'];
  if (value && (valid as string[]).includes(value)) return value as BusinessModelType;
  return 'unknown';
}

// Awareness level classification — Schwartz 5 levels. Drives channel, funnel
// split, and creative approach routing.
type AwarenessLevel = 'unaware' | 'problem-aware' | 'solution-aware' | 'product-aware' | 'most-aware' | 'unknown';

function extractAwarenessLevel(context: string): AwarenessLevel {
  const match = context.match(/\[awarenessLevel:([^\]]+)\]/);
  const value = match?.[1]?.trim().toLowerCase();
  const valid: AwarenessLevel[] = ['unaware', 'problem-aware', 'solution-aware', 'product-aware', 'most-aware', 'unknown'];
  if (value && (valid as string[]).includes(value)) return value as AwarenessLevel;
  return 'unknown';
}

// v3 onboarding §1 echo tags (added 2026-04-21). The dispatch route injects
// these as `[salesMotion:X]`, `[pricingModel:X]`, `[conversionPath:X]`,
// `[avgAcv:X]` from the onboarding form. Block 1 echoes them into
// strategicFrame; downstream blocks consume from structured fields. The
// runner only extracts for logging + observability — prompts read the tags
// directly from context.
function extractContextTag(context: string, tag: string): string | null {
  const match = context.match(new RegExp(`\\[${tag}:([^\\]]+)\\]`));
  const raw = match?.[1]?.trim().toLowerCase();
  // Treat empty brackets (`[salesMotion:]`) as absent.
  return raw && raw.length > 0 ? raw : null;
}

export async function runMediaPlan(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const startTime = Date.now();
  const industry = detectIndustry(context);
  const businessModelType = extractBusinessModel(context);
  const awarenessLevel = extractAwarenessLevel(context);
  // v3 onboarding §1 echo tags — logged for observability; prompts read
  // from context directly.
  const salesMotion = extractContextTag(context, 'salesMotion');
  const pricingModel = extractContextTag(context, 'pricingModel');
  const conversionPath = extractContextTag(context, 'conversionPath');
  const avgAcv = extractContextTag(context, 'avgAcv');
  const shouldInjectTemplates = process.env.INJECT_INDUSTRY_TEMPLATES !== 'false';
  const industryTemplate = shouldInjectTemplates ? loadIndustryTemplate(industry) : '';
  const businessModelTemplate = shouldInjectTemplates ? loadBusinessModelTemplate(businessModelType) : '';
  const { userId, runId } = extractMetadata(context);

  // Load media-plan methodologies once — these frame every block's reasoning.
  // Methodologies = "how to think"; skills = "what to output".
  const bmRouting = loadMediaPlanMethodology('business-model-routing.md');
  const awarenessRouting = loadMediaPlanMethodology('awareness-level-routing.md');
  const salesCycleBounding = loadMediaPlanMethodology('sales-cycle-bounding.md');
  const channelGrounding = loadMediaPlanMethodology('channel-grounding.md');
  const inMarketTierRouting = loadMediaPlanMethodology('in-market-tier-routing.md');
  // 2026-04-21 (Mahdy round 3): three new methodologies added to replace
  // the "delete-noisy-sections" pass with a "ship better content via named
  // frameworks" pass. Foundation skills for measurement, small-budget
  // decision-making, and unit-economics viability.
  const benchmarkSelection = loadMediaPlanMethodology('benchmark-selection.md');
  const smallBudgetDiscipline = loadMediaPlanMethodology('small-budget-discipline.md');
  const ltvCacViability = loadMediaPlanMethodology('ltv-cac-viability.md');
  const mediaPlanMethodologies = [
    bmRouting,
    awarenessRouting,
    salesCycleBounding,
    channelGrounding,
    inMarketTierRouting,
    benchmarkSelection,
    smallBudgetDiscipline,
    ltvCacViability,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');

  console.log(
    `[media-plan] businessModel=${businessModelType} awarenessLevel=${awarenessLevel} industry=${industry} salesMotion=${salesMotion ?? '-'} pricingModel=${pricingModel ?? '-'} conversionPath=${conversionPath ?? '-'} avgAcv=${avgAcv ?? '-'}`,
  );

  const completedBlocks: MediaPlanBlock[] = [];
  const blockResults: Record<string, unknown> = {};
  const allWarnings: string[] = [];

  console.log(`[media-plan] Starting 6-block generation for industry: ${industry}`);

  // Opus planning pass removed 2026-04-20. Previously a 30–45s Opus pre-pass
  // produced advisory 500-word text injected into each block's user prompt.
  // That advisory was never schema-validated or reconciled against block
  // outputs, and its graceful-degradation path (timeout → empty string) made
  // quality non-deterministic across runs. The strategic frame now lives
  // inside block 1 (channelMixBudget.strategicFrame) and is propagated to
  // downstream blocks via previousBlocksContext.

  // Block generation helper — generates, validates, and stores a single block
  const generateBlock = async (
    block: BlockConfig,
    blockNum: number,
  ): Promise<void> => {
    await emitRunnerProgress(onProgress, 'runner', `generating block ${blockNum}/6: ${block.label}`);
    const blockDescriptions: Record<string, string[]> = {
      channelMixBudget: ['Allocating budget across paid channels', 'Calculating channel-level CPM and CPC benchmarks'],
      audienceCampaign: ['Designing audience segments and targeting layers', 'Structuring campaign hierarchy and naming conventions'],
      creativeSystem: ['Defining creative angles and testing plan', 'Setting copy frameworks and CTA sequences'],
      measurementGuardrails: ['Building measurement guidance', 'Setting performance guardrails and alert thresholds'],
      rolloutRoadmap: ['Planning phased launch timeline', 'Allocating budget across rollout phases'],
      strategySnapshot: ['Compiling executive strategy summary', 'Generating strategic recommendations'],
    };
    for (const desc of blockDescriptions[block.name] ?? []) {
      await emitRunnerProgress(onProgress, 'tool', desc);
    }
    console.log(`[media-plan] Block ${blockNum}/6: ${block.label}`);

    const refs = loadBlockRefs(block.name);
    // Ordering matters for Anthropic prompt caching. Stable content (shared
    // across all 6 blocks in one run + across runs within the 1h TTL) goes
    // FIRST so the cache prefix is identical block-to-block and run-to-run.
    // Per-block variable content (block.skill, refs) goes LAST so only the
    // tail is a cache miss. This unlocks cross-block cache hits from block 2
    // onward — block 1 primes, blocks 2–6 hit.
    const systemParts = [
      // ── Stable prefix (identical across all 6 blocks + across runs) ──
      mediaPlanMethodologies ? `\n\n## Media Plan Methodologies (how to think)\n\nThese decision frameworks frame the whole plan. Apply them before the block-specific instructions below.\n\n${mediaPlanMethodologies}` : '',
      businessModelTemplate ? `\n\n## Business Model Template (${businessModelType})\nModel-specific funnel, KPIs, default channel mix, and forbidden campaign types. Overrides any default in the block skill when they conflict.\n\n${businessModelTemplate}` : '',
      industryTemplate ? `\n\n## Industry Template (${industry}) — GENERIC DEFAULTS ONLY\nThese are category-level benchmarks, NOT client-specific research. When using ANY number from this section:\n1. Append "(industry default)" to the value in your output\n2. Only use when client-specific data is unavailable\nNEVER present these as client-specific findings.\n\n${industryTemplate}` : '',
      ANTI_HALLUCINATION,
      CURRENT_ACTIVITIES_GUARDRAIL,
      // ── Per-block tail (cache miss boundary; varies per block) ──
      block.skill,
      refs ? `\n\n## Reference Benchmarks (NOT client-specific)\nThe following are generic industry benchmarks for reference only. When using any number from this section, label it "(benchmark)" in your output. NEVER present these as client-specific research findings.\n\n${refs}` : '',
    ];

    const previousBlocksContext = completedBlocks.length > 0
      ? `\n\n## Previous Block Results\n\n${completedBlocks
          .map((name) => `### ${name}\n${JSON.stringify(blockResults[name], null, 2)}`)
          .join('\n\n')}`
      : '';

    const userPrompt = `Build the ${block.label} section of the media plan based on this context:\n\n${context}${previousBlocksContext}`;

    // Emit progress during generation so hyper-agent view stays active
    const blockProgressMessages: Record<string, string[]> = {
      channelMixBudget: ['draft budget: modeling channel-level spend allocation', 'draft CPM: benchmarking cost-per-impression by platform'],
      audienceCampaign: ['draft audiences: building lookalike and interest segments', 'draft campaigns: structuring ad set hierarchy'],
      creativeSystem: ['draft angles: defining creative messaging directions', 'draft copy: generating headline and CTA variants'],
      measurementGuardrails: ['draft measurement guidance: industry benchmarks + sales process', 'draft alerts: setting performance guardrail triggers'],
      rolloutRoadmap: ['draft phases: planning budget ramp schedule', 'draft timeline: mapping launch milestones'],
      strategySnapshot: ['draft summary: compiling executive strategy overview', 'draft recommendations: prioritizing action items'],
    };
    let progressIdx = 0;
    const msgs = blockProgressMessages[block.name] ?? ['draft analysis: generating section data'];
    const blockProgressInterval = setInterval(async () => {
      const msg = msgs[progressIdx % msgs.length];
      await emitRunnerProgress(onProgress, 'analysis', msg);
      progressIdx++;
    }, 5000);

    let object: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const blockT0 = Date.now();
      try {
        const blockAbort = AbortSignal.timeout(180_000);
        const blockMaxTokens = BLOCK_MAX_TOKENS[block.name] ?? DEFAULT_MAX_TOKENS;
        const result = await generateObject({
          model: anthropic(MODEL),
          schema: stripNumericConstraints(block.schema),
          maxOutputTokens: blockMaxTokens,
          messages: [
            cachedSystemForAiSdk(systemParts.filter(Boolean).join('\n')),
            { role: 'user', content: userPrompt },
          ],
          abortSignal: blockAbort,
        });
        object = result.object;
        clearInterval(blockProgressInterval);
        if (runId) {
          emitTelemetry({
            event: 'tool.call',
            runId,
            userId,
            section: 'mediaPlan',
            card: block.name,
            durationMs: Date.now() - blockT0,
            model: MODEL,
            extra: {
              stage: blockNum <= 3 ? 'wave1' : 'wave2',
              blockNum,
              attempt,
              outcome: 'success',
            },
          });
        }
        break;
      } catch (err) {
        const isTimeout = err instanceof DOMException && err.name === 'TimeoutError';
        if (runId) {
          emitTelemetry({
            event: 'tool.call',
            runId,
            userId,
            section: 'mediaPlan',
            card: block.name,
            durationMs: Date.now() - blockT0,
            model: MODEL,
            errorMessage: err instanceof Error ? err.message : String(err),
            extra: {
              stage: blockNum <= 3 ? 'wave1' : 'wave2',
              blockNum,
              attempt,
              outcome: isTimeout ? 'timeout' : 'error',
            },
          });
        }
        if (isTimeout && attempt === 1) {
          console.warn(`[media-plan] Block ${blockNum} timed out — retrying (attempt 2)`);
          continue;
        }
        clearInterval(blockProgressInterval);
        throw err;
      }
    }

    clearInterval(blockProgressInterval);

    // Validate
    await emitRunnerProgress(onProgress, 'analysis', `validating ${block.label}`);
    let validatedData = object;
    let blockWarnings: string[] = [];

    switch (block.name) {
      case 'channelMixBudget': {
        await emitRunnerProgress(onProgress, 'tool', 'checking budget math and channel allocation');
        const result = validateBudgetMath(validatedData as z.infer<typeof channelMixBudgetSchema>);
        validatedData = result.data;
        blockWarnings = result.warnings;
        // Round-3: budget-gated platform count ceiling + $1,500/mo platform floor.
        const platformCountWarnings = validatePlatformCountByBudget(result.data);
        blockWarnings.push(...platformCountWarnings.map((w) => w.message));
        // Round-3: channel-grounding — every platform must be cited upstream.
        const groundingWarnings = validateChannelGrounding(result.data, context);
        blockWarnings.push(...groundingWarnings.map((w) => w.message));
        // strategicFrame sanity — tier mix sums to 100, budget gate respected,
        // awareness × tier coherence. Non-mutating; emits warnings only.
        const frameWarnings = validateStrategicFrame(result.data);
        blockWarnings.push(...frameWarnings.warnings);
        break;
      }
      case 'audienceCampaign': {
        await emitRunnerProgress(onProgress, 'tool', 'verifying audience targeting heuristics');
        const result = validateTargetingHeuristics(validatedData as z.infer<typeof audienceCampaignSchema>);
        validatedData = result.data;
        blockWarnings = result.warnings;
        // Round-3: budget-gated campaign-count ceiling + singleCampaignRationale requirement.
        const prevChannelMix = blockResults.channelMixBudget as
          | z.infer<typeof channelMixBudgetSchema>
          | undefined;
        const totalMonthly = prevChannelMix?.budgetSummary?.totalMonthly ?? 0;
        const campaignCountWarnings = validateCampaignCountByBudget(result.data, totalMonthly);
        blockWarnings.push(...campaignCountWarnings.map((w) => w.message));
        if (prevChannelMix) {
          const retargetingWarnings = validateNoRetargetingWithoutPool(result.data, prevChannelMix);
          blockWarnings.push(...retargetingWarnings.map((w) => w.message));
        }
        break;
      }
      case 'creativeSystem': {
        // formatSpecs validator removed 2026-04-19 per Mahdy round 2 —
        // formatSpecs deleted from schema. Creative system block now relies
        // on schema validation alone (angles + testingPlan + refreshCadence).
        break;
      }
      case 'measurementGuardrails': {
        await emitRunnerProgress(onProgress, 'tool', 'validating industry benchmarks and sales process guidance');
        const benchmarkWarnings = validateIndustryBenchmarks(
          validatedData as z.infer<typeof measurementGuardrailsSchema>,
        );
        blockWarnings = benchmarkWarnings.map((w) => w.message);
        // Round-3: LTV:CAC viability gate — flag PLG CAC/CPL numeric leaks
        // and lead-vocabulary leaks on PLG/free-trial offers.
        const viabilityWarnings = validateLtvCacViability(
          validatedData as z.infer<typeof measurementGuardrailsSchema>,
          context,
        );
        blockWarnings.push(...viabilityWarnings.map((w) => w.message));
        break;
      }
      case 'rolloutRoadmap': {
        await emitRunnerProgress(onProgress, 'tool', 'reconciling phase budgets with channel mix');
        const totalMonthly = (blockResults.channelMixBudget as z.infer<typeof channelMixBudgetSchema>)
          ?.budgetSummary?.totalMonthly ?? 0;
        const result = validatePhaseBudgets(
          validatedData as z.infer<typeof rolloutRoadmapSchema>,
          totalMonthly,
        );
        validatedData = result.data;
        blockWarnings = result.warnings;
        break;
      }
    }

    if (blockWarnings.length > 0) {
      console.log(`[media-plan] Block ${blockNum} warnings:`, blockWarnings);
      allWarnings.push(...blockWarnings.map((w) => `[${block.label}] ${w}`));
    }

    blockResults[block.name] = validatedData;
    completedBlocks.push(block.name);

    // Write partial result to Supabase
    if (userId) {
      try {
        await writeResearchResult(userId, 'mediaPlan', {
          status: 'partial',
          section: 'mediaPlan',
          durationMs: Date.now() - startTime,
          data: { ...blockResults, completedBlocks: [...completedBlocks] },
        });
      } catch (writeErr) {
        console.error(`[media-plan] Failed to write partial result after block ${blockNum}:`, writeErr);
      }
    }

    await emitRunnerProgress(onProgress, 'output', `completed block ${blockNum}/6: ${block.label}`);
  };

  try {
    // Wave 1: Blocks 1-3 in parallel (independent — no cross-block dependencies)
    await emitRunnerProgress(onProgress, 'runner', 'generating blocks 1-3 in parallel: channel mix, audience, creative');
    const wave1Blocks = BLOCK_SEQUENCE.slice(0, 3); // channelMixBudget, audienceCampaign, creativeSystem
    const wave1Results = await Promise.allSettled(
      wave1Blocks.map((block, i) => generateBlock(block, i + 1)),
    );

    // Check for Wave 1 failures — retry failed blocks individually
    for (let i = 0; i < wave1Results.length; i++) {
      if (wave1Results[i].status === 'rejected') {
        const failedBlock = wave1Blocks[i];
        console.warn(`[media-plan] Wave 1 block ${failedBlock.name} failed — retrying individually`);
        await emitRunnerProgress(onProgress, 'runner', `retrying ${failedBlock.label} after parallel failure`);
        await generateBlock(failedBlock, i + 1);
      }
    }

    // Wave 2a: Blocks 4+5 parallel — measurementGuardrails (industry
    // benchmarks + salesProcessGuidance) and rolloutRoadmap (phased timeline)
    // both consume wave-1 outputs but NOT each other. Confirmed by validator
    // inspection 2026-04-20: validatePhaseBudgets only reads
    // channelMixBudget.budgetSummary.totalMonthly, not block 4; block 4's
    // validateIndustryBenchmarks only reads its own data. Parallelizing this
    // pair saves ~60-100s off the critical path.
    await emitRunnerProgress(onProgress, 'runner', 'generating blocks 4-5 in parallel: measurement, rollout');
    const wave2aBlocks = BLOCK_SEQUENCE.slice(3, 5); // measurementGuardrails, rolloutRoadmap
    const wave2aResults = await Promise.allSettled(
      wave2aBlocks.map((block, i) => generateBlock(block, i + 4)),
    );
    for (let i = 0; i < wave2aResults.length; i++) {
      if (wave2aResults[i].status === 'rejected') {
        const failedBlock = wave2aBlocks[i];
        console.warn(`[media-plan] Wave 2a block ${failedBlock.name} failed — retrying individually`);
        await emitRunnerProgress(onProgress, 'runner', `retrying ${failedBlock.label} after parallel failure`);
        await generateBlock(failedBlock, i + 4);
      }
    }

    // Wave 2b: Block 6 (strategySnapshot) serial — MUST run last because it
    // summarizes blocks 1–5 and its validator (validateSnapshotConsistency)
    // reads channelMixBudget, measurementGuardrails, and its own output.
    await generateBlock(BLOCK_SEQUENCE[5], 6);

    // Final Supabase write with complete status
    if (userId) {
      try {
        await writeResearchResult(userId, 'mediaPlan', {
          status: 'complete',
          section: 'mediaPlan',
          durationMs: Date.now() - startTime,
          data: {
            ...blockResults,
            completedBlocks: [...completedBlocks],
            ...(allWarnings.length > 0 ? { validationWarnings: allWarnings } : {}),
          },
        });
      } catch (writeErr) {
        console.error('[media-plan] Failed to write final result:', writeErr);
      }
    }

    // Cross-block validation
    await emitRunnerProgress(onProgress, 'analysis', 'running cross-block validation');

    const block1 = blockResults.channelMixBudget as z.infer<typeof channelMixBudgetSchema>;
    const block4 = blockResults.measurementGuardrails as z.infer<typeof measurementGuardrailsSchema>;
    const block5 = blockResults.rolloutRoadmap as z.infer<typeof rolloutRoadmapSchema>;
    const block6 = blockResults.strategySnapshot as z.infer<typeof strategySnapshotSchema>;

    const budgetWarnings = reconcileBudgetAcrossBlocks(block1, block4, block5);
    allWarnings.push(...budgetWarnings);

    const snapshotCheck = validateSnapshotConsistency(block1, block4, block6);
    allWarnings.push(...snapshotCheck.warnings);

    // If snapshot is inconsistent, regenerate Block 6 with corrected inputs
    if (snapshotCheck.needsRegeneration) {
      console.log('[media-plan] Regenerating Block 6 due to inconsistent snapshot');
      await emitRunnerProgress(onProgress, 'runner', 'regenerating strategy snapshot for consistency');

      const refs = loadBlockRefs('strategySnapshot');
      // Stable-prefix-first ordering (matches primary-pass assembly above) so
      // the regen call can cache-hit the same prefix the original block-6
      // primary call wrote, when available.
      const systemParts = [
        ANTI_HALLUCINATION,
        CURRENT_ACTIVITIES_GUARDRAIL,
        STRATEGY_SNAPSHOT_SKILL,
        refs ? `\n\n## Reference Benchmarks (NOT client-specific)\nGeneric industry benchmarks for reference only. Label any usage as "(benchmark)" in output.\n\n${refs}` : '',
        '\n\nCRITICAL: The snapshot numbers must EXACTLY match the validated block data provided. Do not round or approximate.',
      ];

      const correctedContext = completedBlocks
        .filter((name) => name !== 'strategySnapshot')
        .map((name) => `### ${name}\n${JSON.stringify(blockResults[name], null, 2)}`)
        .join('\n\n');

      const regenAbort = AbortSignal.timeout(120_000); // 2 min for regen
      const regenT0 = Date.now();
      const { object: regenerated } = await generateObject({
        model: anthropic(MODEL),
        schema: stripNumericConstraints(strategySnapshotSchema),
        maxOutputTokens: BLOCK_MAX_TOKENS.strategySnapshot ?? DEFAULT_MAX_TOKENS,
        messages: [
          cachedSystemForAiSdk(systemParts.filter(Boolean).join('\n')),
          {
            role: 'user',
            content: `Create a strategy snapshot that exactly matches these validated block results:\n\n${correctedContext}`,
          },
        ],
        abortSignal: regenAbort,
      });
      if (runId) {
        emitTelemetry({
          event: 'tool.call',
          runId,
          userId,
          section: 'mediaPlan',
          card: 'strategySnapshot',
          durationMs: Date.now() - regenT0,
          model: MODEL,
          extra: { stage: 'regen', blockNum: 6, outcome: 'success' },
        });
      }

      blockResults.strategySnapshot = regenerated;
    }

    // Final write with all validations
    if (userId) {
      try {
        await writeResearchResult(userId, 'mediaPlan', {
          status: 'complete',
          section: 'mediaPlan',
          durationMs: Date.now() - startTime,
          data: {
            ...blockResults,
            completedBlocks: [...completedBlocks],
            validationWarnings: allWarnings.length > 0 ? allWarnings : undefined,
          },
        });
      } catch (writeErr) {
        console.error('[media-plan] Failed to write final result:', writeErr);
      }
    }

    await emitRunnerProgress(onProgress, 'output', 'media plan generation complete');

    return {
      status: 'complete',
      section: 'mediaPlan',
      durationMs: Date.now() - startTime,
      data: {
        ...blockResults,
        completedBlocks: [...completedBlocks],
        validationWarnings: allWarnings.length > 0 ? allWarnings : undefined,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[media-plan] Runner error:', error);

    return {
      status: 'error',
      section: 'mediaPlan',
      error: errorMsg,
      durationMs: Date.now() - startTime,
    };
  }
}
