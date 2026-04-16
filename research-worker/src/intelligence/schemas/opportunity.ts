/**
 * Opportunity card schema — each opportunity cites wiki entries.
 * Source runner: industryMarket.
 * Current inline shape (pre-migration): runners/industry.ts marketOpportunities array.
 */
import { z } from 'zod';
import { evidenceCitedSchema } from './base';

const opportunityValueSchema = z.object({
  opportunity: z.string(),
  size: z.enum(['small', 'medium', 'large']),
  timing: z.enum(['now', '3-6 months', '6-12 months']),
  difficulty: z.enum(['low', 'medium', 'high']),
  /** Blue Ocean ERRC axis (Eliminate / Reduce / Raise / Create). */
  errc: z.enum(['eliminate', 'reduce', 'raise', 'create']).optional(),
  /** JTBD hypothesis — what job is the customer hiring this for. */
  jtbd: z.string().optional(),
});

export const opportunityCardSchema = z.object({
  opportunities: z.array(evidenceCitedSchema(opportunityValueSchema)),
});

export type OpportunityCard = z.infer<typeof opportunityCardSchema>;
