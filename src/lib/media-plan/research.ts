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

PLATFORM SELECTION DECISION FRAMEWORK:

Before scoring platforms, apply these hard filters in order. These are non-negotiable rules from proven media buyer frameworks.

STEP 1 — ACV-BASED EXCLUSIONS (apply first, before any scoring):
- Client Offer Price / ACV < $3,000/yr → EXCLUDE LinkedIn entirely (CPL too high relative to deal value)
- Client Offer Price / ACV > $5,000/yr → EXCLUDE Meta for cold traffic (use Meta for retargeting ONLY)
- Client Offer Price / ACV < $1,000/yr → CONSIDER TikTok or Reddit for volume plays
- If a platform is excluded by ACV rules, do NOT include it in scoring or recommendations unless explicitly overriding with a stated reason

STEP 2 — COMPANY SIZE ROUTING:
- ICP company size < 50 employees → Meta + Google primary (LinkedIn underperforms for SMB)
- ICP company size 50-500 employees → LinkedIn + Google primary
- ICP company size 500+ employees → LinkedIn primary + ABM, Google secondary, EXCLUDE Meta

STEP 3 — BUDGET-TO-PLATFORM COUNT GATING:
- Monthly budget < $5,000 → Recommend 1 platform ONLY (the highest-scoring one)
- Monthly budget $5,000-$15,000 → Maximum 2 platforms
- Monthly budget $15,000-$30,000 → Maximum 2-3 platforms
- Monthly budget > $30,000 → 3+ platforms viable
- NEVER spread budget across more platforms than the budget supports

STEP 4 — PLATFORM MINIMUM BUDGET CHECK:
After calculating budget allocation percentages, verify each platform meets minimums:
- Meta: $3,000/mo minimum
- Google: $5,000/mo minimum
- LinkedIn: $5,000/mo minimum
If a platform's allocated budget falls below its minimum:
  - Either increase its allocation to meet the minimum (reducing another platform), OR
  - Flag it with belowMinimum: true and note "Below recommended minimum — experimental test only. Results may be limited by insufficient data for optimization." in the rationale.

STEP 5 — QUALITY-VS-COST (QvC) SCORING:
For each platform that SURVIVES Steps 1-4, calculate a weighted QvC score:

| Factor | Weight | How to Score (1-10) |
|--------|--------|---------------------|
| ICP Targeting Precision | 30% | How precisely can this platform reach the exact ICP? (10 = exact job title + company size + industry targeting) |
| Lead Quality Signal | 25% | Based on industry data, how qualified are leads from this platform for this vertical? (10 = consistently high SQL rates) |
| Cost Efficiency | 20% | Inverse of expected CPL relative to budget. Lower CPL = higher score. Use benchmark data. |
| Competitor Presence | 15% | Are competitors actively advertising here? Presence = validated channel. (10 = 3+ competitors active) |
| Creative Format Fit | 10% | Do available ad formats match the client's content strengths? (10 = perfect format match) |

QvC Score = (Targeting x 0.30) + (Quality x 0.25) + (Cost x 0.20) + (Competitor x 0.15) + (Format x 0.10)

Populate qvcScore and qvcBreakdown fields in the output for each platform.

STEP 6 — BUDGET ALLOCATION FROM QvC SCORES:
- Primary platform (highest QvC): 50-65% of total budget
- Secondary platform: 25-35% of total budget
- Testing/tertiary platform: 10-20% of total budget
- Allocation percentages should roughly follow normalized QvC score ratios
- The primary platform ALWAYS gets majority share regardless of exact score ratios

STEP 7 — PLATFORM SYNERGY DESCRIPTION:
For the selected platforms, describe how they work together across the funnel:
- Which platform drives awareness → which captures intent → which converts?
- How do retargeting audiences flow between platforms?
- What is the expected cross-platform user journey?
Format: "[Platform A] drives [stage] → [Platform B] captures [stage] → [Platform C] converts"

IMPORTANT: Show your work. Include the ACV check result, budget gating result, QvC scoring matrix, and platform minimums check in your reasoning.

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

CRITICAL METRIC DEFINITIONS — use these EXACTLY:

ROAS (Return on Ad Spend):
  Formula: (new_customers_this_month × monthly_offer_price) / monthly_ad_spend
  This is a MONTHLY metric. For subscription businesses, Month 1 ROAS is almost always < 1.0x
  because you don't recoup full customer acquisition cost in the first billing cycle.
  DO NOT use LTV in the ROAS formula. ROAS measures period revenue vs period spend.
  When setting a ROAS target, state the expected Month 1 ROAS explicitly.
  Also state "breakeven ROAS expected at month X" based on offer price vs CAC.

LTV:CAC Ratio:
  Formula: customer_LTV / CAC
  This is a LIFETIME metric measuring overall unit economics health.
  Healthy: >= 3:1. Below ideal: 1:1 to 2.9:1. Unsustainable: < 1:1.
  Label this metric "LTV:CAC Ratio" in the KPI targets, NOT "ROAS".

These are DIFFERENT metrics. Do NOT use LTV-based calculations in the ROAS field.
Do NOT use single-month revenue in the LTV:CAC field.
NEVER put two different values for the same metric in the same KPI row.
NEVER put a competing formula in the benchmark description that contradicts the target value.

BENCHMARK SOURCE RULES (CRITICAL — follow exactly):
1. NEVER fabricate source names, report titles, or citation numbers. Do not invent author names, publication names, or year-specific report titles. If you cannot find a specific benchmark with a real, verifiable source, state "Industry standard estimate — no specific source available" and provide a RANGE instead of a point value (e.g., "$50-$120 CPL" not "$85 CPL").
2. When the research document or context contains real data (competitor spend numbers, actual CPC data from keyword research, platform-specific metrics), ALWAYS prefer this over generic benchmarks. Label as "Research Doc §[section number]" or "Client Research Data" in the benchmark field.
3. Acceptable source labels: "Research Doc §4" (referencing a specific section), "Client Research Data" (data from the research pipeline), "LinkedIn Ad Benchmarks 2025" (generic platform benchmarks — no specific author), "Industry standard estimate" (when no specific source exists), "SpyFu keyword data" (from actual keyword research in context).
4. NEVER acceptable source labels: Anything with a specific person's name you cannot verify, anything with a specific report title you cannot verify, anything that looks like an academic citation but isn't real, made-up organizations or consultancies.
5. Confidence scoring adjustment: If a benchmark comes from the research document (real client data), set sourceConfidence to 4-5. If from general industry knowledge without a specific source, set sourceConfidence to 2-3 and use a wider benchmarkRange.

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
