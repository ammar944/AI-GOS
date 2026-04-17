-- Phase 0.4 — structured pipeline telemetry.
-- Append-only event log for runner/card timing, token usage, and cache hits.
-- Written fire-and-forget from research-worker; gated by RESEARCH_TELEMETRY_PERSIST=true.

create table if not exists public.research_telemetry (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  user_id text,
  event text not null,
  section text,
  card text,
  phase text,
  duration_ms integer,
  model text,
  input_tokens integer,
  output_tokens integer,
  cache_creation_tokens integer,
  cache_read_tokens integer,
  estimated_cost_usd numeric(10, 6),
  error_message text,
  extra jsonb,
  event_timestamp timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists research_telemetry_run_id_ts_idx
  on public.research_telemetry (run_id, event_timestamp desc);

create index if not exists research_telemetry_user_id_ts_idx
  on public.research_telemetry (user_id, event_timestamp desc);

create index if not exists research_telemetry_event_ts_idx
  on public.research_telemetry (event, event_timestamp desc);

-- Retention: telemetry is high-volume; expire rows after 30 days.
-- Run via Supabase scheduled function or pg_cron if extensions allow.
-- (Leaving as a manual step for now — documented in plan.)

comment on table public.research_telemetry is
  'Pipeline event log. Fire-and-forget writes from research-worker. 30-day retention recommended.';
