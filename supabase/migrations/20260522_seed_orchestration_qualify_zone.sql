-- Pre-existing seed_orchestration (from 20260520) hits Postgres 17's stricter
-- ambiguity check: the RETURNS TABLE(..., zone text, section_run_id uuid, ...)
-- OUT params shadow the research_section_runs.zone and
-- research_artifact_sections.section_run_id columns. The unqualified
--   where zone = v_zone
-- and the INSERT...ON CONFLICT DO UPDATE SET section_run_id/status branch
-- both error with "column reference 'zone' is ambiguous" on every
-- orchestrate POST.
--
-- Fix:
--   1. #variable_conflict use_column — bare identifiers in SQL statements
--      resolve to table columns first. PL/pgSQL OUT-param assignments
--      (parent_id := ...) still target the OUT vars by syntactic context.
--   2. Alias the SELECT/UPDATE targets and qualify column references so the
--      intent is explicit and future-proof.
--
-- No behavior change; same return contract.

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
        and r.status in ('queued', 'running')
      order by r.started_at asc
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
