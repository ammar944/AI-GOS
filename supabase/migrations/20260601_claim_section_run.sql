-- Atomic claim gate for lab section dispatch.
--
-- scheduleLabSectionJob calls claim_section_run after seed_orchestration has
-- created or reused section rows. Only the caller that transitions the active
-- research_section_runs row from queued -> running owns scheduling the lab job.

create or replace function public.claim_section_run(
  p_run_id uuid,
  p_section_id text
) returns table (
  status text,
  run_id uuid,
  section_id text,
  section_run_id uuid,
  previous_status text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_section_run_id uuid;
  v_previous_status text;
  v_set_clause text := 'status = ''running''';
  v_has_started_at boolean;
  v_has_updated_at boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'research_section_runs'
      and column_name = 'started_at'
  ) into v_has_started_at;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'research_section_runs'
      and column_name = 'updated_at'
  ) into v_has_updated_at;

  if v_has_started_at then
    v_set_clause := v_set_clause || ', started_at = now()';
  end if;
  if v_has_updated_at then
    v_set_clause := v_set_clause || ', updated_at = now()';
  end if;

  execute format(
    $sql$
      update public.research_section_runs r
         set %s
        from public.research_artifacts a
        join public.research_artifact_sections s
          on s.artifact_id = a.id
         and s.zone = $2
       where a.run_id = $1::text
         and r.id = s.section_run_id
         and r.artifact_id = a.id
         and r.zone = $2
         and r.status = 'queued'
       returning r.id
    $sql$,
    v_set_clause
  )
  using p_run_id, p_section_id
  into v_section_run_id;

  if v_section_run_id is not null then
    status := 'claimed';
    run_id := p_run_id;
    section_id := p_section_id;
    section_run_id := v_section_run_id;
    previous_status := 'queued';
    return next;
    return;
  end if;

  select r.id, r.status
    into v_section_run_id, v_previous_status
    from public.research_artifacts a
    join public.research_artifact_sections s
      on s.artifact_id = a.id
     and s.zone = p_section_id
    join public.research_section_runs r
      on r.id = s.section_run_id
     and r.artifact_id = a.id
     and r.zone = p_section_id
   where a.run_id = p_run_id::text
   limit 1;

  run_id := p_run_id;
  section_id := p_section_id;

  if v_section_run_id is null then
    status := 'not_found';
    section_run_id := null;
    previous_status := null;
    return next;
    return;
  end if;

  section_run_id := v_section_run_id;
  previous_status := case
    when v_previous_status in ('queued', 'running', 'complete', 'error')
      then v_previous_status
    else 'error'
  end;
  status := case
    when v_previous_status = 'running' then 'already_running'
    when v_previous_status = 'complete' then 'already_complete'
    else 'already_error'
  end;
  return next;
  return;
end $function$;

-- Explicit reruns intentionally supersede the active section row before going
-- through the same seed -> claim -> schedule path as ordinary kickoff.
create or replace function public.reset_section_run_for_rerun(
  p_user_id text,
  p_run_id text,
  p_section_id text
) returns table (
  section_run_id uuid,
  previous_section_run_id uuid,
  previous_status text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_parent_id uuid;
  v_new_run_id uuid;
  v_previous_run_id uuid;
  v_previous_status text;
begin
  v_parent_id := ensure_artifact(p_user_id, p_run_id);

  select s.section_run_id, s.status
    into v_previous_run_id, v_previous_status
    from public.research_artifact_sections s
   where s.artifact_id = v_parent_id
     and s.zone = p_section_id
   limit 1;

  if v_previous_run_id is not null then
    update public.research_section_runs r
       set status = case
             when r.status in ('queued', 'running') then 'error'
             else r.status
           end,
           aborted_at = case
             when r.status = 'running' and r.aborted_at is null then now()
             else r.aborted_at
           end,
           error = case
             when r.status in ('queued', 'running') and r.error is null
               then jsonb_build_object(
                 'type', 'superseded_by_rerun',
                 'message', 'Section run superseded by an explicit rerun.'
               )
             else r.error
           end
     where r.id = v_previous_run_id;
  end if;

  v_new_run_id := gen_random_uuid();

  insert into public.research_section_runs (
    id, artifact_id, zone, requested_by, prompt, status
  ) values (
    v_new_run_id, v_parent_id, p_section_id, p_user_id, null, 'queued'
  );

  insert into public.research_artifact_sections as s (
    artifact_id,
    zone,
    revision,
    section_run_id,
    status,
    title,
    markdown,
    claims,
    sources,
    error,
    updated_at
  ) values (
    v_parent_id,
    p_section_id,
    0,
    v_new_run_id,
    'queued',
    null,
    null,
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    now()
  )
  on conflict (artifact_id, zone) do update
    set revision = 0,
        section_run_id = excluded.section_run_id,
        status = 'queued',
        title = null,
        markdown = null,
        claims = '[]'::jsonb,
        sources = '[]'::jsonb,
        error = null,
        updated_at = now();

  section_run_id := v_new_run_id;
  previous_section_run_id := v_previous_run_id;
  previous_status := v_previous_status;
  return next;
  return;
end $function$;

revoke execute on function public.claim_section_run(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.reset_section_run_for_rerun(text, text, text)
  from public, anon, authenticated;

grant execute on function public.claim_section_run(uuid, text) to service_role;
grant execute on function public.reset_section_run_for_rerun(text, text, text)
  to service_role;
