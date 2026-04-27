import { z } from "zod";
import {
  awarenessLevelSchema,
  derivedFromSchema,
  sourcedClaimSchema,
} from "./output.ts";

const textArraySchema = z.array(z.string().min(1)).min(1);
const proofArraySchema = z.array(sourcedClaimSchema);

const requiredFields = z.object({
  companyName: z.string().min(1),
  companyUrl: z.string().url(),
  category: z.string().min(1),
  productDescription: z.string().min(1),
  targetCustomer: z.string().min(1),
  primaryIcpDescription: z.string().min(1),
  awarenessLevel: awarenessLevelSchema,
  icpPains: textArraySchema,
  buyingTriggers: textArraySchema,
  icpObjections: textArraySchema,
  corePromise: z.string().min(1),
  keyPromises: textArraySchema,
  commonObjections: textArraySchema,
  tone: z.string().min(1),
  forbiddenClaims: z.array(z.string().min(1)),
  testimonials: proofArraySchema,
  caseStudies: proofArraySchema,
  metrics: proofArraySchema,
  claims: proofArraySchema.min(1),
  styleReferences: proofArraySchema,
});

const optionalFields = z.object({
  brandPositioning: z.string().min(1).optional(),
  compliance: z.array(z.string().min(1)).optional(),
  brandGeography: z.string().min(1).optional(),
  cta: z.string().min(1).optional(),
  conversionPath: z.string().min(1).optional(),
});

export const lockedBriefFieldsSchema = requiredFields.merge(optionalFields).strict();

export const lockedBriefSchema = z.object({
  fields: lockedBriefFieldsSchema,
}).strict();

export const upstreamArtifactSchema = z.object({
  skill: derivedFromSchema.exclude(["gtm-brief"]),
  summary: z.string().min(1),
  claims: z.array(sourcedClaimSchema).min(1),
}).strict();

export const synthesizeScriptsInputSchema = z.object({
  run_id: z.string().min(1),
  brief_snapshot_id: z.string().min(1),
  stage: z.literal("generate-scripts"),
  selected_awareness_levels: z.array(awarenessLevelSchema).min(3).max(5).optional(),
  locked_brief: lockedBriefSchema,
  upstream_outputs: z.object({
    "research-voc": upstreamArtifactSchema,
    "research-icp": upstreamArtifactSchema,
    "research-offer": upstreamArtifactSchema,
    "synthesize-positioning": upstreamArtifactSchema,
    "synthesize-media-plan": upstreamArtifactSchema.optional(),
    "research-competitor": upstreamArtifactSchema.optional(),
    "research-keywords": upstreamArtifactSchema.optional(),
  }).strict(),
  brand_voice_notes: z.object({
    tone: z.string().min(1),
    constraints: z.array(z.string().min(1)),
  }).strict().optional(),
}).strict();

export type LockedBriefFields = z.infer<typeof lockedBriefFieldsSchema>;
export type UpstreamArtifact = z.infer<typeof upstreamArtifactSchema>;
export type SynthesizeScriptsInput = z.infer<typeof synthesizeScriptsInputSchema>;
