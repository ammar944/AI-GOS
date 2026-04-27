/**
 * research-keywords output schema.
 * Facts only. No LLM scores, recommended budgets, or fabricated keyword metrics.
 */
import { z } from "zod";

export const sourceSchema = z
  .object({
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

export const sourcedClaimSchema = sourceSchema
  .extend({
    claim: z.string().min(1),
  })
  .strict();

export const keywordMetricSchema = sourceSchema
  .extend({
    keyword: z.string().min(1),
    provider: z.enum([
      "spyfu",
      "google_ads",
      "searchapi",
      "semrush",
      "ahrefs",
      "public_serp",
      "none",
    ]),
    search_volume: z.string().min(1).optional(),
    cpc: z.string().min(1).optional(),
    competition: z.string().min(1).optional(),
    metric_status: z.enum(["verified", "unavailable"]),
  })
  .strict();

export const intentClusterSchema = z
  .object({
    cluster_name: z.string().min(1),
    intent: z.enum([
      "problem",
      "category",
      "solution",
      "comparison",
      "competitor",
      "pricing",
      "implementation",
      "content_gap",
    ]),
    funnel_stage: z.enum([
      "problem_aware",
      "solution_aware",
      "product_aware",
      "most_aware",
    ]),
    queries: z.array(keywordMetricSchema).min(1),
    evidence: z.array(sourcedClaimSchema).min(1),
  })
  .strict();

export const contentGapSchema = sourceSchema
  .extend({
    gap: z.string().min(1),
    observed_query: z.string().min(1),
    current_result_pattern: z.string().min(1),
    buyer_question: z.string().min(1),
  })
  .strict();

export const negativeKeywordSchema = sourceSchema
  .extend({
    keyword: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

export const sourceGapSchema = sourceSchema
  .extend({
    topic: z.enum(["volume", "cpc", "competition", "serp", "content_gap"]),
    reason: z.string().min(1),
    attempted_queries: z.array(z.string().min(1)),
  })
  .strict();

export const researchKeywordsOutputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("research-demand-intent"),
    company_name: z.string().min(1),
    category: z.string().min(1),
    provider_status: z.array(sourcedClaimSchema),
    intent_clusters: z.array(intentClusterSchema).min(1),
    paid_keyword_opportunities: z.array(keywordMetricSchema),
    content_gaps: z.array(contentGapSchema),
    negative_keywords: z.array(negativeKeywordSchema),
    excluded_terms: z.array(negativeKeywordSchema),
    source_gaps: z.array(sourceGapSchema),
    generated_at: z.string().datetime(),
  })
  .strict();

export type KeywordMetric = z.infer<typeof keywordMetricSchema>;
export type IntentCluster = z.infer<typeof intentClusterSchema>;
export type ResearchKeywordsOutput = z.infer<typeof researchKeywordsOutputSchema>;
