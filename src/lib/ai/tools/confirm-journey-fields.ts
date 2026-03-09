import { tool } from 'ai';
import { z } from 'zod';
import {
  acceptProposedField,
  createEmptyState,
  hydrateOnboardingState,
  normalizeJourneyFieldName,
  setConfirmedField,
  type OnboardingState,
} from '@/lib/journey/session-state';
import { persistToSupabase } from '@/lib/journey/session-state.server';

const inputSchema = z.object({
  fields: z
    .array(
      z.object({
        fieldName: z.string(),
        value: z.unknown().optional(),
      }),
    )
    .min(1),
});

export const confirmJourneyFields = tool({
  description:
    'Confirm one or more journey fields after the user explicitly validates them in conversation. ' +
    'Use this when the user naturally says an inferred or previously proposed value is correct.',
  inputSchema,
  execute: async ({ fields }, { experimental_context }) => {
    const ctx = experimental_context as
      | {
          confirmedState?: unknown;
          userId?: string;
          sessionId?: string;
        }
      | undefined;

    let next =
      hydrateOnboardingState(ctx?.confirmedState) ??
      createEmptyState();

    const confirmedFields: Array<{ fieldName: string; value: unknown }> = [];

    for (const field of fields) {
      const normalizedField = normalizeJourneyFieldName(field.fieldName);
      if (!normalizedField) continue;

      const proposal = next.proposals[normalizedField];
      const value = field.value !== undefined ? field.value : proposal?.value;
      if (value === undefined) continue;

      next = proposal
        ? acceptProposedField(next, normalizedField, value, 'chat-confirmation')
        : setConfirmedField(next, normalizedField, value, {
            source: 'confirmation',
            verifiedBy: 'chat-confirmation',
          });

      confirmedFields.push({
        fieldName: normalizedField,
        value,
      });
    }

    if (ctx?.userId && ctx?.sessionId && confirmedFields.length > 0) {
      await persistToSupabase(ctx.userId, next as OnboardingState, ctx.sessionId);
    }

    return {
      status: 'confirmed' as const,
      fields: confirmedFields,
    };
  },
});
