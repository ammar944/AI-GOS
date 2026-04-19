import type { z } from 'zod';
import {
  channelMixBudgetSchema,
  audienceCampaignSchema,
  creativeSystemSchema,
  measurementGuardrailsSchema,
  rolloutRoadmapSchema,
  strategySnapshotSchema,
} from '../contracts';

type ChannelMixBudget = z.infer<typeof channelMixBudgetSchema>;
type AudienceCampaign = z.infer<typeof audienceCampaignSchema>;
type MeasurementGuardrails = z.infer<typeof measurementGuardrailsSchema>;
type RolloutRoadmap = z.infer<typeof rolloutRoadmapSchema>;
type StrategySnapshot = z.infer<typeof strategySnapshotSchema>;
// creativeSystemSchema intentionally imported for future extension — the
// previous validateFormatSpecs was removed 2026-04-19 per Mahdy round 2
// (formatSpecs deleted from schema).
type _CreativeSystem = z.infer<typeof creativeSystemSchema>;
void (null as unknown as _CreativeSystem);

// Lightweight warning shape used by the round-2 validators added 2026-04-19.
// (Older validators still return { data, warnings: string[] } — that signature
// is unchanged to avoid rippling edits into the runner.)
export interface Warning {
  code: string;
  message: string;
}

// Percentage tolerance: abs(a - b) / max(a, 1) < threshold
function withinRelativeTolerance(a: number, b: number, threshold: number): boolean {
  return Math.abs(a - b) / Math.max(Math.abs(a), 1) <= threshold;
}

// Absolute tolerance check
function withinAbsolute(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

// Normalize an array of numbers so they sum to 100
function normalizeToHundred(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total === 0) return values;
  return values.map((v) => (v / total) * 100);
}

// ── Block-level validators ──────────────────────────────────────────────────

/**
 * Validates and corrects math in Block 1 (Channel Mix & Budget).
 * Normalizes percentages, corrects daily ceilings, flags funnel split errors.
 */
export function validateBudgetMath(
  data: ChannelMixBudget,
): { data: ChannelMixBudget; warnings: string[] } {
  const warnings: string[] = [];
  const result = structuredClone(data) as ChannelMixBudget;

  // Check platform spend sums to totalMonthly
  const platformTotal = result.platforms.reduce((sum, p) => sum + p.monthlySpend, 0);
  const totalMonthly = result.budgetSummary.totalMonthly;

  if (!withinRelativeTolerance(platformTotal, totalMonthly, 0.01)) {
    warnings.push(
      `Platform spend sum ($${platformTotal.toFixed(2)}) differs from totalMonthly ($${totalMonthly.toFixed(2)}) by more than 1% — normalizing percentages.`,
    );
    // Normalize percentages proportionally to reflect actual spend breakdown
    const normalizedPercentages = normalizeToHundred(
      result.platforms.map((p) => p.monthlySpend),
    );
    result.platforms = result.platforms.map((p, i) => ({
      ...p,
      percentage: parseFloat(normalizedPercentages[i]!.toFixed(2)),
    }));
  }

  // Check percentages sum to 100
  const percentageTotal = result.platforms.reduce((sum, p) => sum + p.percentage, 0);
  if (!withinRelativeTolerance(percentageTotal, 100, 0.01)) {
    warnings.push(
      `Platform percentages sum to ${percentageTotal.toFixed(2)}% (expected 100%) — normalizing.`,
    );
    const normalized = normalizeToHundred(result.platforms.map((p) => p.percentage));
    result.platforms = result.platforms.map((p, i) => ({
      ...p,
      percentage: parseFloat(normalized[i]!.toFixed(2)),
    }));
  }

  // Correct daily ceilings
  result.dailyCeilings = result.dailyCeilings.map((ceiling) => {
    const matchingPlatform = result.platforms.find(
      (p) => p.name.toLowerCase() === ceiling.platform.toLowerCase(),
    );
    if (!matchingPlatform) return ceiling;

    const expectedDaily = matchingPlatform.monthlySpend / 30;
    if (!withinAbsolute(ceiling.dailyBudget, expectedDaily, 1)) {
      warnings.push(
        `Daily ceiling for ${ceiling.platform} ($${ceiling.dailyBudget.toFixed(2)}) does not match monthlySpend/30 ($${expectedDaily.toFixed(2)}) — correcting.`,
      );
      return { ...ceiling, dailyBudget: parseFloat(expectedDaily.toFixed(2)) };
    }
    return ceiling;
  });

  // Flag platforms below $5/day minimum
  for (const ceiling of result.dailyCeilings) {
    if (ceiling.dailyBudget < 5) {
      warnings.push(
        `${ceiling.platform} daily budget ($${ceiling.dailyBudget.toFixed(2)}) is below the common $5 platform minimum.`,
      );
    }
    if (!ceiling.minimumMet && ceiling.dailyBudget >= 5) {
      warnings.push(
        `${ceiling.platform} minimumMet is false but daily budget ($${ceiling.dailyBudget.toFixed(2)}) meets the $5 minimum — check flag.`,
      );
    }
  }

  // Check funnel split sums to 100
  const { awareness, consideration, conversion } = result.budgetSummary.funnelSplit;
  const funnelTotal = awareness + consideration + conversion;
  if (!withinRelativeTolerance(funnelTotal, 100, 0.01)) {
    warnings.push(
      `Funnel split sums to ${funnelTotal.toFixed(2)}% (expected 100%) — normalizing.`,
    );
    const [nAwareness, nConsideration, nConversion] = normalizeToHundred([
      awareness,
      consideration,
      conversion,
    ]) as [number, number, number];
    result.budgetSummary = {
      ...result.budgetSummary,
      funnelSplit: {
        awareness: parseFloat(nAwareness.toFixed(2)),
        consideration: parseFloat(nConsideration.toFixed(2)),
        conversion: parseFloat(nConversion.toFixed(2)),
      },
    };
  }

  return { data: result, warnings };
}

/**
 * Validates Block 2 (Audience & Campaign) targeting heuristics.
 *
 * 2026-04-19 (Mahdy round 2): retargeting-window clamping removed —
 * `retargetingSegments` no longer exists in the schema. Keeps segment count /
 * ad-set / priority checks.
 */
export function validateTargetingHeuristics(
  data: AudienceCampaign,
): { data: AudienceCampaign; warnings: string[] } {
  const warnings: string[] = [];
  const result = structuredClone(data) as AudienceCampaign;

  // Warn if segment count exceeds 10
  if (result.segments.length > 10) {
    warnings.push(
      `Segment count (${result.segments.length}) exceeds recommended maximum of 10 — consider consolidating.`,
    );
  }

  // Clamp priority values to 1-10
  result.segments = result.segments.map((seg) => {
    if (seg.priority < 1 || seg.priority > 10) {
      const clamped = Math.min(Math.max(seg.priority, 1), 10);
      warnings.push(
        `Segment "${seg.name}" priority (${seg.priority}) is out of 1-10 range — clamping to ${clamped}.`,
      );
      return { ...seg, priority: clamped };
    }
    return seg;
  });

  // Warn if any campaign has no ad sets
  for (const campaign of result.campaigns) {
    if (campaign.adSets.length === 0) {
      warnings.push(
        `Campaign "${campaign.name}" on ${campaign.platform} has no ad sets — at least 1 required.`,
      );
    }
  }

  return { data: result, warnings };
}

/**
 * Validates Block 5 (Rollout Roadmap) phase budget allocations and timelines.
 * Warns (does not auto-correct) on budget mismatches since phases span different durations.
 */
export function validatePhaseBudgets(
  data: RolloutRoadmap,
  totalMonthly: number,
): { data: RolloutRoadmap; warnings: string[] } {
  const warnings: string[] = [];
  const result = structuredClone(data) as RolloutRoadmap;

  // Check phase budget allocations vs totalMonthly
  const phaseTotal = result.phases.reduce((sum, p) => sum + p.budgetAllocation, 0);
  if (!withinRelativeTolerance(phaseTotal, totalMonthly, 0.05)) {
    warnings.push(
      `Phase budget allocations sum ($${phaseTotal.toFixed(2)}) differs from totalMonthly ($${totalMonthly.toFixed(2)}) by more than 5% — phases may span different time periods but verify intent.`,
    );
  }

  // Parse duration strings and check against totalWeeks
  // Accepts formats like "4 weeks", "2 weeks", "1 week"
  let parsedWeeksTotal = 0;
  let allParsed = true;
  for (const phase of result.phases) {
    const match = /(\d+)\s*week/i.exec(phase.duration);
    if (match && match[1]) {
      parsedWeeksTotal += parseInt(match[1], 10);
    } else {
      allParsed = false;
    }
  }

  if (allParsed && parsedWeeksTotal !== result.timeline.totalWeeks) {
    warnings.push(
      `Phase durations sum to ${parsedWeeksTotal} weeks but timeline.totalWeeks is ${result.timeline.totalWeeks} — check for inconsistency.`,
    );
  }

  // Check each phase has at least 1 objective and 1 success criterion
  for (const phase of result.phases) {
    if (phase.objectives.length === 0) {
      warnings.push(`Phase "${phase.name}" has no objectives — at least 1 required.`);
    }
    if (phase.successCriteria.length === 0) {
      warnings.push(
        `Phase "${phase.name}" has no success criteria — at least 1 required.`,
      );
    }
  }

  return { data: result, warnings };
}

// ── Cross-block validators ──────────────────────────────────────────────────

/**
 * Validates budget consistency across Block 1, Block 4, and Block 5.
 * Returns warning strings only — no data mutation.
 */
export function reconcileBudgetAcrossBlocks(
  block1: ChannelMixBudget,
  _block4: MeasurementGuardrails,
  block5: RolloutRoadmap,
): string[] {
  const warnings: string[] = [];
  const totalMonthly = block1.budgetSummary.totalMonthly;

  // The previous check (totalMonthly / expectedCPL ≈ expectedLeadsPerMonth)
  // has been removed — those numeric fields no longer exist. The qualitative
  // budget reconciliation remaining here compares Block 1 totalMonthly with
  // Block 5 phase allocations.

  // Block 5 phase allocations reference: check if they are at least in the same ballpark
  const phaseTotal = block5.phases.reduce((sum, p) => sum + p.budgetAllocation, 0);
  if (!withinRelativeTolerance(phaseTotal, totalMonthly, 0.05)) {
    warnings.push(
      `Cross-block budget check: Block 5 phase allocations total ($${phaseTotal.toFixed(2)}) diverges from Block 1 totalMonthly ($${totalMonthly.toFixed(2)}) by more than 5%.`,
    );
  }

  return warnings;
}

/**
 * Validates Block 6 (Strategy Snapshot) exact-match consistency against Blocks 1 and 4.
 * Sets needsRegeneration: true if any field diverges — no free-text mutation.
 */
export function validateSnapshotConsistency(
  block1: ChannelMixBudget,
  _block4: MeasurementGuardrails,
  block6: StrategySnapshot,
): { needsRegeneration: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let needsRegeneration = false;

  // leadsPerMonth / estimatedCAC consistency checks removed 2026-04-19 —
  // those numeric forecast fields were stripped from expectedOutcomes.
  // Block 6 now has expectedSignals (qualitative) with no cross-block math.

  // budgetOverview.total: block6 vs block1 — this is a USER-INPUT number
  // (their monthly budget), so consistency still matters.
  if (block6.budgetOverview.total !== block1.budgetSummary.totalMonthly) {
    warnings.push(
      `Snapshot budgetOverview.total (${block6.budgetOverview.total}) does not match Block 1 totalMonthly (${block1.budgetSummary.totalMonthly}).`,
    );
    needsRegeneration = true;
  }

  return { needsRegeneration, warnings };
}

// ── Round-2 validators (2026-04-19, Mahdy full-section-removal) ─────────────

/**
 * Enforce DR cold-launch max 2 campaigns. Splitting budget across 6 campaign
 * types is "super, super thin" per Mahdy.
 */
export function validateCampaignCount(audienceCampaign: AudienceCampaign): Warning[] {
  const count = audienceCampaign.campaigns?.length ?? 0;
  if (count > 2) {
    return [
      {
        code: 'too_many_campaigns',
        message: `Campaign count ${count} exceeds the max of 2 for DR cold-launch. Consolidate.`,
      },
    ];
  }
  return [];
}

/**
 * DR default: conversion must be ≥ 85% of the funnel split. Cold-pool
 * accounts have no awareness/retargeting pool, so most budget goes to
 * conversion.
 */
export function validateFunnelSplitDR(channelMixBudget: ChannelMixBudget): Warning[] {
  const split = channelMixBudget.budgetSummary?.funnelSplit;
  if (!split) return [];
  if (split.conversion < 85) {
    return [
      {
        code: 'funnel_split_too_diffuse',
        message: `DR default requires conversion >= 85% of budget. Got ${split.conversion}%.`,
      },
    ];
  }
  return [];
}

/**
 * Double-check guard: the `retargeting` role was removed from the schema,
 * but models may still sneak retargeting language into segment names or
 * descriptions. Flag any such case.
 */
export function validateNoRetargetingWithoutPool(
  audienceCampaign: AudienceCampaign,
  _channelMixBudget: ChannelMixBudget,
): Warning[] {
  const warnings: Warning[] = [];
  for (const segment of audienceCampaign.segments ?? []) {
    if (
      /retargeting|remarketing|pixel audience|visitor retarget/i.test(segment.name ?? '') ||
      /retargeting|remarketing|pixel audience/i.test(segment.description ?? '')
    ) {
      warnings.push({
        code: 'retargeting_without_pool',
        message: `Segment "${segment.name}" references retargeting but no pool was confirmed. Remove.`,
      });
    }
  }
  return warnings;
}

/**
 * industryBenchmarks replaces the deleted KPI/CAC framework. Must have at
 * least one benchmark entry for the measurement block to be meaningful.
 */
export function validateIndustryBenchmarks(
  measurement: MeasurementGuardrails,
): Warning[] {
  const benchmarks = measurement.industryBenchmarks ?? [];
  if (benchmarks.length === 0) {
    return [
      {
        code: 'missing_industry_benchmarks',
        message: 'industryBenchmarks must have at least 1 entry.',
      },
    ];
  }
  return [];
}
