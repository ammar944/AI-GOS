/**
 * Offer statement card schema — Hormozi Value Equation + Schwartz Awareness grounding.
 * Source runner: offerAnalysis (moves here post-decoupling).
 */
import { z } from 'zod';
import { evidenceCitedSchema } from './base';

const offerStatementValueSchema = z.object({
  type: z.enum(['hero', 'stack', 'guarantee', 'urgency', 'social_proof']),
  statement: z.string(),
  /** Which Hormozi Value Equation axis this statement pulls on. */
  valueEquationAxis: z
    .enum(['dream_outcome', 'likelihood', 'time_delay', 'effort_sacrifice'])
    .optional(),
  /** Schwartz awareness level the statement targets. */
  awarenessLevel: z
    .enum(['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware'])
    .optional(),
  rationale: z.string().optional(),
  targetEmotion: z.string().optional(),
});

export const offerStatementCardSchema = z.object({
  statements: z.array(evidenceCitedSchema(offerStatementValueSchema)),
});

export type OfferStatementCard = z.infer<typeof offerStatementCardSchema>;
