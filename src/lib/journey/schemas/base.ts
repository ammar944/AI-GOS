import { z } from 'zod';

/**
 * Flexible enum parser — normalizes AI output (casing, phrasing) to valid enum values.
 * Uses keyword matching with a safe fallback instead of strict z.enum().
 */
export function flexibleEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number],
): z.ZodType<T[number]> {
  return z.string().transform((val): T[number] => {
    const lower = val.toLowerCase().trim();
    // Exact match first
    if ((values as readonly string[]).includes(lower)) return lower as T[number];
    // Keyword match (e.g. "Mid-Market" matches "mid-market")
    for (const v of values) {
      if (lower.includes(v)) return v;
    }
    return fallback;
  }) as unknown as z.ZodType<T[number]>;
}

// Relaxed: accept empty strings — AI frequently returns "" for fields it cannot fill.
// The .min(1) constraint caused widespread validation failures across all research sections.
export const nonEmptyStringSchema = z.string().trim();

// Relaxed: accept empty arrays — AI may not always have data for every field.
export const nonEmptyStringArraySchema = z.array(z.string()).default([]);

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
  source: flexibleEnum(
    ['gap_organic', 'gap_paid', 'competitor_top', 'related', 'shared'] as const,
    'related',
  ).optional(),
});

export type KeywordOpportunity = z.infer<typeof keywordOpportunitySchema>;
