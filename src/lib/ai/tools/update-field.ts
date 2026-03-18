import { z } from 'zod';

/**
 * Allowlist of onboarding field keys that the chat agent may update.
 * Excludes internal metadata keys (activeJourneyRunId, researchPipeline, lastUpdated).
 */
export const UPDATABLE_FIELD_KEYS = [
  'businessModel',
  'productDescription',
  'coreDeliverables',
  'pricingTiers',
  'valueProp',
  'guarantees',
  'primaryIcpDescription',
  'topCompetitors',
  'uniqueEdge',
  'goals',
  'monthlyAdBudget',
  'industryVertical',
  'jobTitles',
  'companySize',
  'geography',
  'situationBeforeBuying',
  'desiredTransformation',
  'commonObjections',
  'brandPositioning',
] as const;

export type UpdatableFieldKey = (typeof UPDATABLE_FIELD_KEYS)[number];

export const updateFieldInputSchema = z.object({
  key: z
    .enum(UPDATABLE_FIELD_KEYS)
    .describe('The onboarding field to update'),
  value: z
    .string()
    .describe('The new value for the field'),
  reason: z
    .string()
    .describe('One-sentence explanation of why this change improves the offer'),
});
