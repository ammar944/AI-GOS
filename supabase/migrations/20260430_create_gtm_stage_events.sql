-- Migration: GTM stage event timeline for worker-backed skill execution
-- Date: 2026-04-30

CREATE TABLE IF NOT EXISTS public.gtm_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL REFERENCES public.gtm_runs(run_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  stage text NOT NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  tool_name text,
  artifact_path text,
  source_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gtm_stage_events_event_type_check CHECK (event_type IN (
    'queued',
    'started',
    'heartbeat',
    'tool_call',
    'artifact_written',
    'validation_started',
    'validation_passed',
    'validation_failed',
    'completed',
    'blocked',
    'timed_out',
    'errored'
  )),
  CONSTRAINT gtm_stage_events_status_check CHECK (status IN (
    'queued',
    'running',
    'complete',
    'blocked',
    'timed_out',
    'errored'
  )),
  CONSTRAINT gtm_stage_events_duration_check CHECK (
    duration_ms IS NULL OR duration_ms >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_gtm_stage_events_run_id
  ON public.gtm_stage_events(run_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_gtm_stage_events_user_id
  ON public.gtm_stage_events(user_id, created_at DESC);

ALTER TABLE public.gtm_stage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own GTM stage events"
  ON public.gtm_stage_events;
CREATE POLICY "Users can read their own GTM stage events"
  ON public.gtm_stage_events
  FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  );

DROP POLICY IF EXISTS "Users can write their own GTM stage events"
  ON public.gtm_stage_events;
CREATE POLICY "Users can write their own GTM stage events"
  ON public.gtm_stage_events
  FOR INSERT
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  );

COMMENT ON TABLE public.gtm_stage_events IS
  'Append-only GTM stage activity stream. Worker and app write granular events so /gtm/[runId] can show live agent progress.';
