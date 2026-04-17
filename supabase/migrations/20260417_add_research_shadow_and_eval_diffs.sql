-- Phase 0.2 — shadow mode infrastructure.
--
-- `research_results_shadow` receives output from opt-in v2 pipelines (behind
-- RESEARCH_SHADOW_MODE=true env flag) so we can diff against the primary
-- `journey_sessions.research_results` JSONB without ever showing it to users.
--
-- `research_eval_diffs` stores field-level deltas between primary and shadow
-- runs so quality regressions surface in dashboards before any phase ships.

create table if not exists public.research_results_shadow (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  run_id text not null,
  section text not null,
  result jsonb not null,
  pipeline_version text,
  duration_ms integer,
  created_at timestamptz not null default now(),
  unique (user_id, run_id, section, pipeline_version)
);

create index if not exists research_results_shadow_run_id_idx
  on public.research_results_shadow (run_id);

create index if not exists research_results_shadow_user_id_idx
  on public.research_results_shadow (user_id, created_at desc);

comment on table public.research_results_shadow is
  'Dual-write shadow table. Never shown to users. Diff target for quality gates.';

-- ---------------------------------------------------------------------------

create table if not exists public.research_eval_diffs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  run_id text not null,
  section text not null,
  card text,
  diff_score numeric(5, 4),
  field_recall numeric(5, 4),
  citation_delta integer,
  fabrication_delta integer,
  phase text,
  pipeline_version_primary text,
  pipeline_version_shadow text,
  diff_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists research_eval_diffs_run_id_idx
  on public.research_eval_diffs (run_id);

create index if not exists research_eval_diffs_phase_idx
  on public.research_eval_diffs (phase, created_at desc);

create index if not exists research_eval_diffs_section_idx
  on public.research_eval_diffs (section, created_at desc);

comment on table public.research_eval_diffs is
  'Per-section/card diff between primary and shadow pipelines. Used by '
  'nightly 50-URL shadow eval (Phase 0.6) and ad-hoc regression checks.';
