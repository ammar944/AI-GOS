-- Re-seeding a partially complete lab fan-out must reuse complete section runs
-- for already-finished zones instead of inserting fresh queued children.

create index if not exists idx_section_runs_seed_reuse_per_zone
  on public.research_section_runs (artifact_id, zone, status)
  where status in ('queued', 'running', 'complete');

create or replace function public.seed_orchestration(
  p_user_id text,
  p_run_id text,
  p_zones text[]
) returns table (
  parent_id uuid,
  zone text,
  section_run_id uuid,
  ordinal int,
  reused boolean
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
  v_ordinal int := 0;
  v_total int := coalesce(array_length(p_zones, 1), 0);
begin
  if v_total = 0 then
    raise exception 'seed_orchestration requires at least one zone';
  end if;

  v_parent_id := ensure_artifact(p_user_id, p_run_id);

  update research_artifacts a
    set status = case
          when a.status in ('complete', 'partial', 'error', 'aborted') then a.status
          else 'queued'
        end,
        children_total = greatest(a.children_total, v_total),
        updated_at = now()
    where a.id = v_parent_id;

  foreach v_zone in array p_zones loop
    v_ordinal := v_ordinal + 1;

    select r.id into v_run_id
      from research_section_runs r
      where r.artifact_id = v_parent_id
        and r.zone = v_zone
        and r.status in ('queued', 'running', 'complete')
      order by case
          when r.status in ('queued', 'running') then 0
          else 1
        end,
        r.started_at asc
      limit 1;

    if v_run_id is null then
      v_run_id := gen_random_uuid();
      insert into research_section_runs (
        id, artifact_id, zone, requested_by, prompt, status, started_at
      ) values (
        v_run_id, v_parent_id, v_zone, p_user_id, null, 'queued', now()
      );
      v_reused := false;
    else
      v_reused := true;
    end if;

    insert into research_artifact_sections as s (
      artifact_id, zone, revision, section_run_id, status, updated_at
    ) values (
      v_parent_id, v_zone, 0, v_run_id, 'queued', now()
    )
    on conflict (artifact_id, zone) do update
      set section_run_id = case
            when s.status = 'complete' then s.section_run_id
            else excluded.section_run_id
          end,
          status = case
            when s.status = 'complete' then s.status
            else 'queued'
          end,
          updated_at = now();

    parent_id := v_parent_id;
    zone := v_zone;
    section_run_id := v_run_id;
    ordinal := v_ordinal;
    reused := v_reused;
    return next;
  end loop;

  return;
end $function$;

grant execute on function public.seed_orchestration(text, text, text[]) to service_role;
