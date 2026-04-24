import { describe, expect, it } from 'vitest';
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

const emptyStubPayload = { summary: '', keyFindings: [], evidenceIds: [], assumptions: [] };

describe('stage output stubs', () => {
  const schemas = [
    ['marketCategory', marketCategoryOutputSchema],
    ['buyerIcp', buyerIcpOutputSchema],
    ['competitors', competitorsOutputSchema],
    ['voc', vocOutputSchema],
    ['demandIntent', demandIntentOutputSchema],
    ['offerFunnel', offerFunnelOutputSchema],
    ['strategySynthesis', strategySynthesisOutputSchema],
    ['mediaPlan', mediaPlanOutputSchema],
    ['scriptPack', scriptPackOutputSchema],
  ] as const;

  for (const [name, schema] of schemas) {
    it(`${name} accepts an empty stub payload`, () => {
      expect(schema.safeParse(emptyStubPayload).success).toBe(true);
    });

    it(`${name} rejects unknown top-level fields when strict`, () => {
      const strict = schema.strict();
      const result = strict.safeParse({ ...emptyStubPayload, bogus: 1 });
      expect(result.success).toBe(false);
    });
  }
});
