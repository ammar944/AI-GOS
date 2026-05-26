-- Keep the parent artifact rollup in sync with section commits.
--
-- The v3 reader can derive 6/6 from child rows, but the parent row itself is
-- also a trigger/gate contract for the paid-media follow-up wave.

create or replace function public.roll_up_research_artifact(
  p_artifact_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $function$
#variable_conflict use_column
declare
  v_children_complete int;
begin
  select count(distinct s.zone)::int
    into v_children_complete
    from public.research_artifact_sections s
    where s.artifact_id = p_artifact_id
      and s.status = 'complete';

  update public.research_artifacts a
    set children_complete = greatest(a.children_complete, v_children_complete),
        status = case
          when a.children_total > 0
            and greatest(a.children_complete, v_children_complete) >= a.children_total
          then 'complete'
          else a.status
        end,
        updated_at = now()
    where a.id = p_artifact_id;
end $function$;

create or replace function public.commit_artifact_section(
  p_artifact_id uuid,
  p_zone text,
  p_section_run_id uuid,
  p_expected_revision integer,
  p_patch jsonb
) returns table(ok boolean, revision integer, conflict boolean)
language plpgsql
security definer
set search_path = public
as $function$
#variable_conflict use_column
declare
  v_current_revision int;
  v_aborted_at timestamptz;
begin
  select r.aborted_at into v_aborted_at
    from public.research_section_runs r
    where r.id = p_section_run_id;
  if v_aborted_at is not null then
    return query select false, coalesce(v_current_revision, -1), true;
    return;
  end if;

  begin
    select s.revision
      into v_current_revision
      from public.research_artifact_sections s
      where s.artifact_id = p_artifact_id and s.zone = p_zone
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

    insert into public.research_artifact_sections as s (
      artifact_id, zone, revision, section_run_id, status,
      title, markdown, data, claims, sources, error, updated_at
    )
    values (
      p_artifact_id,
      p_zone,
      1,
      p_section_run_id,
      coalesce(p_patch->>'status', 'complete'),
      p_patch->>'title',
      p_patch->>'markdown',
      p_patch->'data',
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
      update public.research_section_runs r
        set status = p_patch->>'status',
            completed_at = case when p_patch->>'status' = 'complete' then now() else r.completed_at end,
            error = case when p_patch->>'status' = 'error' then p_patch->'error' else r.error end
        where r.id = p_section_run_id;
    end if;

    if p_patch->>'status' = 'complete' then
      perform public.roll_up_research_artifact(p_artifact_id);
    end if;

    return query select true, 1, false;
    return;
  end if;

  if v_current_revision <> p_expected_revision then
    return query select false, v_current_revision, true;
    return;
  end if;

  update public.research_artifact_sections s
    set revision = v_current_revision + 1,
        section_run_id = p_section_run_id,
        status = coalesce(p_patch->>'status', s.status),
        title = coalesce(p_patch->>'title', s.title),
        markdown = coalesce(p_patch->>'markdown', s.markdown),
        data = coalesce(p_patch->'data', s.data),
        claims = coalesce(p_patch->'claims', s.claims),
        sources = coalesce(p_patch->'sources', s.sources),
        error = p_patch->'error',
        updated_at = now()
    where s.artifact_id = p_artifact_id and s.zone = p_zone;

  if (p_patch->>'status') in ('complete', 'error', 'partial') then
    update public.research_section_runs r
      set status = p_patch->>'status',
          completed_at = case when p_patch->>'status' = 'complete' then now() else r.completed_at end,
          error = case when p_patch->>'status' = 'error' then p_patch->'error' else r.error end
      where r.id = p_section_run_id;
  end if;

  if p_patch->>'status' = 'complete' then
    perform public.roll_up_research_artifact(p_artifact_id);
  end if;

  return query select true, v_current_revision + 1, false;
end $function$;

revoke execute on function public.roll_up_research_artifact(uuid) from public, anon, authenticated;
grant execute on function public.roll_up_research_artifact(uuid) to service_role;

revoke execute on function public.commit_artifact_section(uuid, text, uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.commit_artifact_section(uuid, text, uuid, int, jsonb) to service_role;
