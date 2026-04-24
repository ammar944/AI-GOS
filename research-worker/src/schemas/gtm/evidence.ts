// MIRROR of src/lib/gtm/schemas/evidence.ts.
// The Railway worker cannot import from src/lib/. Keep this file byte-identical
// after normalizing the `@/lib/gtm/schemas/X` imports to `./X`.
// Parity enforced by research-worker/src/schemas/gtm/__tests__/schema-parity.test.ts.
import { z } from 'zod';

export const EVIDENCE_SOURCE_TYPES = [
  'url',
  'document',
  'transcript',
  'manual_note',
  'web_research',
  'ad_library',
  'tool_result',
] as const;

export const evidenceSourceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(EVIDENCE_SOURCE_TYPES),
  label: z.string().min(1),
  url: z.string().url().optional(),
  excerpt: z.string().optional(),
  capturedAt: z.string().datetime(),
});

export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
