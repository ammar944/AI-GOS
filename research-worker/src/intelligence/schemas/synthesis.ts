/**
 * Strategic synthesis card schema — readiness scorecard + top actions.
 * Source runner: synthesize (becomes thin dispatch post-decoupling).
 * Uses Sonnet, not Haiku — cross-section reasoning.
 * Phase 6.2.4: aligned to readiness-scorecard methodology.
 */
import { z } from 'zod';
import { evidenceCitedSchema } from './base';

const dimensionScoreSchema = z.object({
  dimension: z.enum([
    'Market Opportunity',
    'Audience Clarity',
    'Competitive Position',
    'Offer Strength',
    'Keyword Coverage',
  ]),
  score: z.number().min(0).max(10),
  verdict: z.enum(['red', 'yellow', 'green']),
  summary: z.string().min(10),
  topSignals: z.array(z.string()).max(5),
});

const topActionSchema = z.object({
  action: z.string().min(10),
  category: z.enum(['quick_win', 'strategic', 'defensive']),
  effort: z.enum(['low', 'medium', 'high']),
  impact: z.enum(['low', 'medium', 'high']),
  rationale: z.string().min(10),
});

export const strategicSynthesisCardSchema = z.object({
  readinessScorecard: z.object({
    overallScore: z.number().min(0).max(10),
    overallVerdict: z.enum(['red', 'yellow', 'green']),
    dimensions: z.array(evidenceCitedSchema(dimensionScoreSchema)),
  }),
  topActions: z.array(evidenceCitedSchema(topActionSchema)),
  strategicNarrative: z.string().min(50),
});

export type StrategicSynthesisCard = z.infer<typeof strategicSynthesisCardSchema>;
