import { z } from 'zod';

export const scriptPackOutputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type ScriptPackOutput = z.infer<typeof scriptPackOutputSchema>;
