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
import { loadBlockRefs, loadIndustryTemplate } from '../skills/loader';
import { CHANNEL_MIX_SKILL } from '../skills/channel-mix-skill';
import { AUDIENCE_CAMPAIGN_SKILL } from '../skills/audience-campaign-skill';
import { CREATIVE_SYSTEM_SKILL } from '../skills/creative-system-skill';
import { MEASUREMENT_SKILL } from '../skills/measurement-skill';
import { ROLLOUT_SKILL } from '../skills/rollout-skill';
import { STRATEGY_SNAPSHOT_SKILL } from '../skills/strategy-snapshot-skill';
import {
  validateBudgetMath,
  validateTargetingHeuristics,
  validateFormatSpecs,
  validateCACModel,
  reconcileKPIs,
  validatePhaseBudgets,
  reconcileBudgetAcrossBlocks,
  validateSnapshotConsistency,
} from '../validators/media-plan';

/**
 * Recursively strip .min()/.max()/.nonnegative()/.positive() from z.number()
 * types in a Zod schema. The Anthropic API does not support `minimum`/`maximum`
 * in JSON Schema output_config. Only affects `generateObject()` — post-hoc
 * validation uses the original schema from contracts.ts.
 *
 * Uses Zod v4's `_zod.def.type` string discriminant for reliable type
 * identification across the $ZodType / ZodType class boundary.
 */
function stripNumericConstraints<T extends z.ZodType>(schema: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._zod?.def;
  if (!def || typeof def.type !== 'string') return schema;

  const typeName: string = def.type;

  if (typeName === 'number') {
    // Return a bare z.number() — even .int() is stripped because Zod v4's
    // integer format adds safe-integer min/max bounds to the JSON Schema,
    // which the Anthropic API also rejects. Post-hoc validation with the
    // original schema from contracts.ts will still enforce .int().
    return z.number() as unknown as T;
  }

  if (typeName === 'optional') {
    const inner = stripNumericConstraints((schema as any).unwrap());
    return z.optional(inner) as unknown as T;
  }

  if (typeName === 'default') {
    const inner = stripNumericConstraints(def.innerType);
    return inner.default(def.defaultValue) as unknown as T;
  }

  if (typeName === 'nullable') {
    const inner = stripNumericConstraints((schema as any).unwrap());
    return z.nullable(inner) as unknown as T;
  }

  if (typeName === 'object') {
    const shape = (schema as any).shape;
    if (shape && typeof shape === 'object') {
      const newShape: Record<string, z.ZodType> = {};
      for (const [key, value] of Object.entries(shape)) {
        newShape[key] = stripNumericConstraints(value as z.ZodType);
      }
      return z.object(newShape) as unknown as T;
    }
    return schema;
  }

  if (typeName === 'array') {
    const element = (schema as any).element;
    if (element) {
      return z.array(stripNumericConstraints(element)) as unknown as T;
    }
    return schema;
  }

  if (typeName === 'record') {
    // z.record() generates `propertyNames` in JSON Schema which Anthropic
    // rejects. Replace with a permissive z.object({}).passthrough() so the
    // model can emit arbitrary key-value pairs. Post-hoc validation with
    // the original schema from contracts.ts still enforces the record type.
    return z.object({}).passthrough() as unknown as T;
  }

  // Everything else (string, enum, boolean, literal, union, etc.): pass through
  return schema;
}

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8000;

const ANTI_HALLUCINATION = `\n\nIMPORTANT: Use only the provided reference data and research results. Do not infer unsupported facts. All benchmark numbers must be labeled as 'industry benchmark'.`;

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

// Extract userId and sessionId from the context string
// The dispatch system prepends these as metadata lines
function extractMetadata(context: string): { userId: string; sessionId?: string } {
  const userIdMatch = context.match(/\[userId:([^\]]+)\]/);
  const sessionIdMatch = context.match(/\[sessionId:([^\]]+)\]/);
  return {
    userId: userIdMatch?.[1] ?? '',
    sessionId: sessionIdMatch?.[1],
  };
}

export async function runMediaPlan(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const startTime = Date.now();
  const industry = detectIndustry(context);
  const industryTemplate = loadIndustryTemplate(industry);
  const { userId } = extractMetadata(context);

  const completedBlocks: MediaPlanBlock[] = [];
  const blockResults: Record<string, unknown> = {};
  const allWarnings: string[] = [];

  console.log(`[media-plan] Starting 6-block generation for industry: ${industry}`);

  try {
    for (let i = 0; i < BLOCK_SEQUENCE.length; i++) {
      const block = BLOCK_SEQUENCE[i];
      const blockNum = i + 1;

      await emitRunnerProgress(onProgress, 'runner', `generating block ${blockNum}/6: ${block.label}`);
      console.log(`[media-plan] Block ${blockNum}/6: ${block.label}`);

      // Build system prompt: skill + refs + industry template + anti-hallucination
      const refs = loadBlockRefs(block.name);
      const systemParts = [
        block.skill,
        refs ? `\n\n## Reference Data\n\n${refs}` : '',
        industryTemplate ? `\n\n## Industry Template (${industry})\n\n${industryTemplate}` : '',
        ANTI_HALLUCINATION,
      ];

      // Build user prompt: context + previous block outputs
      const previousBlocksContext = completedBlocks.length > 0
        ? `\n\n## Previous Block Results\n\n${completedBlocks
            .map((name) => `### ${name}\n${JSON.stringify(blockResults[name], null, 2)}`)
            .join('\n\n')}`
        : '';

      const userPrompt = `Build the ${block.label} section of the media plan based on this context:\n\n${context}${previousBlocksContext}`;

      const { object } = await generateObject({
        model: anthropic(MODEL),
        schema: stripNumericConstraints(block.schema),
        maxOutputTokens: MAX_TOKENS,
        system: systemParts.filter(Boolean).join('\n'),
        prompt: userPrompt,
      });

      // Validate the block
      let validatedData = object;
      let blockWarnings: string[] = [];

      switch (block.name) {
        case 'channelMixBudget': {
          const result = validateBudgetMath(validatedData as z.infer<typeof channelMixBudgetSchema>);
          validatedData = result.data;
          blockWarnings = result.warnings;
          break;
        }
        case 'audienceCampaign': {
          const result = validateTargetingHeuristics(validatedData as z.infer<typeof audienceCampaignSchema>);
          validatedData = result.data;
          blockWarnings = result.warnings;
          break;
        }
        case 'creativeSystem': {
          const result = validateFormatSpecs(validatedData as z.infer<typeof creativeSystemSchema>);
          validatedData = result.data;
          blockWarnings = result.warnings;
          break;
        }
        case 'measurementGuardrails': {
          const cacResult = validateCACModel(validatedData as z.infer<typeof measurementGuardrailsSchema>);
          const kpiResult = reconcileKPIs(cacResult.data);
          validatedData = kpiResult.data;
          blockWarnings = [...cacResult.warnings, ...kpiResult.warnings];
          break;
        }
        case 'rolloutRoadmap': {
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
        // strategySnapshot — no per-block validator (cross-block handles it)
      }

      if (blockWarnings.length > 0) {
        console.log(`[media-plan] Block ${blockNum} warnings:`, blockWarnings);
        allWarnings.push(...blockWarnings.map((w) => `[${block.label}] ${w}`));
      }

      // Store validated result
      blockResults[block.name] = validatedData;
      completedBlocks.push(block.name);

      // Write partial result to Supabase
      const isLast = blockNum === BLOCK_SEQUENCE.length;
      if (userId) {
        try {
          await writeResearchResult(userId, 'mediaPlan', {
            status: isLast ? 'complete' : 'partial',
            section: 'mediaPlan',
            durationMs: Date.now() - startTime,
            data: {
              ...blockResults,
              completedBlocks: [...completedBlocks],
              ...(isLast ? { validationWarnings: allWarnings.length > 0 ? allWarnings : undefined } : {}),
            },
          });
        } catch (writeErr) {
          console.error(`[media-plan] Failed to write partial result after block ${blockNum}:`, writeErr);
        }
      }

      await emitRunnerProgress(
        onProgress,
        'output',
        `completed block ${blockNum}/6: ${block.label}`,
      );
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
      const systemParts = [
        STRATEGY_SNAPSHOT_SKILL,
        refs ? `\n\n## Reference Data\n\n${refs}` : '',
        ANTI_HALLUCINATION,
        '\n\nCRITICAL: The snapshot numbers must EXACTLY match the validated block data provided. Do not round or approximate.',
      ];

      const correctedContext = completedBlocks
        .filter((name) => name !== 'strategySnapshot')
        .map((name) => `### ${name}\n${JSON.stringify(blockResults[name], null, 2)}`)
        .join('\n\n');

      const { object: regenerated } = await generateObject({
        model: anthropic(MODEL),
        schema: stripNumericConstraints(strategySnapshotSchema),
        maxOutputTokens: MAX_TOKENS,
        system: systemParts.filter(Boolean).join('\n'),
        prompt: `Create a strategy snapshot that exactly matches these validated block results:\n\n${correctedContext}`,
      });

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
