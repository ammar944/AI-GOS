// Shared utilities for media plan chat tools

import { getValueAtPath, generateDiffPreview } from '@/lib/ai/chat-tools/utils';
import { MEDIA_PLAN_SECTION_LABELS, MEDIA_PLAN_SECTION_ORDER } from '@/lib/media-plan/section-constants';
import type { MediaPlanSectionKey } from '@/lib/media-plan/section-constants';
import type { MediaPlanPendingEdit, ValidatorCategory } from './types';

// Re-export shared utilities
export { getValueAtPath, generateDiffPreview };

/**
 * Summarize a media plan into concise text for system prompts.
 */
export function summarizeMediaPlan(mediaPlan: Record<string, unknown>): string {
  const sections: string[] = [];

  const exec = mediaPlan.executiveSummary as Record<string, unknown> | undefined;
  if (exec) {
    sections.push(`## Executive Summary
- Objective: ${exec.primaryObjective || 'N/A'}
- Monthly Budget: $${exec.recommendedMonthlyBudget || 'N/A'}
- Timeline: ${exec.timelineToResults || 'N/A'}
- Priorities: ${(exec.topPriorities as string[])?.slice(0, 3).join('; ') || 'N/A'}`);
  }

  const platforms = mediaPlan.platformStrategy as Array<Record<string, unknown>> | undefined;
  if (platforms && platforms.length > 0) {
    const platformList = platforms.map(p =>
      `${p.platform} (${p.budgetPercentage}%, $${p.monthlySpend}/mo, ${p.priority})`
    ).join(', ');
    sections.push(`## Platform Strategy
- Platforms: ${platformList}`);
  }

  const budget = mediaPlan.budgetAllocation as Record<string, unknown> | undefined;
  if (budget) {
    sections.push(`## Budget Allocation
- Total Monthly: $${budget.totalMonthlyBudget}
- Daily Ceiling: $${budget.dailyCeiling}`);
  }

  const perf = mediaPlan.performanceModel as Record<string, unknown> | undefined;
  if (perf) {
    const cac = perf.cacModel as Record<string, unknown> | undefined;
    if (cac) {
      sections.push(`## Performance Model (CAC)
- Target CAC: $${cac.targetCAC}
- Target CPL: $${cac.targetCPL}
- Expected Leads: ${cac.expectedMonthlyLeads}/mo
- Expected Customers: ${cac.expectedMonthlyCustomers}/mo
- LTV:CAC: ${cac.ltvToCacRatio}`);
    }
  }

  const kpis = mediaPlan.kpiTargets as Array<Record<string, unknown>> | undefined;
  if (kpis && kpis.length > 0) {
    const kpiList = kpis.slice(0, 5).map(k => `${k.metric}: ${k.target}`).join(', ');
    sections.push(`## KPI Targets
- ${kpiList}`);
  }

  return sections.join('\n\n');
}

/**
 * Determine which validators are affected by a change to a specific section/field.
 * Returns the subset of validators that should run after the change.
 */
export function getAffectedValidators(
  section: MediaPlanSectionKey,
  _fieldPath: string,
): ValidatorCategory[] {
  const affected: ValidatorCategory[] = [];

  // Budget changes cascade to almost everything
  if (section === 'budgetAllocation') {
    affected.push('budget', 'cacModel', 'kpiTargets', 'crossSection', 'phaseBudgets', 'staleReferences');
  }

  // Platform strategy changes affect cross-section and within-platform budgets
  if (section === 'platformStrategy') {
    affected.push('crossSection', 'withinPlatformBudgets');
  }

  // Campaign structure changes affect cross-section, phase budgets, within-platform
  if (section === 'campaignStructure') {
    affected.push('crossSection', 'phaseBudgets', 'withinPlatformBudgets');
  }

  // KPI target changes need reconciliation
  if (section === 'kpiTargets') {
    affected.push('kpiTargets', 'staleReferences');
  }

  // Performance model changes (CAC inputs) cascade to KPIs and references
  if (section === 'performanceModel') {
    affected.push('cacModel', 'kpiTargets', 'staleReferences');
  }

  // Campaign phase changes
  if (section === 'campaignPhases') {
    affected.push('phaseBudgets', 'timeline');
  }

  // Executive summary changes check timeline
  if (section === 'executiveSummary') {
    affected.push('timeline');
  }

  // ICP targeting changes affect cross-section validation
  if (section === 'icpTargeting') {
    affected.push('crossSection');
  }

  // If nothing matched, run stale references as a catch-all
  if (affected.length === 0) {
    affected.push('staleReferences');
  }

  return [...new Set(affected)]; // deduplicate
}

/**
 * Apply a single edit to a media plan object (immutable - returns new object).
 */
export function applyMediaPlanEdit(
  mediaPlan: Record<string, unknown>,
  edit: MediaPlanPendingEdit,
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(mediaPlan));

  const section = result[edit.section];
  if (!section) {
    throw new Error(`Section "${edit.section}" not found in media plan`);
  }

  // For top-level array sections (platformStrategy, kpiTargets, campaignPhases),
  // the section itself IS the value to edit
  if (Array.isArray(section)) {
    setValueAtPath(result, `${edit.section}.${edit.fieldPath}`, edit.newValue);
  } else if (typeof section === 'object' && section !== null) {
    setValueAtPath(section as Record<string, unknown>, edit.fieldPath, edit.newValue);
  }

  return result;
}

/**
 * Set a value at a dot-notation path within an object.
 * Supports array notation like "campaigns[0].dailyBudget".
 */
export function setValueAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.').flatMap(part => {
    const match = part.match(/^(.+)\[(\d+)\]$/);
    if (match) {
      return [match[1], parseInt(match[2], 10)];
    }
    return [part];
  });

  let current: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current === null || current === undefined) {
      throw new Error(`Cannot traverse path: null at "${parts.slice(0, i + 1).join('.')}"`);
    }
    if (typeof part === 'number') {
      if (!Array.isArray(current)) throw new Error(`Expected array at index ${part}`);
      current = current[part];
    } else {
      if (typeof current !== 'object') throw new Error(`Expected object at "${part}"`);
      current = (current as Record<string, unknown>)[part];
    }
  }

  const lastPart = parts[parts.length - 1];
  if (typeof lastPart === 'number') {
    if (!Array.isArray(current)) throw new Error(`Expected array for final index ${lastPart}`);
    current[lastPart] = value;
  } else {
    if (typeof current !== 'object' || current === null) {
      throw new Error(`Expected object for final key "${lastPart}"`);
    }
    (current as Record<string, unknown>)[lastPart] = value;
  }
}

/** Section labels for display (media plan version) */
export { MEDIA_PLAN_SECTION_LABELS, MEDIA_PLAN_SECTION_ORDER };
