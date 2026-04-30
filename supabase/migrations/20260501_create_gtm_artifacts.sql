-- Migration: gtm_artifacts table for versioned markdown artifacts
-- PRD: gtm-conversational-canvas (Task T2)
-- Date: 2026-05-01
-- Design doc: .karimo/prds/001_gtm-conversational-canvas/PRD_gtm-conversational-canvas.md
--
-- Each lighthouse skill output and each agent patch is stored as a versioned
-- markdown artifact. v1 = initial render from skill JSON output. vN+1 either
-- comes from a skill re-run (source='skill_output') or from a textual edit by
-- the orchestrator (source='agent_patch'). user_id is denormalized from
-- gtm_runs so RLS doesn't need a JOIN on every read.

CREATE TABLE IF NOT EXISTS public.gtm_artifacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      text NOT NULL REFERENCES public.gtm_runs(run_id) ON DELETE CASCADE,
  user_id     text NOT NULL,
  skill       text NOT NULL,
  version     int  NOT NULL DEFAULT 1,
  parent_id   uuid REFERENCES public.gtm_artifacts(id),
  content_md  text NOT NULL,
  source      text NOT NULL,
  created_by  text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT gtm_artifacts_source_check CHECK (source IN (
    'skill_output',
    'agent_patch'
  )),
  CONSTRAINT gtm_artifacts_version_check CHECK (version >= 1),
  CONSTRAINT gtm_artifacts_run_skill_version_unique UNIQUE (run_id, skill, version)
);

CREATE INDEX IF NOT EXISTS idx_gtm_artifacts_run_id      ON public.gtm_artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_gtm_artifacts_user_id     ON public.gtm_artifacts(user_id);
CREATE INDEX IF NOT EXISTS idx_gtm_artifacts_run_skill   ON public.gtm_artifacts(run_id, skill, version DESC);
CREATE INDEX IF NOT EXISTS idx_gtm_artifacts_created_at  ON public.gtm_artifacts(created_at DESC);

-- Row Level Security (Clerk JWT text subject pattern, mirrors gtm_runs)
ALTER TABLE public.gtm_artifacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own artifacts" ON public.gtm_artifacts;
CREATE POLICY "Users can manage their own artifacts"
  ON public.gtm_artifacts
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  );

-- Documentation
COMMENT ON TABLE public.gtm_artifacts IS
  'Versioned markdown artifacts produced by lighthouse skills and the orchestrator chat. One row per (run_id, skill, version). v1 = initial render from skill JSON. vN+1 = either skill re-run or agent textual patch. See PRD_gtm-conversational-canvas.md for design.';

COMMENT ON COLUMN public.gtm_artifacts.run_id IS
  'FK to gtm_runs.run_id. Cascades on run deletion.';

COMMENT ON COLUMN public.gtm_artifacts.user_id IS
  'Clerk text user_id, denormalized from gtm_runs for RLS performance (avoids JOIN). Must match the parent run''s user_id at insert time.';

COMMENT ON COLUMN public.gtm_artifacts.skill IS
  'Lighthouse skill slug (ingest-url, ingest-identity, research-icp, research-competitor, research-offer). Synthesis skills will reuse this column when wired in Phase 2.';

COMMENT ON COLUMN public.gtm_artifacts.version IS
  'Sequential per (run_id, skill). Starts at 1. Increments on every re-render or patch.';

COMMENT ON COLUMN public.gtm_artifacts.parent_id IS
  'Self-FK to the version this row supersedes. NULL for v1.';

COMMENT ON COLUMN public.gtm_artifacts.source IS
  'skill_output = rendered from a fresh skill JSON output (paid). agent_patch = orchestrator-applied textual edit on the prior MD (free, evidence-preserving).';

COMMENT ON COLUMN public.gtm_artifacts.created_by IS
  'Clerk user_id when the user explicitly triggered the change, or ''orchestrator'' when the chat agent acted autonomously. Used for audit, not RLS.';

COMMENT ON COLUMN public.gtm_artifacts.metadata IS
  'Free-form per-version metadata: refinement_context, evidence_url_count, prompt_version, etc. Schemaless for iteration speed.';
