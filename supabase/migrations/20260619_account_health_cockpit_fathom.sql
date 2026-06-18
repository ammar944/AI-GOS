-- Account-Health Cockpit — Fathom ingestion schema (Agency Intelligence, slice 2).
-- Adds raw Fathom transcripts + extracted verbal-risk signals, and extends
-- sl_refresh_runs (from 20260618_agency_intelligence.sql) with the two new
-- Fathom run kinds. See docs/superpowers/specs/2026-06-18-account-health-cockpit-design.md.
--
-- Dated AFTER 20260618_agency_intelligence.sql so it applies later: it ALTERs
-- sl_refresh_runs (created there) and references its run lifecycle.
--
-- History/raw vs extracted semantics:
--   * sl_fathom_transcripts — one row per Fathom recording (442 rows), raw + idempotent
--                              by raw_sha256; client_slug nullable (333 unattributed kept,
--                              excluded from cockpit).
--   * sl_fathom_signals     — compact extracted signals, only for attributed calls
--                              (client_slug NOT NULL); the only LLM-produced table, gated
--                              by a deterministic anti-fabrication verbatim-quote check.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) sl_fathom_transcripts — raw Fathom recordings (deterministic phase-A sync)
-- ---------------------------------------------------------------------------
create table if not exists public.sl_fathom_transcripts (
  recording_id text primary key check (recording_id ~ '^[0-9]+$'),  -- normalized String of the Fathom int; natural key + join key
  client_slug  text,                                                -- nullable: null = unattributed (kept, excluded from cockpit)
  title        text,
  meeting_title text,
  call_type    text not null default 'unknown'
               check (call_type in ('sales','cs_checkin','onboarding','other','unknown')),  -- from corpus join; 'unknown' if unattributed
  call_date    timestamptz not null,                                -- recording_start_time, fallback created_at
  transcript   jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  summary      text,                                                -- default_summary.markdown_formatted
  action_items jsonb not null default '[]'::jsonb check (jsonb_typeof(action_items) = 'array'),
  share_url    text,
  call_url     text,                                                -- raw .url
  transcript_turns integer not null default 0 check (transcript_turns >= 0),
  raw_sha256   text not null check (raw_sha256 ~ '^sha256:[a-f0-9]{64}$'),  -- content hash for idempotent re-sync
  source_metadata jsonb not null default '{}'::jsonb,  -- { source_repo, source_path, recorded_by, calendar_invitees_domains_type, transcript_language, matched_by, attribution_status, attribution_collision? }
  ingested_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_sl_fathom_transcripts_client_date
  on public.sl_fathom_transcripts (client_slug, call_date desc) where client_slug is not null;
create index if not exists idx_sl_fathom_transcripts_call_type
  on public.sl_fathom_transcripts (call_type, call_date desc);

-- ---------------------------------------------------------------------------
-- 2) sl_fathom_signals — compact extracted verbal-risk signals (LLM phase-B, gated)
-- ---------------------------------------------------------------------------
create table if not exists public.sl_fathom_signals (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null check (client_slug <> ''),              -- NOT NULL: only attributed calls produce signals
  recording_id text not null references public.sl_fathom_transcripts(recording_id) on delete cascade,
  signal_type text not null check (signal_type in ('churn_escalation','going_dark','payment_risk','verbal_promise','upsell_intent')),
  severity    text not null check (severity in ('low','medium','high')),
  quote       text not null check (length(quote) between 12 and 1200),  -- VERBATIM transcript substring (anti-fab gate)
  quote_sha256 text not null check (quote_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  speaker     text,                                                 -- transcript speaker.display_name of the quoted turn
  call_date   timestamptz not null,
  extracted_at timestamptz not null default now(),
  source_metadata jsonb not null default '{}'::jsonb,  -- { extractor:'zz-sync-fathom', extraction_version:'account-health-v1', model, extraction_run_id, quote_match:{transcript_index,timestamp,speaker,normalized_quote_sha256}, rationale, suggested_action }
  unique (recording_id, signal_type, quote_sha256)                  -- idempotency backstop
);

create index if not exists idx_sl_fathom_signals_client_sev_date
  on public.sl_fathom_signals (client_slug, severity, call_date desc);
create index if not exists idx_sl_fathom_signals_type_date
  on public.sl_fathom_signals (signal_type, call_date desc);
create index if not exists idx_sl_fathom_signals_recording
  on public.sl_fathom_signals (recording_id);

-- ---------------------------------------------------------------------------
-- RLS: internal users (admin/internal, active) can SELECT; service_role writes.
-- Verbatim predicate from 20260618_agency_intelligence.sql.
-- ---------------------------------------------------------------------------
alter table public.sl_fathom_transcripts enable row level security;
alter table public.sl_fathom_signals     enable row level security;

-- sl_fathom_transcripts
drop policy if exists "internal users select sl fathom transcripts" on public.sl_fathom_transcripts;
create policy "internal users select sl fathom transcripts"
  on public.sl_fathom_transcripts for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

-- sl_fathom_signals
drop policy if exists "internal users select sl fathom signals" on public.sl_fathom_signals;
create policy "internal users select sl fathom signals"
  on public.sl_fathom_signals for select to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.jwt() ->> 'sub'
        and up.account_status = 'active'
        and up.app_role in ('admin', 'internal')
    )
  );

-- Grants: internal users (via RLS) + service_role read; service_role full write.
grant select on public.sl_fathom_transcripts to authenticated, service_role;
grant select on public.sl_fathom_signals     to authenticated, service_role;

grant insert, update, delete on public.sl_fathom_transcripts to service_role;
grant insert, update, delete on public.sl_fathom_signals     to service_role;

-- ---------------------------------------------------------------------------
-- Extend sl_refresh_runs for Fathom provenance (table created in 20260618).
-- ---------------------------------------------------------------------------
alter table public.sl_refresh_runs drop constraint if exists sl_refresh_runs_run_kind_check;
alter table public.sl_refresh_runs add constraint sl_refresh_runs_run_kind_check
  check (run_kind in ('corpus_sync', 'corpus_rebuild', 'fathom_sync', 'fathom_extract'));

comment on table public.sl_fathom_transcripts is
  'Raw Fathom call recordings (442 rows). Idempotent by raw_sha256; client_slug nullable (unattributed calls kept, excluded from cockpit). Join key recording_id is String(raw Fathom int).';
comment on table public.sl_fathom_signals is
  'Verbal-risk signals extracted from attributed Fathom transcripts (client_slug NOT NULL). Only LLM-produced table; every quote passes a deterministic verbatim anti-fabrication gate.';
