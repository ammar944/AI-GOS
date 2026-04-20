// update-field.ts — AI tool for proposing updates to the user's onboarding profile.
// Propose pattern (mirrors edit-card): server returns `{ status: 'proposed', ... }`.
// Frontend scans message parts for updateField tool results and renders
// Accept / Reject UI. Nothing is written to Supabase from this tool — the
// user must explicitly accept, and persistence happens from the client.

import { tool } from 'ai';
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

export type UpdateFieldInput = z.infer<typeof updateFieldInputSchema>;

/**
 * Server-executed tool — returns the update as a proposal.
 * Frontend scans message parts for updateField tool results and renders
 * Accept/Reject UI. The user must accept; persistence happens client-side.
 */
export const updateField = tool({
  description:
    'Propose an update to a specific onboarding field in the user\'s business profile (value prop, ICP description, pricing, positioning, etc). Call only when the user explicitly asks to change a profile field — never on casual questions. The user will see a preview and can accept or reject. One-sentence `reason` explaining why this change improves the offer.',
  inputSchema: updateFieldInputSchema,
  execute: async (input) => {
    return {
      status: 'proposed' as const,
      key: input.key,
      value: input.value,
      reason: input.reason,
    };
  },
});
