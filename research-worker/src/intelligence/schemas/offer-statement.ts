/**
 * Offer statement card schema — Hormozi Value Equation + Schwartz Awareness grounding.
 * Source runner: offerAnalysis (moves here post-decoupling).
 *
 * Phase 6.2.3: required fields upgraded so every statement must be grounded in
 * a wiki entry, pull on a Hormozi axis, and target an awareness level.
 */
import { z } from 'zod';
import { evidenceCitedSchema } from './base';

const offerStatementValueSchema = z.object({
  type: z.enum(['hero', 'stack', 'guarantee', 'urgency', 'social_proof']),
  statement: z.string().min(10),
  /** Which Hormozi Value Equation axis this statement pulls on. Required. */
  valueEquationAxis: z.enum(['dream_outcome', 'likelihood', 'time_delay', 'effort_sacrifice']),
  /** Schwartz awareness level the statement targets. Required. */
  awarenessLevel: z.enum(['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware']),
  /** Reasoning for why this statement passes the quality gate. Required. */
  rationale: z.string().min(10),
  /** Wiki evidence entry that grounds this statement. Required. */
  evidence: z.string().min(10),
  /** Optional emotional register the statement is designed to trigger. */
  targetEmotion: z.string().optional(),
});

export const offerStatementCardSchema = z.object({
  statements: z.array(evidenceCitedSchema(offerStatementValueSchema)),
});

export type OfferStatementCard = z.infer<typeof offerStatementCardSchema>;
