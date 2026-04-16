/**
 * Strategic synthesis card schema — readiness scorecard + top actions.
 * Source runner: synthesize (becomes thin dispatch post-decoupling).
 * Uses Sonnet, not Haiku — cross-section reasoning.
 */
import { z } from 'zod';
import { evidenceCitedSchema } from './base';

const scorecardDimensionSchema = z.object({
  dimension: z.string(),
  score: z.number().min(0).max(10),
  summary: z.string(),
  blockers: z.array(z.string()).default([]),
});

const topActionValueSchema = z.object({
  action: z.string(),
  owner: z.string().optional(),
  timeline: z.string().optional(),
  impact: z.enum(['low', 'medium', 'high']).optional(),
});

export const strategicSynthesisCardSchema = z.object({
  readinessScorecard: z.object({
    dimensions: z.array(scorecardDimensionSchema),
    overallScore: z.number().min(0).max(10),
    verdict: z.string(),
  }),
  topActions: z.array(evidenceCitedSchema(topActionValueSchema)),
  strategicNarrative: z.string().optional(),
});

export type StrategicSynthesisCard = z.infer<typeof strategicSynthesisCardSchema>;
