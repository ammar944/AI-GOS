/**
 * ingest-identity — Output schema (IdentityCard)
 *
 * Typed output contract. Facts only. No scores, no recommendations.
 * Every factual claim is anchored to a source in `sources[]`.
 *
 * Fields:
 * - company_name / domain: the canonical subject
 * - category: 1-3 words describing what the company does (e.g. "B2B SaaS", "DTC Fashion")
 * - core_keywords: terms the company wants to rank for / be found under
 * - negative_keywords: terms that must be excluded from ads/SEO to avoid mistargeting
 * - sources: provenance array; every claim traceable to at least one entry
 *
 * Empty arrays are allowed — factually "no keywords collected yet" beats
 * fabricated ones. The sanity-check script (scripts/sanity-check.ts) flags
 * scaffold / obviously-empty outputs and hard-fails unless ALLOW_SUSPECT=1.
 */
import { z } from "zod";

export const IdentitySourceSchema = z.object({
  source_url: z.string().min(1),
  retrieved_at: z.string().datetime(),
  describes: z.string().min(1),
});

export type IdentitySource = z.infer<typeof IdentitySourceSchema>;

export const IdentityCardOutputSchema = z.object({
  run_id: z.string().min(1),
  company_name: z.string().min(1),
  domain: z.string().min(1),
  category: z.string().min(1),
  core_keywords: z.array(z.string().min(1)),
  negative_keywords: z.array(z.string().min(1)),
  sources: z.array(IdentitySourceSchema),
  generated_at: z.string().datetime(),
});

export type IdentityCardOutput = z.infer<typeof IdentityCardOutputSchema>;

/**
 * Fragment schema — what the main agent writes to <runDir>/fragments/identity.json.
 * Partial of IdentityCardOutput; orchestrate.ts merges this with the run context.
 */
export const IdentityFragmentSchema = IdentityCardOutputSchema
  .partial()
  .required({
    company_name: true,
    domain: true,
    category: true,
    sources: true,
  });

export type IdentityFragment = z.infer<typeof IdentityFragmentSchema>;
