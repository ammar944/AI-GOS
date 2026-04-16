/**
 * Shared Zod schema: EvidenceCited<T>.
 * Every claim in a synthesis card must wrap its value in this type so the
 * validator can audit grounding.
 */
import { z } from 'zod';

export const evidenceCitedSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    evidenceIds: z.array(z.string()).min(1),
    confidence: z.number().min(0).max(100),
  });

/** Re-exported for convenience. */
export type EvidenceCited<T> = z.infer<ReturnType<typeof evidenceCitedSchema<z.ZodType<T>>>>;
