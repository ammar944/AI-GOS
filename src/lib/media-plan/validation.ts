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
  RiskMonitoring,
} from './types';

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
 * 5. ROAS — (customers × LTV) / budget consistency (>20% drift → override)
 */
export function reconcileKPITargets(
  kpiTargets: KPITarget[],
  cacModel: CACModel,
  monthlyBudget: number,
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

    // Check 5: Fix ROAS target — (customers × LTV) / budget (>20% deviation)
    if (metric.includes('roas') || metric.includes('return on ad spend')) {
      const match = kpi.target.match(/(\d+\.?\d*)/);
      if (match) {
        const statedROAS = parseFloat(match[1]);
        const customers = cacModel.expectedMonthlyCustomers;
        const ltv = cacModel.estimatedLTV;

        if (statedROAS > 0 && customers > 0 && ltv > 0 && monthlyBudget > 0) {
          const computedROAS = Math.round(((customers * ltv) / monthlyBudget) * 100) / 100;
          if (computedROAS > 0 && Math.abs(statedROAS - computedROAS) / computedROAS > 0.20) {
            overrides.push({
              field: `kpiTargets.${kpi.metric}`,
              originalValue: kpi.target,
              adjustedValue: `${computedROAS}x`,
              rule: 'KPI_ROAS_Override',
              reason: `ROAS adjusted from ${statedROAS}x to ${computedROAS}x. Computed: (${customers} customers × $${ltv} LTV) / $${monthlyBudget} budget.`,
            });
            return { ...kpi, target: `${computedROAS}x` };
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

  // Rule 3: Total phase spend should match totalMonthlyBudget (±2%)
  const totalPhaseBudget = fixedPhases.reduce((sum, p) => sum + p.estimatedBudget, 0);
  if (totalPhaseBudget > 0) {
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

      // Try to match this campaign to a rule by checking name/objective keywords
      const matchedRule = rules.campaigns.find(rule =>
        rule.match.some(keyword => nameLC.includes(keyword) || objectiveLC.includes(keyword)),
      );

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
    const yearMatch = fixedName.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      const foundYear = parseInt(yearMatch[1], 10);
      if (foundYear !== currentYear) {
        fixedName = fixedName.replace(/\b20\d{2}\b/, String(currentYear));
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
