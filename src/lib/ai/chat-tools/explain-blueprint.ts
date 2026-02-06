// Explain Blueprint Tool
// Auto-execute tool that provides targeted section data for the model to reason about

import { z } from 'zod';
import { tool } from 'ai';

export function createExplainBlueprintTool(blueprint: Record<string, unknown>) {
  return tool({
    description:
      'Get detailed data from a specific blueprint section to explain why a recommendation, ' +
      'score, or assessment was made. Use this when the user asks "why" questions or wants ' +
      'to understand the reasoning behind blueprint content.',
    inputSchema: z.object({
      section: z
        .enum([
          'industryMarketOverview',
          'icpAnalysisValidation',
          'offerAnalysisViability',
          'competitorAnalysis',
          'crossAnalysisSynthesis',
        ])
        .describe('The blueprint section to analyze'),
      field: z
        .string()
        .optional()
        .describe('Specific field within the section to focus on (e.g., "offerStrength", "painPoints")'),
      question: z
        .string()
        .describe('The specific "why" question to answer'),
    }),
    execute: async ({ section, field, question }) => {
      const sectionData = blueprint[section];
      if (!sectionData) {
        return {
          section,
          field,
          question,
          sectionData: null,
          error: `Section "${section}" not found in blueprint`,
        };
      }

      return {
        sectionData,
        section,
        field,
        question,
      };
    },
  });
}
