import { z } from 'zod';

export const nonEmptyStringSchema = z.string().trim().min(1);

export const nonEmptyStringArraySchema = z.array(nonEmptyStringSchema).min(1);

export const stringOrNumberSchema = z.union([z.string(), z.number()]);

export const namedSummarySchema = z.object({
  title: nonEmptyStringSchema.optional(),
  name: nonEmptyStringSchema.optional(),
  description: nonEmptyStringSchema.optional(),
  summary: nonEmptyStringSchema.optional(),
});

export const scoreBreakdownSchema = z.object({
  factor: nonEmptyStringSchema,
  relevance: z.number().min(0).max(100).optional(),
});

// V3 shared types

export const keywordOpportunitySchema = z.object({
  keyword: nonEmptyStringSchema,
  searchVolume: z.number(),
  cpc: z.number(),
  difficulty: z.number().min(0).max(100),
  source: z
    .enum([
      'gap_organic',
      'gap_paid',
      'competitor_top',
      'related',
      'shared',
    ])
    .optional(),
});

export type KeywordOpportunity = z.infer<typeof keywordOpportunitySchema>;
