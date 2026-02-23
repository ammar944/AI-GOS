// Validation Cascade Orchestrator
// Runs the appropriate validators in dependency order after a media plan edit.

import type { MediaPlanOutput } from '@/lib/media-plan/types';
import type { OnboardingFormData } from '@/lib/onboarding/types';
import type { MediaPlanSectionKey } from '@/lib/media-plan/section-constants';
import type { ValidationCascadeResult, ValidationAutoFix, ValidatorCategory } from './types';

import {
  validateAndFixBudget,
  computeCACModel,
  reconcileKPITargets,
  validateCrossSection,
  validatePhaseBudgets,
  validateWithinPlatformBudgets,
  reconcileTimeline,
  sweepStaleReferences,
} from '@/lib/media-plan/validation';

/**
 * Derive offer price from onboarding data.
 * Uses primary pricing tier or falls back to productOffer.offerPrice.
 */
export function deriveOfferPrice(onboardingData: OnboardingFormData): number {
  const tiers = onboardingData.productOffer.pricingTiers;
  if (tiers && tiers.length > 0) {
    const primary = tiers.find(t => t.isPrimary) ?? tiers[0];
    return primary.price;
  }
  return onboardingData.productOffer.offerPrice || 0;
}

/**
 * Derive retention multiplier from onboarding data pricing model.
 * monthly -> 12, annual -> 1, one_time -> 1, usage_based -> 6, seat_based -> 12, custom -> 3
 */
export function deriveRetentionMultiplier(onboardingData: OnboardingFormData): number {
  const models = onboardingData.productOffer.pricingModel;
  if (!models || models.length === 0) return 1;

  // Use the primary pricing tier's billing cycle if available
  const tiers = onboardingData.productOffer.pricingTiers;
  const primaryCycle = tiers?.find(t => t.isPrimary)?.billingCycle ?? models[0];

  switch (primaryCycle) {
    case 'monthly': return 12;
    case 'annual': return 1;
    case 'one_time': return 1;
    case 'usage_based': return 6;
    case 'seat_based': return 12;
    case 'custom': return 3;
    default: return 1;
  }
}

/**
 * Run the validation cascade on a media plan after an edit.
 * Only runs validators that are relevant to the changed section/field.
 * Validators run in dependency order -- later validators use outputs of earlier ones.
 */
export function runValidationCascade(
  mediaPlan: MediaPlanOutput,
  onboardingData: OnboardingFormData,
  validatorsToRun: ValidatorCategory[],
): ValidationCascadeResult {
  const autoFixes: ValidationAutoFix[] = [];
  const warnings: string[] = [];
  const updatedSections: Partial<Record<MediaPlanSectionKey, unknown>> = {};
  const validatorsRun: ValidatorCategory[] = [];

  // Working copies -- mutations flow through the cascade
  let workingPlan = JSON.parse(JSON.stringify(mediaPlan)) as MediaPlanOutput;
  const monthlyBudget = onboardingData.budgetTargets.monthlyAdBudget;
  const offerPrice = deriveOfferPrice(onboardingData);
  const retentionMultiplier = deriveRetentionMultiplier(onboardingData);
  const targetCPL = onboardingData.budgetTargets.targetCpl || workingPlan.performanceModel.cacModel.targetCPL;
  const leadToSqlRate = workingPlan.performanceModel.cacModel.leadToSqlRate;
  const sqlToCustomerRate = workingPlan.performanceModel.cacModel.sqlToCustomerRate;

  const shouldRun = (v: ValidatorCategory) => validatorsToRun.includes(v);

  // 1. Budget validation
  if (shouldRun('budget') && workingPlan.budgetAllocation) {
    validatorsRun.push('budget');
    const result = validateAndFixBudget(workingPlan.budgetAllocation, monthlyBudget);
    if (result.adjustments.length > 0) {
      workingPlan = { ...workingPlan, budgetAllocation: result.budget };
      updatedSections.budgetAllocation = result.budget;
      for (const adj of result.adjustments) {
        autoFixes.push({
          validator: 'budget',
          field: adj.field,
          oldValue: adj.originalValue,
          newValue: adj.adjustedValue,
          rule: adj.rule,
          reason: adj.reason,
        });
      }
    }
  }

  // 2. CAC Model recomputation
  let currentCACModel = workingPlan.performanceModel.cacModel;
  if (shouldRun('cacModel')) {
    validatorsRun.push('cacModel');
    const newCACModel = computeCACModel({
      monthlyBudget: workingPlan.budgetAllocation?.totalMonthlyBudget ?? monthlyBudget,
      targetCPL,
      leadToSqlRate,
      sqlToCustomerRate,
      offerPrice,
      retentionMultiplier,
    });

    // Check if values actually changed
    if (newCACModel.targetCAC !== currentCACModel.targetCAC ||
        newCACModel.expectedMonthlyLeads !== currentCACModel.expectedMonthlyLeads) {
      autoFixes.push({
        validator: 'cacModel',
        field: 'performanceModel.cacModel',
        oldValue: `CAC=$${currentCACModel.targetCAC}, Leads=${currentCACModel.expectedMonthlyLeads}`,
        newValue: `CAC=$${newCACModel.targetCAC}, Leads=${newCACModel.expectedMonthlyLeads}`,
        rule: 'CACModel_Recompute',
        reason: 'Recomputed CAC model from updated inputs.',
      });
      workingPlan = {
        ...workingPlan,
        performanceModel: { ...workingPlan.performanceModel, cacModel: newCACModel },
      };
      updatedSections.performanceModel = workingPlan.performanceModel;
      currentCACModel = newCACModel;
    }
  }

  // 3. KPI target reconciliation
  if (shouldRun('kpiTargets') && workingPlan.kpiTargets) {
    validatorsRun.push('kpiTargets');
    const effectiveBudget = workingPlan.budgetAllocation?.totalMonthlyBudget ?? monthlyBudget;
    const result = reconcileKPITargets(workingPlan.kpiTargets, currentCACModel, effectiveBudget, offerPrice);
    if (result.overrides.length > 0) {
      workingPlan = { ...workingPlan, kpiTargets: result.kpiTargets };
      updatedSections.kpiTargets = result.kpiTargets;
      for (const adj of result.overrides) {
        autoFixes.push({
          validator: 'kpiTargets',
          field: adj.field,
          oldValue: adj.originalValue,
          newValue: adj.adjustedValue,
          rule: adj.rule,
          reason: adj.reason,
        });
      }
    }
  }

  // 4. Cross-section validation
  if (shouldRun('crossSection') && workingPlan.platformStrategy && workingPlan.budgetAllocation) {
    validatorsRun.push('crossSection');
    const result = validateCrossSection({
      platformStrategy: workingPlan.platformStrategy,
      icpTargeting: workingPlan.icpTargeting,
      campaignStructure: workingPlan.campaignStructure,
      budgetAllocation: workingPlan.budgetAllocation,
      kpiTargets: workingPlan.kpiTargets,
      performanceModel: workingPlan.performanceModel,
    });
    warnings.push(...result.warnings);
    if (result.fixes?.campaignStructure) {
      workingPlan = { ...workingPlan, campaignStructure: result.fixes.campaignStructure };
      updatedSections.campaignStructure = result.fixes.campaignStructure;
    }
    for (const adj of result.adjustments) {
      autoFixes.push({
        validator: 'crossSection',
        field: adj.field,
        oldValue: adj.originalValue,
        newValue: adj.adjustedValue,
        rule: adj.rule,
        reason: adj.reason,
      });
    }
  }

  // 5. Phase budget validation
  if (shouldRun('phaseBudgets') && workingPlan.campaignPhases) {
    validatorsRun.push('phaseBudgets');
    const effectiveBudget = workingPlan.budgetAllocation?.totalMonthlyBudget ?? monthlyBudget;
    const dailyCeiling = workingPlan.budgetAllocation?.dailyCeiling ?? Math.round(effectiveBudget / 30);
    const result = validatePhaseBudgets(
      workingPlan.campaignPhases,
      effectiveBudget,
      dailyCeiling,
      workingPlan.campaignStructure?.campaigns,
    );
    if (result.adjustments.length > 0) {
      workingPlan = { ...workingPlan, campaignPhases: result.phases };
      updatedSections.campaignPhases = result.phases;
      for (const adj of result.adjustments) {
        autoFixes.push({
          validator: 'phaseBudgets',
          field: adj.field,
          oldValue: adj.originalValue,
          newValue: adj.adjustedValue,
          rule: adj.rule,
          reason: adj.reason,
        });
      }
    }
  }

  // 6. Within-platform budget validation
  if (shouldRun('withinPlatformBudgets') && workingPlan.campaignStructure) {
    validatorsRun.push('withinPlatformBudgets');
    const result = validateWithinPlatformBudgets(workingPlan.campaignStructure);
    warnings.push(...result.warnings);
    if (result.adjustments.length > 0) {
      workingPlan = { ...workingPlan, campaignStructure: result.campaignStructure };
      updatedSections.campaignStructure = result.campaignStructure;
      for (const adj of result.adjustments) {
        autoFixes.push({
          validator: 'withinPlatformBudgets',
          field: adj.field,
          oldValue: adj.originalValue,
          newValue: adj.adjustedValue,
          rule: adj.rule,
          reason: adj.reason,
        });
      }
    }
  }

  // 7. Timeline reconciliation (warning-only)
  if (shouldRun('timeline') && workingPlan.executiveSummary && workingPlan.campaignPhases) {
    validatorsRun.push('timeline');
    const timelineWarnings = reconcileTimeline(workingPlan.executiveSummary, workingPlan.campaignPhases);
    warnings.push(...timelineWarnings);
  }

  // 8. Sweep stale references
  if (shouldRun('staleReferences')) {
    validatorsRun.push('staleReferences');
    const effectiveBudget = workingPlan.budgetAllocation?.totalMonthlyBudget ?? monthlyBudget;
    const result = sweepStaleReferences(workingPlan, currentCACModel, effectiveBudget, offerPrice);
    if (result.corrections.length > 0) {
      workingPlan = result.mediaPlan;
      // Mark all sections as potentially updated since sweep touches free text
      for (const key of Object.keys(workingPlan) as (keyof MediaPlanOutput)[]) {
        if (key !== 'metadata' && key !== 'validationWarnings') {
          updatedSections[key as MediaPlanSectionKey] = workingPlan[key];
        }
      }
      for (const correction of result.corrections) {
        autoFixes.push({
          validator: 'staleReferences',
          field: 'freeText',
          oldValue: 'stale reference',
          newValue: 'corrected',
          rule: 'SweepStaleRef',
          reason: correction,
        });
      }
    }
  }

  return {
    autoFixes,
    warnings,
    updatedSections,
    validatorsRun,
  };
}
