-- Enable Realtime for journey_sessions table
-- Required for useResearchRealtime to receive postgres_changes events
-- when the Railway worker writes research results.

alter publication supabase_realtime add table journey_sessions;
