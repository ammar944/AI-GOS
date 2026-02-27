import { tool } from 'ai';
import { z } from 'zod';

export const askUser = tool({
  description:
    'Present a structured question to the user with selectable options. ' +
    'Use for categorical questions where predefined choices help guide the user. ' +
    'The user will see interactive chips they can tap to respond.',
  inputSchema: z.object({
    question: z
      .string()
      .describe('The question to display to the user'),
    fieldName: z
      .string()
      .describe(
        'The OnboardingState field this answer maps to (e.g., "businessModel", "industry")'
      ),
    options: z
      .array(
        z.object({
          label: z
            .string()
            .describe('Short option label shown on the chip'),
          description: z
            .string()
            .optional()
            .describe('Optional longer description shown below the label'),
        })
      )
      .min(2)
      .max(6)
      .describe(
        '2-6 option choices. An "Other" option is always added automatically by the frontend.'
      ),
    multiSelect: z
      .boolean()
      .default(false)
      .describe(
        'If true, user can select multiple options. If false, single selection auto-submits.'
      ),
  }),
  // NO execute function — this is an interactive tool.
  // The frontend renders chips and calls addToolOutput() with the user's selection.
});
