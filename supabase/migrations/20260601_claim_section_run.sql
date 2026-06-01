-- Atomic claim gate for lab section dispatch.
--
-- scheduleLabSectionJob calls claim_section_run after seed_orchestration has
-- created or reused section rows. Only the caller that transitions the active
-- research_section_runs row from queued -> running owns scheduling the lab job.

drop function if exists public.claim_section_run(uuid, text);

create or replace function public.claim_section_run(
  p_user_id text,
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
         and s.zone = $3
       where a.user_id = $1
         and a.run_id = $2::text
         and r.id = s.section_run_id
         and r.artifact_id = a.id
         and r.zone = $3
         and r.status = 'queued'
       returning r.id
    $sql$,
    v_set_clause
  )
  using p_user_id, p_run_id, p_section_id
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
   where a.user_id = p_user_id
     and a.run_id = p_run_id::text
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

revoke execute on function public.claim_section_run(text, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.reset_section_run_for_rerun(text, text, text)
  from public, anon, authenticated;

grant execute on function public.claim_section_run(text, uuid, text) to service_role;
grant execute on function public.reset_section_run_for_rerun(text, text, text)
  to service_role;

-- Preserve terminal error rows during ordinary orchestration. Explicit reruns
-- are the only path that should supersede an error row with a fresh queued run.
create or replace function public.seed_orchestration(
  p_user_id text,
  p_run_id text,
  p_zones text[]
) returns table (
  parent_id uuid,
  zone text,
  section_run_id uuid,
  ordinal int,
  reused boolean,
  status text
)
language plpgsql
security definer
set search_path = public
as $function$
#variable_conflict use_column
declare
  v_parent_id uuid;
  v_zone text;
  v_run_id uuid;
  v_reused boolean;
  v_status text;
  v_ordinal int := 0;
  v_total int := coalesce(array_length(p_zones, 1), 0);
begin
  if v_total = 0 then
    raise exception 'seed_orchestration requires at least one zone';
  end if;

  v_parent_id := ensure_artifact(p_user_id, p_run_id);

  update public.research_artifacts a
    set status = case
          when a.status in ('complete', 'partial', 'error', 'aborted') then a.status
          else 'queued'
        end,
        children_total = greatest(a.children_total, v_total),
        updated_at = now()
    where a.id = v_parent_id;

  foreach v_zone in array p_zones loop
    v_ordinal := v_ordinal + 1;

    select r.id, r.status into v_run_id, v_status
      from public.research_section_runs r
      where r.artifact_id = v_parent_id
        and r.zone = v_zone
        and r.status in ('queued', 'running', 'complete', 'error')
      order by case
          when r.status in ('queued', 'running') then 0
          when r.status = 'complete' then 1
          else 2
        end,
        r.started_at asc
      limit 1;

    if v_run_id is null then
      v_run_id := gen_random_uuid();
      insert into public.research_section_runs (
        id, artifact_id, zone, requested_by, prompt, status, started_at
      ) values (
        v_run_id, v_parent_id, v_zone, p_user_id, null, 'queued', now()
      );
      v_reused := false;
      v_status := 'queued';
    else
      v_reused := true;
    end if;

    insert into public.research_artifact_sections as s (
      artifact_id, zone, revision, section_run_id, status, updated_at
    ) values (
      v_parent_id, v_zone, 0, v_run_id, v_status, now()
    )
    on conflict (artifact_id, zone) do update
      set section_run_id = case
            when s.status in ('complete', 'error') then s.section_run_id
            else excluded.section_run_id
          end,
          status = case
            when s.status in ('complete', 'error') then s.status
            else excluded.status
          end,
          updated_at = now();

    parent_id := v_parent_id;
    zone := v_zone;
    section_run_id := v_run_id;
    ordinal := v_ordinal;
    reused := v_reused;
    status := v_status;
    return next;
  end loop;

  return;
end $function$;

revoke execute on function public.seed_orchestration(text, text, text[])
  from public, anon, authenticated;
grant execute on function public.seed_orchestration(text, text, text[])
  to service_role;
