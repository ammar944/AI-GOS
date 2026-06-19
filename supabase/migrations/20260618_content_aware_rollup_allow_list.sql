-- P0.1 — content-aware rollup + exact-six allow-list.
--
-- Two coupled corrections to the research rollup so a 6/6 "complete" parent can
-- never be declared while a positioning section is empty/unreliable, and so the
-- set of rollup-counting zones is a fail-closed allow-list rather than a
-- deny-list that defaults unknown zones to TRUE.
--
-- (1) roll_up_research_artifact becomes CONTENT-AWARE: a section whose
--     verification_tier = 'insufficient' (empty/unreliable) must NOT count
--     toward children_complete even when status='complete' and
--     counts_toward_rollup=true. NULL-tier handling is fail-closed — a NULL
--     tier counts ONLY when status='complete' AND data IS NOT NULL; otherwise
--     it does not count.
--
-- (2) seed_orchestration + commit_artifact_section replace the capstone
--     DENY-LIST (which defaults any unknown/future zone to TRUE) with an
--     exact-six ALLOW-LIST. counts_toward_rollup is TRUE only for the six
--     canonical positioning zones; capstone (positioningPaidMediaPlan,
--     positioningSynthesis, positioningCrossSectionReasoning), corpus
--     (deepResearchProgram), strategyBrief, and any future/unknown zone are
--     fail-closed FALSE.
--
-- ALLOW-LIST SOURCE OF TRUTH: the six ids below MUST equal POSITIONING_SECTION_IDS
-- in src/lib/ai/prompts/positioning-skills/index.ts:12-19. A drift-guard test
-- (allow-list-drift-guard.test.ts) asserts this SQL array equals that constant.
--
-- No signature changes (CREATE OR REPLACE, no DROP). SECURITY DEFINER preserved.
-- Plain count/predicate SQL only — no PG17-only features, so the pglite test
-- substrate (real plpgsql, offline) matches prod behavior exactly.

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
      and s.counts_toward_rollup = true
      -- Content-aware gate: an 'insufficient'-tier section is empty/unreliable
      -- and must not count. NULL tier is fail-closed — it counts only when the
      -- section actually carries data.
      and (
        (s.verification_tier is not null and s.verification_tier <> 'insufficient')
        or (s.verification_tier is null and s.data is not null)
      );

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
  -- Exact-six positioning allow-list. MUST equal POSITIONING_SECTION_IDS in
  -- src/lib/ai/prompts/positioning-skills/index.ts:12-19 (drift-guarded by test).
  v_allow_list text[] := array[
    'positioningMarketCategory',
    'positioningBuyerICP',
    'positioningCompetitorLandscape',
    'positioningVoiceOfCustomer',
    'positioningDemandIntent',
    'positioningOfferDiagnostic'
  ];
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
      (v_zone = any (v_allow_list)),
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
          counts_toward_rollup = (v_zone = any (v_allow_list)),
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
  -- Exact-six positioning allow-list. MUST equal POSITIONING_SECTION_IDS in
  -- src/lib/ai/prompts/positioning-skills/index.ts:12-19 (drift-guarded by test).
  v_allow_list text[] := array[
    'positioningMarketCategory',
    'positioningBuyerICP',
    'positioningCompetitorLandscape',
    'positioningVoiceOfCustomer',
    'positioningDemandIntent',
    'positioningOfferDiagnostic'
  ];
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
      artifact_id, zone, revision, section_run_id, status, counts_toward_rollup,
      title, markdown, data, claims, sources, error,
      verification_tier, verification_flag, updated_at
    )
    values (
      p_artifact_id,
      p_zone,
      1,
      p_section_run_id,
      coalesce(p_patch->>'status', 'complete'),
      (p_zone = any (v_allow_list)),
      p_patch->>'title',
      p_patch->>'markdown',
      p_patch->'data',
      coalesce(p_patch->'claims', '[]'::jsonb),
      coalesce(p_patch->'sources', '[]'::jsonb),
      p_patch->'error',
      p_patch->>'verificationTier',
      case
        when p_patch ? 'verificationFlag'
          and p_patch->'verificationFlag' <> 'null'::jsonb
        then p_patch->'verificationFlag'
        else null
      end,
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
        counts_toward_rollup = (p_zone = any (v_allow_list)),
        title = coalesce(p_patch->>'title', s.title),
        markdown = coalesce(p_patch->>'markdown', s.markdown),
        data = coalesce(p_patch->'data', s.data),
        claims = coalesce(p_patch->'claims', s.claims),
        sources = coalesce(p_patch->'sources', s.sources),
        error = p_patch->'error',
        verification_tier = case
          when p_patch ? 'verificationTier' then p_patch->>'verificationTier'
          else s.verification_tier
        end,
        verification_flag = case
          when p_patch ? 'verificationFlag'
            and p_patch->'verificationFlag' <> 'null'::jsonb
          then p_patch->'verificationFlag'
          when p_patch ? 'verificationFlag' then null
          else s.verification_flag
        end,
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

revoke execute on function public.commit_artifact_section(uuid, text, uuid, int, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_artifact_section(uuid, text, uuid, int, jsonb)
  to service_role;

-- Scoped, idempotent historical repair: flip any row whose zone is NOT in the
-- exact-six allow-list but is still flagged counts_toward_rollup=true back to
-- false. Only touches now-non-allow-listed rows and only true->false, so
-- re-running is a no-op once correct. Mirrors the repair tail in 20260613.
update public.research_artifact_sections
  set counts_toward_rollup = false
  where counts_toward_rollup = true
    and zone <> all (array[
      'positioningMarketCategory',
      'positioningBuyerICP',
      'positioningCompetitorLandscape',
      'positioningVoiceOfCustomer',
      'positioningDemandIntent',
      'positioningOfferDiagnostic'
    ]);

-- Re-roll affected parents so children_complete reflects the corrected flags
-- and the new content-aware gate.
update public.research_artifacts a
  set children_complete = least((
      select count(*)::int
        from public.research_artifact_sections s
        where s.artifact_id = a.id
          and s.status = 'complete'
          and s.counts_toward_rollup = true
          and (
            (s.verification_tier is not null and s.verification_tier <> 'insufficient')
            or (s.verification_tier is null and s.data is not null)
          )
    ), a.children_total),
    updated_at = now()
  where a.children_complete is distinct from least((
      select count(*)::int
        from public.research_artifact_sections s
        where s.artifact_id = a.id
          and s.status = 'complete'
          and s.counts_toward_rollup = true
          and (
            (s.verification_tier is not null and s.verification_tier <> 'insufficient')
            or (s.verification_tier is null and s.data is not null)
          )
    ), a.children_total);
