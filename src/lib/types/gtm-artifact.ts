// Types for the gtm_artifacts table.
// PRD: gtm-conversational-canvas (T2)
// Source of truth: supabase/migrations/20260501_create_gtm_artifacts.sql

import { z } from "zod";

export const GTM_ARTIFACT_SOURCES = ["skill_output", "agent_patch"] as const;
export type GtmArtifactSource = (typeof GTM_ARTIFACT_SOURCES)[number];

export const gtmArtifactSchema = z.object({
  id: z.string().uuid(),
  run_id: z.string().min(1),
  user_id: z.string().min(1),
  skill: z.string().min(1),
  version: z.number().int().positive(),
  parent_id: z.string().uuid().nullable(),
  content_md: z.string(),
  source: z.enum(GTM_ARTIFACT_SOURCES),
  created_by: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string(),
});

export type GtmArtifact = z.infer<typeof gtmArtifactSchema>;

export const gtmArtifactInsertSchema = gtmArtifactSchema
  .omit({ id: true, created_at: true })
  .extend({
    metadata: z.record(z.string(), z.unknown()).default({}),
  });

export type GtmArtifactInsert = z.infer<typeof gtmArtifactInsertSchema>;
