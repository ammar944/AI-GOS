/**
 * White-space gap card schema — positioning gaps cite competitor + offer wiki entries.
 * Source runner: competitorIntel (moves here post-decoupling).
 */
import { z } from 'zod';
import { evidenceCitedSchema } from './base';

const gapValueSchema = z.object({
  gap: z.string(),
  /** Competitor(s) failing to cover this gap — must match a wiki competitor_name entry. */
  targetCompetitor: z.string(),
  type: z.enum(['positioning', 'feature', 'segment', 'price', 'distribution']).optional(),
  ourAdvantage: z.string().optional(),
  exploitability: z.number().min(0).max(10).optional(),
  impact: z.number().min(0).max(10).optional(),
  recommendedAction: z.string().optional(),
});

export const whiteSpaceGapCardSchema = z.object({
  gaps: z.array(evidenceCitedSchema(gapValueSchema)),
});

export type WhiteSpaceGapCard = z.infer<typeof whiteSpaceGapCardSchema>;
