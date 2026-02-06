// Edit Blueprint Tool
// Requires approval before execution (needsApproval: true)

import { z } from 'zod';
import { tool } from 'ai';
import { getValueAtPath, generateDiffPreview } from './utils';

export function createEditBlueprintTool(blueprint: Record<string, unknown>) {
  return tool({
    description:
      'Propose an edit to a specific field in the strategic blueprint. ' +
      'Use this when the user wants to change, update, or modify any blueprint content. ' +
      'The edit requires user approval before being applied. ' +
      'Always use this tool instead of outputting JSON in your text response.',
    inputSchema: z.object({
      section: z
        .enum([
          'industryMarketOverview',
          'icpAnalysisValidation',
          'offerAnalysisViability',
          'competitorAnalysis',
          'crossAnalysisSynthesis',
        ])
        .describe('The blueprint section to edit'),
      fieldPath: z
        .string()
        .describe(
          'Dot-notation path to the field within the section (e.g., "recommendedPositioning", "painPoints.primary[0]")'
        ),
      newValue: z
        .unknown()
        .describe('The proposed new value. Must match the original data type (string, array, object, etc.)'),
      explanation: z
        .string()
        .describe('Brief explanation of why this change addresses the user request'),
    }),
    needsApproval: true,
    execute: async ({ section, fieldPath, newValue, explanation }) => {
      const sectionData = blueprint[section] as Record<string, unknown> | undefined;
      if (!sectionData) {
        return {
          error: `Section "${section}" not found in blueprint`,
          section,
          fieldPath,
          newValue,
          explanation,
        };
      }

      const oldValue = getValueAtPath(sectionData, fieldPath);

      // Guard: prevent replacing an array with a non-array (common model mistake)
      if (Array.isArray(oldValue) && !Array.isArray(newValue)) {
        return {
          error: `Type mismatch: "${fieldPath}" is an array with ${oldValue.length} items. ` +
            `Use an array index (e.g., "${fieldPath}[0]") to edit a specific item, ` +
            `or pass an array as the new value.`,
          section,
          fieldPath,
          newValue,
          explanation,
        };
      }

      const diffPreview = generateDiffPreview(oldValue, newValue);

      return {
        section,
        fieldPath,
        oldValue,
        newValue,
        explanation,
        diffPreview,
      };
    },
  });
}
