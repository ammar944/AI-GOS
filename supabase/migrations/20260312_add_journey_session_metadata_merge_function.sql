create or replace function public.merge_journey_session_metadata_keys(
  p_user_id text,
  p_keys jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.journey_sessions (
    user_id,
    metadata,
    updated_at
  )
  values (
    p_user_id,
    coalesce(p_keys, '{}'::jsonb),
    now()
  )
  on conflict (user_id) do update
  set metadata = coalesce(public.journey_sessions.metadata, '{}'::jsonb)
    || coalesce(p_keys, '{}'::jsonb),
      updated_at = now();
end;
$$;

revoke execute on function public.merge_journey_session_metadata_keys(text, jsonb) from public;
grant execute on function public.merge_journey_session_metadata_keys(text, jsonb) to service_role;
