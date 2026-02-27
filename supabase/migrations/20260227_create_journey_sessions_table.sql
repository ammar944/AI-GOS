-- Journey Sessions table for AI-GOS v2
-- Stores session state for the /journey chat interface
-- Auth: Service role + Clerk ID (no RLS needed per DISCOVERY.md D8)

create table if not exists journey_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  phase text default 'setup',
  messages jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast user lookups
create index if not exists idx_journey_sessions_user_id on journey_sessions(user_id);

-- Auto-update updated_at timestamp
create or replace function update_journey_sessions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger journey_sessions_updated_at
  before update on journey_sessions
  for each row
  execute function update_journey_sessions_updated_at();
