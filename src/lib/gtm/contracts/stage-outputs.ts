import { z } from 'zod';
import {
  marketCategoryOutputSchema,
  buyerIcpOutputSchema,
  competitorsOutputSchema,
  vocOutputSchema,
  demandIntentOutputSchema,
  offerFunnelOutputSchema,
} from '@/lib/gtm/schemas/research-sections';
import { strategySynthesisOutputSchema } from '@/lib/gtm/schemas/strategy-synthesis';
import { mediaPlanOutputSchema } from '@/lib/gtm/schemas/media-plan';
import { scriptPackOutputSchema } from '@/lib/gtm/schemas/script-pack';
import { gtmBriefSchema } from '@/lib/gtm/schemas/gtm-brief';
import { gtmBriefSnapshotSchema } from '@/lib/gtm/schemas/gtm-brief-snapshot';
import { ingestIdentityOutputSchema } from '@/lib/gtm/schemas/ingest-identity-output';
import type { GtmStageKey } from '@/lib/gtm/schemas/gtm-run';

export const stageOutputSchemas: Record<GtmStageKey, z.ZodTypeAny> = {
  'discover-url': gtmBriefSchema,
  'discover-identity': ingestIdentityOutputSchema,
  'enrich-brief': gtmBriefSchema,
  'review-brief': gtmBriefSchema,
  'lock-brief': gtmBriefSnapshotSchema,
  'research-market-category': marketCategoryOutputSchema,
  'research-buyer-icp': buyerIcpOutputSchema,
  'research-competitors': competitorsOutputSchema,
  'research-voc': vocOutputSchema,
  'research-demand-intent': demandIntentOutputSchema,
  'research-offer-funnel': offerFunnelOutputSchema,
  'synthesize-strategy': strategySynthesisOutputSchema,
  'generate-media-plan': mediaPlanOutputSchema,
  'generate-scripts': scriptPackOutputSchema,
};

export type StageOutputMap = {
  [K in GtmStageKey]: z.infer<(typeof stageOutputSchemas)[K]>;
};
