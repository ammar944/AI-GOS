-- Fix: Enable multi-session per user
-- The previous UNIQUE(user_id) constraint forces one row per user, making every
-- new journey overwrite the last. The app code already uses onConflict: 'user_id,run_id'
-- (session-state.server.ts:203) but the DB constraint didn't match.
--
-- This migration:
-- 1. Backfills run_id for any rows missing it
-- 2. Drops UNIQUE(user_id), adds UNIQUE(user_id, run_id)
-- 3. Rewrites 3 RPC functions to accept p_run_id and use the new constraint

-- Step 1: Backfill run_id for existing rows that have NULL run_id
UPDATE journey_sessions
SET run_id = gen_random_uuid()::text
WHERE run_id IS NULL;

-- Step 2: Make run_id NOT NULL now that all rows have values
ALTER TABLE journey_sessions
  ALTER COLUMN run_id SET NOT NULL;

-- Step 3: Drop the old single-session constraint
ALTER TABLE journey_sessions
  DROP CONSTRAINT IF EXISTS journey_sessions_user_id_unique;

-- Step 4: Add the new multi-session constraint
ALTER TABLE journey_sessions
  ADD CONSTRAINT journey_sessions_user_run_unique UNIQUE (user_id, run_id);

-- Step 5: Add index for run_id lookups (frontend queries by run_id)
CREATE INDEX IF NOT EXISTS idx_journey_sessions_run_id ON journey_sessions(run_id);

-- Step 6: Rewrite merge_journey_session_research_result to accept run_id
CREATE OR REPLACE FUNCTION public.merge_journey_session_research_result(
  p_user_id text,
  p_run_id text,
  p_section text,
  p_result jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.journey_sessions (
    user_id,
    run_id,
    research_results,
    updated_at
  )
  VALUES (
    p_user_id,
    p_run_id,
    jsonb_build_object(p_section, p_result),
    now()
  )
  ON CONFLICT (user_id, run_id) DO UPDATE
  SET research_results = CASE
    WHEN coalesce(public.journey_sessions.research_results -> p_section ->> 'status', '') = 'complete'
      AND coalesce(p_result ->> 'status', '') IN ('error', 'partial')
    THEN public.journey_sessions.research_results
    ELSE coalesce(public.journey_sessions.research_results, '{}'::jsonb) ||
      jsonb_build_object(p_section, p_result)
  END,
  updated_at = now();
END;
$$;

-- Step 7: Rewrite merge_journey_session_job_status to accept run_id
CREATE OR REPLACE FUNCTION public.merge_journey_session_job_status(
  p_user_id text,
  p_run_id text,
  p_job_id text,
  p_row jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.journey_sessions (
    user_id,
    run_id,
    job_status,
    updated_at
  )
  VALUES (
    p_user_id,
    p_run_id,
    jsonb_build_object(p_job_id, p_row),
    now()
  )
  ON CONFLICT (user_id, run_id) DO UPDATE
  SET job_status = jsonb_set(
    coalesce(public.journey_sessions.job_status, '{}'::jsonb),
    array[p_job_id],
    public.merge_journey_job_status_row(
      public.journey_sessions.job_status -> p_job_id,
      p_row
    ),
    true
  ),
  updated_at = now();
END;
$$;

-- Step 8: Rewrite merge_journey_session_metadata_keys to accept run_id
CREATE OR REPLACE FUNCTION public.merge_journey_session_metadata_keys(
  p_user_id text,
  p_run_id text,
  p_keys jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.journey_sessions (
    user_id,
    run_id,
    metadata,
    updated_at
  )
  VALUES (
    p_user_id,
    p_run_id,
    coalesce(p_keys, '{}'::jsonb),
    now()
  )
  ON CONFLICT (user_id, run_id) DO UPDATE
  SET metadata = coalesce(public.journey_sessions.metadata, '{}'::jsonb)
    || coalesce(p_keys, '{}'::jsonb),
      updated_at = now();
END;
$$;

-- Revoke/grant for the updated metadata function
REVOKE EXECUTE ON FUNCTION public.merge_journey_session_metadata_keys(text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.merge_journey_session_metadata_keys(text, text, jsonb) TO service_role;
