import { z } from "zod";

export const sourceSchema = z.object({
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
});

export const sourcedClaimSchema = sourceSchema.extend({
  claim: z.string().min(1),
  source_path: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
});

export const derivedFromSchema = z.enum([
  "research-voc",
  "research-icp",
  "research-offer",
  "synthesize-positioning",
  "synthesize-media-plan",
  "research-competitor",
  "research-keywords",
  "gtm-brief",
]);

export const awarenessLevelSchema = z.enum([
  "unaware",
  "problem",
  "solution",
  "product",
  "mostAware",
]);

export const inMarketTierSchema = z.enum([
  "in-market",
  "needs-convinced",
  "cold-mass",
]);

export const platformSchema = z.enum(["meta", "google", "linkedin"]);
export const formatSchema = z.enum(["video", "static", "email"]);
export const durationSchema = z.enum(["10s", "30s", "60s"]);

export const scriptAngleSchema = z.enum([
  "painPoint",
  "outcome",
  "socialProof",
  "curiosity",
  "urgency",
  "identity",
  "contrarian",
]);

export const derivedLineSchema = z.object({
  text: z.string().min(1),
  role: z.enum(["hook", "middle", "cta"]),
  derived_from: z.array(derivedFromSchema).min(1),
  evidence: z.array(sourcedClaimSchema).min(1),
});

export const scriptSchema = z.object({
  id: z.string().min(1),
  awareness_level: awarenessLevelSchema,
  in_market_tier: inMarketTierSchema,
  platform: platformSchema,
  format: formatSchema,
  angle: scriptAngleSchema,
  framework: z.string().min(1),
  duration: durationSchema,
  hook: derivedLineSchema,
  middle: z.array(derivedLineSchema).min(1),
  cta: derivedLineSchema,
  hook_variants: z.array(derivedLineSchema).max(5),
  objection_handled: derivedLineSchema.optional(),
  flagged_claims: z.array(
    z.object({
      claim: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
  quality_gate: z.object({
    passed: z.boolean(),
    violations: z.array(z.string()),
    auto_fixes: z.number().int().min(0),
  }),
});

export const dynamicCreativeSetSchema = z.object({
  platform: platformSchema,
  script_ids: z.array(z.string().min(1)).min(1),
});

export const synthesizeScriptsOutputSchema = z.object({
  run_id: z.string().min(1),
  brief_snapshot_id: z.string().min(1),
  stage: z.literal("generate-scripts"),
  company_name: z.string().min(1),
  scripts: z.array(scriptSchema).min(9).max(15),
  dynamic_creative_sets: z.array(dynamicCreativeSetSchema),
  matrix_warnings: z.array(z.string()),
  style_references_used: z.array(sourcedClaimSchema),
  generated_at: z.string().datetime(),
});

export type Source = z.infer<typeof sourceSchema>;
export type SourcedClaim = z.infer<typeof sourcedClaimSchema>;
export type DerivedFrom = z.infer<typeof derivedFromSchema>;
export type AwarenessLevel = z.infer<typeof awarenessLevelSchema>;
export type InMarketTier = z.infer<typeof inMarketTierSchema>;
export type ScriptPlatform = z.infer<typeof platformSchema>;
export type ScriptFormat = z.infer<typeof formatSchema>;
export type ScriptDuration = z.infer<typeof durationSchema>;
export type ScriptAngle = z.infer<typeof scriptAngleSchema>;
export type DerivedLine = z.infer<typeof derivedLineSchema>;
export type Script = z.infer<typeof scriptSchema>;
export type SynthesizeScriptsOutput = z.infer<typeof synthesizeScriptsOutputSchema>;
