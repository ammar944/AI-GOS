-- Add research_results column to journey_sessions for async research worker
-- This column stores structured results from the Railway research worker.
-- Format: { [sectionName]: ResearchResult }
-- The Realtime subscription in useResearchRealtime depends on this column existing.

alter table journey_sessions
  add column if not exists research_results jsonb default '{}'::jsonb;

-- Enable Realtime on this table (required for useResearchRealtime postgres_changes subscription)
-- Run this in the Supabase SQL editor or via the Dashboard → Database → Replication.
-- Cannot be done via migration SQL alone — must use Supabase management API or Dashboard.
-- See: https://supabase.com/docs/guides/realtime/postgres-changes

comment on column journey_sessions.research_results is
  'Stores research section results written by Railway worker. Keys: industryMarket, competitors, icpValidation, offerAnalysis, crossAnalysis, keywordIntel.';
