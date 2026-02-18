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
// Post-Processing Functions (deterministic computation on AI outputs)
// =============================================================================

/**
 * Deterministic post-processing for platform strategy.
 * Flags high-density platforms by prepending a warning note to the rationale.
 */
export function postProcessPlatformStrategy(
  platforms: Phase1PlatformStrategyOutput['platforms'],
): Phase1PlatformStrategyOutput['platforms'] {
  return platforms.map(p => {
    if (p.competitiveDensity != null && p.competitiveDensity >= 8) {
      return {
        ...p,
        rationale: `⚠ HIGH COMPETITIVE DENSITY (${p.competitiveDensity}/10) — expect elevated CPMs and aggressive bid competition. ${p.rationale}`,
      };
    }
    return p;
  });
}

/**
 * Deterministic post-processing for ICP targeting.
 * Sorts segments by priorityScore descending (highest priority first).
 */
export function postProcessICPTargeting(
  targeting: Phase1ICPTargetingOutput,
): Phase1ICPTargetingOutput {
  return {
    ...targeting,
    segments: [...targeting.segments].sort(
      (a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0),
    ),
  };
}

/**
 * Deterministic post-processing for media plan risks.
 * Computes P×I scores, classifies, and sorts by score descending.
 * AI provides raw probability + impact; computation is deterministic.
 */
export function postProcessMediaPlanRisks(risks: Array<{
  risk: string;
  category: string;
  severity: string;
  likelihood: string;
  mitigation: string;
  contingency: string;
  probability?: number;
  impact?: number;
  earlyWarningIndicator?: string;
  monitoringFrequency?: string;
}>): typeof risks & Array<{ score?: number; classification?: string }> {
  return risks
    .map(r => {
      if (r.probability != null && r.impact != null) {
        const score = r.probability * r.impact;
        return {
          ...r,
          score,
          classification: classifyRiskScore(score),
        };
      }
      return r;
    })
    .sort((a, b) => ((b as any).score ?? 0) - ((a as any).score ?? 0));
}

function classifyRiskScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score <= 6) return 'low';
  if (score <= 12) return 'medium';
  if (score <= 19) return 'high';
  return 'critical';
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
- Competitive density assessment: Score 1-10 how crowded each platform is for this specific vertical (1=wide open, 10=extremely saturated). Consider number of active advertisers, auction competition, and CPM trends.
- Audience saturation: Assess whether the ICP audience on each platform is over-targeted (low/medium/high). Check if major competitors are all bidding on the same audiences.
- Platform risk factors: For each platform, identify 1-3 specific risk factors (e.g., "Meta algorithm changes deprioritizing B2B lead gen", "LinkedIn CPL inflation trending 15% YoY", "Google broad match expansion reducing targeting precision").

QUALITY STANDARDS:
- CPL ranges MUST be current benchmarks from actual sources, not generic estimates
- Only recommend platforms where the ICP is demonstrably reachable
- Budget percentages must sum to 100%
- monthlySpend must equal the total budget × percentage / 100
- Each platform needs specific ad formats and placements, not generic lists
- competitiveDensity must be justified by competitor activity data, not generic estimates
- platformRiskFactors must cite specific, current platform trends — not generic "costs may increase"

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema.`,

        prompt: `Research advertising platform strategy for this client:\n\n${context}`,
        ...GENERATION_SETTINGS.research,
      }),
      'platformStrategy',
    );

    const processed = {
      ...result.object,
      platforms: postProcessPlatformStrategy(result.object.platforms),
    };

    return {
      data: processed,
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
- Segment priority scoring: Score each segment 1-10 based on reachability × ICP relevance (10=highly reachable, perfect fit). Higher scores mean this segment should receive more budget.
- Targeting difficulty: Rate each segment easy/moderate/hard based on how many targeting layers are needed to reach them (easy=broad interest match, moderate=job title + company size, hard=requires custom audiences or lookalikes only)
- Audience overlap analysis: Identify which segments overlap significantly (>30%) on each platform. Recommend exclusion lists to prevent duplicate impressions.

QUALITY STANDARDS:
- Audience reach estimates MUST cite platform-specific ranges, not guesses
- Targeting parameters must be real options currently available on the platform
- Include at least one cold prospecting and one warm retargeting segment
- Platform targeting must map to actual targeting options (real job titles, real interest categories)
- Exclusions are mandatory: existing customers, job seekers, irrelevant demographics
- priorityScore must reflect BOTH reachability (can we target them?) AND relevance (are they our ICP?). A highly relevant but unreachable segment should score 4-5, not 9-10.
- overlapWarnings must specify which segments overlap, on which platforms, and by approximately how much.

OUTPUT FORMAT: Respond ONLY with valid JSON matching the schema.`,

        prompt: `Research ICP targeting strategy for paid advertising:\n\n${context}`,
        ...GENERATION_SETTINGS.research,
      }),
      'icpTargeting',
    );

    const processed = postProcessICPTargeting(result.object);

    return {
      data: processed,
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
- Benchmark ranges: For each KPI, provide a low/mid/high range rather than a single number. Low = conservative/pessimistic, mid = realistic target, high = optimistic/stretch. The mid value should match the target.
- Source confidence scoring: Rate each benchmark source 1-5 (1=anecdotal/blog, 2=industry survey, 3=industry report from known firm, 4=platform-published data, 5=verified first-party data). Higher confidence = more weight in planning.
- Scenario thresholds: When sensitivity analysis data is available in context, provide best/base/worst scenario thresholds per KPI. Best=aggressive stretch, base=plan target, worst=minimum acceptable before triggering contingency.

QUALITY STANDARDS:
- Every benchmark MUST include a source context (e.g., "WordStream 2025 B2B SaaS benchmarks")
- Targets must be achievable given the client's budget and industry
- Include both primary KPIs (CPL, ROAS, SQL volume) and secondary KPIs (CTR, CPC, frequency)
- Each KPI needs a clear measurement method and timeframe
- Primary KPIs: 3-4 metrics the campaign is optimized for
- Secondary KPIs: 3-4 supporting metrics that inform optimization
- benchmarkRange.mid MUST match the target field. If they disagree, adjust the range to be consistent.
- sourceConfidence must reflect the ACTUAL source cited in the benchmark field. A "WordStream 2025 report" is confidence 3. "Meta Ads Manager average" is confidence 4. Uncited claims are confidence 1.
- scenarioThresholds are only required when sensitivity analysis data is provided in context. If no sensitivity data, omit entirely.

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
