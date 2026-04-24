// MIRROR of src/lib/gtm/schemas/media-plan.ts.
// The Railway worker cannot import from src/lib/. Keep this file byte-identical
// after normalizing the `@/lib/gtm/schemas/X` imports to `./X`.
// Parity enforced by research-worker/src/schemas/gtm/__tests__/schema-parity.test.ts.
import { z } from 'zod';

export const mediaPlanOutputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type MediaPlanOutput = z.infer<typeof mediaPlanOutputSchema>;
