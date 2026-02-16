// Media Plan Validation — Deterministic Layer
// Pure functions for budget math, CAC computation, and cross-section consistency.
// Follows the reconciliation.ts pattern from strategic blueprint.

import type {
  BudgetAllocation,
  PlatformStrategy,
  CACModel,
  PerformanceModel,
  ICPTargeting,
  CampaignStructure,
  KPITarget,
  MonitoringSchedule,
} from './types';

// =============================================================================
// Types
// =============================================================================

export interface ValidationAdjustment {
  field: string;
  originalValue: string | number;
  adjustedValue: string | number;
  rule: string;
  reason: string;
}

export interface BudgetValidationResult {
  budget: BudgetAllocation;
  adjustments: ValidationAdjustment[];
}

export interface CACModelInput {
  monthlyBudget: number;
  targetCPL: number;
  leadToSqlRate: number;
  sqlToCustomerRate: number;
  offerPrice: number;
  /** Multiplier for LTV based on pricing model (e.g., 12 for monthly sub, 1 for one-time) */
  retentionMultiplier: number;
}

export interface CrossSectionValidationResult {
  valid: boolean;
  adjustments: ValidationAdjustment[];
  warnings: string[];
}

// =============================================================================
// Budget Validation
// =============================================================================

/**
 * Validate and fix budget allocation math.
 * Rules:
 * 1. Platform percentages sum to 100 (proportional fix if off)
 * 2. monthlyBudget = totalBudget * percentage / 100 (recalculate)
 * 3. Funnel split percentages sum to 100
 * 4. dailyCeiling <= totalMonthlyBudget / 30 (cap if exceeded)
 * 5. totalMonthlyBudget matches onboarding budget (override if >10% off)
 */
export function validateAndFixBudget(
  budget: BudgetAllocation,
  onboardingMonthlyBudget: number,
): BudgetValidationResult {
  const adjustments: ValidationAdjustment[] = [];
  let fixed = { ...budget };

  // Rule 5: totalMonthlyBudget must match onboarding budget (within 10%)
  const budgetDrift = Math.abs(fixed.totalMonthlyBudget - onboardingMonthlyBudget) / onboardingMonthlyBudget;
  if (budgetDrift > 0.10) {
    adjustments.push({
      field: 'totalMonthlyBudget',
      originalValue: fixed.totalMonthlyBudget,
      adjustedValue: onboardingMonthlyBudget,
      rule: 'Rule5_BudgetMatch',
      reason: `Total budget drifted ${(budgetDrift * 100).toFixed(1)}% from onboarding ($${fixed.totalMonthlyBudget} vs $${onboardingMonthlyBudget})`,
    });
    fixed = { ...fixed, totalMonthlyBudget: onboardingMonthlyBudget };
  }

  // Rule 1: Platform percentages must sum to 100
  const platformBreakdown = [...fixed.platformBreakdown];
  const pctSum = platformBreakdown.reduce((sum, p) => sum + p.percentage, 0);
  if (Math.abs(pctSum - 100) > 0.5) {
    const scale = 100 / pctSum;
    const adjustedBreakdown = platformBreakdown.map(p => ({
      ...p,
      percentage: Math.round(p.percentage * scale * 10) / 10,
    }));
    // Fix rounding: adjust the largest platform to make it exactly 100
    const newSum = adjustedBreakdown.reduce((s, p) => s + p.percentage, 0);
    if (Math.abs(newSum - 100) > 0.01) {
      const largestIdx = adjustedBreakdown.reduce((maxIdx, p, i, arr) =>
        p.percentage > arr[maxIdx].percentage ? i : maxIdx, 0);
      adjustedBreakdown[largestIdx] = {
        ...adjustedBreakdown[largestIdx],
        percentage: Math.round((adjustedBreakdown[largestIdx].percentage + (100 - newSum)) * 10) / 10,
      };
    }
    adjustments.push({
      field: 'platformBreakdown.percentage',
      originalValue: pctSum,
      adjustedValue: 100,
      rule: 'Rule1_PlatformPctSum',
      reason: `Platform percentages summed to ${pctSum}%, proportionally scaled to 100%`,
    });
    fixed = { ...fixed, platformBreakdown: adjustedBreakdown };
  }

  // Rule 2: Recalculate monthlyBudget = totalBudget * percentage / 100
  const recalcBreakdown = fixed.platformBreakdown.map(p => ({
    ...p,
    monthlyBudget: Math.round(fixed.totalMonthlyBudget * p.percentage / 100),
  }));
  const hasBudgetDrift = recalcBreakdown.some((p, i) =>
    Math.abs(p.monthlyBudget - fixed.platformBreakdown[i].monthlyBudget) > 1,
  );
  if (hasBudgetDrift) {
    adjustments.push({
      field: 'platformBreakdown.monthlyBudget',
      originalValue: 'AI-generated values',
      adjustedValue: 'recalculated from percentage',
      rule: 'Rule2_BudgetRecalc',
      reason: 'Recalculated platform monthly budgets from totalBudget * percentage / 100',
    });
    fixed = { ...fixed, platformBreakdown: recalcBreakdown };
  }

  // Rule 3: Funnel split percentages sum to 100
  const funnelSplit = [...fixed.funnelSplit];
  const funnelPctSum = funnelSplit.reduce((sum, f) => sum + f.percentage, 0);
  if (Math.abs(funnelPctSum - 100) > 0.5) {
    const scale = 100 / funnelPctSum;
    const adjustedFunnel = funnelSplit.map(f => ({
      ...f,
      percentage: Math.round(f.percentage * scale * 10) / 10,
    }));
    // Fix rounding on largest
    const newFSum = adjustedFunnel.reduce((s, f) => s + f.percentage, 0);
    if (Math.abs(newFSum - 100) > 0.01) {
      const largestIdx = adjustedFunnel.reduce((maxIdx, f, i, arr) =>
        f.percentage > arr[maxIdx].percentage ? i : maxIdx, 0);
      adjustedFunnel[largestIdx] = {
        ...adjustedFunnel[largestIdx],
        percentage: Math.round((adjustedFunnel[largestIdx].percentage + (100 - newFSum)) * 10) / 10,
      };
    }
    adjustments.push({
      field: 'funnelSplit.percentage',
      originalValue: funnelPctSum,
      adjustedValue: 100,
      rule: 'Rule3_FunnelPctSum',
      reason: `Funnel split summed to ${funnelPctSum}%, proportionally scaled to 100%`,
    });
    fixed = { ...fixed, funnelSplit: adjustedFunnel };
  }

  // Rule 4: dailyCeiling <= totalMonthlyBudget / 30
  const maxDailyCeiling = Math.round(fixed.totalMonthlyBudget / 30);
  if (fixed.dailyCeiling > maxDailyCeiling) {
    adjustments.push({
      field: 'dailyCeiling',
      originalValue: fixed.dailyCeiling,
      adjustedValue: maxDailyCeiling,
      rule: 'Rule4_DailyCeiling',
      reason: `Daily ceiling $${fixed.dailyCeiling} exceeds $${maxDailyCeiling} (budget/30). Capped.`,
    });
    fixed = { ...fixed, dailyCeiling: maxDailyCeiling };
  }

  return { budget: fixed, adjustments };
}

// =============================================================================
// CAC Model Computation
// =============================================================================

/**
 * Pure arithmetic CAC model. No AI involved.
 * leads = budget / CPL
 * SQLs = leads * rate / 100
 * customers = SQLs * closeRate / 100
 * CAC = budget / customers
 * LTV = offerPrice * retentionMultiplier
 * ltvToCacRatio = LTV / CAC
 */
export function computeCACModel(input: CACModelInput): CACModel {
  const { monthlyBudget, targetCPL, leadToSqlRate, sqlToCustomerRate, offerPrice, retentionMultiplier } = input;

  const expectedMonthlyLeads = Math.round(monthlyBudget / targetCPL);
  const expectedMonthlySQLs = Math.round(expectedMonthlyLeads * leadToSqlRate / 100);
  const expectedMonthlyCustomers = Math.max(1, Math.round(expectedMonthlySQLs * sqlToCustomerRate / 100));
  const targetCAC = Math.round(monthlyBudget / expectedMonthlyCustomers);
  const estimatedLTV = Math.round(offerPrice * retentionMultiplier);
  const ltvToCacRatio = targetCAC > 0 ? estimatedLTV / targetCAC : 0;

  const ratioStr = ltvToCacRatio >= 3
    ? `${ltvToCacRatio.toFixed(1)}:1 — Healthy`
    : ltvToCacRatio >= 1
      ? `${ltvToCacRatio.toFixed(1)}:1 — Below ideal (target >3:1)`
      : `${ltvToCacRatio.toFixed(1)}:1 — Unsustainable`;

  return {
    targetCAC,
    targetCPL,
    leadToSqlRate,
    sqlToCustomerRate,
    expectedMonthlyLeads,
    expectedMonthlySQLs,
    expectedMonthlyCustomers,
    estimatedLTV,
    ltvToCacRatio: ratioStr,
  };
}

/**
 * Build a complete PerformanceModel from CAC input and monitoring schedule.
 * CAC model is computed deterministically; monitoring schedule comes from AI.
 */
export function buildPerformanceModel(
  cacInput: CACModelInput,
  monitoringSchedule: MonitoringSchedule,
): PerformanceModel {
  return {
    cacModel: computeCACModel(cacInput),
    monitoringSchedule,
  };
}

// =============================================================================
// Cross-Section Validation
// =============================================================================

/**
 * Validate consistency across completed media plan sections.
 * Follows the reconcileICPAndOffer pattern from reconciliation.ts.
 *
 * Rules:
 * 1. Campaign dailyBudget sums <= budgetAllocation.dailyCeiling
 * 2. Platforms in campaigns are a subset of platformStrategy platforms
 * 3. Platforms in icpTargeting.platformTargeting match platformStrategy
 * 4. KPI targetCPL matches performanceModel.cacModel.targetCPL
 */
export function validateCrossSection(input: {
  platformStrategy: PlatformStrategy[];
  icpTargeting: ICPTargeting;
  campaignStructure: CampaignStructure;
  budgetAllocation: BudgetAllocation;
  kpiTargets: KPITarget[];
  performanceModel: PerformanceModel;
}): CrossSectionValidationResult {
  const adjustments: ValidationAdjustment[] = [];
  const warnings: string[] = [];
  const { platformStrategy, icpTargeting, campaignStructure, budgetAllocation, kpiTargets, performanceModel } = input;

  const validPlatforms = new Set(platformStrategy.map(p => p.platform.toLowerCase()));

  // Rule 1: Campaign dailyBudget sums <= budgetAllocation.dailyCeiling
  const totalDailyBudget = campaignStructure.campaigns.reduce((sum, c) => sum + c.dailyBudget, 0);
  if (totalDailyBudget > budgetAllocation.dailyCeiling * 1.1) { // 10% tolerance
    warnings.push(
      `Campaign daily budgets sum to $${totalDailyBudget}, exceeding daily ceiling of $${budgetAllocation.dailyCeiling}`,
    );
  }

  // Rule 2: Platforms in campaigns are subset of platformStrategy platforms
  const campaignPlatforms = new Set(campaignStructure.campaigns.map(c => c.platform.toLowerCase()));
  for (const plat of campaignPlatforms) {
    if (!validPlatforms.has(plat)) {
      warnings.push(`Campaign references platform "${plat}" not in platformStrategy`);
    }
  }

  // Rule 3: Platforms in icpTargeting.platformTargeting match platformStrategy
  for (const pt of icpTargeting.platformTargeting) {
    if (!validPlatforms.has(pt.platform.toLowerCase())) {
      warnings.push(`ICP targeting references platform "${pt.platform}" not in platformStrategy`);
    }
  }

  // Rule 4: KPI targetCPL matches performanceModel.cacModel.targetCPL
  const cplKpi = kpiTargets.find(k =>
    k.metric.toLowerCase().includes('cost per lead') || k.metric.toLowerCase().includes('cpl'),
  );
  if (cplKpi) {
    const kpiCplMatch = cplKpi.target.match(/\$?(\d+)/);
    if (kpiCplMatch) {
      const kpiCplValue = parseInt(kpiCplMatch[1], 10);
      const modelCpl = performanceModel.cacModel.targetCPL;
      if (Math.abs(kpiCplValue - modelCpl) > modelCpl * 0.2) {
        warnings.push(
          `KPI CPL target ($${kpiCplValue}) differs >20% from performance model CPL ($${modelCpl})`,
        );
      }
    }
  }

  // Rule 5: KPI targetCAC matches performanceModel.cacModel.targetCAC
  const cacKpi = kpiTargets.find(k =>
    k.metric.toLowerCase().includes('customer acquisition cost') || k.metric.toLowerCase().includes('cac'),
  );
  if (cacKpi) {
    const kpiCacMatch = cacKpi.target.match(/\$?(\d[\d,]*)/);
    if (kpiCacMatch) {
      const kpiCacValue = parseInt(kpiCacMatch[1].replace(/,/g, ''), 10);
      const modelCac = performanceModel.cacModel.targetCAC;
      if (Math.abs(kpiCacValue - modelCac) > modelCac * 0.2) {
        warnings.push(
          `KPI CAC target ($${kpiCacValue}) differs >20% from computed CAC ($${modelCac}). Computed value is deterministic: budget / customers.`,
        );
      }
    }
  }

  return {
    valid: warnings.length === 0,
    adjustments,
    warnings,
  };
}

/**
 * Fix KPI targets that conflict with deterministic performance model values.
 * Overwrites AI-hallucinated CAC/CPL/SQL/lead targets with computed math.
 * Returns the corrected array + list of overrides made.
 */
export function reconcileKPITargets(
  kpiTargets: KPITarget[],
  cacModel: CACModel,
): { kpiTargets: KPITarget[]; overrides: ValidationAdjustment[] } {
  const overrides: ValidationAdjustment[] = [];
  const fixed = kpiTargets.map(kpi => {
    const metric = kpi.metric.toLowerCase();

    // Fix CAC target
    if (metric.includes('customer acquisition cost') || metric.includes('cac')) {
      const match = kpi.target.match(/\$?(\d[\d,]*)/);
      if (match) {
        const kpiValue = parseInt(match[1].replace(/,/g, ''), 10);
        if (Math.abs(kpiValue - cacModel.targetCAC) > cacModel.targetCAC * 0.2) {
          overrides.push({
            field: `kpiTargets.${kpi.metric}`,
            originalValue: kpi.target,
            adjustedValue: `<$${cacModel.targetCAC}`,
            rule: 'KPI_CAC_Override',
            reason: `AI-generated CAC target ($${kpiValue}) contradicts computed CAC ($${cacModel.targetCAC} = budget / customers). Overriding with math.`,
          });
          return { ...kpi, target: `<$${cacModel.targetCAC}` };
        }
      }
    }

    // Fix SQL volume target
    if (metric.includes('sql') && (metric.includes('volume') || metric.includes('/month'))) {
      const match = kpi.target.match(/(\d[\d,]*)/);
      if (match) {
        const kpiValue = parseInt(match[1].replace(/,/g, ''), 10);
        if (Math.abs(kpiValue - cacModel.expectedMonthlySQLs) > cacModel.expectedMonthlySQLs * 0.3) {
          overrides.push({
            field: `kpiTargets.${kpi.metric}`,
            originalValue: kpi.target,
            adjustedValue: `${cacModel.expectedMonthlySQLs}/month`,
            rule: 'KPI_SQL_Override',
            reason: `AI-generated SQL target (${kpiValue}) contradicts computed SQLs (${cacModel.expectedMonthlySQLs} = leads × SQL rate). Overriding with math.`,
          });
          return { ...kpi, target: `${cacModel.expectedMonthlySQLs}/month` };
        }
      }
    }

    return kpi;
  });

  return { kpiTargets: fixed, overrides };
}

// =============================================================================
// Retention Multiplier Heuristic
// =============================================================================

/**
 * Estimate a retention multiplier from pricing model for LTV calculation.
 * Roughly: monthly → 12 months, annual → 2.5 years, one-time → 1, etc.
 */
export function estimateRetentionMultiplier(pricingModels: string[]): number {
  const normalized = pricingModels.map(p => p.toLowerCase().replace(/[_-]/g, ''));
  if (normalized.some(p => p.includes('monthly') || p.includes('subscription'))) return 12;
  if (normalized.some(p => p.includes('annual'))) return 2.5;
  if (normalized.some(p => p.includes('seat') || p.includes('usage'))) return 10;
  if (normalized.some(p => p.includes('onetime') || p.includes('one time'))) return 1;
  return 8; // default for recurring-ish models
}
