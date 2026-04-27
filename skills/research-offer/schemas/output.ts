/**
 * research-offer output contract.
 * Facts only. No scores, no recommendations, no generated copy.
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

export const sourcedValueSchema = sourceSchema
  .extend({
    label: z.string().min(1),
    value: z.string().min(1),
  })
  .strict();

export const pricingSignalSchema = sourceSchema
  .extend({
    plan_name: z.string().min(1).optional(),
    price_text: z.string().min(1),
    billing_period: z.string().min(1).optional(),
    caveats: z.array(z.string().min(1)),
  })
  .strict();

export const offerPathSchema = z
  .object({
    promise: z.array(sourcedClaimSchema),
    cta: z.array(sourcedClaimSchema),
    first_value_path: z.array(sourcedClaimSchema),
    activation_friction: z.array(sourcedClaimSchema),
  })
  .strict();

export const publicObjectionSchema = sourceSchema
  .extend({
    objection: z.string().min(1),
    evidence_type: z.enum([
      "pricing",
      "proof",
      "clarity",
      "implementation",
      "risk",
      "alternative",
    ]),
  })
  .strict();

const sourceGapSchema = z
  .object({
    topic: z.enum(["pricing", "proof", "activation", "objections", "packaging"]),
    reason: z.string().min(1),
    attempted_sources: z.array(z.string().min(1)),
  })
  .strict();

export const researchOfferOutputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("research-offer-funnel"),
    company_name: z.string().min(1),
    offer_name: z.string().min(1).optional(),
    category: z.string().min(1),
    offer_path: offerPathSchema,
    value_props: z.array(sourcedValueSchema),
    proof_assets: z.array(sourcedClaimSchema),
    pricing_signals: z.array(pricingSignalSchema),
    packaging_notes: z.array(sourcedClaimSchema),
    public_objections: z.array(publicObjectionSchema),
    source_gaps: z.array(sourceGapSchema),
    generated_at: z.string().datetime(),
  })
  .strict();

export type ResearchOfferOutput = z.infer<typeof researchOfferOutputSchema>;
