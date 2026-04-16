/**
 * Opportunity card schema — each opportunity cites wiki entries.
 * Source runner: industryMarket.
 * Current inline shape (pre-migration): runners/industry.ts marketOpportunities array.
 */
import { z } from 'zod';
import { evidenceCitedSchema } from './base';

const opportunityValueSchema = z.object({
  opportunity: z.string().min(10),
  /** Opportunity archetype from market-opportunity methodology (A-G). */
  archetype: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
  size: z.enum(['small', 'medium', 'large']),
  timing: z.enum(['now', '3-6 months', '6-12 months']),
  difficulty: z.enum(['low', 'medium', 'high']),
  /** Specific research finding that backs this opportunity. */
  evidence: z.string().min(10),
  /** URL if evidence comes from a web_search source. */
  evidenceUrl: z.string().url().optional(),
  /** Why this opportunity exists and how paid media exploits it. */
  mechanism: z.string().min(10),
  /** Blue Ocean ERRC axis (Eliminate / Reduce / Raise / Create). */
  errc: z.enum(['eliminate', 'reduce', 'raise', 'create']).optional(),
  /** JTBD hypothesis — what job is the customer hiring this for. */
  jtbd: z.string().optional(),
});

export const opportunityCardSchema = z.object({
  opportunities: z.array(evidenceCitedSchema(opportunityValueSchema)),
});

export type OpportunityCard = z.infer<typeof opportunityCardSchema>;
