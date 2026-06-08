-- Re-assert the post-six capstone rollup exclusion on the LIVE database.
-- 20260604_cross_section_reasoning_rollup_exclusion.sql added
-- positioningCrossSectionReasoning (the thinker) to the seed_orchestration
-- exclusion set, but the live prod DB (sidrtuxpqftyzwdusdha) was observed in
-- the E2E (run 02a121c0..., commit 9302bec5) still flagging the thinker
-- counts_toward_rollup=true -- i.e. it is still running the prior 20260603
-- function whose exclusion array omits the thinker. This migration re-applies
-- the correct function + a scoped, idempotent historical repair so it takes
-- effect through the normal migration flow. Safe to run whether or not 20260604
-- ever landed: create-or-replace is idempotent and the repair only flips
-- already-wrong true->false on the three capstone zones.

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
      artifact_id,
      zone,
      revision,
      section_run_id,
      status,
      counts_toward_rollup,
      updated_at
    ) values (
      v_parent_id,
      v_zone,
      0,
      v_run_id,
      v_status,
      (v_zone <> all (
        array[
          'positioningCrossSectionReasoning',
          'positioningSynthesis',
          'positioningPaidMediaPlan'
        ]
      )),
      now()
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
          counts_toward_rollup = (v_zone <> all (
            array[
              'positioningCrossSectionReasoning',
              'positioningSynthesis',
              'positioningPaidMediaPlan'
            ]
          )),
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

-- Scoped, idempotent historical repair: flip any capstone row still mis-flagged
-- true (e.g. the thinker from run 02a121c0...). Only touches the three capstone
-- zones and only true->false, so re-running is a no-op once correct. children_*
-- counters are already clamped by the rollup trigger and need no repair.
update public.research_artifact_sections
  set counts_toward_rollup = false
  where zone in (
      'positioningCrossSectionReasoning',
      'positioningSynthesis',
      'positioningPaidMediaPlan'
    )
    and counts_toward_rollup = true;
