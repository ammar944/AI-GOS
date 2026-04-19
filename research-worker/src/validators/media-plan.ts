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
type CreativeSystem = z.infer<typeof creativeSystemSchema>;
type MeasurementGuardrails = z.infer<typeof measurementGuardrailsSchema>;
type RolloutRoadmap = z.infer<typeof rolloutRoadmapSchema>;
type StrategySnapshot = z.infer<typeof strategySnapshotSchema>;

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

// Known valid ad creative dimensions
const KNOWN_DIMENSIONS = new Set([
  '1080x1080',
  '1200x628',
  '1080x1920',
  '1200x1200',
  '1280x720',
  '1920x1080',
  '600x314',
  '1200x630',
  '900x900',
  '320x50',
  '728x90',
  '300x250',
  '160x600',
  '970x250',
]);

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
 * Clamps retargeting windows, priority values, and warns on oversized segment lists.
 */
export function validateTargetingHeuristics(
  data: AudienceCampaign,
): { data: AudienceCampaign; warnings: string[] } {
  const warnings: string[] = [];
  const result = structuredClone(data) as AudienceCampaign;

  // Clamp retargeting window to 1-180 days
  result.retargetingSegments = result.retargetingSegments.map((seg) => {
    if (seg.windowDays < 1 || seg.windowDays > 180) {
      const clamped = Math.min(Math.max(seg.windowDays, 1), 180);
      warnings.push(
        `Retargeting window for "${seg.name}" (${seg.windowDays} days) is outside 1-180 day limit — clamping to ${clamped}.`,
      );
      return { ...seg, windowDays: clamped };
    }
    return seg;
  });

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
 * Validates Block 3 (Creative System) format specs and copy limits.
 * Warns on unrecognized dimensions, copy overages, and thin testing plans.
 */
export function validateFormatSpecs(
  data: CreativeSystem,
): { data: CreativeSystem; warnings: string[] } {
  const warnings: string[] = [];
  const result = structuredClone(data) as CreativeSystem;

  const COPY_LIMITS: Record<string, { headline: number; description: number }> = {
    google: { headline: 30, description: 90 },
    meta: { headline: 40, description: 125 },
    linkedin: { headline: 200, description: 600 },
  };

  for (const spec of result.formatSpecs) {
    // Validate dimensions
    if (spec.dimensions && !KNOWN_DIMENSIONS.has(spec.dimensions)) {
      warnings.push(
        `Format spec for ${spec.platform} "${spec.format}" has unrecognized dimensions "${spec.dimensions}".`,
      );
    }

    // Check copy limits against platform maximums
    const platformKey = spec.platform.toLowerCase();
    const limits = COPY_LIMITS[platformKey];
    if (limits) {
      if (spec.copyLimits.headline > limits.headline) {
        warnings.push(
          `${spec.platform} headline copy limit (${spec.copyLimits.headline}) exceeds platform maximum of ${limits.headline} chars.`,
        );
      }
      if (spec.copyLimits.description > limits.description) {
        warnings.push(
          `${spec.platform} description copy limit (${spec.copyLimits.description}) exceeds platform maximum of ${limits.description} chars.`,
        );
      }
    }
  }

  // Warn if testing plan has no tests
  if (result.testingPlan.firstTests.length === 0) {
    warnings.push('Testing plan has no first tests defined — at least 1 test required.');
  }

  // Check refresh cadence
  const { frequencyDays } = result.refreshCadence;
  if (frequencyDays < 7 || frequencyDays > 90) {
    warnings.push(
      `Refresh cadence frequencyDays (${frequencyDays}) is outside the recommended 7-90 day range.`,
    );
  }

  return { data: result, warnings };
}

/**
 * Block 4 validator — qualitative-only KPI check (2026-04-19).
 *
 * Previously this ran CAC-model math (ltvCacRatio, expectedLeadsPerMonth,
 * etc.). All those fields were removed from the schema per Mahdy feedback:
 * paid media cannot guarantee those numbers, so publishing them is a trap.
 *
 * This stub just verifies each KPI has the qualitative guidance fields
 * populated (drivers + improvementLevers). It is kept as a no-op that may
 * be expanded later to audit KPI quality (e.g., flag empty drivers lists).
 */
export function validateMeasurementQualitative(
  data: MeasurementGuardrails,
): { data: MeasurementGuardrails; warnings: string[] } {
  const warnings: string[] = [];
  const result = structuredClone(data) as MeasurementGuardrails;

  for (const kpi of result.kpis) {
    if (!kpi.drivers || kpi.drivers.length === 0) {
      warnings.push(`KPI "${kpi.metric}" has no drivers listed — add at least one.`);
    }
    if (!kpi.improvementLevers || kpi.improvementLevers.length === 0) {
      warnings.push(
        `KPI "${kpi.metric}" has no improvement levers — add at least one actionable lever.`,
      );
    }
  }

  if (!result.cacFramework.drivers || result.cacFramework.drivers.length === 0) {
    warnings.push('cacFramework.drivers is empty — describe what influences CAC for this business.');
  }
  if (
    !result.cacFramework.improvementLevers ||
    result.cacFramework.improvementLevers.length === 0
  ) {
    warnings.push(
      'cacFramework.improvementLevers is empty — describe concrete actions the client can take.',
    );
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
