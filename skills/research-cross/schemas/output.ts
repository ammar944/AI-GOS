/**
 * research-cross output schema.
 * Synthesis only: every finding is derived from at least two upstream skill outputs.
 */
import { z } from "zod";

export const sourceSchema = z
  .object({
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

export const provenanceSkillSchema = z.enum([
  "ingest-identity",
  "research-market",
  "research-icp",
  "research-offer",
  "research-competitor",
  "research-voc",
  "research-keywords",
]);

export const provenanceSchema = sourceSchema
  .extend({
    skill: provenanceSkillSchema,
    output_path: z.string().min(1),
    evidence_id: z.string().min(1).optional(),
  })
  .strict();

export const evidenceClaimSchema = sourceSchema
  .extend({
    claim: z.string().min(1),
  })
  .strict();

export const crossFindingSchema = z
  .object({
    finding: z.string().min(1),
    finding_type: z.enum(["overlap", "contradiction", "gap", "theme", "risk"]),
    derived_from: z.array(provenanceSchema).min(2),
    evidence: z.array(evidenceClaimSchema).min(1),
  })
  .strict()
  .superRefine((finding, context) => {
    const skillCount = new Set(finding.derived_from.map((item) => item.skill)).size;
    if (skillCount < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["derived_from"],
        message: "derived_from must reference at least two distinct upstream skills",
      });
    }
  });

export const contradictionSchema = z
  .object({
    topic: z.string().min(1),
    conflict: z.string().min(1),
    sides: z
      .array(
        z
          .object({
            claim: z.string().min(1),
            provenance: provenanceSchema,
          })
          .strict(),
      )
      .min(2),
    resolution_needed: z.string().min(1),
  })
  .strict()
  .superRefine((contradiction, context) => {
    const skillCount = new Set(
      contradiction.sides.map((side) => side.provenance.skill),
    ).size;
    if (skillCount < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sides"],
        message: "contradiction sides must cite at least two distinct upstream skills",
      });
    }
  });

export const gapSchema = z
  .object({
    gap: z.string().min(1),
    blocked_downstream_decision: z.string().min(1),
    missing_from_skills: z.array(provenanceSkillSchema).min(1),
  })
  .strict();

export const inputManifestItemSchema = z
  .object({
    skill: provenanceSkillSchema,
    status: z.enum(["present", "missing", "invalid"]),
    generated_at: z.string().datetime().optional(),
  })
  .strict();

export const researchCrossOutputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("synthesize-strategy"),
    company_name: z.string().min(1),
    category: z.string().min(1),
    input_manifest: z.array(inputManifestItemSchema).min(7),
    cross_findings: z.array(crossFindingSchema).min(1),
    contradictions: z.array(contradictionSchema),
    research_gaps: z.array(gapSchema),
    high_confidence_themes: z.array(crossFindingSchema),
    readiness_blockers: z.array(gapSchema),
    generated_at: z.string().datetime(),
  })
  .strict();

export type ResearchCrossOutput = z.infer<typeof researchCrossOutputSchema>;
