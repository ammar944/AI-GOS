-- Harden Supabase security advisor findings.
-- - Fix mutable search_path warnings on helper and SECURITY DEFINER functions
-- - Enable RLS on journey_sessions with Clerk-backed owner policies
-- - Remove permissive public insert policies from shared_blueprints / blueprint_versions
-- - Move vector extension out of public schema

alter function public.update_journey_sessions_updated_at()
  set search_path = public;

alter function public.get_next_version_number(uuid)
  set search_path = public;

alter function public.update_blueprints_updated_at()
  set search_path = public;

alter function public.merge_journey_session_research_result(text, text, jsonb)
  set search_path = public;

alter function public.requesting_user_id()
  set search_path = public;

alter function public.merge_journey_job_status_updates(jsonb, jsonb)
  set search_path = public;

alter function public.merge_journey_session_job_status(text, text, jsonb)
  set search_path = public;

alter function public.merge_journey_job_status_row(jsonb, jsonb)
  set search_path = public;

alter function public.update_media_plans_updated_at()
  set search_path = public;

alter function public.update_conversation_timestamp()
  set search_path = public;

alter function public.apply_blueprint_edit(uuid, text, text, jsonb, jsonb, text, uuid)
  set search_path = public;

alter function public.set_updated_at()
  set search_path = public;

alter table if exists public.journey_sessions enable row level security;

drop policy if exists "Users can view their own journey sessions"
  on public.journey_sessions;
drop policy if exists "Users can insert their own journey sessions"
  on public.journey_sessions;
drop policy if exists "Users can update their own journey sessions"
  on public.journey_sessions;
drop policy if exists "Users can delete their own journey sessions"
  on public.journey_sessions;

create policy "Users can view their own journey sessions"
  on public.journey_sessions
  for select
  to authenticated
  using (user_id = auth.jwt() ->> 'sub');

create policy "Users can insert their own journey sessions"
  on public.journey_sessions
  for insert
  to authenticated
  with check (user_id = auth.jwt() ->> 'sub');

create policy "Users can update their own journey sessions"
  on public.journey_sessions
  for update
  to authenticated
  using (user_id = auth.jwt() ->> 'sub')
  with check (user_id = auth.jwt() ->> 'sub');

create policy "Users can delete their own journey sessions"
  on public.journey_sessions
  for delete
  to authenticated
  using (user_id = auth.jwt() ->> 'sub');

alter table if exists public.blueprint_versions enable row level security;

drop policy if exists "Allow public insert"
  on public.blueprint_versions;
drop policy if exists "Allow public read"
  on public.blueprint_versions;
drop policy if exists "Users can view their own blueprint versions"
  on public.blueprint_versions;

create policy "Users can view their own blueprint versions"
  on public.blueprint_versions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.blueprints
      where public.blueprints.id = public.blueprint_versions.blueprint_id
        and public.blueprints.user_id = auth.jwt() ->> 'sub'
    )
  );

alter table if exists public.shared_blueprints enable row level security;

drop policy if exists "Allow insert"
  on public.shared_blueprints;
drop policy if exists "Allow public read"
  on public.shared_blueprints;
drop policy if exists "Authenticated users can create shared blueprints"
  on public.shared_blueprints;
drop policy if exists "Anyone can view shared blueprints"
  on public.shared_blueprints;

create policy "Anyone can view shared blueprints"
  on public.shared_blueprints
  for select
  to public
  using (true);

do $$
begin
  if exists (
    select 1
    from pg_extension
    where extname = 'vector'
      and extnamespace <> 'extensions'::regnamespace
  ) then
    execute 'alter extension vector set schema extensions';
  end if;
end;
$$;
