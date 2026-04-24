import { z } from 'zod';

export const mediaPlanOutputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type MediaPlanOutput = z.infer<typeof mediaPlanOutputSchema>;
