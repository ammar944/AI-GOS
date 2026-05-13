-- Phase 1 of the orchestrator + artifact UI cycle.
-- Adds the parent/child run model on top of the normalized artifact tables
-- shipped in 20260514. The Next.js POST /api/research-v2/orchestrate endpoint
-- calls seed_orchestration(...) to idempotently create one parent
-- research_artifacts row + six queued research_section_runs (one per
-- positioning zone). The worker (Phase 2) picks those up and runs them.
--
-- Idempotency contract: calling seed_orchestration twice with the same
-- (user_id, run_id, zones) returns the same parent_id and the same
-- section_run_ids — no duplicate parents, no duplicate non-terminal children.

-- ---------------------------------------------------------------------------
-- Parent rollup columns
-- ---------------------------------------------------------------------------

alter table research_artifacts
  add column if not exists children_total int not null default 0,
  add column if not exists children_complete int not null default 0;

-- ---------------------------------------------------------------------------
-- Helpful index for non-terminal section_run lookup during seeding.
-- ---------------------------------------------------------------------------

create index if not exists idx_section_runs_active_per_zone
  on research_section_runs (artifact_id, zone, status)
  where status in ('queued', 'running');

-- ---------------------------------------------------------------------------
-- RPC: seed_orchestration
--
-- For each zone in p_zones, returns (zone, section_run_id, ordinal) for a
-- queued or running section_run row. If a non-terminal run already exists for
-- (artifact_id, zone), it is reused; otherwise a new queued row is inserted.
-- Always returns one row per zone in input order, plus a parent_id sentinel
-- in the parent_id column. Idempotent on (user_id, run_id, zones).
-- ---------------------------------------------------------------------------

create or replace function seed_orchestration(
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
as $$
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

  -- Parent row — idempotent via the existing ensure_artifact RPC contract
  -- (unique on user_id, run_id).
  v_parent_id := ensure_artifact(p_user_id, p_run_id);

  -- Parent rollup. Only bump children_total when it hasn't been set yet so
  -- a later call that re-uses the same parent doesn't multiply the counter.
  update research_artifacts
    set status = case
          when status in ('complete', 'partial', 'error', 'aborted') then status
          else 'queued'
        end,
        children_total = greatest(children_total, v_total),
        updated_at = now()
    where id = v_parent_id;

  -- One row per zone. Reuse any non-terminal run, otherwise insert a queued
  -- run. Either way we return (zone, section_run_id, ordinal) in input order.
  foreach v_zone in array p_zones loop
    v_ordinal := v_ordinal + 1;

    select id into v_run_id
      from research_section_runs
      where artifact_id = v_parent_id
        and zone = v_zone
        and status in ('queued', 'running')
      order by started_at asc
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

    -- Mirror in the per-zone artifact_sections row so the UI can render the
    -- queued state before the worker writes the first event.
    insert into research_artifact_sections (
      artifact_id, zone, revision, section_run_id, status, updated_at
    ) values (
      v_parent_id, v_zone, 0, v_run_id, 'queued', now()
    )
    on conflict (artifact_id, zone) do update
      set section_run_id = case
            when research_artifact_sections.status in ('complete') then research_artifact_sections.section_run_id
            else excluded.section_run_id
          end,
          status = case
            when research_artifact_sections.status in ('complete') then research_artifact_sections.status
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
end $$;

-- ---------------------------------------------------------------------------
-- Allow service-role callers to invoke the new RPC. RLS still hides the
-- underlying tables from end users; writes flow only through this function.
-- ---------------------------------------------------------------------------

grant execute on function seed_orchestration(text, text, text[]) to service_role;
