-- Meta Ads Account Dashboard — schema.
-- Spec: docs/superpowers/specs/2026-06-25-meta-ads-dashboard-design.md
--
-- Read-only reporting of SaaSLaunch *clients'* own Meta (FB+IG) ad-account
-- performance, surfaced at /internal/meta-ads. Checkle ships live; Anura renders
-- as "pending Meta MCP rollout". Data is staged by a Claude-driven READ-ONLY MCP
-- pull and upserted deterministically by scripts/zz-sync-meta.mjs.
--
-- RLS mirrors 20260618_agency_intelligence.sql: internal/admin (active) SELECT,
-- service_role writes. No write/mutation MCP tool is ever involved.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0) Widen sl_refresh_runs.run_kind to include 'meta_sync'.
--    The .mjs uploader bypasses Zod, so this DB CHECK is the real gate.
--    All pre-existing kinds are preserved.
-- ---------------------------------------------------------------------------
alter table public.sl_refresh_runs drop constraint if exists sl_refresh_runs_run_kind_check;
alter table public.sl_refresh_runs add constraint sl_refresh_runs_run_kind_check
  check (run_kind in ('corpus_sync', 'corpus_rebuild', 'fathom_sync', 'fathom_extract', 'meta_sync'));

-- ---------------------------------------------------------------------------
-- 1) sl_meta_ad_accounts — one row per client Meta ad account
-- ---------------------------------------------------------------------------
create table if not exists public.sl_meta_ad_accounts (
  meta_account_id text primary key,
  client_slug text not null,
  account_name text,
  currency text,
  status text,
  is_mcp_enabled boolean not null default false,
  connected_at timestamptz not null default now()
);

create index if not exists idx_sl_meta_ad_accounts_slug
  on public.sl_meta_ad_accounts (client_slug);

-- ---------------------------------------------------------------------------
-- 2) sl_meta_insights — account- and campaign-level daily rows
--    roas / cost_per_result are nullable: null for non-conversion objectives
--    (e.g. Checkle runs traffic/awareness -> purchase_roas "Not available").
-- ---------------------------------------------------------------------------
create table if not exists public.sl_meta_insights (
  id uuid primary key default gen_random_uuid(),
  meta_account_id text not null references public.sl_meta_ad_accounts(meta_account_id) on delete cascade,
  date date not null,
  level text not null check (level in ('account', 'campaign')),
  campaign_id text,
  campaign_name text,
  objective text,
  spend numeric,
  impressions numeric,
  reach numeric,
  frequency numeric,
  link_clicks numeric,
  clicks numeric,
  ctr numeric,              -- link CTR, stored as a percent value (1.33 == 1.33%)
  cpc numeric,
  cpm numeric,
  results numeric,
  cost_per_result numeric,  -- CPA
  purchase_value numeric,
  roas numeric,             -- nullable
  currency text,
  raw_sha256 text not null,
  synced_at timestamptz not null default now()
);

-- Idempotency key. Postgres treats NULL campaign_id (account-level rows) as
-- distinct, which would break account-level dedupe, so COALESCE it to a sentinel.
create unique index if not exists uq_sl_meta_insights_idempotent
  on public.sl_meta_insights (meta_account_id, date, level, coalesce(campaign_id, '__account__'));

create index if not exists idx_sl_meta_insights_account_date
  on public.sl_meta_insights (meta_account_id, date desc);
create index if not exists idx_sl_meta_insights_account_level_date
  on public.sl_meta_insights (meta_account_id, level, date desc);

-- ---------------------------------------------------------------------------
-- RLS: internal users (admin/internal, active) can SELECT; service_role writes.
-- Mirrors 20260618_agency_intelligence.sql.
-- ---------------------------------------------------------------------------
alter table public.sl_meta_ad_accounts enable row level security;
alter table public.sl_meta_insights enable row level security;

drop policy if exists "internal users select sl meta ad accounts" on public.sl_meta_ad_accounts;
create policy "internal users select sl meta ad accounts"
  on public.sl_meta_ad_accounts for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

drop policy if exists "internal users select sl meta insights" on public.sl_meta_insights;
create policy "internal users select sl meta insights"
  on public.sl_meta_insights for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

-- Grants: internal users (via RLS) + service_role read; service_role full write.
grant select on public.sl_meta_ad_accounts to authenticated, service_role;
grant select on public.sl_meta_insights to authenticated, service_role;
grant insert, update, delete on public.sl_meta_ad_accounts to service_role;
grant insert, update, delete on public.sl_meta_insights to service_role;

comment on table public.sl_meta_ad_accounts is
  'Client Meta (FB+IG) ad accounts surfaced in /internal/meta-ads. Read-only; populated by scripts/zz-sync-meta.mjs.';
comment on table public.sl_meta_insights is
  'Account- and campaign-level daily Meta insights. roas/cost_per_result nullable (null for non-conversion objectives like Checkle traffic). Idempotent on (meta_account_id, date, level, coalesce(campaign_id, ''__account__'')).';
