// Explain Media Plan Tool
// Auto-execute tool that provides targeted section data for the model to reason about
// Adapted from explain-blueprint.ts for the media plan data structure

import { z } from 'zod';
import { tool } from 'ai';
import type { MediaPlanSectionKey } from '@/lib/media-plan/section-constants';
import type { MediaPlanOutput } from '@/lib/media-plan/types';

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

/** Sections that always benefit from CAC/budget context */
const FINANCIAL_SECTIONS = new Set<MediaPlanSectionKey>([
  'budgetAllocation',
  'performanceModel',
  'kpiTargets',
]);

/** Keywords in user questions that trigger additional financial context */
const FINANCIAL_KEYWORDS = ['budget', 'cac', 'cpl', 'lead', 'customer', 'ltv', 'roas'];

export function createExplainMediaPlanTool(mediaPlan: Record<string, unknown>) {
  return tool({
    description:
      'Get detailed data from a specific media plan section to explain why a recommendation, ' +
      'budget allocation, KPI target, or strategy was chosen. Use this when the user asks ' +
      '"why" questions or wants to understand the reasoning behind media plan content.',
    inputSchema: z.object({
      section: z
        .enum(SECTION_KEYS)
        .describe('The media plan section to analyze'),
      field: z
        .string()
        .optional()
        .describe(
          'Specific field within the section to focus on (e.g., "cacModel", "totalMonthlyBudget", "angles")',
        ),
      question: z
        .string()
        .describe('The specific "why" question to answer'),
    }),
    execute: async ({ section, field, question }) => {
      const sectionData = mediaPlan[section];
      if (!sectionData) {
        return {
          section,
          field,
          question,
          sectionData: null,
          additionalContext: null,
          error: `Section "${section}" not found in media plan`,
        };
      }

      // Determine if additional financial context should be included
      const isFinancialSection = FINANCIAL_SECTIONS.has(section);
      const questionLower = question.toLowerCase();
      const mentionsFinancial = FINANCIAL_KEYWORDS.some((kw) =>
        questionLower.includes(kw),
      );

      let additionalContext: Record<string, unknown> | null = null;

      if (isFinancialSection || mentionsFinancial) {
        const plan = mediaPlan as unknown as MediaPlanOutput;
        additionalContext = {};

        // Include CAC model from performance model
        if (plan.performanceModel?.cacModel) {
          additionalContext.cacModel = plan.performanceModel.cacModel;
        }

        // Include total monthly budget from budget allocation
        if (plan.budgetAllocation?.totalMonthlyBudget != null) {
          additionalContext.totalMonthlyBudget =
            plan.budgetAllocation.totalMonthlyBudget;
        }

        // Include platform breakdown for budget context
        if (plan.budgetAllocation?.platformBreakdown) {
          additionalContext.platformBreakdown =
            plan.budgetAllocation.platformBreakdown;
        }
      }

      return {
        sectionData,
        section,
        field,
        question,
        additionalContext,
      };
    },
  });
}
