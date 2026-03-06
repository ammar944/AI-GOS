-- Fix: Add UNIQUE constraint on user_id for upsert support
-- The code uses .upsert({ ... }, { onConflict: 'user_id' }) which requires
-- a unique or exclusion constraint on the conflict column.

-- Drop existing non-unique index first
drop index if exists idx_journey_sessions_user_id;

-- Add unique constraint (automatically creates a unique index)
alter table journey_sessions
  add constraint journey_sessions_user_id_unique unique (user_id);

-- Add research_output column if missing (referenced by persistResearchToSupabase)
alter table journey_sessions
  add column if not exists research_output jsonb default '{}'::jsonb;
