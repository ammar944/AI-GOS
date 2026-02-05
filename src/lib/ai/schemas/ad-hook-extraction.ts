// Ad Hook Extraction Schema
// Lightweight schema for extracting hooks from competitor ads
// Used to optimize re-synthesis by only updating adHooks field

import { z } from 'zod';
import { adHookSchema } from './cross-analysis';

// =============================================================================
// Hook Extraction Result Schema
// =============================================================================

export const hookExtractionResultSchema = z.object({
  extractedHooks: z.array(adHookSchema)
    .min(0)
    .max(15)
    .describe('Hooks extracted or inspired from competitor ads. Mark source.type as "extracted" for verbatim hooks, "inspired" for adapted patterns.'),

  hookSummary: z.object({
    totalAdsAnalyzed: z.number()
      .describe('Total number of competitor ads analyzed'),
    extractedCount: z.number()
      .describe('Number of hooks extracted verbatim from ads'),
    inspiredCount: z.number()
      .describe('Number of hooks inspired by ad patterns'),
  }).describe('Summary statistics of the extraction process'),
}).describe('Result of extracting ad hooks from competitor creatives');

// =============================================================================
// Type Exports
// =============================================================================

export type HookExtractionResult = z.infer<typeof hookExtractionResultSchema>;
