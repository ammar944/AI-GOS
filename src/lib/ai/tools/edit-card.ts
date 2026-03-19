// edit-card.ts — AI tool for proposing edits to workspace artifact cards.
// Interactive tool (no execute) — frontend renders approval UI.
// On accept, the frontend calls updateCard() from workspace context.

import { tool } from 'ai';
import { z } from 'zod';

export const editCardInputSchema = z.object({
  cardId: z
    .string()
    .describe('The ID of the card to edit (from the card context provided in the system prompt)'),
  field: z
    .string()
    .describe(
      'The top-level field key in the card content to update (e.g. "items", "stats", "text", "headline", "strengths", "weaknesses")',
    ),
  newValue: z
    .unknown()
    .describe(
      'The new value for the field. Must match the existing type: string for text fields, array for list fields, etc.',
    ),
  explanation: z
    .string()
    .describe('One sentence explaining what changed and why'),
});

export type EditCardInput = z.infer<typeof editCardInputSchema>;

/** Interactive tool — no execute function. Frontend handles approval flow. */
export const editCard = tool({
  description:
    'Propose an edit to a research artifact card. Call this when the user asks to change, update, fix, or improve something in the research results. The user will see a preview and can approve or reject the change. Always explain what you are changing and why.',
  inputSchema: editCardInputSchema,
});
