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
  CampaignTemplate,
  CampaignPhase,
  KPITarget,
  MonitoringSchedule,
  MonthlyRoadmap,
  RiskMonitoring,
  MediaPlanOutput,
} from './types';
import type { OnboardingFormData } from '@/lib/onboarding/types';

import { postProcessMediaPlanRisks } from './research';

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
  fixes?: {
    campaignStructure?: CampaignStructure;
  };
}

export interface ResolvedTargets {
  monthlyBudget: number;
  cpl: number;
  cac: number;
  leadsPerMonth: number;
  sqlsPerMonth: number;
  customersPerMonth: number;
  leadToSqlRate: number;
  sqlToCustomerRate: number;
  ltvCacRatio: string;
  estimatedLtv: number;
}

export interface RetargetingValidationInput {
  campaignStructure: CampaignStructure;
  campaignPhases: CampaignPhase[];
  hasExistingPaidTraffic: boolean;
  hasOrganicKeywords: boolean;
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
 * effectiveBudget = budget × 0.80 (20% reserved for overhead/testing)
 * leads = effectiveBudget / CPL
 * SQLs = leads * rate / 100
 * customers = SQLs * closeRate / 100
 * CAC = budget / customers (full budget — you still spent it all)
 * LTV = offerPrice * retentionMultiplier
 * ltvToCacRatio = LTV / CAC
 */
export function computeCACModel(input: CACModelInput): CACModel {
  const { monthlyBudget, targetCPL, leadToSqlRate, sqlToCustomerRate, offerPrice, retentionMultiplier } = input;

  // Apply 20% safety margin: only 80% of budget drives lead acquisition.
  // The remaining 20% covers platform overhead, testing, and optimization.
  // CAC still uses full monthlyBudget because that's the total spend.
  const safeCPL = targetCPL > 0 ? targetCPL : 1; // guard division by zero
  const effectiveBudget = monthlyBudget * 0.80;
  const expectedMonthlyLeads = Math.round(effectiveBudget / safeCPL);
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
// 3-Scenario CAC Model (supplementary — uses sensitivity analysis from ICP)
// =============================================================================

export interface ScenarioCAC {
  label: 'best' | 'base' | 'worst';
  assumedCPL: number;
  leadToSqlRate: number;
  sqlToCustomerRate: number;
  resultingCAC: number;
  expectedMonthlyLeads: number;
  expectedMonthlySQLs: number;
  expectedMonthlyCustomers: number;
  estimatedLTV: number;
  ltvCacRatio: string;
  conditions: string;
}

/**
 * Compute 3-scenario CAC model from ICP sensitivity analysis.
 * Supplements the primary single-model computeCACModel() — used for
 * executive summary and risk section context.
 *
 * Applies a 20% safety margin to budget for effective spend.
 */
export function computeThreeScenarioCAC(
  monthlyBudget: number,
  offerPrice: number,
  retentionMultiplier: number,
  sensitivityAnalysis: {
    bestCase: { assumedCPL: number; assumedLeadToSqlRate: number; assumedSqlToCustomerRate: number; conditions: string };
    baseCase: { assumedCPL: number; assumedLeadToSqlRate: number; assumedSqlToCustomerRate: number; conditions: string };
    worstCase: { assumedCPL: number; assumedLeadToSqlRate: number; assumedSqlToCustomerRate: number; conditions: string };
  },
): ScenarioCAC[] {
  const scenarios: ScenarioCAC[] = [];

  for (const [label, scenario] of Object.entries({
    best: sensitivityAnalysis.bestCase,
    base: sensitivityAnalysis.baseCase,
    worst: sensitivityAnalysis.worstCase,
  })) {
    // Apply 20% safety margin to budget for effective spend
    const effectiveBudget = monthlyBudget * 0.80;
    const leads = Math.floor(effectiveBudget / scenario.assumedCPL);
    const sqls = Math.floor(leads * (scenario.assumedLeadToSqlRate / 100));
    const customers = Math.max(1, Math.floor(sqls * (scenario.assumedSqlToCustomerRate / 100)));
    const cac = Math.round(monthlyBudget / customers);
    const ltv = offerPrice * retentionMultiplier;
    const ltvCacRatio = cac > 0 ? (ltv / cac).toFixed(1) : '0';

    scenarios.push({
      label: label as 'best' | 'base' | 'worst',
      assumedCPL: scenario.assumedCPL,
      leadToSqlRate: scenario.assumedLeadToSqlRate,
      sqlToCustomerRate: scenario.assumedSqlToCustomerRate,
      resultingCAC: cac,
      expectedMonthlyLeads: leads,
      expectedMonthlySQLs: sqls,
      expectedMonthlyCustomers: customers,
      estimatedLTV: ltv,
      ltvCacRatio: `${ltvCacRatio}:1`,
      conditions: scenario.conditions,
    });
  }

  return scenarios;
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
  const fixes: CrossSectionValidationResult['fixes'] = {};
  const { platformStrategy, icpTargeting, campaignStructure, budgetAllocation, kpiTargets, performanceModel } = input;

  const validPlatforms = new Set(platformStrategy.map(p => p.platform.toLowerCase()));

  // Rule 1: Campaign dailyBudget sums <= budgetAllocation.dailyCeiling (with proportional scaling fix)
  const dailyCeiling = budgetAllocation.dailyCeiling;
  const totalDailyBudget = campaignStructure.campaigns.reduce((sum, c) => sum + c.dailyBudget, 0);
  if (totalDailyBudget > dailyCeiling * 1.1) { // 10% tolerance
    warnings.push(
      `Campaign daily budgets sum to $${totalDailyBudget}, exceeding daily ceiling of $${dailyCeiling}`,
    );

    // Proportional scaling fix
    const scaleFactor = dailyCeiling / totalDailyBudget;
    const scaledCampaigns = campaignStructure.campaigns.map(c => ({
      ...c,
      dailyBudget: Math.round(c.dailyBudget * scaleFactor),
    }));

    adjustments.push({
      field: 'campaignStructure.campaigns.dailyBudget',
      originalValue: totalDailyBudget,
      adjustedValue: scaledCampaigns.reduce((sum, c) => sum + c.dailyBudget, 0),
      rule: 'Rule1_DailyBudgetScale',
      reason: `Campaign daily budgets summed to $${totalDailyBudget}, exceeding ceiling $${dailyCeiling} by ${((totalDailyBudget / dailyCeiling - 1) * 100).toFixed(1)}%. Proportionally scaled by factor ${scaleFactor.toFixed(3)}.`,
    });

    fixes.campaignStructure = {
      ...campaignStructure,
      campaigns: scaledCampaigns,
    };
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

  const hasFixedCampaignStructure = fixes.campaignStructure !== undefined;

  return {
    valid: warnings.length === 0,
    adjustments,
    warnings,
    ...(hasFixedCampaignStructure ? { fixes } : {}),
  };
}

/**
 * Fix KPI targets that conflict with deterministic performance model values.
 * Overwrites AI-hallucinated CAC/CPL/SQL/lead/ROAS targets with computed math.
 * Returns the corrected array + list of overrides made.
 *
 * Checks:
 * 1. CAC target vs computed CAC (>20% drift → override)
 * 2. SQL volume vs computed SQLs (>30% drift → override)
 * 3. CPL target vs computed CPL (>15% drift → override)
 * 4. Lead volume — detect missing 20% margin, override to (budget × 0.80) / CPL
 * 5. ROAS — monthly revenue / budget (detects LTV:CAC disguised as ROAS)
 * 6. Benchmark contradiction — flags benchmark text that contradicts target value
 */
export function reconcileKPITargets(
  kpiTargets: KPITarget[],
  cacModel: CACModel,
  monthlyBudget: number,
  offerPrice?: number,
): { kpiTargets: KPITarget[]; overrides: ValidationAdjustment[] } {
  const overrides: ValidationAdjustment[] = [];
  const fixed = kpiTargets.map(kpi => {
    const metric = kpi.metric.toLowerCase();

    // Check 1: Fix CAC target
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

    // Check 2: Fix SQL volume target
    // Fuzzy match: "SQLs per Month", "SQL per Month", "Monthly SQLs",
    // "Sales Qualified Leads", "SQL Volume", "SQL/month"
    if (/sql|sales.qualified/i.test(metric) && !/rate|%|cost/i.test(metric)) {
      // Parse target: strip non-numeric prefixes like "~", "/month", etc.
      const match = kpi.target.match(/~?(\d[\d,]*)/);
      if (match) {
        const kpiValue = parseInt(match[1].replace(/,/g, ''), 10);
        if (kpiValue > 0 && cacModel.expectedMonthlySQLs > 0 &&
          Math.abs(kpiValue - cacModel.expectedMonthlySQLs) > cacModel.expectedMonthlySQLs * 0.20) {
          overrides.push({
            field: `kpiTargets.${kpi.metric}`,
            originalValue: kpi.target,
            adjustedValue: `${cacModel.expectedMonthlySQLs}/month`,
            rule: 'KPI_SQL_Override',
            reason: `AI-generated SQL target (${kpiValue}) contradicts computed SQLs (${cacModel.expectedMonthlySQLs} = leads × SQL rate). Overriding with math.`,
          });
          // Also fix benchmark if it references a stale lead count
          let fixedBenchmark = kpi.benchmark;
          if (fixedBenchmark) {
            const leadRefMatch = fixedBenchmark.match(/~?(\d[\d,]*)\s*leads/i);
            if (leadRefMatch) {
              const statedLeads = parseInt(leadRefMatch[1].replace(/,/g, ''), 10);
              if (statedLeads > 0 && Math.abs(statedLeads - cacModel.expectedMonthlyLeads) / cacModel.expectedMonthlyLeads > 0.20) {
                fixedBenchmark = fixedBenchmark.replace(leadRefMatch[0], `${cacModel.expectedMonthlyLeads} leads`);
                overrides.push({
                  field: `kpiTargets.${kpi.metric}.benchmark`,
                  originalValue: kpi.benchmark,
                  adjustedValue: fixedBenchmark,
                  rule: 'KPI_SQL_Benchmark_LeadFix',
                  reason: `Benchmark referenced ~${statedLeads} leads but computed leads = ${cacModel.expectedMonthlyLeads}. Corrected.`,
                });
              }
            }
          }
          return { ...kpi, target: `${cacModel.expectedMonthlySQLs}/month`, benchmark: fixedBenchmark };
        }
      }
    }

    // Check 3: Fix CPL target (>15% deviation from computed CPL)
    if (metric.includes('cost per lead') || metric.includes('cpl')) {
      const match = kpi.target.match(/\$?(\d[\d,]*)/);
      if (match) {
        const kpiValue = parseInt(match[1].replace(/,/g, ''), 10);
        if (cacModel.targetCPL > 0 && Math.abs(kpiValue - cacModel.targetCPL) > cacModel.targetCPL * 0.15) {
          overrides.push({
            field: `kpiTargets.${kpi.metric}`,
            originalValue: kpi.target,
            adjustedValue: `<$${cacModel.targetCPL}`,
            rule: 'KPI_CPL_Override',
            reason: `AI-generated CPL target ($${kpiValue}) deviates >15% from computed CPL ($${cacModel.targetCPL}). Overriding with math.`,
          });
          return { ...kpi, target: `<$${cacModel.targetCPL}` };
        }
      }
    }

    // Check 4: Fix lead volume — cacModel.expectedMonthlyLeads already includes 20% margin
    // (effectiveBudget = budget × 0.80, leads = effectiveBudget / CPL)
    if (
      metric.includes('lead') &&
      !metric.includes('sql') &&
      !metric.includes('cost') &&
      (metric.includes('volume') || metric.includes('/month') || metric.includes('per month') || metric.includes('generation'))
    ) {
      const match = kpi.target.match(/(\d[\d,]*)/);
      if (match && cacModel.targetCPL > 0) {
        const statedLeads = parseInt(match[1].replace(/,/g, ''), 10);
        const correctLeads = cacModel.expectedMonthlyLeads; // already (budget × 0.80) / CPL
        // Detect AI error: leads match full-budget calculation (no margin)
        const noMarginLeads = Math.round(monthlyBudget / cacModel.targetCPL);

        if (statedLeads > 0 && correctLeads > 0) {
          // Detect common AI error: leads match budget/CPL without 20% margin
          if (noMarginLeads > 0 && Math.abs(statedLeads - noMarginLeads) < noMarginLeads * 0.05) {
            overrides.push({
              field: `kpiTargets.${kpi.metric}`,
              originalValue: kpi.target,
              adjustedValue: `${correctLeads}/month`,
              rule: 'KPI_Lead_Margin_Override',
              reason: `Lead volume (${statedLeads}) matches budget/CPL without 20% margin (${noMarginLeads}). Corrected to (budget × 0.80)/CPL = ${correctLeads}.`,
            });
            return { ...kpi, target: `${correctLeads}/month` };
          }
          // Catch any deviation >25% from the computed value
          if (Math.abs(statedLeads - correctLeads) / correctLeads > 0.25) {
            overrides.push({
              field: `kpiTargets.${kpi.metric}`,
              originalValue: kpi.target,
              adjustedValue: `${correctLeads}/month`,
              rule: 'KPI_Lead_Override',
              reason: `Lead volume (${statedLeads}) deviates >25% from computed ${correctLeads} ((budget × 0.80)/CPL). Overridden.`,
            });
            return { ...kpi, target: `${correctLeads}/month` };
          }
        }
      }
    }

    // Check 5: Fix ROAS target — correct formula is monthly revenue / budget.
    // Detects LTV:CAC ratio disguised as ROAS and overrides with correct monthly ROAS.
    if (metric.includes('roas') || metric.includes('return on ad spend')) {
      const match = kpi.target.match(/(\d+\.?\d*)/);
      if (match) {
        const statedROAS = parseFloat(match[1]);
        const customers = cacModel.expectedMonthlyCustomers;
        const price = offerPrice ?? 0;
        const ltv = cacModel.estimatedLTV;

        if (statedROAS > 0 && customers > 0 && monthlyBudget > 0 && price > 0) {
          // Correct monthly ROAS: (customers × monthly offer price) / monthly ad spend
          const monthlyRevenue = customers * price;
          const correctMonthlyROAS = Math.round((monthlyRevenue / monthlyBudget) * 100) / 100;

          // LTV:CAC ratio (what the AI often puts in the ROAS field by mistake)
          const ltvBasedValue = ltv > 0 ? Math.round(((customers * ltv) / monthlyBudget) * 100) / 100 : 0;

          // Detect which formula the AI used
          const isLTVBased = ltvBasedValue > 0 && Math.abs(statedROAS - ltvBasedValue) / ltvBasedValue < 0.15;
          const isMonthlyBased = correctMonthlyROAS > 0 && Math.abs(statedROAS - correctMonthlyROAS) / correctMonthlyROAS < 0.20;

          if (isLTVBased && !isMonthlyBased) {
            // AI put LTV:CAC in the ROAS field — override with correct monthly ROAS
            overrides.push({
              field: `kpiTargets.${kpi.metric}`,
              originalValue: kpi.target,
              adjustedValue: `${correctMonthlyROAS}x`,
              rule: 'KPI_ROAS_LTV_Confusion',
              reason: `ROAS field contains LTV-based value (${statedROAS}x ≈ LTV:CAC ${ltvBasedValue}x). ` +
                `Correct monthly ROAS: (${customers} customers × $${price}) / $${monthlyBudget} = ${correctMonthlyROAS}x. ` +
                `LTV:CAC ratio (${ltvBasedValue}x) belongs in Performance Model, not ROAS.`,
            });
            return { ...kpi, target: `${correctMonthlyROAS}x` };
          } else if (!isMonthlyBased) {
            // Neither formula matches — fabricated value, override with monthly ROAS
            overrides.push({
              field: `kpiTargets.${kpi.metric}`,
              originalValue: kpi.target,
              adjustedValue: `${correctMonthlyROAS}x`,
              rule: 'KPI_ROAS_Override',
              reason: `ROAS (${statedROAS}x) doesn't match monthly ROAS (${correctMonthlyROAS}x) or LTV:CAC (${ltvBasedValue}x). ` +
                `Overriding with correct monthly ROAS: (${customers} × $${price}) / $${monthlyBudget}.`,
            });
            return { ...kpi, target: `${correctMonthlyROAS}x` };
          }
          // If isMonthlyBased — it's correct, no action needed
        }
      }
    }

    // Check 5b: Fix LTV:CAC ratio — should be "X:1" not "$X"
    // The AI sometimes puts a dollar amount in the LTV:CAC row target (e.g., "<$1875")
    // instead of the correct ratio format (e.g., "6.4:1").
    if (
      (metric.includes('ltv') && metric.includes('cac')) ||
      metric.includes('ltv:cac') ||
      (metric.includes('lifetime value') && metric.includes('cac'))
    ) {
      const ratioMatch = cacModel.ltvToCacRatio.match(/(\d+\.?\d*)\s*:\s*1/);
      if (ratioMatch) {
        const correctRatio = parseFloat(ratioMatch[1]);
        const currentTarget = kpi.target;

        // Case 1: Dollar format (e.g. "<$1875", "$1,875") — always wrong for LTV:CAC
        if (/\$\d/.test(currentTarget)) {
          overrides.push({
            field: `kpiTargets.${kpi.metric}`,
            originalValue: currentTarget,
            adjustedValue: `${correctRatio}:1`,
            rule: 'KPI_LTV_CAC_Format',
            reason: `LTV:CAC target ("${currentTarget}") is in dollar format instead of ratio. Corrected to ${correctRatio}:1 from CAC model.`,
          });
          return { ...kpi, target: `${correctRatio}:1` };
        }

        // Case 2: Already ratio format but wrong value (e.g. "3:1" when should be "6.4:1")
        const existingRatioMatch = currentTarget.match(/(\d+\.?\d*)\s*:\s*1/);
        if (existingRatioMatch) {
          const existingRatio = parseFloat(existingRatioMatch[1]);
          if (correctRatio > 0 && Math.abs(existingRatio - correctRatio) / correctRatio > 0.20) {
            overrides.push({
              field: `kpiTargets.${kpi.metric}`,
              originalValue: currentTarget,
              adjustedValue: `${correctRatio}:1`,
              rule: 'KPI_LTV_CAC_Override',
              reason: `LTV:CAC ratio (${existingRatio}:1) deviates >20% from computed ${correctRatio}:1. Overriding.`,
            });
            return { ...kpi, target: `${correctRatio}:1` };
          }
        }
      }
    }

    // Check 6: Flag benchmark description that contradicts the target value.
    // Generic check — applies to any KPI with a numeric "Nx" in the target and benchmark.
    const targetNumMatch = kpi.target.match(/(\d+\.?\d*)\s*x/i);
    if (targetNumMatch && kpi.benchmark) {
      const targetValue = parseFloat(targetNumMatch[1]);
      // Extract "Nx" patterns from benchmark text (e.g., "~2.2x", "3.5x")
      const benchmarkMatches = kpi.benchmark.match(/~?(\d+\.?\d*)\s*x/gi);
      if (benchmarkMatches && targetValue > 0) {
        for (const bMatch of benchmarkMatches) {
          const benchValue = parseFloat(bMatch.replace(/[~x]/gi, ''));
          if (isNaN(benchValue) || benchValue <= 0) continue;
          const deviation = Math.abs(benchValue - targetValue) / targetValue;
          if (deviation > 0.50) {
            overrides.push({
              field: `kpiTargets.${kpi.metric}.benchmark`,
              originalValue: kpi.benchmark,
              adjustedValue: kpi.benchmark.replace(bMatch, `${targetValue}x`),
              rule: 'KPI_Benchmark_Contradiction',
              reason: `${kpi.metric}: benchmark text contains "${bMatch}" which contradicts target ${targetValue}x (${Math.round(deviation * 100)}% deviation). Replaced with target value.`,
            });
            kpi = { ...kpi, benchmark: kpi.benchmark.replace(bMatch, `${targetValue}x`) };
          }
        }
      }
    }

    return kpi;
  });

  return { kpiTargets: fixed, overrides };
}

/**
 * Check timeline consistency between executive summary and Phase 1 duration.
 * WARNING only — does not auto-fix text fields.
 * Must run AFTER Phase 3 synthesis (executive summary won't exist before then).
 */
export function reconcileTimeline(
  executiveSummary: { timelineToResults?: string },
  campaignPhases: CampaignPhase[],
): string[] {
  const warnings: string[] = [];

  const timeline = executiveSummary.timelineToResults;
  const phase1Duration = campaignPhases[0]?.durationWeeks;

  if (timeline == null || phase1Duration == null) return warnings;

  // Parse week numbers from timeline string
  // Common formats: "4-6 weeks", "4 weeks", "within 6 weeks", "90 days"
  const weekMatches = timeline.match(/(\d+)\s*(?:week|wk)/gi);
  const dayMatches = timeline.match(/(\d+)\s*(?:day)/gi);

  let maxStatedWeeks = 0;

  if (weekMatches && weekMatches.length > 0) {
    const weeks = weekMatches.map(m => {
      const num = m.match(/(\d+)/);
      return num ? parseInt(num[1], 10) : 0;
    });
    maxStatedWeeks = Math.max(...weeks);
  } else if (dayMatches && dayMatches.length > 0) {
    // Convert days to weeks
    const days = dayMatches.map(m => {
      const num = m.match(/(\d+)/);
      return num ? parseInt(num[1], 10) : 0;
    });
    maxStatedWeeks = Math.round(Math.max(...days) / 7);
  }

  if (maxStatedWeeks <= 0) return warnings;

  // Phase 1 duration should not exceed stated timeline by more than 2 weeks
  if (phase1Duration > maxStatedWeeks + 2) {
    warnings.push(
      `Timeline mismatch: Executive summary says "${timeline}" but Phase 1 duration is ${phase1Duration} weeks. ` +
      `Consider adjusting executive summary timeline to match Phase 1 or explaining the gap.`,
    );
  }

  return warnings;
}

// =============================================================================
// Phase Budget Validation
// =============================================================================

/**
 * Validate and fix campaign phase budgets.
 * Rules:
 * 1. Each phase's implied daily spend must not exceed dailyCeiling.
 * 2. Campaign daily × duration reconciliation — phase budgets must be consistent
 *    with campaign daily spend rates (±10%). Auto-fixes when campaigns provided.
 * 3. Total phase budgets should approximately match totalMonthlyBudget (±2%).
 * 4. Phase progression warning — daily spend should increase from testing to scale
 *    to optimization (warning only, no auto-fix).
 */
export function validatePhaseBudgets(
  campaignPhases: CampaignPhase[],
  totalMonthlyBudget: number,
  dailyCeiling: number,
  campaigns?: CampaignTemplate[],
): { phases: CampaignPhase[]; adjustments: ValidationAdjustment[] } {
  const adjustments: ValidationAdjustment[] = [];
  let fixedPhases = campaignPhases.map(p => ({ ...p }));

  // Rule 1: Cap each phase's implied daily spend at dailyCeiling
  fixedPhases = fixedPhases.map(phase => {
    const phaseDays = phase.durationWeeks * 7;
    const impliedDailySpend = phase.estimatedBudget / phaseDays;

    if (impliedDailySpend > dailyCeiling) {
      const cappedBudget = Math.round(dailyCeiling * phaseDays);
      adjustments.push({
        field: `campaignPhases.${phase.name}.estimatedBudget`,
        originalValue: phase.estimatedBudget,
        adjustedValue: cappedBudget,
        rule: 'PhaseBudget_DailyCeilCap',
        reason: `Phase "${phase.name}" implied daily spend ($${Math.round(impliedDailySpend)}/day) exceeds daily ceiling ($${dailyCeiling}/day). Capped estimatedBudget from $${phase.estimatedBudget} to $${cappedBudget}.`,
      });
      return { ...phase, estimatedBudget: cappedBudget };
    }
    return phase;
  });

  // Rule 2: Campaign daily × duration reconciliation
  // When campaign data is available, verify that each phase's stated budget is
  // consistent with what campaign daily budgets would actually cost over the
  // phase duration. Auto-fix by adjusting estimatedBudget to match campaign
  // daily rates; Rule 3 (total normalization) will re-normalize after.
  if (campaigns && campaigns.length > 0) {
    const totalCampaignDaily = campaigns.reduce((sum, c) => sum + c.dailyBudget, 0);

    if (totalCampaignDaily > 0) {
      fixedPhases = fixedPhases.map(phase => {
        const phaseDays = phase.durationWeeks * 7;
        if (phaseDays <= 0 || phase.estimatedBudget <= 0) return phase;

        const phaseImpliedDaily = phase.estimatedBudget / phaseDays;
        const impliedBudgetFromCampaigns = totalCampaignDaily * phaseDays;
        const discrepancy = Math.abs(impliedBudgetFromCampaigns - phase.estimatedBudget) / phase.estimatedBudget;

        if (discrepancy > 0.10) {
          const correctedBudget = Math.round(impliedBudgetFromCampaigns);
          adjustments.push({
            field: `campaignPhases.${phase.name}.estimatedBudget`,
            originalValue: phase.estimatedBudget,
            adjustedValue: correctedBudget,
            rule: 'PhaseBudget_DailyDurationReconcile',
            reason: `Phase "${phase.name}" budget ($${phase.estimatedBudget} over ${phaseDays} days = $${Math.round(phaseImpliedDaily)}/day) is inconsistent with campaign daily budgets ($${Math.round(totalCampaignDaily)}/day × ${phaseDays} days = $${correctedBudget}). Adjusted estimatedBudget to match campaign daily rates.`,
          });
          return { ...phase, estimatedBudget: correctedBudget };
        }
        return phase;
      });
    }
  }

  // Rule 3: Total phase spend should match budget × total duration
  // When phases span multiple months, the total budget should scale accordingly
  // (e.g., 3 phases spanning 12 weeks at $15K/mo should total ~$42K, not $15K)
  const totalPhaseBudget = fixedPhases.reduce((sum, p) => sum + p.estimatedBudget, 0);
  if (totalPhaseBudget > 0) {
    const totalPhaseDays = fixedPhases.reduce((sum, p) => sum + (p.durationWeeks * 7), 0);
    const totalPhaseMonths = totalPhaseDays / 30;

    if (totalPhaseMonths > 1.5) {
      // Multi-month plan: total budget should scale with duration
      const expectedTotalSpend = Math.round(totalMonthlyBudget * totalPhaseMonths);
      const deviation = Math.abs(totalPhaseBudget - expectedTotalSpend) / expectedTotalSpend;

      if (deviation > 0.15) {
        const scaleFactor = expectedTotalSpend / totalPhaseBudget;
        fixedPhases = fixedPhases.map(p => ({
          ...p,
          estimatedBudget: Math.round(p.estimatedBudget * scaleFactor),
        }));

        adjustments.push({
          field: 'campaignPhases.budgetPercentage',
          originalValue: totalPhaseBudget,
          adjustedValue: expectedTotalSpend,
          rule: 'PhaseBudget_MultiMonthScale',
          reason: `Phase budgets total $${totalPhaseBudget} but phases span ${totalPhaseDays} days (~${totalPhaseMonths.toFixed(1)} months). At $${totalMonthlyBudget}/mo, expected total ~$${expectedTotalSpend}. Scaled phase budgets proportionally.`,
        });
      }
    } else {
      // Single-month plan: total should match monthly budget (±2%)
      const budgetRatio = (totalPhaseBudget / totalMonthlyBudget) * 100;
      if (Math.abs(budgetRatio - 100) > 2) {
        const scale = totalMonthlyBudget / totalPhaseBudget;
        fixedPhases = fixedPhases.map(p => ({
          ...p,
          estimatedBudget: Math.round(p.estimatedBudget * scale),
        }));

        adjustments.push({
          field: 'campaignPhases.budgetPercentage',
          originalValue: Math.round(budgetRatio * 10) / 10,
          adjustedValue: 100,
          rule: 'PhaseBudget_PctNormalize',
          reason: `Phase budgets totaled $${totalPhaseBudget} (${budgetRatio.toFixed(1)}% of monthly budget $${totalMonthlyBudget}). Proportionally scaled to 100%.`,
        });
      }
    }
  }

  // Rule 4: Phase daily spend progression warning (testing → scale → optimize)
  // Phases should generally show increasing daily spend as campaigns move from
  // testing to scaling to optimization. Warn when daily spend decreases but do
  // NOT auto-fix — there are legitimate cases (e.g., optimization phase reduces
  // spend while maintaining efficiency).
  if (fixedPhases.length >= 2) {
    const sorted = [...fixedPhases].sort((a, b) => a.phase - b.phase);
    for (let i = 1; i < sorted.length; i++) {
      const prevDays = sorted[i - 1].durationWeeks * 7;
      const currDays = sorted[i].durationWeeks * 7;
      if (prevDays <= 0 || currDays <= 0) continue;

      const prevDaily = sorted[i - 1].estimatedBudget / prevDays;
      const currDaily = sorted[i].estimatedBudget / currDays;

      if (currDaily < prevDaily) {
        adjustments.push({
          field: 'campaignPhases.progression',
          originalValue: Math.round(prevDaily),
          adjustedValue: Math.round(currDaily),
          rule: 'PhaseBudget_ProgressionWarn',
          reason: `Phase ${sorted[i].phase} "${sorted[i].name}" daily spend ($${Math.round(currDaily)}/day) is lower than Phase ${sorted[i - 1].phase} "${sorted[i - 1].name}" ($${Math.round(prevDaily)}/day). Expected increasing progression from testing to scale to optimization.`,
        });
      }
    }
  }

  return { phases: fixedPhases, adjustments };
}

// =============================================================================
// Resolved Targets Builder
// =============================================================================

/**
 * Map CACModel fields into a flat ResolvedTargets shape for downstream consumers.
 * Pure mapping — no computation needed.
 */
export function buildResolvedTargets(
  cacModel: CACModel,
  monthlyBudget: number,
): ResolvedTargets {
  return {
    monthlyBudget,
    cpl: cacModel.targetCPL,
    cac: cacModel.targetCAC,
    leadsPerMonth: cacModel.expectedMonthlyLeads,
    sqlsPerMonth: cacModel.expectedMonthlySQLs,
    customersPerMonth: cacModel.expectedMonthlyCustomers,
    leadToSqlRate: cacModel.leadToSqlRate,
    sqlToCustomerRate: cacModel.sqlToCustomerRate,
    ltvCacRatio: cacModel.ltvToCacRatio,
    estimatedLtv: cacModel.estimatedLTV,
  };
}

// =============================================================================
// Within-Platform Campaign Budget Percentage Validation
// =============================================================================

/**
 * Expected campaign budget percentages within each platform.
 * Based on MB1 proven templates — the synthesis prompt guides the AI to follow
 * these ranges, and this validator is the post-generation safety net.
 *
 * Only covers LinkedIn, Google, and Meta — platforms with proven template data.
 * Platforms like TikTok, Reddit, YouTube standalone are intentionally omitted.
 */
const PLATFORM_CAMPAIGN_BUDGET_RULES: Record<string, {
  campaigns: { match: string[]; min: number; max: number; label: string }[];
}> = {
  linkedin: {
    campaigns: [
      { match: ['ctv', 'awareness', 'video views', 'brand'], min: 0.08, max: 0.18, label: 'CTV/Awareness' },
      { match: ['prospecting', 'lead gen', 'leadgen'], min: 0.45, max: 0.65, label: 'Prospecting Lead Gen' },
      { match: ['mofu', 'thought leadership', 'mid-funnel', 'mid funnel'], min: 0.12, max: 0.25, label: 'MoFu Thought Leadership' },
      { match: ['retargeting', 'remarketing', 'conversation'], min: 0.08, max: 0.18, label: 'Retargeting' },
    ],
  },
  google: {
    campaigns: [
      { match: ['brand', 'branded'], min: 0.08, max: 0.18, label: 'Brand' },
      { match: ['competitor', 'comp branded', 'alternative'], min: 0.20, max: 0.40, label: 'Competitor Branded' },
      { match: ['non-branded', 'non branded', 'solution', 'high-intent', 'high intent'], min: 0.30, max: 0.50, label: 'Non-Branded Search' },
      { match: ['display', 'remarketing', 'retargeting', 'youtube'], min: 0.08, max: 0.18, label: 'Display/Remarketing' },
    ],
  },
  meta: {
    campaigns: [
      { match: ['lead gen', 'leadgen', 'lead form'], min: 0.45, max: 0.65, label: 'Lead Gen Form' },
      { match: ['conversion', 'website', 'traffic'], min: 0.25, max: 0.45, label: 'Website Conversions' },
      { match: ['awareness', 'video', 'brand'], min: 0.05, max: 0.15, label: 'Awareness' },
    ],
  },
};

/**
 * Validate that campaign budget splits within each platform follow MB1 template ranges.
 * Checks each campaign's share of its platform's total daily budget against expected
 * percentage ranges. Auto-fixes by clamping to min/max and proportionally rebalancing.
 *
 * Graceful handling:
 * - Platforms not in rules (TikTok, Reddit, etc.) are skipped entirely
 * - Platforms with only 1 campaign are skipped (nothing to compare)
 * - Campaigns that don't match any rule keyword are skipped (no warning)
 * - Zero-budget campaigns/platforms are skipped
 */
export function validateWithinPlatformBudgets(
  campaignStructure: CampaignStructure,
): { campaignStructure: CampaignStructure; adjustments: ValidationAdjustment[]; warnings: string[] } {
  const adjustments: ValidationAdjustment[] = [];
  const warnings: string[] = [];
  const fixedCampaigns = campaignStructure.campaigns.map(c => ({ ...c }));

  // Group campaign indices by platform (lowercase)
  const platformGroups: Record<string, number[]> = {};
  for (let i = 0; i < fixedCampaigns.length; i++) {
    const plat = fixedCampaigns[i].platform.toLowerCase();
    if (!platformGroups[plat]) platformGroups[plat] = [];
    platformGroups[plat].push(i);
  }

  for (const [platform, indices] of Object.entries(platformGroups)) {
    // Skip platforms with only 1 campaign — nothing to compare
    if (indices.length < 2) continue;

    // Look up rules — try exact match first, then check if platform starts with a known key
    // (handles "google ads" matching "google")
    let rules = PLATFORM_CAMPAIGN_BUDGET_RULES[platform];
    if (!rules) {
      const matchedKey = Object.keys(PLATFORM_CAMPAIGN_BUDGET_RULES).find(key =>
        platform.startsWith(key) || platform.includes(key),
      );
      if (matchedKey) rules = PLATFORM_CAMPAIGN_BUDGET_RULES[matchedKey];
    }
    if (!rules) continue; // Platform not in our templates — skip

    // Calculate total daily budget for this platform
    const platformDailyTotal = indices.reduce((sum, i) => sum + fixedCampaigns[i].dailyBudget, 0);
    if (platformDailyTotal <= 0) continue;

    let needsRebalance = false;

    for (const idx of indices) {
      const campaign = fixedCampaigns[idx];
      if (campaign.dailyBudget <= 0) continue;

      const campaignShare = campaign.dailyBudget / platformDailyTotal;
      const nameLC = campaign.name.toLowerCase();
      const objectiveLC = (campaign.objective ?? '').toLowerCase();

      // Match by name first (more specific), then objective as fallback.
      // This prevents a retargeting campaign with objective "Lead Generation"
      // from matching the Prospecting rule before the Retargeting rule.
      const nameMatch = rules.campaigns.find(rule =>
        rule.match.some(keyword => nameLC.includes(keyword)),
      );
      const objectiveMatch = !nameMatch ? rules.campaigns.find(rule =>
        rule.match.some(keyword => objectiveLC.includes(keyword)),
      ) : null;
      const matchedRule = nameMatch || objectiveMatch;

      if (!matchedRule) continue; // No matching rule — skip silently

      if (campaignShare < matchedRule.min) {
        const pct = Math.round(campaignShare * 100);
        const minPct = Math.round(matchedRule.min * 100);
        warnings.push(
          `${platform} "${campaign.name}": budget share ${pct}% is below recommended minimum ${minPct}% for ${matchedRule.label} campaigns.`,
        );
        fixedCampaigns[idx] = { ...campaign, dailyBudget: Math.round(platformDailyTotal * matchedRule.min) };
        needsRebalance = true;
      } else if (campaignShare > matchedRule.max) {
        const pct = Math.round(campaignShare * 100);
        const maxPct = Math.round(matchedRule.max * 100);
        warnings.push(
          `${platform} "${campaign.name}": budget share ${pct}% exceeds recommended maximum ${maxPct}% for ${matchedRule.label} campaigns.`,
        );
        fixedCampaigns[idx] = { ...campaign, dailyBudget: Math.round(platformDailyTotal * matchedRule.max) };
        needsRebalance = true;
      }
    }

    // Rebalance so campaigns still sum to the original platform daily total
    if (needsRebalance) {
      const currentTotal = indices.reduce((sum, i) => sum + fixedCampaigns[i].dailyBudget, 0);
      if (currentTotal > 0 && currentTotal !== platformDailyTotal) {
        const scaleFactor = platformDailyTotal / currentTotal;
        for (const idx of indices) {
          fixedCampaigns[idx] = {
            ...fixedCampaigns[idx],
            dailyBudget: Math.round(fixedCampaigns[idx].dailyBudget * scaleFactor),
          };
        }
      }

      adjustments.push({
        field: `campaignStructure.campaigns.${platform}.budgetSplit`,
        originalValue: indices.map(i => `${campaignStructure.campaigns[i].name}=$${campaignStructure.campaigns[i].dailyBudget}`).join(', '),
        adjustedValue: indices.map(i => `${fixedCampaigns[i].name}=$${fixedCampaigns[i].dailyBudget}`).join(', '),
        rule: 'WithinPlatform_BudgetSplit',
        reason: `${platform} campaign budget percentages adjusted to match MB1 template ranges. Total platform daily budget preserved at $${platformDailyTotal}.`,
      });
    }
  }

  return {
    campaignStructure: { ...campaignStructure, campaigns: fixedCampaigns },
    adjustments,
    warnings,
  };
}

// =============================================================================
// Per-Platform Daily Budget Validation
// =============================================================================

/**
 * Validate that campaign daily budgets within each platform sum to approximately
 * match the platform's monthly allocation (monthlySpend / 30).
 * Catches cases like Google campaigns summing to $139/day when Google's monthly
 * is $2,250 ($75/day) — an 85% overshoot.
 *
 * Auto-fixes by proportionally scaling campaign dailyBudgets for the platform,
 * then adjusting the largest campaign to absorb rounding drift.
 */
export function validatePerPlatformDailyBudgets(
  platformStrategy: PlatformStrategy[],
  campaignStructure: CampaignStructure,
  warnings: string[],
): CampaignStructure {
  const fixedCampaigns = campaignStructure.campaigns.map(c => ({ ...c }));

  for (const platform of platformStrategy) {
    const dailyCeiling = Math.round(platform.monthlySpend / 30);
    if (dailyCeiling <= 0) continue;

    const platformNameLC = platform.platform.toLowerCase();

    // Find campaign indices that belong to this platform
    const indices: number[] = [];
    for (let i = 0; i < fixedCampaigns.length; i++) {
      const campaignPlatLC = fixedCampaigns[i].platform.toLowerCase();
      if (
        campaignPlatLC === platformNameLC ||
        campaignPlatLC.includes(platformNameLC) ||
        platformNameLC.includes(campaignPlatLC)
      ) {
        indices.push(i);
      }
    }

    if (indices.length === 0) continue;

    const sumDaily = indices.reduce((sum, i) => sum + fixedCampaigns[i].dailyBudget, 0);
    if (sumDaily <= 0) continue;

    const deviation = Math.abs(sumDaily - dailyCeiling) / dailyCeiling;
    if (deviation <= 0.10) continue; // within 10% tolerance

    const direction = sumDaily > dailyCeiling ? 'over' : 'under';
    warnings.push(
      `Per-platform daily budget: ${platform.platform} campaigns sum to $${sumDaily}/day but platform monthly $${platform.monthlySpend} implies $${dailyCeiling}/day (${Math.round(deviation * 100)}% ${direction}). Scaled proportionally.`,
    );

    // Proportionally scale all campaign dailyBudgets for this platform
    const scaleFactor = dailyCeiling / sumDaily;
    for (const idx of indices) {
      fixedCampaigns[idx] = {
        ...fixedCampaigns[idx],
        dailyBudget: Math.round(fixedCampaigns[idx].dailyBudget * scaleFactor),
      };
    }

    // Fix rounding drift: adjust the largest campaign
    const scaledSum = indices.reduce((sum, i) => sum + fixedCampaigns[i].dailyBudget, 0);
    if (scaledSum !== dailyCeiling) {
      const largestIdx = indices.reduce((maxIdx, i) =>
        fixedCampaigns[i].dailyBudget > fixedCampaigns[maxIdx].dailyBudget ? i : maxIdx,
        indices[0],
      );
      fixedCampaigns[largestIdx] = {
        ...fixedCampaigns[largestIdx],
        dailyBudget: fixedCampaigns[largestIdx].dailyBudget + (dailyCeiling - scaledSum),
      };
    }
  }

  return { ...campaignStructure, campaigns: fixedCampaigns };
}

// =============================================================================
// Campaign Naming Validation
// =============================================================================

/** Platform aliases for name matching (case-insensitive) */
const PLATFORM_ALIASES: Record<string, string[]> = {
  meta: ['meta', 'facebook'],
  google: ['google', 'google ads'],
  linkedin: ['linkedin'],
  tiktok: ['tiktok'],
  youtube: ['youtube'],
  twitter: ['twitter', 'x'],
};

/** Funnel stage aliases for name matching (case-insensitive) */
const FUNNEL_ALIASES: Record<string, string[]> = {
  cold: ['cold', 'prospecting'],
  warm: ['warm', 'retargeting'],
  hot: ['hot', 'conversion'],
};

/**
 * Validate campaign naming conventions.
 * Rules:
 * 1. Fix stale year references in campaign names.
 * 2. Warn if campaign name doesn't contain its platform (allowing aliases).
 * 3. Warn if campaign name doesn't contain funnel stage (allowing aliases).
 */
export function validateCampaignNaming(
  campaignStructure: CampaignStructure,
  generationYear?: number,
): { campaignStructure: CampaignStructure; adjustments: ValidationAdjustment[] } {
  const adjustments: ValidationAdjustment[] = [];
  const currentYear = generationYear ?? new Date().getFullYear();

  const fixedCampaigns = campaignStructure.campaigns.map(campaign => {
    let fixedName = campaign.name;

    // Rule 1: Fix stale year references
    // Use (?:_|\b) to match years preceded by underscore (common in campaign names
    // like "ClientName_LI_LeadGen_2025") since \b fails between _ and digits.
    const yearMatch = fixedName.match(/(?:_|\b)(20\d{2})(?:$|\b)/);
    if (yearMatch) {
      const foundYear = parseInt(yearMatch[1], 10);
      if (foundYear !== currentYear) {
        fixedName = fixedName.replace(/((?:_|\b))20\d{2}(?=$|\b)/, `$1${currentYear}`);
        adjustments.push({
          field: `campaignStructure.campaigns.${campaign.name}.name`,
          originalValue: campaign.name,
          adjustedValue: fixedName,
          rule: 'CampaignNaming_YearFix',
          reason: `Campaign name contained stale year ${foundYear}, replaced with current year ${currentYear}.`,
        });
      }
    }

    // Rule 2: Warn if campaign name doesn't contain its platform
    const campaignPlatform = campaign.platform.toLowerCase();
    const platformMatch = Object.entries(PLATFORM_ALIASES).find(
      ([key, aliases]) => key === campaignPlatform || aliases.includes(campaignPlatform),
    );
    const allPlatformAliases = platformMatch ? platformMatch[1] : [campaignPlatform];
    const nameLC = fixedName.toLowerCase();
    if (!allPlatformAliases.some(alias => nameLC.includes(alias))) {
      adjustments.push({
        field: `campaignStructure.campaigns.${campaign.name}.name`,
        originalValue: fixedName,
        adjustedValue: fixedName, // warning only
        rule: 'CampaignNaming_PlatformWarn',
        reason: `Campaign "${fixedName}" does not contain platform "${campaign.platform}" or its aliases in the name.`,
      });
    }

    // Rule 3: Warn if campaign name doesn't contain funnel stage
    const campaignFunnel = campaign.funnelStage.toLowerCase();
    const funnelMatch = Object.entries(FUNNEL_ALIASES).find(
      ([key, aliases]) => key === campaignFunnel || aliases.includes(campaignFunnel),
    );
    const allFunnelAliases = funnelMatch ? funnelMatch[1] : [campaignFunnel];
    if (!allFunnelAliases.some(alias => nameLC.includes(alias))) {
      adjustments.push({
        field: `campaignStructure.campaigns.${campaign.name}.name`,
        originalValue: fixedName,
        adjustedValue: fixedName, // warning only
        rule: 'CampaignNaming_FunnelWarn',
        reason: `Campaign "${fixedName}" does not contain funnel stage "${campaign.funnelStage}" or its aliases in the name.`,
      });
    }

    return { ...campaign, name: fixedName };
  });

  return {
    campaignStructure: { ...campaignStructure, campaigns: fixedCampaigns },
    adjustments,
  };
}

// =============================================================================
// Retargeting Pool Realism Validation
// =============================================================================

/**
 * Validate retargeting campaigns are realistic given existing traffic.
 * Only applies when BOTH hasExistingPaidTraffic === false AND hasOrganicKeywords === false.
 */
export function validateRetargetingPoolRealism(
  input: RetargetingValidationInput,
): { campaignStructure: CampaignStructure; campaignPhases: CampaignPhase[]; adjustments: ValidationAdjustment[]; warnings: string[] } {
  const { campaignStructure, campaignPhases, hasExistingPaidTraffic, hasOrganicKeywords } = input;
  const adjustments: ValidationAdjustment[] = [];
  const warnings: string[] = [];

  // Only apply when there is no existing traffic at all
  if (hasExistingPaidTraffic || hasOrganicKeywords) {
    return { campaignStructure, campaignPhases, adjustments, warnings };
  }

  const retargetingNote = ' | Note: Activates once cold campaigns generate sufficient traffic pool (estimated Week 3-4)';

  // Find and annotate warm/retargeting campaigns
  const fixedCampaigns = campaignStructure.campaigns.map(campaign => {
    const funnelLC = campaign.funnelStage.toLowerCase();
    const isRetargeting = funnelLC.includes('warm') || funnelLC.includes('retargeting');

    if (isRetargeting && !campaign.objective.includes('Activates once cold campaigns')) {
      adjustments.push({
        field: `campaignStructure.campaigns.${campaign.name}.objective`,
        originalValue: campaign.objective,
        adjustedValue: campaign.objective + retargetingNote,
        rule: 'Retargeting_PoolRealism',
        reason: `No existing paid traffic or organic keywords. Retargeting campaign "${campaign.name}" needs cold traffic pool built first.`,
      });

      return { ...campaign, objective: campaign.objective + retargetingNote };
    }

    return campaign;
  });

  warnings.push(
    'No existing paid traffic or organic keywords detected. Retargeting/warm campaigns will need 2-4 weeks of cold campaign traffic before they can effectively scale.',
  );

  return {
    campaignStructure: { ...campaignStructure, campaigns: fixedCampaigns },
    campaignPhases: campaignPhases.map(p => ({ ...p })),
    adjustments,
    warnings,
  };
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

// =============================================================================
// ACV + Platform Minimum Compliance Validation
// =============================================================================

export interface PlatformComplianceResult {
  platformStrategy: PlatformStrategy[];
  campaignStructure: CampaignStructure;
  adjustments: ValidationAdjustment[];
  warnings: string[];
}

/**
 * Platform minimum budgets from MB1 proven rules.
 * Platforms below these thresholds should be flagged "experimental test only".
 */
const PLATFORM_MINIMUM_BUDGETS: Record<string, number> = {
  meta: 3000,
  linkedin: 5000,
  google: 5000,
};

/**
 * Calculate Annual Contract Value from onboarding data.
 * Monthly pricing → multiply by 12. Annual → use directly. Fallback to 0.
 */
export function calculateACV(onboarding: OnboardingFormData): number {
  const price = onboarding.productOffer.offerPrice;
  if (!price || price <= 0) return 0;

  const models = onboarding.productOffer.pricingModel.map(m => m.toLowerCase());

  // If any model is annual/yearly, treat offerPrice as annual
  if (models.some(m => m.includes('annual') || m.includes('yearly'))) {
    return price;
  }
  // If one-time, it IS the ACV (no recurring)
  if (models.some(m => m.includes('one_time') || m.includes('onetime'))) {
    return price;
  }
  // Default: monthly → annualize
  return price * 12;
}

/**
 * Parse the largest company size from the ICP companySize array.
 * Returns the upper bound of the largest range (e.g., "201-1000" → 1000, "1000+" → 1001).
 */
function parseMaxCompanySize(companySizes: string[]): number {
  let max = 0;
  for (const size of companySizes) {
    if (size === '1000+') { max = Math.max(max, 1001); continue; }
    const match = size.match(/(\d+)/g);
    if (match) {
      const nums = match.map(Number);
      max = Math.max(max, ...nums);
    }
  }
  return max;
}

/**
 * Validate platform compliance against ACV rules and minimum budget thresholds.
 *
 * ACV Rules (from MB1):
 * - ACV > $5,000 → Meta cold campaigns NOT recommended (retargeting only)
 * - ACV < $3,000 → LinkedIn NOT recommended (CPL exceeds ROI threshold)
 * - Enterprise (1000+ employees) → Meta typically underperforms
 *
 * Platform Minimums:
 * - Meta: $3,000/mo
 * - Google: $5,000/mo
 * - LinkedIn: $5,000/mo
 *
 * Auto-fixes: relabels Meta cold→warm campaigns when ACV > $5K.
 * Warnings only for LinkedIn/enterprise/minimum issues — human reviewer decides.
 */
export function validatePlatformCompliance(
  platformStrategy: PlatformStrategy[],
  campaignStructure: CampaignStructure,
  onboarding: OnboardingFormData,
): PlatformComplianceResult {
  const adjustments: ValidationAdjustment[] = [];
  const warnings: string[] = [];
  const fixedPlatforms = platformStrategy.map(p => ({ ...p }));
  const fixedCampaigns = campaignStructure.campaigns.map(c => ({ ...c }));

  const acv = calculateACV(onboarding);
  const maxCompanySize = parseMaxCompanySize(onboarding.icp.companySize);

  console.log(`[PlatformCompliance] ACV=$${acv}, maxCompanySize=${maxCompanySize}, campaigns=${fixedCampaigns.length}`);

  // Skip ACV checks if we can't determine ACV (no offer price)
  if (acv > 0) {
    // ── ACV > $5,000 → Meta cold traffic NOT recommended ──
    if (acv > 5000) {
      const metaColdIndices: number[] = [];
      for (let i = 0; i < fixedCampaigns.length; i++) {
        const c = fixedCampaigns[i];
        // Case-insensitive funnelStage check (defensive — Zod should enforce lowercase)
        if (c.platform.toLowerCase().includes('meta') && c.funnelStage.toLowerCase() === 'cold') {
          metaColdIndices.push(i);
        }
      }

      console.log(`[PlatformCompliance] ACV > $5K: found ${metaColdIndices.length} Meta cold campaign(s)`);

      if (metaColdIndices.length > 0) {
        const campaignNames = metaColdIndices.map(i => fixedCampaigns[i].name);
        warnings.push(
          `ACV RULE VIOLATION: Client ACV is $${acv.toLocaleString()}/yr (>$5,000). ` +
          `Meta should be retargeting-only, but ${metaColdIndices.length} cold campaign(s) found: ` +
          `${campaignNames.join(', ')}. ` +
          `Relabeled to warm/retargeting. Review and confirm override if cold Meta is intentional.`,
        );

        // Auto-fix: relabel cold Meta campaigns to warm + rename + update ad sets
        for (const idx of metaColdIndices) {
          const original = fixedCampaigns[idx];
          // Update campaign name: replace cold-related patterns with warm/retargeting equivalents
          let fixedName = original.name;
          fixedName = fixedName.replace(/\bcold\b/gi, 'Warm');
          fixedName = fixedName.replace(/_Cold_/g, '_Warm_');
          fixedName = fixedName.replace(/\bProspecting\b/gi, 'Retargeting');
          fixedName = fixedName.replace(/_Prospecting_/g, '_Retargeting_');
          fixedName = fixedName.replace(/_Interest_/g, '_Retargeting_');
          fixedName = fixedName.replace(/LeadGen_Interest/gi, 'Retargeting_Warm');
          fixedName = fixedName.replace(/LeadGen_Cold/gi, 'Retargeting_Warm');

          adjustments.push({
            field: `campaignStructure.campaigns.${original.name}.funnelStage`,
            originalValue: 'cold',
            adjustedValue: 'warm',
            rule: 'ACV_MetaColdGate',
            reason: `Client ACV $${acv.toLocaleString()}/yr exceeds $5,000 threshold. Meta cold traffic not recommended. Campaign relabeled to warm/retargeting. Shift targeting to website visitors, video viewers, LinkedIn engagers, and lookalikes of converters.`,
          });
          if (fixedName !== original.name) {
            adjustments.push({
              field: `campaignStructure.campaigns.${original.name}.name`,
              originalValue: original.name,
              adjustedValue: fixedName,
              rule: 'ACV_MetaColdGate_Rename',
              reason: `Campaign name updated to reflect warm/retargeting relabel (was: "${original.name}").`,
            });
          }

          // Update ad sets to reflect warm targeting (deep copy + fix names/targeting)
          const fixedAdSets = (original.adSets || []).map(adSet => {
            let fixedAdSetName = adSet.name;
            let fixedTargeting = adSet.targeting;

            if (/interest|cold|prospecting/i.test(fixedAdSetName)) {
              fixedAdSetName = fixedAdSetName
                .replace(/Interest/gi, 'Retargeting')
                .replace(/Cold/gi, 'Warm')
                .replace(/Prospecting/gi, 'Retargeting');
            }
            if (/interest.based|cold|prospecting/i.test(fixedTargeting)) {
              fixedTargeting = `[ACV Override: Warm audiences only — website visitors, video viewers, LinkedIn engagers, lookalikes of converters] ${fixedTargeting}`;
            }

            return { ...adSet, name: fixedAdSetName, targeting: fixedTargeting };
          });

          fixedCampaigns[idx] = {
            ...original,
            name: fixedName,
            funnelStage: 'warm',
            adSets: fixedAdSets,
            notes: (original.notes ? original.notes + ' ' : '') +
              `[ACV Override: Client ACV >$5K ($${acv.toLocaleString()}/yr). Meta cold traffic not recommended per MB1 rules. ` +
              `Campaign repurposed for warm/retargeting audiences. Shift interest targeting to lookalike of website visitors and LinkedIn engagers.]`,
          };
          console.log(`[PlatformCompliance] Relabeled Meta campaign "${original.name}" → "${fixedName}" (cold→warm, ${fixedAdSets.length} ad sets updated)`);
        }
      }
    }

    // ── ACV < $3,000 → LinkedIn NOT recommended ──
    if (acv < 3000) {
      const hasLinkedIn = fixedPlatforms.some(p => p.platform.toLowerCase().includes('linkedin'));
      if (hasLinkedIn) {
        warnings.push(
          `ACV RULE WARNING: Client ACV is $${acv.toLocaleString()}/yr (<$3,000). ` +
          `LinkedIn CPL typically exceeds ROI threshold for low-ACV offers. ` +
          `Consider reallocating LinkedIn budget to Meta + Google.`,
        );
      }
    }
  }

  // ── Enterprise (1000+ employees) → Meta warning ──
  // Only triggers when "1000+" is in the companySize array (parsed as 1001)
  if (maxCompanySize > 1000) {
    const hasMeta = fixedPlatforms.some(p => p.platform.toLowerCase().includes('meta'));
    if (hasMeta) {
      warnings.push(
        `COMPANY SIZE WARNING: ICP targets ${maxCompanySize >= 1001 ? '1000+' : maxCompanySize}+ employees (enterprise). ` +
        `Meta typically underperforms for enterprise B2B targeting. ` +
        `Consider reallocating to LinkedIn + Google.`,
      );
    }
  }

  // ── Platform Minimum Budget Flags ──
  for (let i = 0; i < fixedPlatforms.length; i++) {
    const platform = fixedPlatforms[i];
    const pNameLC = platform.platform.toLowerCase();
    const monthly = platform.monthlySpend;
    if (monthly <= 0) continue;

    for (const [key, minimum] of Object.entries(PLATFORM_MINIMUM_BUDGETS)) {
      if (pNameLC.includes(key) && monthly < minimum) {
        warnings.push(
          `BELOW PLATFORM MINIMUM: ${platform.platform} allocated $${monthly.toLocaleString()}/mo ` +
          `but recommended minimum is $${minimum.toLocaleString()}/mo. ` +
          `Results may be limited by insufficient data for optimization. ` +
          `Flagged as experimental test only.`,
        );

        adjustments.push({
          field: `platformStrategy.${platform.platform}.belowMinimum`,
          originalValue: String(platform.belowMinimum ?? false),
          adjustedValue: 'true',
          rule: 'PlatformMinimum_Flag',
          reason: `${platform.platform} allocated $${monthly.toLocaleString()}/mo, below recommended minimum $${minimum.toLocaleString()}/mo. Flagged as experimental test.`,
        });

        fixedPlatforms[i] = {
          ...platform,
          belowMinimum: true,
          rationale: `[Below recommended minimum ($${minimum.toLocaleString()}/mo) — experimental test only. Results may be limited by insufficient data for optimization.] ${platform.rationale}`,
        };

        break; // only match one minimum per platform
      }
    }
  }

  return {
    platformStrategy: fixedPlatforms,
    campaignStructure: { ...campaignStructure, campaigns: fixedCampaigns },
    adjustments,
    warnings,
  };
}

// =============================================================================
// Risk Post-Processing
// =============================================================================

/**
 * Apply deterministic P×I scoring to risk monitoring risks.
 * Computes score = probability × impact, classifies, and sorts by score descending.
 * Safe to call on media plans without numerical risk fields (no-ops gracefully).
 */
export function validateRiskMonitoring(riskMonitoring: RiskMonitoring): RiskMonitoring {
  if (!riskMonitoring.risks || riskMonitoring.risks.length === 0) {
    return riskMonitoring;
  }

  // After risk monitoring synthesis is complete, compute P×I scores deterministically
  const processedRisks = postProcessMediaPlanRisks(riskMonitoring.risks);

  return {
    ...riskMonitoring,
    risks: processedRisks as RiskMonitoring['risks'],
  };
}

// =============================================================================
// Monthly Roadmap ↔ Phase Budget Reconciliation
// =============================================================================

/**
 * Ensure monthly roadmap amounts are consistent with campaign phase budgets.
 * Budget and phases are synthesized in parallel, so they can disagree.
 *
 * Rules:
 * 1. If Phase 1 is ~1 month (3-5 weeks), Monthly Roadmap Month 1 should ≈ Phase 1 budget (±15%).
 * 2. Subsequent months should approximate their overlapping phase budgets.
 */
export function reconcileMonthlyRoadmapWithPhases(
  budgetAllocation: BudgetAllocation,
  campaignPhases: CampaignPhase[],
): { budgetAllocation: BudgetAllocation; adjustments: ValidationAdjustment[] } {
  const adjustments: ValidationAdjustment[] = [];
  if (!budgetAllocation.monthlyRoadmap?.length || !campaignPhases.length) {
    return { budgetAllocation, adjustments };
  }

  const roadmap = budgetAllocation.monthlyRoadmap.map(m => ({ ...m }));
  const sortedPhases = [...campaignPhases].sort((a, b) => a.phase - b.phase);

  // Build a month-by-month budget expectation from phases
  // Each phase has a start week (cumulative) and a duration
  let cumulativeWeeks = 0;
  const monthBudgets: number[] = [];

  for (const phase of sortedPhases) {
    const phaseStartWeek = cumulativeWeeks;
    const phaseDays = phase.durationWeeks * 7;
    const dailyRate = phase.estimatedBudget / phaseDays;

    // Distribute this phase's budget across calendar months
    for (let day = 0; day < phaseDays; day++) {
      const absoluteDay = phaseStartWeek * 7 + day;
      const monthIdx = Math.floor(absoluteDay / 30);
      while (monthBudgets.length <= monthIdx) monthBudgets.push(0);
      monthBudgets[monthIdx] += dailyRate;
    }
    cumulativeWeeks += phase.durationWeeks;
  }

  // Round
  for (let i = 0; i < monthBudgets.length; i++) {
    monthBudgets[i] = Math.round(monthBudgets[i]);
  }

  // Reconcile each roadmap month against phase-derived expectation
  for (let i = 0; i < roadmap.length && i < monthBudgets.length; i++) {
    const expected = monthBudgets[i];
    const actual = roadmap[i].budget;
    if (expected <= 0 || actual <= 0) continue;

    const deviation = Math.abs(actual - expected) / expected;
    if (deviation > 0.15) {
      adjustments.push({
        field: `budgetAllocation.monthlyRoadmap[${i}].budget`,
        originalValue: actual,
        adjustedValue: expected,
        rule: 'Roadmap_PhaseReconcile',
        reason: `Monthly Roadmap Month ${i + 1} ($${actual.toLocaleString()}) differs from phase-derived expectation ($${expected.toLocaleString()}) by ${Math.round(deviation * 100)}%. Adjusted to match phase budgets.`,
      });
      roadmap[i] = { ...roadmap[i], budget: expected };
    }
  }

  // Fix ramp-up free text: "Total Phase N: ~$X,XXX" patterns that disagree with
  // actual phase estimatedBudget. The AI writes these before validation runs.
  let fixedRampUp = budgetAllocation.rampUpStrategy;
  if (fixedRampUp && sortedPhases.length > 0) {
    // Match patterns like "Total Phase 1: ~$6,000", "Phase 1 total: $6,000",
    // "Total Phase 1 spend: ~$6K", "Total Phase 1 budget: ~$6,000 over 4 weeks"
    // Uses [^$]*? to flexibly match any text between "Phase N" and the dollar amount
    const phaseAmountPattern = /(?:Total\s+)?Phase\s+(\d)[^$]*?\$(\d[\d,]*(?:\.\d+)?[Kk]?)/gi;
    let rampMatch: RegExpExecArray | null;
    while ((rampMatch = phaseAmountPattern.exec(fixedRampUp)) !== null) {
      const phaseNum = parseInt(rampMatch[1], 10);
      let statedAmount = rampMatch[2].replace(/,/g, '');
      // Handle "6K" / "14K" shorthand
      if (/[Kk]$/.test(statedAmount)) {
        statedAmount = String(parseFloat(statedAmount.replace(/[Kk]/, '')) * 1000);
      }
      const statedValue = parseFloat(statedAmount);

      const matchingPhase = sortedPhases.find(p => p.phase === phaseNum);
      if (matchingPhase && statedValue > 0 && matchingPhase.estimatedBudget > 0) {
        const phaseDev = Math.abs(statedValue - matchingPhase.estimatedBudget) / matchingPhase.estimatedBudget;
        if (phaseDev > 0.15) {
          const correctStr = `$${matchingPhase.estimatedBudget.toLocaleString()}`;
          fixedRampUp = fixedRampUp.replace(rampMatch[0],
            rampMatch[0].replace(/~?\$(\d[\d,]*(?:\.\d+)?[Kk]?)/, correctStr));
          adjustments.push({
            field: 'budgetAllocation.rampUpStrategy',
            originalValue: rampMatch[0],
            adjustedValue: rampMatch[0].replace(/~?\$(\d[\d,]*(?:\.\d+)?[Kk]?)/, correctStr),
            rule: 'RampUp_PhaseTotalFix',
            reason: `Ramp-up text stated Phase ${phaseNum} total ~$${Math.round(statedValue).toLocaleString()} but phase estimatedBudget is $${matchingPhase.estimatedBudget.toLocaleString()} (${Math.round(phaseDev * 100)}% deviation). Corrected.`,
          });
        }
      }
    }
  }

  return {
    budgetAllocation: { ...budgetAllocation, monthlyRoadmap: roadmap, rampUpStrategy: fixedRampUp },
    adjustments,
  };
}

// =============================================================================
// Stale Reference Sweep (Post-Assembly)
// =============================================================================

/**
 * Deep walk-and-replace across the entire assembled media plan.
 * Catches stale CAC, ROAS, lead count, and LTV:CAC string references that were
 * baked into AI-generated free text BEFORE deterministic reconciliation ran.
 *
 * Only operates on string fields — numbers and booleans are untouched.
 * Returns the corrected plan + list of corrections made.
 */
export function sweepStaleReferences(
  mediaPlan: MediaPlanOutput,
  cacModel: CACModel,
  monthlyBudget: number,
  offerPrice?: number,
): { mediaPlan: MediaPlanOutput; corrections: string[] } {
  const corrections: string[] = [];
  const computedCAC = cacModel.targetCAC;
  const computedLeads = cacModel.expectedMonthlyLeads;
  const computedCustomers = cacModel.expectedMonthlyCustomers;
  const computedLTV = cacModel.estimatedLTV;

  // Compute correct LTV:CAC ratio
  const ltvCacRatio = computedCAC > 0
    ? (computedLTV / computedCAC).toFixed(1)
    : '0';

  // Compute correct monthly ROAS for stale ROAS sweep
  const price = offerPrice ?? 0;
  const correctMonthlyROAS = (monthlyBudget > 0 && computedCustomers > 0 && price > 0)
    ? Math.round((computedCustomers * price / monthlyBudget) * 100) / 100
    : 0;

  // Build correction patterns.
  // Each pattern has an optional contextPattern: if set, the pattern only fires
  // on strings where the full text matches the context regex. This prevents
  // false positives (e.g., replacing "$450" that is a CPL, not a CAC).
  type Correction = {
    pattern: RegExp;
    replacer: (match: string, ...groups: string[]) => string;
    label: string;
    contextPattern?: RegExp;
  };
  const patterns: Correction[] = [];

  // --- CAC patterns ---

  // Pattern 1: "$450 CAC", "$1,500 CAC target"
  patterns.push({
    pattern: /\$(\d[\d,]*)\s*CAC/gi,
    replacer: (_match, amount) => {
      const value = parseInt(amount.replace(/,/g, ''), 10);
      if (value > 0 && Math.abs(value - computedCAC) / computedCAC > 0.20) {
        return `$${computedCAC.toLocaleString()} CAC`;
      }
      return _match;
    },
    label: 'CAC dollar reference',
  });

  // Pattern 2: "CAC of $450", "CAC target $450", "CAC: $450"
  // Preserves the original preposition/separator (of, target, =, :)
  patterns.push({
    pattern: /CAC\s*(of|target|[=:])\s*\$(\d[\d,]*)/gi,
    replacer: (match, preposition, amount) => {
      const value = parseInt(amount.replace(/,/g, ''), 10);
      if (value > 0 && Math.abs(value - computedCAC) / computedCAC > 0.20) {
        return `CAC ${preposition} $${computedCAC.toLocaleString()}`;
      }
      return match;
    },
    label: 'CAC target reference',
  });

  // Pattern 3: "<$XXX" in CAC context — only fire if the full string mentions CAC
  // This catches KPI-style targets like "<$450" that leaked from the onboarding CAC
  patterns.push({
    pattern: /<\$(\d[\d,]*)/g,
    contextPattern: /cac|cost per acquisition|customer acquisition/i,
    replacer: (_match, amount) => {
      const value = parseInt(amount.replace(/,/g, ''), 10);
      if (value > 0 && Math.abs(value - computedCAC) / computedCAC > 0.20) {
        return `<$${computedCAC.toLocaleString()}`;
      }
      return _match;
    },
    label: 'KPI-style CAC target',
  });

  // Pattern 4: "vs. $XXX" or "vs $XXX" in CAC context
  // Range guard: only replace if the value is within 5x of computed CAC (avoids budget amounts)
  patterns.push({
    pattern: /vs\.?\s*\$(\d[\d,]*)/gi,
    contextPattern: /cac|cost per acquisition|customer acquisition/i,
    replacer: (_match, amount) => {
      const value = parseInt(amount.replace(/,/g, ''), 10);
      if (value > 0 && value < computedCAC * 5 && Math.abs(value - computedCAC) / computedCAC > 0.20) {
        return `vs. $${computedCAC.toLocaleString()}`;
      }
      return _match;
    },
    label: 'CAC vs. reference',
  });

  // Pattern 5: "below $XXX" / "under $XXX" / "at or below $XXX" in CAC context
  patterns.push({
    pattern: /(?:at\s+or\s+)?(?:below|under)\s+\$(\d[\d,]*)/gi,
    contextPattern: /cac|cost per acquisition|customer acquisition/i,
    replacer: (_match, amount) => {
      const value = parseInt(amount.replace(/,/g, ''), 10);
      if (value > 0 && Math.abs(value - computedCAC) / computedCAC > 0.20) {
        return `below $${computedCAC.toLocaleString()}`;
      }
      return _match;
    },
    label: 'CAC below/under reference',
  });

  // Pattern 6: ">$XXX" threshold in CAC context (e.g., ">$500" when CAC is $1875)
  patterns.push({
    pattern: />\$(\d[\d,]*)/g,
    contextPattern: /cac|cost per acquisition|customer acquisition/i,
    replacer: (_match, amount) => {
      const value = parseInt(amount.replace(/,/g, ''), 10);
      if (value > 0 && Math.abs(value - computedCAC) / computedCAC > 0.20) {
        return `>$${computedCAC.toLocaleString()}`;
      }
      return _match;
    },
    label: 'CAC threshold reference',
  });

  // Pattern 7: "<$XXX" WITHOUT CAC context — catches KPI target strings and
  // success criteria like "<$450". Only fires when the dollar value is within
  // 5x range of computed CAC (avoids matching CPL targets like "<$75").
  // Negative lookahead prevents replacing values followed by CPL/CPC/CTR metrics.
  patterns.push({
    pattern: /<\$(\d[\d,]*)(?!\s*(?:CPL|CPC|CTR|cost per lead|cost per click))/gi,
    replacer: (_match, amount) => {
      const value = parseInt(amount.replace(/,/g, ''), 10);
      if (value <= 0) return _match;
      // Only match values in the CAC range (within 5x), not CPL-range values
      if (value > computedCAC * 5 || value < computedCAC * 0.1) return _match;
      if (Math.abs(value - computedCAC) / computedCAC > 0.20) {
        return `<$${computedCAC.toLocaleString()}`;
      }
      return _match;
    },
    label: 'CAC-range operator target',
  });

  // --- ROAS patterns ---
  // The AI may derive ROAS from onboarding CAC (e.g., $997/$450 = 2.2x).
  // Correct ROAS = (customers × price) / budget.
  if (correctMonthlyROAS > 0) {
    patterns.push({
      pattern: /ROAS\s*>?\s*(\d+\.?\d*)x/gi,
      replacer: (_match, roasStr) => {
        const statedROAS = parseFloat(roasStr);
        if (statedROAS > 0 && Math.abs(statedROAS - correctMonthlyROAS) / Math.max(statedROAS, correctMonthlyROAS) > 0.30) {
          return `ROAS ${correctMonthlyROAS}x`;
        }
        return _match;
      },
      label: 'ROAS derived from stale CAC',
    });

    // Pattern: ">2.2x at target CAC" or "2.2x ROAS" — ROAS value near CAC context
    patterns.push({
      pattern: />?\s*(\d+\.?\d*)x\s+(?:at\s+)?(?:target\s+)?CAC/gi,
      replacer: (_match, roasStr) => {
        const statedROAS = parseFloat(roasStr);
        if (statedROAS > 0 && Math.abs(statedROAS - correctMonthlyROAS) / Math.max(statedROAS, correctMonthlyROAS) > 0.30) {
          return `${correctMonthlyROAS}x at target CAC`;
        }
        return _match;
      },
      label: 'ROAS-at-CAC reference',
    });
  }

  // --- Lead count patterns ---

  // Pattern: "NNN leads" where NNN differs >=20% from computed leads
  patterns.push({
    pattern: /(\d[\d,]*)\s*leads/gi,
    replacer: (_match, amount) => {
      const value = parseInt(amount.replace(/,/g, ''), 10);
      if (value > 0 && Math.abs(value - computedLeads) / computedLeads >= 0.20) {
        return `${computedLeads} leads`;
      }
      return _match;
    },
    label: 'lead count reference',
  });

  // --- LTV:CAC patterns ---

  // Pattern: LTV:CAC showing dollar amount (e.g., "$1,875" in LTV:CAC context)
  patterns.push({
    pattern: /LTV\s*[:/]\s*CAC\s*(?:Ratio)?\s*[|:]*\s*<?(\$\d[\d,]*)/gi,
    replacer: () => {
      return `LTV:CAC Ratio ${ltvCacRatio}:1`;
    },
    label: 'LTV:CAC dollar-as-ratio',
  });

  // --- Google Target CPA fix ---
  // Google campaigns optimize at conversion (lead) level, so Target CPA should
  // be the CPL, not the CAC. Fix "Target CPA $450" → "Target CPA $75".
  const targetCPL = cacModel.targetCPL;
  if (targetCPL > 0) {
    patterns.push({
      pattern: /Target\s+CPA\s+\$(\d[\d,]*)/gi,
      replacer: (_match, amount) => {
        const value = parseInt(amount.replace(/,/g, ''), 10);
        // Only replace if the value looks like a CAC (not already CPL-range)
        if (value > 0 && Math.abs(value - targetCPL) / targetCPL > 0.30) {
          return `Target CPA $${targetCPL.toLocaleString()}`;
        }
        return _match;
      },
      label: 'Google Target CPA (was CAC, should be CPL)',
    });
  }

  // --- Daily budget ceiling fix ---
  // Fix "$600/day budget" references that exceed the daily ceiling
  const dailyCeiling = Math.round(monthlyBudget / 30);
  if (dailyCeiling > 0) {
    patterns.push({
      pattern: /\$(\d[\d,]*)\/day\s*(budget|allocation|spend)/gi,
      replacer: (_match, amount, suffix) => {
        const value = parseInt(amount.replace(/,/g, ''), 10);
        if (value > dailyCeiling) {
          return `$${dailyCeiling}/day ${suffix}`;
        }
        return _match;
      },
      label: 'daily budget exceeds ceiling',
    });
  }

  // Walk all string fields and apply corrections
  function walkAndReplace(obj: unknown): unknown {
    if (typeof obj === 'string') {
      let result = obj;
      for (const { pattern, replacer, label, contextPattern } of patterns) {
        // If a contextPattern is set, only apply this pattern on strings that match it
        if (contextPattern && !contextPattern.test(result)) continue;
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
        const before = result;
        result = result.replace(pattern, replacer as (...args: string[]) => string);
        if (result !== before) {
          corrections.push(`${label}: "${before.slice(0, 80)}..." → "${result.slice(0, 80)}..."`);
        }
      }
      return result;
    }
    if (Array.isArray(obj)) return obj.map(walkAndReplace);
    if (obj && typeof obj === 'object') {
      const newObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        newObj[k] = walkAndReplace(v);
      }
      return newObj;
    }
    return obj;
  }

  // Skip cacModel (source of truth) and metadata (not AI-generated).
  // monitoringSchedule IS AI-generated text and needs sweeping.
  const { performanceModel, metadata, ...sectionsToSweep } = mediaPlan;
  const swept = walkAndReplace(sectionsToSweep) as Omit<MediaPlanOutput, 'performanceModel' | 'metadata'>;

  // Sweep monitoringSchedule separately (AI-generated text), preserve cacModel as-is
  const sweptMonitoring = walkAndReplace(performanceModel.monitoringSchedule) as typeof performanceModel.monitoringSchedule;

  return {
    mediaPlan: {
      ...swept,
      performanceModel: { ...performanceModel, monitoringSchedule: sweptMonitoring },
      metadata,
    },
    corrections,
  };
}
