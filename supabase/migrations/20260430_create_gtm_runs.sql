-- Migration: gtm_runs table for chat-driven Pre-Pitch Positioning Audit pipeline
-- Date: 2026-04-30
-- Design doc: ~/.gstack/projects/ammar944-AI-GOS/ammar-refactor-agent-loop-v1-design-20260430-124931.md
-- Supersedes the unlanded 2026-04-24 brief/snapshot draft at docs/migrations/2026-04-24-add-gtm-brief-tables.sql.
-- The new architecture uses a single gtm_runs table with stages jsonb, no gtm_briefs/gtm_brief_snapshots.

CREATE TABLE IF NOT EXISTS public.gtm_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL UNIQUE,
  user_id text NOT NULL,
  input_url text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  manifest jsonb,
  stages jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gtm_runs_status_check CHECK (status IN (
    'queued',
    'running',
    'awaiting_user',
    'completed',
    'partial',
    'failed'
  ))
);

CREATE INDEX IF NOT EXISTS idx_gtm_runs_user_id    ON public.gtm_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_gtm_runs_run_id     ON public.gtm_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_gtm_runs_status     ON public.gtm_runs(status);
CREATE INDEX IF NOT EXISTS idx_gtm_runs_created_at ON public.gtm_runs(created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_gtm_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gtm_runs_updated_at ON public.gtm_runs;
CREATE TRIGGER trg_gtm_runs_updated_at
  BEFORE UPDATE ON public.gtm_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_gtm_runs_updated_at();

-- Row Level Security (Clerk JWT text subject pattern)
ALTER TABLE public.gtm_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own runs" ON public.gtm_runs;
CREATE POLICY "Users can manage their own runs"
  ON public.gtm_runs
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  );

-- Documentation
COMMENT ON TABLE public.gtm_runs IS
  'GTM agent run state for the chat-driven Pre-Pitch Positioning Audit pipeline (Approach A, design 2026-04-30). One row per prospect run. The chat thread at /gtm/[runId] is rendered from this row; this is the source of truth.';

COMMENT ON COLUMN public.gtm_runs.run_id IS
  'Stable URL-friendly run identifier the frontend queries by (used in /gtm/[runId] route). Distinct from id (uuid PK).';

COMMENT ON COLUMN public.gtm_runs.input_url IS
  'The prospect SaaS URL pasted at /gtm/new. The first input the orchestrator works from.';

COMMENT ON COLUMN public.gtm_runs.status IS
  'Run lifecycle. awaiting_user = orchestrator yielded conversationally on a blocker source_gap. partial = >=1 stage completed + >=1 blocked, still produces a usable audit. See .claude/architecture/refactor-agent-loop-v1-design-2026-04-29.md for the locked state machine.';

COMMENT ON COLUMN public.gtm_runs.stages IS
  'Map of stageName -> { status, started_at, completed_at, tool_calls[], output, source_gaps[] }. Stage statuses: queued|running|complete|blocked|timed_out|errored. Validated by zod schemas in src/lib/gtm/* and research-worker/src/schemas/*.';

COMMENT ON COLUMN public.gtm_runs.manifest IS
  'Free-form orchestrator/run metadata (tools registered, prompt version, lighthouse-scope allow-list snapshot, etc.). Intentionally schemaless for rapid iteration.';
