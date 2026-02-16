// Media Plan Research — Phase 1 Sonar Pro Calls
// Web-grounded research for platform strategy, ICP targeting, and KPI benchmarks.
// Follows src/lib/ai/research.ts pattern.

import { generateObject, NoObjectGeneratedError } from 'ai';
import {
  perplexity,
  MODELS,
  GENERATION_SETTINGS,
  estimateCost,
} from '@/lib/ai/providers';
import {
  phase1PlatformStrategySchema,
  phase1ICPTargetingSchema,
  phase1KPITargetsSchema,
  type Phase1PlatformStrategyOutput,
  type Phase1ICPTargetingOutput,
  type Phase1KPITargetsOutput,
} from './phase-schemas';

// =============================================================================
// Types
// =============================================================================

export interface ResearchResult<T> {
  data: T;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  cost: number;
  model: string;
}

// =============================================================================
// Retry wrapper (same as blueprint research)
// =============================================================================

const SCHEMA_RETRY_MAX = 2;

async function withSchemaRetry<T>(
  fn: () => Promise<T>,
  section: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= SCHEMA_RETRY_MAX; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error instanceof NoObjectGeneratedError && attempt < SCHEMA_RETRY_MAX) {
        console.warn(`[MediaPlan:${section}] Schema mismatch on attempt ${attempt + 1}, retrying...`);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function logError(section: string, error: unknown): void {
  console.error(`[MediaPlan:${section}] Generation failed:`, error);
  if (error instanceof NoObjectGeneratedError) {
    console.error(`[MediaPlan:${section}] Raw text:`, error.text?.slice(0, 2000));
  }
}

// =============================================================================
// Platform Strategy Research
// =============================================================================

export async function researchPlatformStrategy(
  context: string,
): Promise<ResearchResult<Phase1PlatformStrategyOutput>> {
  const model = MODELS.SONAR_PRO;

  try {
    const result = await withSchemaRetry(
      () => generateObject({
        model: perplexity(model),
        schema: phase1PlatformStrategySchema,
        system: `You are a senior paid media strategist with access to real-time web data.

TASK: Research and recommend advertising platforms for a client based on their industry, ICP, and budget.

RESEARCH FOCUS:
- Current CPL benchmarks per platform for this specific industry/vertical (cite sources)
- Platform feature availability for their ICP targeting needs
- Current targeting options and audience sizes per platform
- Platform policy changes or updates that affect this vertical
- Competitor platform activity patterns

QUALITY STANDARDS:
- CPL ranges MUST be current benchmarks from actual sources, not generic estimates
- Only recommend platforms where the ICP is demonstrably reachable
- Budget percentages must sum to 100%
- monthlySpend must equal the total budget × percentage / 100
- Each platform needs specific ad formats and placements, not generic lists

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema.`,

        prompt: `Research advertising platform strategy for this client:\n\n${context}`,
        ...GENERATION_SETTINGS.research,
      }),
      'platformStrategy',
    );

    return {
      data: result.object,
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model,
    };
  } catch (error) {
    logError('platformStrategy', error);
    throw error;
  }
}

// =============================================================================
// ICP Targeting Research
// =============================================================================

export async function researchICPTargeting(
  context: string,
): Promise<ResearchResult<Phase1ICPTargetingOutput>> {
  const model = MODELS.SONAR_PRO;

  try {
    const result = await withSchemaRetry(
      () => generateObject({
        model: perplexity(model),
        schema: phase1ICPTargetingSchema,
        system: `You are a paid advertising targeting specialist with access to real-time web data.

TASK: Research and define audience segments and targeting strategies for paid advertising platforms.

RESEARCH FOCUS:
- Real audience sizes per segment per platform (from platform audience insights or industry reports)
- Current targeting options actually available on each platform (Meta targeting taxonomy changes frequently)
- Job title and interest targeting that currently works for this vertical
- Custom and lookalike audience strategies with realistic seed sizes
- Exclusion lists based on current best practices

QUALITY STANDARDS:
- Audience reach estimates MUST cite platform-specific ranges, not guesses
- Targeting parameters must be real options currently available on the platform
- Include at least one cold prospecting and one warm retargeting segment
- Platform targeting must map to actual targeting options (real job titles, real interest categories)
- Exclusions are mandatory: existing customers, job seekers, irrelevant demographics

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema.`,

        prompt: `Research ICP targeting strategy for paid advertising:\n\n${context}`,
        ...GENERATION_SETTINGS.research,
      }),
      'icpTargeting',
    );

    return {
      data: result.object,
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model,
    };
  } catch (error) {
    logError('icpTargeting', error);
    throw error;
  }
}

// =============================================================================
// KPI Benchmarks Research
// =============================================================================

export async function researchKPIBenchmarks(
  context: string,
): Promise<ResearchResult<Phase1KPITargetsOutput>> {
  const model = MODELS.SONAR_PRO;

  try {
    const result = await withSchemaRetry(
      () => generateObject({
        model: perplexity(model),
        schema: phase1KPITargetsSchema,
        system: `You are a performance marketing analyst with access to real-time industry benchmark data.

TASK: Research current industry KPI benchmarks and define measurable targets for a paid advertising campaign.

RESEARCH FOCUS:
- Current CPL benchmarks for this specific vertical and platform mix (cite year and source)
- CTR, CPC, and ROAS benchmarks from recent industry reports
- Conversion rate benchmarks: lead-to-SQL and SQL-to-customer for this vertical
- CAC benchmarks for comparable businesses
- Frequency and impression share norms

QUALITY STANDARDS:
- Every benchmark MUST include a source context (e.g., "WordStream 2025 B2B SaaS benchmarks")
- Targets must be achievable given the client's budget and industry
- Include both primary KPIs (CPL, ROAS, SQL volume) and secondary KPIs (CTR, CPC, frequency)
- Each KPI needs a clear measurement method and timeframe
- Primary KPIs: 3-4 metrics the campaign is optimized for
- Secondary KPIs: 3-4 supporting metrics that inform optimization

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema.`,

        prompt: `Research current KPI benchmarks and define targets for:\n\n${context}`,
        ...GENERATION_SETTINGS.research,
      }),
      'kpiTargets',
    );

    return {
      data: result.object,
      usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0, totalTokens: result.usage.totalTokens ?? 0 },
      cost: estimateCost(model, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0),
      model,
    };
  } catch (error) {
    logError('kpiTargets', error);
    throw error;
  }
}
