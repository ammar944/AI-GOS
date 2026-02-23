// Recalculate Tool
// Triggers the deterministic validation cascade after an edit is applied
// Ensures cross-section mathematical consistency (budget math, CAC model, KPI targets)

import { z } from 'zod';
import { tool } from 'ai';
import type { MediaPlanOutput } from '@/lib/media-plan/types';
import type { OnboardingFormData } from '@/lib/onboarding/types';
import type { MediaPlanSectionKey } from '@/lib/media-plan/section-constants';
import { runValidationCascade } from './validation-cascade';
import { getAffectedValidators } from './utils';

const SECTION_KEYS: [MediaPlanSectionKey, ...MediaPlanSectionKey[]] = [
  'executiveSummary',
  'platformStrategy',
  'icpTargeting',
  'campaignStructure',
  'creativeStrategy',
  'budgetAllocation',
  'campaignPhases',
  'kpiTargets',
  'performanceModel',
  'riskMonitoring',
];

export function createRecalculateTool(
  mediaPlan: MediaPlanOutput,
  onboardingData: OnboardingFormData,
) {
  return tool({
    description:
      'Run the deterministic validation cascade to fix cross-section inconsistencies after an edit. ' +
      'Use this AFTER an edit has been applied to recalculate budget math, CAC model, KPI targets, ' +
      'and other dependent values. This ensures all sections stay mathematically consistent.',
    inputSchema: z.object({
      changedSection: z
        .enum(SECTION_KEYS)
        .describe('The section that was just edited'),
      changedField: z
        .string()
        .describe('The specific field that changed (e.g., "totalMonthlyBudget")'),
      reason: z
        .string()
        .describe('Brief description of what changed and why validation is needed'),
    }),
    execute: async ({ changedSection, changedField, reason: _reason }) => {
      const validators = getAffectedValidators(
        changedSection as MediaPlanSectionKey,
        changedField,
      );

      if (validators.length === 0) {
        return {
          validatorsRun: [],
          autoFixes: [],
          warnings: [],
          updatedSections: {},
          message: 'No validators needed for this change.',
        };
      }

      const result = runValidationCascade(mediaPlan, onboardingData, validators);

      return {
        ...result,
        message:
          result.autoFixes.length > 0
            ? `Ran ${result.validatorsRun.length} validators. Applied ${result.autoFixes.length} auto-fix(es).${result.warnings.length > 0 ? ` ${result.warnings.length} warning(s).` : ''}`
            : result.warnings.length > 0
              ? `No auto-fixes needed but ${result.warnings.length} warning(s) found.`
              : 'All sections are consistent. No fixes needed.',
      };
    },
  });
}
