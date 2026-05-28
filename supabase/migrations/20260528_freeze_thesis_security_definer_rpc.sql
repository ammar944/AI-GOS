-- Freeze the reviewed GTM brief snapshot with one atomic update. This avoids
-- the application-level read-modify-write race in orchestrate-db.ts.

create or replace function public.freeze_reviewed_brief_snapshot(
  p_parent_audit_run_id uuid,
  p_gtm_brief_snapshot jsonb,
  p_gtm_brief_review jsonb,
  p_frozen_at timestamptz
) returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_updated_count int;
  v_exists boolean;
begin
  update public.research_artifacts a
    set thesis = coalesce(a.thesis, '{}'::jsonb) || jsonb_build_object(
          'source', 'onboarding_v2_review',
          'frozenAt', to_jsonb(p_frozen_at),
          'gtmBriefSnapshot', p_gtm_brief_snapshot,
          'gtmBriefReview', p_gtm_brief_review
        ),
        updated_at = now()
    where a.id = p_parent_audit_run_id
      and a.thesis->>'source' is distinct from 'onboarding_v2_review';

  get diagnostics v_updated_count = row_count;
  if v_updated_count > 0 then
    return 'frozen';
  end if;

  select exists (
    select 1
      from public.research_artifacts a
      where a.id = p_parent_audit_run_id
  ) into v_exists;

  if not v_exists then
    raise exception 'research_artifacts row % not found', p_parent_audit_run_id;
  end if;

  return 'already_frozen';
end $function$;

grant execute on function public.freeze_reviewed_brief_snapshot(
  uuid,
  jsonb,
  jsonb,
  timestamptz
) to service_role;
