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
  // §1 Product & Revenue Model
  'businessModel', // legacy — kept for chat-refinement sessions on old users
  'productDescription',
  'targetCustomer',
  'salesMotion',
  'pricingModel',
  'conversionPath',
  'avgAcv',
  // §2 ICP + Pain
  'primaryIcpDescription',
  'industryVertical',
  'jobTitles',
  'companySize',
  'geography',
  'buyingTriggers',
  'currentAlternative',
  // §3 Offer & Product Experience
  'coreDeliverables',
  'valueProp',
  'firstValueMoment',
  'activationEvent',
  'retentionDrivers',
  // §4 Pricing & Economics
  'pricingTiers',
  'targetPlan',
  'monthlyAdBudget',
  'avgCustomerLtv',
  'targetCac',
  // §5 Competition & Positioning
  'topCompetitors',
  'uniqueEdge',
  'lossReasons',
  'competitorStrengths',
  // §6 Goals & Strategy
  'goals',
  'pipelineTarget',
  'commonObjections',
  'keyPromises',
  'brandPositioning',
  // §7 Current Marketing & Performance
  'channels',
  'channelBudgetSplit',
  'whatIsWorking',
  'whatIsNotWorking',
  'currentCac',
  'monthlyRevenue',
  'salesCycleLength',
  'visitorToSignupPct',
  'signupToActivationPct',
  'activationToPaidPct',
  'demoToCloseRate',
  'last3to6MoGrowthTrend',
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
