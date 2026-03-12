create or replace function public.merge_journey_job_status_updates(
  existing_updates jsonb,
  incoming_updates jsonb
) returns jsonb
language sql
immutable
as $$
  with combined as (
    select update_elem
    from jsonb_array_elements(
      coalesce(existing_updates, '[]'::jsonb) ||
      coalesce(incoming_updates, '[]'::jsonb)
    ) as update_elem
  ),
  deduped as (
    select distinct on (coalesce(update_elem->>'id', md5(update_elem::text)))
      update_elem
    from combined
    order by
      coalesce(update_elem->>'id', md5(update_elem::text)),
      coalesce(update_elem->>'at', '') desc
  )
  select coalesce(
    jsonb_agg(update_elem order by coalesce(update_elem->>'at', '')),
    '[]'::jsonb
  )
  from deduped;
$$;

create or replace function public.merge_journey_job_status_row(
  existing_row jsonb,
  incoming_row jsonb
) returns jsonb
language sql
immutable
as $$
  select jsonb_strip_nulls(
    (
      (coalesce(existing_row, '{}'::jsonb) || coalesce(incoming_row, '{}'::jsonb))
      - 'updates'
    ) || jsonb_build_object(
      'updates',
      public.merge_journey_job_status_updates(
        existing_row->'updates',
        incoming_row->'updates'
      )
    )
  );
$$;

create or replace function public.merge_journey_session_research_result(
  p_user_id text,
  p_section text,
  p_result jsonb
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.journey_sessions (
    user_id,
    research_results,
    updated_at
  )
  values (
    p_user_id,
    jsonb_build_object(p_section, p_result),
    now()
  )
  on conflict (user_id) do update
  set research_results = case
    when coalesce(public.journey_sessions.research_results -> p_section ->> 'status', '') = 'complete'
      and coalesce(p_result ->> 'status', '') in ('error', 'partial')
    then public.journey_sessions.research_results
    else coalesce(public.journey_sessions.research_results, '{}'::jsonb) ||
      jsonb_build_object(p_section, p_result)
  end,
  updated_at = now();
end;
$$;

create or replace function public.merge_journey_session_job_status(
  p_user_id text,
  p_job_id text,
  p_row jsonb
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.journey_sessions (
    user_id,
    job_status,
    updated_at
  )
  values (
    p_user_id,
    jsonb_build_object(p_job_id, p_row),
    now()
  )
  on conflict (user_id) do update
  set job_status = jsonb_set(
    coalesce(public.journey_sessions.job_status, '{}'::jsonb),
    array[p_job_id],
    public.merge_journey_job_status_row(
      public.journey_sessions.job_status -> p_job_id,
      p_row
    ),
    true
  ),
  updated_at = now();
end;
$$;
