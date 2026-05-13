-- Phase 5 — abort-respecting commit guard + ability to surface reaped runs
-- on research_artifact_sections (the projector's source of truth).
--
-- Two changes:
--   1. commit_artifact_section: reject commits when the targeted
--      section_run_id has aborted_at set. This closes the window where an
--      aborted runner reaches its commit line before AbortController.abort
--      actually propagates and would otherwise overwrite the cancel intent.
--   2. reap_orphaned_section_runs(): atomic helper the worker calls on boot
--      to mark stale runs as error AND update the corresponding section row
--      so the canvas projector flips the zone into its error state.

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
  v_aborted_at timestamptz;
begin
  -- Aborted-run guard: any commit attempt against an aborted run conflicts.
  -- Allows /abort to write aborted_at and then trust the section won't be
  -- overwritten by an in-flight tool loop that's mid-shutdown. The 'error'
  -- terminal write for orphaned runs goes through reap_orphaned_section_runs
  -- (which bypasses this RPC).
  select aborted_at into v_aborted_at
    from research_section_runs
    where id = p_section_run_id;
  if v_aborted_at is not null then
    return query select false, coalesce(v_current_revision, -1), true;
    return;
  end if;

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

    if not found then
      return query select false, -1, true;
      return;
    end if;

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
-- reap_orphaned_section_runs — boot-time cleanup that updates both
-- research_section_runs AND the corresponding research_artifact_sections
-- rows so the projector's zone status reflects the orphan.
-- ---------------------------------------------------------------------------

create or replace function reap_orphaned_section_runs(
  p_threshold_minutes int
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reaped int;
begin
  with stale as (
    update research_section_runs r
      set status = 'error',
          aborted_at = now(),
          error = jsonb_build_object('type', 'orphaned_after_restart')
      where r.status = 'running'
        and r.aborted_at is null
        and r.started_at < now() - make_interval(mins => p_threshold_minutes)
      returning r.id, r.artifact_id, r.zone
  )
  update research_artifact_sections s
    set status = 'error',
        error = jsonb_build_object(
          'message', 'Worker restarted while this section was running.',
          'type', 'orphaned_after_restart'
        ),
        updated_at = now()
    from stale
    where s.artifact_id = stale.artifact_id
      and s.zone = stale.zone
      and s.section_run_id = stale.id;

  get diagnostics v_reaped = row_count;
  return v_reaped;
end $$;

revoke execute on function commit_artifact_section(uuid, text, uuid, int, jsonb) from public, anon, authenticated;
revoke execute on function reap_orphaned_section_runs(int) from public, anon, authenticated;

grant execute on function commit_artifact_section(uuid, text, uuid, int, jsonb) to service_role;
grant execute on function reap_orphaned_section_runs(int) to service_role;
