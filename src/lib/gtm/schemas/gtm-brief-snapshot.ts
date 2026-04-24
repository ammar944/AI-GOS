import { z } from 'zod';
import { gtmBriefFieldsSchema, type GtmBrief } from '@/lib/gtm/schemas/gtm-brief';

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
