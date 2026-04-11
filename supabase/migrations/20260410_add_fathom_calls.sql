-- Add fathom_calls JSONB column to journey_sessions for tracking linked Fathom calls.

ALTER TABLE journey_sessions
ADD COLUMN IF NOT EXISTS fathom_calls JSONB DEFAULT '[]'::jsonb;

-- Atomic merge function: upsert a single call entry by recording_id.
-- If a call with this recording_id exists, replace it; otherwise append.
CREATE OR REPLACE FUNCTION merge_journey_session_fathom_call(
  p_user_id TEXT,
  p_run_id TEXT,
  p_recording_id INTEGER,
  p_call_data JSONB
) RETURNS VOID AS $$
DECLARE
  v_existing JSONB;
  v_idx INTEGER;
BEGIN
  SELECT fathom_calls INTO v_existing
  FROM journey_sessions
  WHERE user_id = p_user_id
  AND (metadata->>'activeJourneyRunId') = p_run_id;

  IF v_existing IS NULL THEN
    UPDATE journey_sessions
    SET fathom_calls = jsonb_build_array(p_call_data),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND (metadata->>'activeJourneyRunId') = p_run_id;
    RETURN;
  END IF;

  -- Find index of existing call with this recording_id
  SELECT (ordinality - 1) INTO v_idx
  FROM jsonb_array_elements(v_existing) WITH ORDINALITY AS t(elem, ordinality)
  WHERE (elem->>'recordingId')::integer = p_recording_id
  LIMIT 1;

  IF v_idx IS NOT NULL THEN
    -- Update existing
    UPDATE journey_sessions
    SET fathom_calls = jsonb_set(fathom_calls, ARRAY[v_idx::text], p_call_data),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND (metadata->>'activeJourneyRunId') = p_run_id;
  ELSE
    -- Append new
    UPDATE journey_sessions
    SET fathom_calls = fathom_calls || jsonb_build_array(p_call_data),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND (metadata->>'activeJourneyRunId') = p_run_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: update a fathom call's status by documentId (used by worker post-extraction)
CREATE OR REPLACE FUNCTION update_fathom_call_status_by_document(
  p_user_id TEXT,
  p_run_id TEXT,
  p_document_id TEXT,
  p_status TEXT,
  p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE journey_sessions
  SET fathom_calls = (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN elem->>'documentId' = p_document_id THEN
          CASE
            WHEN p_error IS NOT NULL THEN
              jsonb_set(jsonb_set(elem, '{status}', to_jsonb(p_status)), '{error}', to_jsonb(p_error))
            ELSE
              jsonb_set(elem - 'error', '{status}', to_jsonb(p_status))
          END
        ELSE elem
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(fathom_calls) AS elem
  ),
  updated_at = NOW()
  WHERE user_id = p_user_id
  AND (metadata->>'activeJourneyRunId') = p_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
