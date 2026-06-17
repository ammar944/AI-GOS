-- Phase 1 of the Managed Agents migration.
--
-- Stores every Managed Agents webhook event the Next.js handler has
-- processed so we can:
--   (R1) dedupe replayed deliveries on event_id PRIMARY KEY,
--   (R3) keep an ordered audit log of fetched events for telemetry projection,
--   (R5) count save_section_artifact_rejected rows per
--        (section_run_id, event_type) to enforce the custom-tool repair
--        retry ceiling.
--
-- The handler MUST verify the Managed Agents signature before doing any
-- work that touches this table, and MUST upsert into this table BEFORE
-- doing any work that mutates research_artifact_sections.

create table if not exists public.managed_agents_webhook_events (
  event_id           text        primary key,
  session_id         text        not null,
  session_thread_id  text,
  artifact_id        uuid,
  section_run_id     uuid,
  section_type       text,
  event_type         text        not null,
  created_at         timestamptz not null,
  verified_at        timestamptz,
  processed_at       timestamptz not null default now(),
  payload            jsonb       not null
);

comment on table public.managed_agents_webhook_events is
  'Managed Agents webhook delivery log (Phase 1 of the migration).
   Primary key event_id enforces R1 dedupe. Used for retry-count queries
   (R5) and ordered telemetry projection (R3). TTL ~7 days via the
   cleanup_managed_agents_webhook_events() function below.';

-- ---------------------------------------------------------------------------
-- R5 retry-ceiling indexes: (section_run_id, event_type) is the canonical
-- lookup for the rejection counter. (section_run_id) alone is also useful
-- when projecting per-section telemetry into research_section_events.
-- ---------------------------------------------------------------------------

create index if not exists idx_managed_agents_webhook_events_section_event
  on public.managed_agents_webhook_events (section_run_id, event_type)
  where section_run_id is not null;

-- ---------------------------------------------------------------------------
-- Session/thread/section composite for ordering and telemetry projection.
-- ---------------------------------------------------------------------------

create index if not exists idx_managed_agents_webhook_events_session
  on public.managed_agents_webhook_events (session_id, session_thread_id, section_run_id);

-- ---------------------------------------------------------------------------
-- Created-at ordering used by R3 sort-before-project logic.
-- ---------------------------------------------------------------------------

create index if not exists idx_managed_agents_webhook_events_created_at
  on public.managed_agents_webhook_events (created_at);

-- ---------------------------------------------------------------------------
-- TTL: 7 days. Run from a cron job (or supabase scheduled function). The
-- function returns the number of rows it deleted so a scheduled health probe
-- can record the result.
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_managed_agents_webhook_events(
  p_ttl_interval interval default interval '7 days'
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.managed_agents_webhook_events
   where created_at < now() - p_ttl_interval
  returning 1 into v_deleted;

  get diagnostics v_deleted = row_count;
  return coalesce(v_deleted, 0);
end;
$$;

revoke execute on function public.cleanup_managed_agents_webhook_events(interval)
  from public, anon, authenticated;
grant execute on function public.cleanup_managed_agents_webhook_events(interval)
  to service_role;

-- ---------------------------------------------------------------------------
-- RLS: never expose webhook payloads to the client. Service role only.
-- ---------------------------------------------------------------------------

alter table public.managed_agents_webhook_events enable row level security;

-- No policies — service_role bypasses RLS, anon/authenticated have no
-- access. The Next.js webhook handler uses createAdminClient() (service
-- role) for both reads and writes against this table.

revoke all on public.managed_agents_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on public.managed_agents_webhook_events
  to service_role;
