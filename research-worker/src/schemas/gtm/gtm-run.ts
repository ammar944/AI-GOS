// MIRROR of src/lib/gtm/schemas/gtm-run.ts.
// The Railway worker cannot import from src/lib/. Keep this file byte-identical
// after normalizing the `@/lib/gtm/schemas/X` imports to `./X`.
// Parity enforced by research-worker/src/schemas/gtm/__tests__/schema-parity.test.ts.
import { z } from 'zod';

export const GTM_STAGE_KEYS = [
  'discover-url',
  'enrich-brief',
  'review-brief',
  'lock-brief',
  'research-market-category',
  'research-buyer-icp',
  'research-competitors',
  'research-voc',
  'research-demand-intent',
  'research-offer-funnel',
  'synthesize-strategy',
  'generate-media-plan',
  'generate-scripts',
] as const;

export type GtmStageKey = (typeof GTM_STAGE_KEYS)[number];

export const gtmStageKeySchema = z.enum(GTM_STAGE_KEYS);

export const GTM_RUN_STATUSES = ['draft', 'running', 'needs_review', 'completed', 'failed'] as const;
export type GtmRunStatus = (typeof GTM_RUN_STATUSES)[number];

export const gtmRunStatusSchema = z.enum(GTM_RUN_STATUSES);

export const gtmRunSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  clientId: z.string().min(1).nullable(),
  briefId: z.string().min(1),
  briefSnapshotId: z.string().min(1),
  status: gtmRunStatusSchema,
  currentStage: gtmStageKeySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type GtmRun = z.infer<typeof gtmRunSchema>;
