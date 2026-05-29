-- Dispatch gating (Cluster A, layer 1): the orchestrate dispatcher must know each
-- seeded zone's current status so it can skip kicking off zones that are already
-- running or complete. Pure additive column on the seed_orchestration RETURNS TABLE.
-- New rows are 'queued'; reused rows carry their real status.

-- Adding the `status` column changes the function's result type (RETURNS TABLE
-- columns are OUT params); Postgres CREATE OR REPLACE cannot change a return type,
-- so the prior definition must be dropped first. The DROP + CREATE runs in one
-- migration transaction, so there is no window where the RPC is missing.
drop function if exists public.seed_orchestration(text, text, text[]);

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

    select r.id, r.status into v_run_id, v_status
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
      v_status := 'queued';
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
    status := v_status;
    return next;
  end loop;

  return;
end $function$;

grant execute on function public.seed_orchestration(text, text, text[]) to service_role;
