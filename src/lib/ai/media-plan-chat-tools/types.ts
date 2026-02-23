// Types for media plan chat tools

import type { MediaPlanSectionKey } from '@/lib/media-plan/section-constants';

/** A pending edit to a media plan field, parallel to PendingEdit in chat-tools/types */
export interface MediaPlanPendingEdit {
  section: MediaPlanSectionKey;
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  explanation: string;
  diffPreview: string;
}

/** Which validator categories are affected by a field change */
export type ValidatorCategory =
  | 'budget'
  | 'cacModel'
  | 'kpiTargets'
  | 'crossSection'
  | 'phaseBudgets'
  | 'withinPlatformBudgets'
  | 'timeline'
  | 'staleReferences';

/** Result of running the full validation cascade */
export interface ValidationCascadeResult {
  /** Auto-fixes that were applied */
  autoFixes: ValidationAutoFix[];
  /** Warnings that require human review */
  warnings: string[];
  /** The updated media plan sections (only sections that changed) */
  updatedSections: Partial<Record<MediaPlanSectionKey, unknown>>;
  /** Which validators ran */
  validatorsRun: ValidatorCategory[];
}

/** A single auto-fix from the validation cascade */
export interface ValidationAutoFix {
  validator: ValidatorCategory;
  field: string;
  oldValue: string | number;
  newValue: string | number;
  rule: string;
  reason: string;
}

/** Result of a budget simulation */
export interface BudgetSimulationResult {
  current: SimulatedCACSnapshot;
  proposed: SimulatedCACSnapshot;
  proposedMonthlyBudget: number;
  delta: {
    budgetChange: number;
    budgetChangePercent: number;
    leadsDelta: number;
    customersDelta: number;
    cacDelta: number;
  };
}

/** A snapshot of CAC model numbers for comparison */
export interface SimulatedCACSnapshot {
  monthlyBudget: number;
  expectedMonthlyLeads: number;
  expectedMonthlySQLs: number;
  expectedMonthlyCustomers: number;
  targetCAC: number;
  estimatedLTV: number;
  ltvToCacRatio: string;
}
