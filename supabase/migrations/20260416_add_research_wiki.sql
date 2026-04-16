-- Research Wiki: persistent structured knowledge base for runner context sharing.
-- Each runner writes wiki entries after completing. Subsequent runners read
-- relevant entries instead of lossy summarized context.
-- See: .claude/plans/curious-roaming-sifakis.md Phase 2

ALTER TABLE journey_sessions
  ADD COLUMN IF NOT EXISTS research_wiki
  JSONB DEFAULT '{"entries":[],"version":0}'::jsonb;

-- Atomic append: adds entries and bumps version in a single statement.
-- Safe under concurrent runner writes (each runner appends, never overwrites).
CREATE OR REPLACE FUNCTION public.append_research_wiki_entries(
  p_user_id TEXT,
  p_run_id TEXT,
  p_entries JSONB
) RETURNS VOID AS $$
BEGIN
  UPDATE journey_sessions
  SET research_wiki = jsonb_build_object(
    'entries', COALESCE(research_wiki->'entries', '[]'::jsonb) || p_entries,
    'version', COALESCE((research_wiki->>'version')::int, 0) + 1
  )
  WHERE user_id = p_user_id
    AND run_id = p_run_id;
END;
$$ LANGUAGE plpgsql;
