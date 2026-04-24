import { z } from 'zod';
import { gtmBriefSnapshotSchema } from '../schemas/gtm/gtm-brief-snapshot';
import { gtmBriefSchema } from '../schemas/gtm/gtm-brief';
import { mediaPlanOutputSchema } from '../schemas/gtm/media-plan';
import {
  buyerIcpOutputSchema,
  competitorsOutputSchema,
  demandIntentOutputSchema,
  marketCategoryOutputSchema,
  offerFunnelOutputSchema,
  vocOutputSchema,
} from '../schemas/gtm/research-sections';
import { scriptPackOutputSchema } from '../schemas/gtm/script-pack';
import { strategySynthesisOutputSchema } from '../schemas/gtm/strategy-synthesis';
import { type GtmStageKey } from '../schemas/gtm/gtm-run';

const stageOutputSchemas = {
  'discover-url': gtmBriefSchema,
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
} satisfies Record<GtmStageKey, z.ZodType<unknown>>;

export function validateGtmStageOutput(stage: GtmStageKey, output: unknown): unknown {
  return stageOutputSchemas[stage].parse(output);
}
