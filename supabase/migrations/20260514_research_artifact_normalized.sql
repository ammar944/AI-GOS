-- Phase 2: normalized research artifact storage.
-- Replaces the journey_sessions.research_results JSONB monolith with
-- section-owned tables + compare-and-swap RPCs. Lets six subagents commit
-- independently without overwriting each other.
--
-- Design doc: ~/.gstack/projects/ammar944-AI-GOS/ammar-feat-research-v2-design-20260512-205154.md
-- (Premise 6 + Phase 2). Legacy research_results JSONB stays in place during
-- the dual-write window; backfill script populates these tables from existing
-- rows.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists research_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  user_id text not null,
  thesis jsonb,
  status text not null default 'idle',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, run_id)
);

create index if not exists idx_research_artifacts_user_run
  on research_artifacts (user_id, run_id);

create table if not exists research_artifact_sections (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references research_artifacts(id) on delete cascade,
  zone text not null,
  revision int not null default 0,
  section_run_id uuid,
  status text not null default 'idle',
  title text,
  markdown text,
  claims jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  error jsonb,
  updated_at timestamptz not null default now(),
  unique (artifact_id, zone)
);

create index if not exists idx_research_sections_artifact
  on research_artifact_sections (artifact_id, zone);

create table if not exists research_section_runs (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references research_artifacts(id) on delete cascade,
  zone text not null,
  requested_by text not null,
  prompt text,
  status text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  aborted_at timestamptz,
  error jsonb,
  telemetry jsonb
);

create index if not exists idx_section_runs_status
  on research_section_runs (status, started_at);
create index if not exists idx_section_runs_artifact_zone
  on research_section_runs (artifact_id, zone, started_at desc);

create table if not exists research_section_events (
  id uuid primary key default gen_random_uuid(),
  section_run_id uuid not null references research_section_runs(id) on delete cascade,
  artifact_id uuid not null,
  zone text not null,
  event_type text not null,
  message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_section_events_run_ts
  on research_section_events (section_run_id, created_at);

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'research_artifact_sections'
  ) then
    execute 'alter publication supabase_realtime add table research_artifact_sections';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'research_section_events'
  ) then
    execute 'alter publication supabase_realtime add table research_section_events';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS — users read their own; service role writes via SECURITY DEFINER RPCs
-- ---------------------------------------------------------------------------

alter table research_artifacts enable row level security;
alter table research_artifact_sections enable row level security;
alter table research_section_runs enable row level security;
alter table research_section_events enable row level security;

drop policy if exists "users select own artifacts" on research_artifacts;
create policy "users select own artifacts" on research_artifacts
  for select using (user_id = auth.jwt() ->> 'sub');

drop policy if exists "users select own sections" on research_artifact_sections;
create policy "users select own sections" on research_artifact_sections
  for select using (
    artifact_id in (
      select id from research_artifacts where user_id = auth.jwt() ->> 'sub'
    )
  );

drop policy if exists "users select own runs" on research_section_runs;
create policy "users select own runs" on research_section_runs
  for select using (
    artifact_id in (
      select id from research_artifacts where user_id = auth.jwt() ->> 'sub'
    )
  );

drop policy if exists "users select own events" on research_section_events;
create policy "users select own events" on research_section_events
  for select using (
    artifact_id in (
      select id from research_artifacts where user_id = auth.jwt() ->> 'sub'
    )
  );

-- No INSERT/UPDATE/DELETE policies for end users — all writes flow through
-- SECURITY DEFINER RPCs executed by the service role.

-- ---------------------------------------------------------------------------
-- RPC: ensure_artifact — idempotent upsert for (user_id, run_id) → artifact_id.
-- ---------------------------------------------------------------------------

create or replace function ensure_artifact(
  p_user_id text,
  p_run_id text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into research_artifacts (user_id, run_id)
  values (p_user_id, p_run_id)
  on conflict (user_id, run_id) do update
    set updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: start_section_run — creates a section_run, pins it as the active run
-- for the zone, returns the new section_run_id.
-- ---------------------------------------------------------------------------

create or replace function start_section_run(
  p_artifact_id uuid,
  p_zone text,
  p_requested_by text,
  p_prompt text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_run_id uuid;
begin
  v_run_id := gen_random_uuid();

  insert into research_section_runs (id, artifact_id, zone, requested_by, prompt, status, started_at)
    values (v_run_id, p_artifact_id, p_zone, p_requested_by, p_prompt, 'running', now());

  insert into research_artifact_sections (artifact_id, zone, revision, section_run_id, status, updated_at)
    values (p_artifact_id, p_zone, 0, v_run_id, 'running', now())
    on conflict (artifact_id, zone) do update
      set section_run_id = excluded.section_run_id,
          status = 'running',
          updated_at = now();

  return v_run_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: commit_artifact_section — compare-and-swap commit. Returns
-- (ok, revision, conflict) so callers can react to stale-revision races.
-- Uses FOR UPDATE NOWAIT to fail-fast on contention (six concurrent zones
-- don't overlap, so contention indicates a bug rather than normal load).
-- ---------------------------------------------------------------------------

create or replace function commit_artifact_section(
  p_artifact_id uuid,
  p_zone text,
  p_section_run_id uuid,
  p_expected_revision int,
  p_patch jsonb
) returns table (ok boolean, revision int, conflict boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_revision int;
  v_current_run_id uuid;
begin
  begin
    select revision, section_run_id
      into v_current_revision, v_current_run_id
      from research_artifact_sections
      where artifact_id = p_artifact_id and zone = p_zone
      for update nowait;
  exception
    when lock_not_available then
      return query select false, coalesce(v_current_revision, -1), true;
      return;
  end;

  if v_current_revision is null then
    -- No row exists yet. Only allow insert when caller expects revision 0.
    if p_expected_revision <> 0 then
      return query select false, -1, true;
      return;
    end if;
    insert into research_artifact_sections (
      artifact_id, zone, revision, section_run_id, status,
      title, markdown, claims, sources, error, updated_at
    )
    values (
      p_artifact_id,
      p_zone,
      1,
      p_section_run_id,
      coalesce(p_patch->>'status', 'complete'),
      p_patch->>'title',
      p_patch->>'markdown',
      coalesce(p_patch->'claims', '[]'::jsonb),
      coalesce(p_patch->'sources', '[]'::jsonb),
      p_patch->'error',
      now()
    )
    on conflict (artifact_id, zone) do nothing;

    -- If on_conflict swallowed the insert, surface as conflict so caller retries.
    if not found then
      return query select false, -1, true;
      return;
    end if;

    -- Mark terminal on insert path too.
    if (p_patch->>'status') in ('complete', 'error', 'partial') then
      update research_section_runs
        set status = p_patch->>'status',
            completed_at = case
              when p_patch->>'status' = 'complete' then now()
              else completed_at
            end,
            error = case
              when p_patch->>'status' = 'error' then p_patch->'error'
              else error
            end
        where id = p_section_run_id;
    end if;

    return query select true, 1, false;
    return;
  end if;

  if v_current_revision <> p_expected_revision then
    return query select false, v_current_revision, true;
    return;
  end if;

  -- Active-run guard: if the row has a pinned section_run_id, the caller MUST
  -- match it (or pass it on first write). Stale runners whose run is no longer
  -- the active one cannot overwrite a section that has advanced to a newer run.
  if v_current_run_id is not null
     and v_current_run_id <> p_section_run_id then
    return query select false, v_current_revision, true;
    return;
  end if;

  update research_artifact_sections
    set revision = v_current_revision + 1,
        section_run_id = p_section_run_id,
        status = coalesce(p_patch->>'status', status),
        title = coalesce(p_patch->>'title', title),
        markdown = coalesce(p_patch->>'markdown', markdown),
        claims = coalesce(p_patch->'claims', claims),
        sources = coalesce(p_patch->'sources', sources),
        error = p_patch->'error',
        updated_at = now()
    where artifact_id = p_artifact_id and zone = p_zone;

  -- Mark the section_run terminal if the patch says so.
  if (p_patch->>'status') in ('complete', 'error', 'partial') then
    update research_section_runs
      set status = p_patch->>'status',
          completed_at = case
            when p_patch->>'status' = 'complete' then now()
            else completed_at
          end,
          error = case
            when p_patch->>'status' = 'error' then p_patch->'error'
            else error
          end
      where id = p_section_run_id;
  end if;

  return query select true, v_current_revision + 1, false;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: append_section_event — emits an activity event for a section run.
-- Active-run guard: rejects events from stale runners (post-abort, before
-- self-terminate). The join enforces that p_section_run_id matches the
-- CURRENT section_run_id pinned on the section row.
-- ---------------------------------------------------------------------------

create or replace function append_section_event(
  p_section_run_id uuid,
  p_event_type text,
  p_message text,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  v_id := gen_random_uuid();

  insert into research_section_events (
    id, section_run_id, artifact_id, zone, event_type, message, payload
  )
  select v_id, r.id, r.artifact_id, r.zone, p_event_type, p_message, p_payload
    from research_section_runs r
    join research_artifact_sections ras
      on ras.artifact_id = r.artifact_id and ras.zone = r.zone
    where r.id = p_section_run_id
      and ras.section_run_id = p_section_run_id;

  if not found then
    return null; -- stale run rejected
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Grants — service_role calls these RPCs; authenticated users read tables.
-- SECURITY DEFINER functions default to PUBLIC execute, which would let
-- end-user JWTs bypass RLS. Revoke PUBLIC first, then grant only service_role.
-- ---------------------------------------------------------------------------

revoke execute on function ensure_artifact(text, text) from public, anon, authenticated;
revoke execute on function start_section_run(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function commit_artifact_section(uuid, text, uuid, int, jsonb) from public, anon, authenticated;
revoke execute on function append_section_event(uuid, text, text, jsonb) from public, anon, authenticated;

grant execute on function ensure_artifact(text, text) to service_role;
grant execute on function start_section_run(uuid, text, text, text) to service_role;
grant execute on function commit_artifact_section(uuid, text, uuid, int, jsonb) to service_role;
grant execute on function append_section_event(uuid, text, text, jsonb) to service_role;

grant select on research_artifacts to authenticated, service_role;
grant select on research_artifact_sections to authenticated, service_role;
grant select on research_section_runs to authenticated, service_role;
grant select on research_section_events to authenticated, service_role;
