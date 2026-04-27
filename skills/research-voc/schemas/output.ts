/**
 * research-voc output schema.
 * Category-only VoC evidence. No competitor review mining, product claims, recommendations, or fabricated values.
 */
import { z } from "zod";

const PLACEHOLDER_VALUES = new Set([
  "unknown",
  "tbd",
  "n/a",
  "na",
  "scaffold",
  "placeholder",
]);

export function normalizeForExclusion(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function containsNormalizedTerm(value: string, term: string): boolean {
  const normalizedValue = normalizeForExclusion(value);
  const normalizedTerm = normalizeForExclusion(term);

  if (normalizedValue.length === 0 || normalizedTerm.length < 2) {
    return false;
  }

  return ` ${normalizedValue} `.includes(` ${normalizedTerm} `);
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_VALUES.has(normalizeForExclusion(value));
}

export const sourceSchema = z
  .object({
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
    source_title: z.string().min(1).optional(),
  })
  .strict();

export const sourcedClaimSchema = sourceSchema
  .extend({
    claim: z.string().min(1),
  })
  .strict();

export const vocQuoteSchema = sourceSchema
  .extend({
    quote: z.string().min(1),
    source_platform: z.enum([
      "reddit",
      "hacker_news",
      "forum",
      "blog_comment",
      "community",
      "review_site",
      "other",
    ]),
    problem_space: z.string().min(1),
    speaker_context: z.string().min(1).optional(),
    theme: z.string().min(1),
  })
  .strict();

export const workaroundSchema = sourceSchema
  .extend({
    workaround: z.string().min(1),
    pain_it_reveals: z.string().min(1),
    quote: z.string().min(1).optional(),
  })
  .strict();

export const exclusionSchema = z
  .object({
    term: z.string().min(1),
    source: z.enum(["research-competitor", "brief", "ingest-identity"]),
    reason: z.string().min(1),
  })
  .strict();

export const sourceGapSchema = sourceSchema
  .extend({
    topic: z.enum(["reddit", "hacker_news", "forum", "review_site", "community"]),
    reason: z.string().min(1),
    attempted_queries: z.array(z.string().min(1)),
  })
  .strict();

export const rejectedCompetitorMatchSchema = sourceSchema
  .extend({
    rejected_term: z.string().min(1),
    matched_competitor: z.string().min(1),
  })
  .strict();

export const researchVocOutputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("research-voc"),
    company_name: z.string().min(1),
    category: z.string().min(1),
    exclusion_terms: z.array(exclusionSchema).min(1),
    category_pain_language: z.array(vocQuoteSchema).min(1),
    status_quo_frustrations: z.array(vocQuoteSchema),
    workarounds: z.array(workaroundSchema),
    desired_outcomes: z.array(sourcedClaimSchema),
    objection_language: z.array(vocQuoteSchema),
    source_gaps: z.array(sourceGapSchema),
    rejected_competitor_matches: z.array(rejectedCompetitorMatchSchema),
    generated_at: z.string().datetime(),
  })
  .strict()
  .superRefine((output, context) => {
    const terms = output.exclusion_terms.map((entry) => entry.term);

    const checkText = (path: Array<string | number>, value: string): void => {
      if (isPlaceholder(value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: `placeholder value is not allowed: ${value}`,
        });
      }

      const matched = terms.find((term) => containsNormalizedTerm(value, term));
      if (matched) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: `contains excluded term: ${matched}`,
        });
      }
    };

    const checkSourceTitle = (
      path: Array<string | number>,
      sourceTitle: string | undefined,
    ): void => {
      if (sourceTitle) {
        checkText([...path, "source_title"], sourceTitle);
      }
    };

    output.category_pain_language.forEach((entry, index) => {
      checkText(["category_pain_language", index, "quote"], entry.quote);
      checkText(["category_pain_language", index, "problem_space"], entry.problem_space);
      checkText(["category_pain_language", index, "theme"], entry.theme);
      checkSourceTitle(["category_pain_language", index], entry.source_title);
    });

    output.status_quo_frustrations.forEach((entry, index) => {
      checkText(["status_quo_frustrations", index, "quote"], entry.quote);
      checkText(["status_quo_frustrations", index, "problem_space"], entry.problem_space);
      checkText(["status_quo_frustrations", index, "theme"], entry.theme);
      checkSourceTitle(["status_quo_frustrations", index], entry.source_title);
    });

    output.objection_language.forEach((entry, index) => {
      checkText(["objection_language", index, "quote"], entry.quote);
      checkText(["objection_language", index, "problem_space"], entry.problem_space);
      checkText(["objection_language", index, "theme"], entry.theme);
      checkSourceTitle(["objection_language", index], entry.source_title);
    });

    output.workarounds.forEach((entry, index) => {
      checkText(["workarounds", index, "workaround"], entry.workaround);
      checkText(["workarounds", index, "pain_it_reveals"], entry.pain_it_reveals);
      if (entry.quote) {
        checkText(["workarounds", index, "quote"], entry.quote);
      }
      checkSourceTitle(["workarounds", index], entry.source_title);
    });

    output.desired_outcomes.forEach((entry, index) => {
      checkText(["desired_outcomes", index, "claim"], entry.claim);
      checkSourceTitle(["desired_outcomes", index], entry.source_title);
    });

    output.source_gaps.forEach((entry, index) => {
      checkText(["source_gaps", index, "reason"], entry.reason);
      entry.attempted_queries.forEach((query, queryIndex) => {
        checkText(["source_gaps", index, "attempted_queries", queryIndex], query);
      });
      checkSourceTitle(["source_gaps", index], entry.source_title);
    });

    output.rejected_competitor_matches.forEach((entry, index) => {
      if (isPlaceholder(entry.rejected_term)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rejected_competitor_matches", index, "rejected_term"],
          message: `placeholder value is not allowed: ${entry.rejected_term}`,
        });
      }
      if (isPlaceholder(entry.matched_competitor)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rejected_competitor_matches", index, "matched_competitor"],
          message: `placeholder value is not allowed: ${entry.matched_competitor}`,
        });
      }
      checkSourceTitle(["rejected_competitor_matches", index], entry.source_title);
    });
  });

export type ResearchVocOutput = z.infer<typeof researchVocOutputSchema>;
export type ExclusionTerm = z.infer<typeof exclusionSchema>;
export type Source = z.infer<typeof sourceSchema>;
