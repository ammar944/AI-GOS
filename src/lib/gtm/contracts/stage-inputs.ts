import { z } from 'zod';
import { gtmBriefSnapshotSchema } from '@/lib/gtm/schemas/gtm-brief-snapshot';
import type { GtmStageKey } from '@/lib/gtm/schemas/gtm-run';

const sectionInputSchema = z.object({
  briefSnapshot: gtmBriefSnapshotSchema,
  priorOutputs: z.record(z.string(), z.unknown()),
});

export const stageInputSchemas: Record<GtmStageKey, z.ZodTypeAny> = {
  'discover-url': z.object({ url: z.string().url() }),
  'enrich-brief': z.object({ briefId: z.string().min(1), uploads: z.array(z.unknown()).default([]) }),
  'review-brief': z.object({ briefId: z.string().min(1) }),
  'lock-brief': z.object({ briefId: z.string().min(1) }),
  'research-market-category': sectionInputSchema,
  'research-buyer-icp': sectionInputSchema,
  'research-competitors': sectionInputSchema,
  'research-voc': sectionInputSchema,
  'research-demand-intent': sectionInputSchema,
  'research-offer-funnel': sectionInputSchema,
  'synthesize-strategy': sectionInputSchema,
  'generate-media-plan': sectionInputSchema,
  'generate-scripts': sectionInputSchema,
};

export type StageInputMap = {
  [K in GtmStageKey]: z.infer<(typeof stageInputSchemas)[K]>;
};
