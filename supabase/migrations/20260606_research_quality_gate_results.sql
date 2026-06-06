-- Additive persistence for Truthgate research-quality gate results.
-- This table stores recomputed gate reports without mutating committed section
-- artifacts, verification tiers, profiles, or shared-session snapshots.

create table if not exists public.research_quality_gate_results (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  artifact_id uuid not null references public.research_artifacts(id) on delete cascade,
  gate_version text not null,
  result jsonb not null,
  report_markdown text,
  computed_at timestamptz not null default now(),
  unique (run_id, gate_version)
);

create index if not exists idx_research_quality_gate_results_artifact
  on public.research_quality_gate_results (artifact_id);

create index if not exists idx_research_quality_gate_results_computed_at
  on public.research_quality_gate_results (computed_at desc);

comment on table public.research_quality_gate_results is
  'Additive Truthgate quality-gate reports recomputed from committed research artifacts.';

comment on column public.research_quality_gate_results.gate_version is
  'Version of the additive gate vocabulary/evaluator used to compute result.';

comment on column public.research_quality_gate_results.result is
  'Full computed gate result JSON, including the additive gates object.';

alter table public.research_quality_gate_results enable row level security;

drop policy if exists "users select own research quality gate results"
  on public.research_quality_gate_results;
create policy "users select own research quality gate results"
  on public.research_quality_gate_results
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.research_artifacts a
      where a.id = artifact_id
        and a.user_id = auth.jwt() ->> 'sub'
    )
  );

grant select on public.research_quality_gate_results to authenticated, service_role;
grant insert, update, delete on public.research_quality_gate_results to service_role;
