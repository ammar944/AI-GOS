-- Even with table aliases (20260521), commit_artifact_section still triggers
-- "column reference 'revision' is ambiguous" on PG17 because:
--   * the RETURNS TABLE(..., revision integer, ...) OUT param shadows
--     research_artifact_sections.revision in the INSERT column list and the
--     UPDATE SET LHS, neither of which can be table-aliased syntactically.
--
-- Mirror the fix we just applied to seed_orchestration (20260522): add
--   #variable_conflict use_column
-- so bare identifiers in SQL statements resolve to table columns first.
-- PL/pgSQL OUT-param assignments stay variable by syntactic context.

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
  v_current_run_id uuid;
  v_aborted_at timestamptz;
begin
  select aborted_at into v_aborted_at
    from research_section_runs
    where id = p_section_run_id;
  if v_aborted_at is not null then
    return query select false, coalesce(v_current_revision, -1), true;
    return;
  end if;

  begin
    select s.revision, s.section_run_id
      into v_current_revision, v_current_run_id
      from research_artifact_sections s
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
    insert into research_artifact_sections as s (
      artifact_id, zone, revision, section_run_id, status,
      title, markdown, claims, sources, error, updated_at
    )
    values (
      p_artifact_id, p_zone, 1, p_section_run_id,
      coalesce(p_patch->>'status', 'complete'),
      p_patch->>'title', p_patch->>'markdown',
      coalesce(p_patch->'claims', '[]'::jsonb),
      coalesce(p_patch->'sources', '[]'::jsonb),
      p_patch->'error', now()
    )
    on conflict (artifact_id, zone) do nothing;

    if not found then
      return query select false, -1, true;
      return;
    end if;

    if (p_patch->>'status') in ('complete', 'error', 'partial') then
      update research_section_runs r
        set status = p_patch->>'status',
            completed_at = case when p_patch->>'status' = 'complete' then now() else r.completed_at end,
            error = case when p_patch->>'status' = 'error' then p_patch->'error' else r.error end
        where r.id = p_section_run_id;
    end if;

    return query select true, 1, false;
    return;
  end if;

  if v_current_revision <> p_expected_revision then
    return query select false, v_current_revision, true;
    return;
  end if;

  if v_current_run_id is not null and v_current_run_id <> p_section_run_id then
    return query select false, v_current_revision, true;
    return;
  end if;

  update research_artifact_sections s
    set revision = v_current_revision + 1,
        section_run_id = p_section_run_id,
        status = coalesce(p_patch->>'status', s.status),
        title = coalesce(p_patch->>'title', s.title),
        markdown = coalesce(p_patch->>'markdown', s.markdown),
        claims = coalesce(p_patch->'claims', s.claims),
        sources = coalesce(p_patch->'sources', s.sources),
        error = p_patch->'error',
        updated_at = now()
    where s.artifact_id = p_artifact_id and s.zone = p_zone;

  if (p_patch->>'status') in ('complete', 'error', 'partial') then
    update research_section_runs r
      set status = p_patch->>'status',
          completed_at = case when p_patch->>'status' = 'complete' then now() else r.completed_at end,
          error = case when p_patch->>'status' = 'error' then p_patch->'error' else r.error end
      where r.id = p_section_run_id;
  end if;

  return query select true, v_current_revision + 1, false;
end $function$;
