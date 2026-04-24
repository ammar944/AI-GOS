import { z } from 'zod';

export const strategySynthesisOutputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type StrategySynthesisOutput = z.infer<typeof strategySynthesisOutputSchema>;
