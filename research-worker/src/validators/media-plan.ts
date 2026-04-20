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
 * Validates the strategicFrame on channelMixBudget (added 2026-04-20).
 * Enforces:
 *  - inMarketTierMix percentages sum to 100 (±1 rounding tolerance)
 *  - Budget-gated tier allocation per in-market-tier-routing.md:
 *      <$2k  → must be 100/0/0 (single-tier discipline)
 *      <$5k  → coldMass must be 0 (no cold-mass budget below multi-platform gate)
 *      <$15k → coldMass capped at ~15% (same spirit as the 70/20/10 rule)
 *  - Awareness-level × tier-mix coherence (flag but do not block)
 *
 * Non-mutating: returns warnings only. The runner retries block 1 on a
 * schema/warning budget breach (see generateBlock retry loop in media-plan.ts).
 */
export function validateStrategicFrame(
  data: ChannelMixBudget,
): { warnings: string[] } {
  const warnings: string[] = [];
  const frame = data.strategicFrame;
  if (!frame) {
    warnings.push('strategicFrame missing from channelMixBudget output.');
    return { warnings };
  }

  // Rule 1: tier percentages sum to 100
  const tierSum =
    frame.inMarketTierMix.inMarket +
    frame.inMarketTierMix.needsConvinced +
    frame.inMarketTierMix.coldMass;
  if (!withinAbsolute(tierSum, 100, 1)) {
    warnings.push(
      `strategicFrame.inMarketTierMix percentages sum to ${tierSum.toFixed(1)}, expected 100 (±1).`,
    );
  }

  // Rule 2: budget-gated allocation (in-market-tier-routing.md table)
  const totalMonthly = data.budgetSummary?.totalMonthly ?? 0;
  const { inMarket, needsConvinced, coldMass } = frame.inMarketTierMix;
  if (totalMonthly < 2000) {
    if (inMarket < 99 || needsConvinced > 1 || coldMass > 1) {
      warnings.push(
        `Budget gate violated: totalMonthly=$${totalMonthly} requires 100/0/0 tier mix (single-tier discipline). Got ${inMarket}/${needsConvinced}/${coldMass}. See in-market-tier-routing.md.`,
      );
    }
  } else if (totalMonthly < 5000) {
    if (coldMass > 1) {
      warnings.push(
        `Budget gate violated: totalMonthly=$${totalMonthly} forbids cold-mass allocation (coldMass must be 0 under $5k). Got coldMass=${coldMass}. See in-market-tier-routing.md.`,
      );
    }
  } else if (totalMonthly < 15000) {
    if (coldMass > 15) {
      warnings.push(
        `Budget gate violated: totalMonthly=$${totalMonthly} caps cold-mass at 15%. Got coldMass=${coldMass}. Concentrate in-market first per Haynes.`,
      );
    }
  }

  // Rule 3: equal-splits are Haynes-forbidden (concentration, not diversification)
  if (totalMonthly >= 5000) {
    const approxEqual =
      withinAbsolute(inMarket, 33.3, 3) &&
      withinAbsolute(needsConvinced, 33.3, 3) &&
      withinAbsolute(coldMass, 33.3, 3);
    if (approxEqual) {
      warnings.push(
        'Equal-split tier mix (33/33/33) violates Haynes concentration principle. Master in-market first, then expand outward.',
      );
    }
  }

  // Rule 4: awareness-level coherence (warn-only; some mixes are legitimate with rationale)
  const level = frame.awarenessLevelApplied;
  if (level === 'unaware' && totalMonthly < 5000 && coldMass > 0) {
    warnings.push(
      `Unaware market × under-$5k budget × coldMass>0: incoherent. Budget gate caps tier mix but awareness classification calls for cold-mass. Flag in funnelSplitRationale.`,
    );
  }
  if ((level === 'product-aware' || level === 'most-aware') && inMarket < 50) {
    warnings.push(
      `Awareness level "${level}" expects in-market-dominant mix (per awareness-level-routing.md). Got inMarket=${inMarket}%. Review.`,
    );
  }

  // Rule 5: sales-cycle ceiling must be positive and bounded
  if (frame.salesCycleCeilingDays <= 0 || frame.salesCycleCeilingDays > 365) {
    warnings.push(
      `salesCycleCeilingDays=${frame.salesCycleCeilingDays} out of plausible range (1–365). See sales-cycle-bounding.md ceiling table.`,
    );
  }

  return { warnings };
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
  // 2026-04-20: fixed the apples/oranges comparison that used to compare the
  // SUM of all phase budgets (which span multiple months) directly against
  // the MONTHLY budget. A 4-phase rollout running Jan→May will naturally
  // have phaseTotal ≫ totalMonthly. The honest check is per-phase burn-rate
  // normalized to a monthly figure: no individual phase should burn at more
  // than ~1.3× the monthly budget, and the FIRST phase should not exceed
  // the monthly budget (soft-launch ramp discipline). Without this fix the
  // validator emitted a warning on every well-formed plan.
  for (const phase of result.phases) {
    const weeks = (() => {
      const m = /(\d+)\s*week/i.exec(phase.duration);
      return m && m[1] ? parseInt(m[1], 10) : 0;
    })();
    if (weeks <= 0) continue; // duration not parseable; skip rate check for this phase
    const monthlyEquivalent = (phase.budgetAllocation / weeks) * 4.33;
    if (monthlyEquivalent > totalMonthly * 1.3) {
      warnings.push(
        `Phase "${phase.name}" burns $${monthlyEquivalent.toFixed(0)}/month-equivalent — exceeds 1.3× the planned monthly budget ($${totalMonthly.toFixed(0)}). Verify the phase budget or widen the duration.`,
      );
    }
  }
  // Phase 1 (soft launch) additional check: should not exceed the monthly
  // budget on a per-month-equivalent basis — the ramp-up rule says phase 1
  // starts at ≤50% of daily ceiling.
  const phase1 = result.phases[0];
  if (phase1) {
    const weeks = (() => {
      const m = /(\d+)\s*week/i.exec(phase1.duration);
      return m && m[1] ? parseInt(m[1], 10) : 0;
    })();
    if (weeks > 0) {
      const phase1Monthly = (phase1.budgetAllocation / weeks) * 4.33;
      if (phase1Monthly > totalMonthly) {
        warnings.push(
          `Phase 1 "${phase1.name}" runs at $${phase1Monthly.toFixed(0)}/month-equivalent, exceeding the planned monthly ($${totalMonthly.toFixed(0)}). Soft-launch should be at or below monthly budget, not above.`,
        );
      }
    }
  }
  // Keep phaseTotal read for future use (e.g. total-campaign-cost surfacing);
  // intentionally not comparing it to totalMonthly here.
  void phaseTotal;

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
