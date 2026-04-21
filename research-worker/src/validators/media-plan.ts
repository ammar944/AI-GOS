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
  const { awareness, consideration, conversion, displayMode } = result.budgetSummary.funnelSplit;
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
        displayMode,
      },
    };
  }

  // 2026-04-21 (Mahdy round 3): enforce displayMode coherence. Small budgets
  // (< $5k) or conversion-dominant splits (> 90%) must be 'rationale-only'
  // because the 3-bar chart is degenerate. Correct the field rather than
  // warn; the model commonly picks 'chart' by default.
  const shouldSuppressChart =
    totalMonthly < 5000 || result.budgetSummary.funnelSplit.conversion > 90;
  if (shouldSuppressChart && result.budgetSummary.funnelSplit.displayMode !== 'rationale-only') {
    warnings.push(
      `funnelSplit.displayMode forced to 'rationale-only' (totalMonthly=$${totalMonthly.toFixed(0)}, conversion=${result.budgetSummary.funnelSplit.conversion.toFixed(0)}%) — chart would be degenerate.`,
    );
    result.budgetSummary.funnelSplit.displayMode = 'rationale-only';
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
 * Validates Block 5 (Rollout Roadmap) phase durations, decision gates, and
 * content requirements.
 *
 * 2026-04-21 (Mahdy round 3): budgetAllocation is now optional. At small
 * budgets the $ bar per phase is degenerate — phase 1 shows activities +
 * decisionGate only. Per-phase monthly-equivalent burn checks still run but
 * only when budgetAllocation is present. decisionGate is now required and
 * checked for presence + basic length.
 */
export function validatePhaseBudgets(
  data: RolloutRoadmap,
  totalMonthly: number,
): { data: RolloutRoadmap; warnings: string[] } {
  const warnings: string[] = [];
  const result = structuredClone(data) as RolloutRoadmap;

  for (const phase of result.phases) {
    const weeks = (() => {
      const m = /(\d+)\s*week/i.exec(phase.duration);
      return m && m[1] ? parseInt(m[1], 10) : 0;
    })();
    if (weeks <= 0) continue;
    // Only run burn-rate check when budgetAllocation is present.
    const budget = phase.budgetAllocation;
    if (typeof budget === 'number' && budget > 0) {
      const monthlyEquivalent = (budget / weeks) * 4.33;
      if (monthlyEquivalent > totalMonthly * 1.3) {
        warnings.push(
          `Phase "${phase.name}" burns $${monthlyEquivalent.toFixed(0)}/month-equivalent — exceeds 1.3× the planned monthly budget ($${totalMonthly.toFixed(0)}). Verify the phase budget or widen the duration.`,
        );
      }
    }
  }
  // Phase 1 soft-launch discipline: if budgetAllocation is emitted for phase 1
  // it must not exceed the monthly budget on a per-month-equivalent basis.
  // At small budgets phase 1 should omit budgetAllocation entirely.
  const phase1 = result.phases[0];
  if (phase1 && typeof phase1.budgetAllocation === 'number' && phase1.budgetAllocation > 0) {
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

  // 2026-04-21: small-budget discipline — at < $5k, phase 1 should OMIT
  // budgetAllocation (display-suppressed chart). Warn if present.
  if (
    totalMonthly < 5000 &&
    phase1 &&
    typeof phase1.budgetAllocation === 'number' &&
    phase1.budgetAllocation > 0
  ) {
    warnings.push(
      `Phase 1 "${phase1.name}" has budgetAllocation set but totalMonthly < $5k — at small budgets phase 1 should emit activities + decisionGate only (omit budgetAllocation) per small-budget-discipline.md.`,
    );
  }

  // Duration totals vs timeline.totalWeeks
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

  // Content requirements per phase.
  for (const phase of result.phases) {
    if (phase.objectives.length === 0) {
      warnings.push(`Phase "${phase.name}" has no objectives — at least 1 required.`);
    }
    if (phase.successCriteria.length === 0) {
      warnings.push(
        `Phase "${phase.name}" has no success criteria — at least 1 required.`,
      );
    }
    // decisionGate is required by schema, but also check for meaningful content.
    if (!phase.decisionGate || phase.decisionGate.trim().length < 20) {
      warnings.push(
        `Phase "${phase.name}" decisionGate is missing or too short — must name an observable signal that triggers moving to the next phase (Haynes weekly-decision-cadence).`,
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

  // 2026-04-21: phase-total vs totalMonthly check removed. budgetAllocation
  // is now optional per phase (small budgets omit it), so summing
  // allocations across phases is no longer a coherent signal. Per-phase
  // burn-rate coherence is enforced in validatePhaseBudgets when the field
  // is present. Keep totalMonthly read for future cross-block uses.
  void totalMonthly;
  void block5;

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

// ── Round-3 validators (2026-04-21, Mahdy skill-first rewrite) ──────────────

/**
 * Budget-gated campaign count ceiling — the "master gate" from
 * small-budget-discipline.md.
 *
 *   < $5k  → 1 campaign max (Brooke "single campaign first" rule)
 *   $5k-$15k → 2 campaigns max
 *   > $15k → 3 campaigns max
 *
 * When only 1 campaign is returned, `singleCampaignRationale` must be set.
 * This surfaces the Brooke-anchored justification as structured data rather
 * than leaving it implicit.
 */
export function validateCampaignCountByBudget(
  audienceCampaign: AudienceCampaign,
  totalMonthly: number,
): Warning[] {
  const warnings: Warning[] = [];
  const campaigns = audienceCampaign.campaigns ?? [];
  const count = campaigns.length;

  let ceiling: number;
  if (totalMonthly < 5000) ceiling = 1;
  else if (totalMonthly < 15000) ceiling = 2;
  else ceiling = 3;

  if (count > ceiling) {
    warnings.push({
      code: 'too_many_campaigns_for_budget',
      message: `Campaign count ${count} exceeds the budget-gated ceiling of ${ceiling} (totalMonthly=$${totalMonthly.toFixed(0)}). Under $5k → 1 max; $5k–$15k → 2 max; over $15k → 3 max. See small-budget-discipline.md.`,
    });
  }

  if (count === 1) {
    const rationale = campaigns[0]?.singleCampaignRationale;
    if (!rationale || rationale.trim().length < 30) {
      warnings.push({
        code: 'missing_single_campaign_rationale',
        message:
          'singleCampaignRationale is required and must be ≥30 chars when only 1 campaign is returned. Cite the Brooke "single campaign first" principle or the ICP/budget reason.',
      });
    }
  }

  return warnings;
}

/**
 * Platform-count ceiling gate from small-budget-discipline.md. Under $5k
 * requires a single platform regardless of whether upstream research
 * surfaced two plausible channels.
 */
export function validatePlatformCountByBudget(
  channelMixBudget: ChannelMixBudget,
): Warning[] {
  const warnings: Warning[] = [];
  const total = channelMixBudget.budgetSummary?.totalMonthly ?? 0;
  const platformCount = channelMixBudget.platforms?.length ?? 0;

  let ceiling: number;
  if (total < 5000) ceiling = 1;
  else if (total < 15000) ceiling = 2;
  else ceiling = 3;

  if (platformCount > ceiling) {
    warnings.push({
      code: 'too_many_platforms_for_budget',
      message: `Platform count ${platformCount} exceeds budget-gated ceiling ${ceiling} (totalMonthly=$${total.toFixed(0)}). Under $5k → 1 platform. See small-budget-discipline.md.`,
    });
  }

  // $1,500/mo platform floor — per small-budget-discipline.md.
  for (const p of channelMixBudget.platforms ?? []) {
    if (p.monthlySpend > 0 && p.monthlySpend < 1500) {
      warnings.push({
        code: 'platform_below_spend_floor',
        message: `Platform "${p.name}" allocated $${p.monthlySpend.toFixed(0)}/mo — below the $1,500/mo learning floor. Consolidate onto a single platform.`,
      });
    }
  }

  return warnings;
}

/**
 * Channel-grounding gate: every platform recommended in Block 1 must have
 * at least one citation path — a competitor running ads on the same
 * platform, an ICP channel mention, or an upstream platformRecommendation.
 *
 * The runner passes the context string in which the upstream research
 * appears. We run a string-level check for the platform name; a missing
 * citation surfaces as a warning (not a hard reject) so the runner can
 * retry block 1 with tightened guidance.
 */
export function validateChannelGrounding(
  channelMixBudget: ChannelMixBudget,
  context: string,
): Warning[] {
  const warnings: Warning[] = [];
  const lowerContext = context.toLowerCase();

  for (const platform of channelMixBudget.platforms ?? []) {
    const normalized = platform.name.toLowerCase().trim();
    if (!normalized) continue;
    // Accept common aliases: "meta" ↔ "facebook"/"instagram", "google" ↔ "google ads"/"search".
    const aliases = new Set<string>([normalized]);
    if (normalized.includes('meta')) {
      aliases.add('facebook');
      aliases.add('instagram');
    }
    if (normalized.includes('facebook') || normalized.includes('instagram')) {
      aliases.add('meta');
    }
    if (normalized.includes('google')) {
      aliases.add('search');
      aliases.add('youtube');
    }

    const grounded = Array.from(aliases).some((alias) => lowerContext.includes(alias));
    if (!grounded) {
      warnings.push({
        code: 'platform_not_grounded',
        message: `Platform "${platform.name}" does not appear in upstream research context (competitorIntel / icpValidation / strategicSynthesis). See channel-grounding.md — every platform must be cited.`,
      });
    }
  }

  return warnings;
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
 * 2026-04-21 (Mahdy round 3): benchmark-selection.md compliance. Each
 * benchmark must carry meaningful interpretation + exactly 2 process-side
 * levers. Flag paid-media lever leaks.
 */
export function validateIndustryBenchmarks(
  measurement: MeasurementGuardrails,
): Warning[] {
  const warnings: Warning[] = [];
  const benchmarks = measurement.industryBenchmarks ?? [];

  // Empty is now allowed — the LTV:CAC viability gate may force zero CAC
  // benchmarks. But an empty array AND zero risks AND zero salesProcessGuidance
  // improvementLevers is a pathological output — let the other validators
  // catch that. Here we only lint the entries that exist.

  const PAID_MEDIA_LEVER_RE =
    /\b(increase\s+(?:ad\s+)?(?:budget|spend)|shift\s+platform|test\s+meta|test\s+google|meta\s+advantage|google\s+ads|tiktok|reallocate\s+budget|raise\s+(?:cpm|cpc|bid)|scale\s+ad\s+spend)\b/i;

  for (const [idx, entry] of benchmarks.entries()) {
    if (!entry.interpretation || entry.interpretation.trim().length < 20) {
      warnings.push({
        code: 'benchmark_missing_interpretation',
        message: `industryBenchmarks[${idx}] "${entry.metric}" missing or too-short interpretation. Per benchmark-selection.md, uninterpreted benchmarks are noise.`,
      });
    }
    const levers = entry.leversToMoveIt ?? [];
    if (levers.length !== 2) {
      warnings.push({
        code: 'benchmark_wrong_lever_count',
        message: `industryBenchmarks[${idx}] "${entry.metric}" has ${levers.length} levers, expected exactly 2 per benchmark-selection.md.`,
      });
    }
    for (const [leverIdx, lever] of levers.entries()) {
      if (PAID_MEDIA_LEVER_RE.test(lever)) {
        warnings.push({
          code: 'benchmark_lever_is_paid_media',
          message: `industryBenchmarks[${idx}].leversToMoveIt[${leverIdx}] "${lever}" is a paid-media action. Benchmark levers must be process-side only (pricing, retention, sales-process). See benchmark-selection.md.`,
        });
      }
    }
  }

  return warnings;
}

/**
 * LTV:CAC viability gate inference — per ltv-cac-viability.md.
 *
 * This is a heuristic check: if the context reveals a low-ticket offer
 * (price < $50/mo for PLG) AND the measurement output still contains CAC /
 * CPL language, flag the unit-economics mismatch. The fabrication-sweep
 * also catches numeric leaks; this validator adds a schema-aware check.
 */
export function validateLtvCacViability(
  measurement: MeasurementGuardrails,
  context: string,
): Warning[] {
  const warnings: Warning[] = [];
  const lowerContext = context.toLowerCase();

  const isPlg = /\[businessmodeltype:plg\]/i.test(context);
  const isFreeTrialLike =
    lowerContext.includes('free trial') ||
    lowerContext.includes('freemium') ||
    lowerContext.includes('self-serve');

  if (!isPlg && !isFreeTrialLike) return warnings;

  // Check for CAC / CPL numeric language in benchmark / guidance strings.
  const CAC_NUMERIC_RE = /\$\s?\d{2,}\s?(?:cac|cpl|customer acquisition cost|cost per lead)\b/i;

  for (const entry of measurement.industryBenchmarks ?? []) {
    if (CAC_NUMERIC_RE.test(`${entry.metric} ${entry.range} ${entry.interpretation}`)) {
      warnings.push({
        code: 'plg_cac_numeric_leak',
        message: `industryBenchmarks entry "${entry.metric}" contains a numeric CAC/CPL target on a PLG/free-trial offer. See ltv-cac-viability.md — apply the 3× gate.`,
      });
    }
  }

  const guidanceText = `${measurement.salesProcessGuidance?.diagnosticNote ?? ''} ${(
    measurement.salesProcessGuidance?.improvementLevers ?? []
  ).join(' ')}`;

  if (/\bleads?\b|\blead[-\s]gen\b|\bmql\b|\bsql\b/i.test(guidanceText)) {
    warnings.push({
      code: 'plg_lead_vocabulary_leak',
      message:
        'salesProcessGuidance uses lead/MQL/SQL vocabulary on a PLG/free-trial offer. Use "free sign-ups", "trial starts", "activated users" per ltv-cac-viability.md.',
    });
  }

  return warnings;
}
