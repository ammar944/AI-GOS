// MIRROR of src/lib/gtm/schemas/strategy-synthesis.ts.
// The Railway worker cannot import from src/lib/. Keep this file byte-identical
// after normalizing the `@/lib/gtm/schemas/X` imports to `./X`.
// Parity enforced by research-worker/src/schemas/gtm/__tests__/schema-parity.test.ts.
import { z } from 'zod';

export const strategySynthesisOutputSchema = z.object({
  summary: z.string(),
  keyFindings: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

export type StrategySynthesisOutput = z.infer<typeof strategySynthesisOutputSchema>;
