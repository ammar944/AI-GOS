// Edit Media Plan Tool
// Requires approval before execution (needsApproval: true)
// Adapted from edit-blueprint.ts for the media plan data structure

import { z } from 'zod';
import { tool } from 'ai';
import { getValueAtPath, generateDiffPreview } from '@/lib/ai/chat-tools/utils';
import { getAffectedValidators } from './utils';
import type { MediaPlanSectionKey } from '@/lib/media-plan/section-constants';

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

export function createEditMediaPlanTool(mediaPlan: Record<string, unknown>) {
  return tool({
    description:
      'Propose an edit to a specific field in the media plan. ' +
      'Use this when the user wants to change, update, or modify any media plan content ' +
      '(budget, platform strategy, KPIs, creative angles, campaign structure, etc.). ' +
      'The edit requires user approval before being applied. ' +
      'Always use this tool instead of outputting JSON in your text response.',
    inputSchema: z.object({
      section: z
        .enum(SECTION_KEYS)
        .describe('The media plan section to edit'),
      fieldPath: z
        .string()
        .describe(
          'Dot-notation path to the field within the section (e.g., "totalMonthlyBudget", ' +
          '"cacModel.targetCPL", "platformBreakdown[0].monthlyBudget")',
        ),
      newValue: z
        .unknown()
        .describe(
          'The proposed new value. Must match the original data type (string, number, array, object, etc.)',
        ),
      explanation: z
        .string()
        .describe('Brief explanation of why this change addresses the user request'),
    }),
    needsApproval: true,
    execute: async ({ section, fieldPath, newValue, explanation }) => {
      const sectionData = mediaPlan[section] as Record<string, unknown> | unknown[] | undefined;
      if (!sectionData) {
        return {
          error: `Section "${section}" not found in media plan`,
          section,
          fieldPath,
          newValue,
          explanation,
          affectedValidators: [],
          requiresValidationCascade: false,
        };
      }

      // For array sections (platformStrategy[], campaignPhases[], kpiTargets[]),
      // getValueAtPath expects an object, so wrap in a container
      const lookupTarget = Array.isArray(sectionData)
        ? ({ _array: sectionData } as Record<string, unknown>)
        : (sectionData as Record<string, unknown>);
      const lookupPath = Array.isArray(sectionData) ? `_array.${fieldPath}` : fieldPath;

      const oldValue = getValueAtPath(lookupTarget, lookupPath);

      // Guard: prevent replacing an array with a non-array (common model mistake)
      if (Array.isArray(oldValue) && !Array.isArray(newValue)) {
        return {
          error:
            `Type mismatch: "${fieldPath}" is an array with ${oldValue.length} items. ` +
            `Use an array index (e.g., "${fieldPath}[0]") to edit a specific item, ` +
            `or pass an array as the new value.`,
          section,
          fieldPath,
          newValue,
          explanation,
          affectedValidators: [],
          requiresValidationCascade: false,
        };
      }

      const diffPreview = generateDiffPreview(oldValue, newValue);

      // Determine which validators would need to run after this edit
      const affectedValidators = getAffectedValidators(section, fieldPath);

      return {
        section,
        fieldPath,
        oldValue,
        newValue,
        explanation,
        diffPreview,
        affectedValidators,
        requiresValidationCascade: affectedValidators.length > 0,
      };
    },
  });
}
