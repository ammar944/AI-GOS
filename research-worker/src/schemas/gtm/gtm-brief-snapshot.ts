// MIRROR of src/lib/gtm/schemas/gtm-brief-snapshot.ts.
// The Railway worker cannot import from src/lib/. Keep this file byte-identical
// after normalizing the `@/lib/gtm/schemas/X` imports to `./X`.
// Parity enforced by research-worker/src/schemas/gtm/__tests__/schema-parity.test.ts.
import { z } from 'zod';
import { gtmBriefFieldsSchema, type GtmBrief } from './gtm-brief';

export const gtmBriefSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  parentBriefId: z.string().min(1),
  fields: gtmBriefFieldsSchema,
  briefCreatedAt: z.string().datetime(),
  briefUpdatedAt: z.string().datetime(),
  snapshotCreatedAt: z.string().datetime(),
});

export type GtmBriefSnapshot = z.infer<typeof gtmBriefSnapshotSchema>;

export interface FreezeBriefOptions {
  snapshotId: string;
  now?: string;
}

export function freezeBriefAsSnapshot(brief: GtmBrief, options: FreezeBriefOptions): GtmBriefSnapshot {
  return {
    snapshotId: options.snapshotId,
    parentBriefId: brief.briefId,
    fields: JSON.parse(JSON.stringify(brief.fields)) as GtmBriefSnapshot['fields'],
    briefCreatedAt: brief.createdAt,
    briefUpdatedAt: brief.updatedAt,
    snapshotCreatedAt: options.now ?? new Date().toISOString(),
  };
}
