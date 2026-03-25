// edit-card.ts — AI tool for proposing edits to workspace artifact cards.
// Server-side execute returns the edit payload as a tool result.
// Frontend detects editCard results in message parts and renders Accept/Reject UI.
// On accept, frontend calls updateCard() from workspace context.

import { tool } from 'ai';
import { z } from 'zod';

export const editCardInputSchema = z.object({
  cardId: z
    .string()
    .describe('The ID of the card to edit (from the card context provided in the system prompt)'),
  field: z
    .string()
    .describe(
      'The field to update. Use dot notation for stat-grid items: "stats.Category", "stats.Market Size". Use plain keys for other fields: "text", "items", "headline".',
    ),
  newValue: z
    .unknown()
    .describe(
      'The new value. For dot-notation stat fields (stats.X), pass a plain string. For text fields, pass a string. For list fields (items), pass the full updated array.',
    ),
  explanation: z
    .string()
    .describe('One sentence explaining what changed and why'),
});

export type EditCardInput = z.infer<typeof editCardInputSchema>;

/**
 * Server-executed tool — returns the edit proposal as a structured result.
 * Frontend scans message parts for editCard tool results and renders
 * Accept/Reject UI. The edit is NOT auto-applied — user must accept.
 */
export const editCard = tool({
  description:
    'Propose an edit to a research artifact card. Call this when the user asks to change, update, fix, or improve something in the research results. The user will see a preview and can approve or reject the change. Always explain what you are changing and why.',
  inputSchema: editCardInputSchema,
  execute: async (input) => {
    // Return the edit proposal as a structured result.
    // Frontend renders Accept/Reject based on this.
    return {
      status: 'proposed' as const,
      cardId: input.cardId,
      field: input.field,
      newValue: input.newValue,
      explanation: input.explanation,
    };
  },
});
