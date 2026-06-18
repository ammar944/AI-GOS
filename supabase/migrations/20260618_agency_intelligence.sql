-- Agency Intelligence Console — first-slice schema.
-- Tracker truth (landing analytics, existing) + corpus truth (SaaSLaunch corpus snapshots)
-- + evidence-backed insights. See docs/plans/2026-06-18-agency-intelligence-console-plan.md.
--
-- History/current-state semantics are intentionally separated:
--   * sl_corpus_snapshots         — one full index.json per refresh run (append-only history).
--   * sl_corpus_client_snapshots  — per-client file content per refresh run, keyed by
--                                    (refresh_run_id, client_slug) — append-only history.
--   * sl_corpus_clients_current   — latest per-client state, unique(client_slug), upserted
--                                    on each successful sync (the "current" view).
-- No single table mixes unique(client_slug) with snapshot_id; history and current are distinct.
--
-- No live Slack/Fathom integration tables in this slice (corpus is rebuilt out-of-band by
-- the two-step pipeline; the console only snapshots its output).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) sl_refresh_runs — one row per sync/rebuild execution
-- ---------------------------------------------------------------------------
create table if not exists public.sl_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  run_kind text not null check (run_kind in ('corpus_sync', 'corpus_rebuild')),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  dry_run boolean not null default false,
  manifest_hash text not null,
  client_count integer not null check (client_count >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  source_metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_sl_refresh_runs_status_started
  on public.sl_refresh_runs (status, started_at desc);
create index if not exists idx_sl_refresh_runs_hash
  on public.sl_refresh_runs (manifest_hash);

-- ---------------------------------------------------------------------------
-- 2) sl_corpus_snapshots — full corpus index.json captured per refresh run
-- ---------------------------------------------------------------------------
create table if not exists public.sl_corpus_snapshots (
  id uuid primary key default gen_random_uuid(),
  refresh_run_id uuid not null references public.sl_refresh_runs(id) on delete cascade,
  manifest_hash text not null,
  client_count integer not null check (client_count >= 0),
  index_json jsonb not null,
  captured_at timestamptz not null default now(),
  unique (refresh_run_id)
);

create index if not exists idx_sl_corpus_snapshots_run
  on public.sl_corpus_snapshots (refresh_run_id);
create index if not exists idx_sl_corpus_snapshots_hash_captured
  on public.sl_corpus_snapshots (manifest_hash, captured_at desc);

-- ---------------------------------------------------------------------------
-- 3) sl_corpus_client_snapshots — per-client file content per refresh run (history)
-- ---------------------------------------------------------------------------
create table if not exists public.sl_corpus_client_snapshots (
  id uuid primary key default gen_random_uuid(),
  refresh_run_id uuid not null references public.sl_refresh_runs(id) on delete cascade,
  snapshot_id uuid not null references public.sl_corpus_snapshots(id) on delete cascade,
  client_slug text not null,
  client_display_name text,
  client_json jsonb not null,
  risk_tier text,
  churn_score integer,
  gap_score integer,
  sources_total integer,
  source_counts jsonb not null default '{}'::jsonb,
  actions_count integer not null default 0 check (actions_count >= 0),
  promises_count integer not null default 0 check (promises_count >= 0),
  gaps_count integer not null default 0 check (gaps_count >= 0),
  fathom_meetings_count integer not null default 0 check (fathom_meetings_count >= 0),
  captured_at timestamptz not null default now(),
  unique (refresh_run_id, client_slug)
);

create index if not exists idx_sl_corpus_client_snapshots_run
  on public.sl_corpus_client_snapshots (refresh_run_id);
create index if not exists idx_sl_corpus_client_snapshots_slug_captured
  on public.sl_corpus_client_snapshots (client_slug, captured_at desc);

-- ---------------------------------------------------------------------------
-- 4) sl_corpus_clients_current — latest per-client state (upserted on sync)
-- ---------------------------------------------------------------------------
create table if not exists public.sl_corpus_clients_current (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null unique,
  client_display_name text,
  latest_refresh_run_id uuid references public.sl_refresh_runs(id) on delete set null,
  latest_snapshot_id uuid references public.sl_corpus_snapshots(id) on delete set null,
  manifest_hash text not null,
  risk_tier text,
  churn_score integer,
  gap_score integer,
  sources_total integer,
  source_counts jsonb not null default '{}'::jsonb,
  actions_count integer not null default 0 check (actions_count >= 0),
  promises_count integer not null default 0 check (promises_count >= 0),
  gaps_count integer not null default 0 check (gaps_count >= 0),
  fathom_meetings_count integer not null default 0 check (fathom_meetings_count >= 0),
  client_json jsonb not null,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sl_corpus_clients_current_tier
  on public.sl_corpus_clients_current (risk_tier);
create index if not exists idx_sl_corpus_clients_current_churn
  on public.sl_corpus_clients_current (churn_score desc nulls last);

-- ---------------------------------------------------------------------------
-- 5) sl_insights — evidence-backed deterministic insights per client
-- ---------------------------------------------------------------------------
create table if not exists public.sl_insights (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null,
  insight_kind text not null check (insight_kind in ('client_health')),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  headline text not null,
  body text not null,
  evidence jsonb not null default '[]'::jsonb,
  refresh_run_id uuid references public.sl_refresh_runs(id) on delete set null,
  source_metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists idx_sl_insights_slug_generated
  on public.sl_insights (client_slug, generated_at desc);
create index if not exists idx_sl_insights_kind_generated
  on public.sl_insights (insight_kind, generated_at desc);

-- ---------------------------------------------------------------------------
-- RLS: internal users (admin/internal, active) can SELECT; service_role writes.
-- Mirrors the 20260611_saaslaunch_landing_analytics.sql policy pattern.
-- ---------------------------------------------------------------------------
alter table public.sl_refresh_runs enable row level security;
alter table public.sl_corpus_snapshots enable row level security;
alter table public.sl_corpus_client_snapshots enable row level security;
alter table public.sl_corpus_clients_current enable row level security;
alter table public.sl_insights enable row level security;

-- sl_refresh_runs
drop policy if exists "internal users select sl refresh runs" on public.sl_refresh_runs;
create policy "internal users select sl refresh runs"
  on public.sl_refresh_runs for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

-- sl_corpus_snapshots
drop policy if exists "internal users select sl corpus snapshots" on public.sl_corpus_snapshots;
create policy "internal users select sl corpus snapshots"
  on public.sl_corpus_snapshots for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

-- sl_corpus_client_snapshots
drop policy if exists "internal users select sl corpus client snapshots" on public.sl_corpus_client_snapshots;
create policy "internal users select sl corpus client snapshots"
  on public.sl_corpus_client_snapshots for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

-- sl_corpus_clients_current
drop policy if exists "internal users select sl corpus clients current" on public.sl_corpus_clients_current;
create policy "internal users select sl corpus clients current"
  on public.sl_corpus_clients_current for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

-- sl_insights
drop policy if exists "internal users select sl insights" on public.sl_insights;
create policy "internal users select sl insights"
  on public.sl_insights for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

-- Grants: internal users (via RLS) + service_role read; service_role full write.
grant select on public.sl_refresh_runs to authenticated, service_role;
grant select on public.sl_corpus_snapshots to authenticated, service_role;
grant select on public.sl_corpus_client_snapshots to authenticated, service_role;
grant select on public.sl_corpus_clients_current to authenticated, service_role;
grant select on public.sl_insights to authenticated, service_role;

grant insert, update, delete on public.sl_refresh_runs to service_role;
grant insert, update, delete on public.sl_corpus_snapshots to service_role;
grant insert, update, delete on public.sl_corpus_client_snapshots to service_role;
grant insert, update, delete on public.sl_corpus_clients_current to service_role;
grant insert, update, delete on public.sl_insights to service_role;

comment on table public.sl_refresh_runs is
  'Agency Intelligence refresh executions (corpus_sync / corpus_rebuild). Append-only history of sync runs.';
comment on table public.sl_corpus_snapshots is
  'Full SaaSLaunch corpus index.json captured per refresh run. Append-only history.';
comment on table public.sl_corpus_client_snapshots is
  'Per-client SaaSLaunch corpus file content per refresh run. Append-only history keyed by (refresh_run_id, client_slug).';
comment on table public.sl_corpus_clients_current is
  'Latest per-client corpus state. Unique(client_slug), upserted on each successful sync.';
comment on table public.sl_insights is
  'Evidence-backed deterministic agency insights per client. evidence[] carries resolvable row/source locators.';