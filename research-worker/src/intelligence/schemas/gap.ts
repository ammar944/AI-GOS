/**
 * White-space gap card schema — positioning gaps cite competitor + offer wiki entries.
 * Source runner: competitorIntel (moves here post-decoupling).
 */
import { z } from 'zod';
import { evidenceCitedSchema } from './base';

const gapValueSchema = z.object({
  move: z.string().min(10),
  archetype: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
  targetCompetitor: z.string().min(2),
  competitorWeakness: z.string().min(10),
  valueEquationAxis: z.enum(['dreamOutcome', 'likelihood', 'timeDelay', 'effort']),
  risk: z.enum(['low', 'medium', 'high']),
  reward: z.enum(['low', 'medium', 'high']),
  playbook: z.string().min(10),
  evidence: z.string().min(10),
  // Retained optional legacy cross-reference fields
  type: z
    .enum(['positioning', 'feature', 'segment', 'price', 'distribution', 'messaging', 'audience', 'channel'])
    .optional(),
  ourAdvantage: z.string().optional(),
  exploitability: z.number().min(0).max(10).optional(),
  impact: z.number().min(0).max(10).optional(),
  recommendedAction: z.string().optional(),
});

export const whiteSpaceGapCardSchema = z.object({
  gaps: z.array(evidenceCitedSchema(gapValueSchema)),
});

export type WhiteSpaceGapCard = z.infer<typeof whiteSpaceGapCardSchema>;
