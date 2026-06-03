-- Research v3 persistence and parent rollup correctness.
--
-- Only rows seeded for the six canonical positioning sections should count
-- toward parent completion. Capstone sections keep the false default.

alter table public.research_artifacts
  add column if not exists profile_persisted_at timestamptz;

alter table public.research_artifact_sections
  add column if not exists counts_toward_rollup boolean not null default false;

alter table public.business_profiles
  add column if not exists cached_onboarding jsonb;

alter table public.research_section_events
  alter column section_run_id drop not null,
  alter column zone drop not null;

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
      true,
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
          counts_toward_rollup = true,
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

create or replace function public.roll_up_research_artifact(
  p_artifact_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $function$
#variable_conflict use_column
declare
  v_complete int;
begin
  select count(*)::int
    into v_complete
    from public.research_artifact_sections s
    where s.artifact_id = p_artifact_id
      and s.status = 'complete'
      and s.counts_toward_rollup = true;

  update public.research_artifacts a
    set children_complete = least(v_complete, a.children_total),
        status = case
          when a.children_total > 0
            and v_complete >= a.children_total
          then 'complete'
          else a.status
        end,
        updated_at = now()
    where a.id = p_artifact_id;
end $function$;

revoke execute on function public.roll_up_research_artifact(uuid)
  from public, anon, authenticated;
grant execute on function public.roll_up_research_artifact(uuid)
  to service_role;

-- One-time historical repair for rows created before counts_toward_rollup.
-- Future rollup membership comes only from seed_orchestration(p_zones).
update public.research_artifact_sections
  set counts_toward_rollup = true
  where zone in (
      'positioningMarketCategory',
      'positioningBuyerICP',
      'positioningCompetitorLandscape',
      'positioningVoiceOfCustomer',
      'positioningDemandIntent',
      'positioningOfferDiagnostic'
    )
    and counts_toward_rollup = false;

update public.research_artifacts a
  set children_complete = least((
      select count(*)::int
        from public.research_artifact_sections s
        where s.artifact_id = a.id
          and s.status = 'complete'
          and s.counts_toward_rollup = true
    ), a.children_total),
    updated_at = now()
  where a.children_complete is distinct from least((
      select count(*)::int
        from public.research_artifact_sections s
        where s.artifact_id = a.id
          and s.status = 'complete'
          and s.counts_toward_rollup = true
    ), a.children_total);
