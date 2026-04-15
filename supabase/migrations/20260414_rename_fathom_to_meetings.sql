-- Rename fathom_calls column to meeting_transcripts
ALTER TABLE journey_sessions
RENAME COLUMN fathom_calls TO meeting_transcripts;

-- Drop old RPCs
DROP FUNCTION IF EXISTS merge_journey_session_fathom_call(TEXT, TEXT, INTEGER, JSONB);
DROP FUNCTION IF EXISTS update_fathom_call_status_by_document(TEXT, TEXT, TEXT, TEXT, TEXT);

-- Atomic merge function: upsert a single meeting entry by id.
-- If a meeting with this id exists, replace it; otherwise append.
CREATE OR REPLACE FUNCTION merge_journey_session_meeting(
  p_user_id TEXT,
  p_run_id TEXT,
  p_meeting_id TEXT,
  p_meeting_data JSONB
) RETURNS VOID AS $$
DECLARE
  v_existing JSONB;
  v_idx INTEGER;
BEGIN
  SELECT meeting_transcripts INTO v_existing
  FROM journey_sessions
  WHERE user_id = p_user_id
  AND (metadata->>'activeJourneyRunId') = p_run_id;

  IF v_existing IS NULL THEN
    UPDATE journey_sessions
    SET meeting_transcripts = jsonb_build_array(p_meeting_data),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND (metadata->>'activeJourneyRunId') = p_run_id;
    RETURN;
  END IF;

  -- Find index of existing meeting with this id
  SELECT (ordinality - 1) INTO v_idx
  FROM jsonb_array_elements(v_existing) WITH ORDINALITY AS t(elem, ordinality)
  WHERE elem->>'id' = p_meeting_id
  LIMIT 1;

  IF v_idx IS NOT NULL THEN
    -- Update existing
    UPDATE journey_sessions
    SET meeting_transcripts = jsonb_set(meeting_transcripts, ARRAY[v_idx::text], p_meeting_data),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND (metadata->>'activeJourneyRunId') = p_run_id;
  ELSE
    -- Append new
    UPDATE journey_sessions
    SET meeting_transcripts = meeting_transcripts || jsonb_build_array(p_meeting_data),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND (metadata->>'activeJourneyRunId') = p_run_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: update a meeting's status by documentId (used by worker post-extraction)
CREATE OR REPLACE FUNCTION update_meeting_status_by_document(
  p_user_id TEXT,
  p_run_id TEXT,
  p_document_id TEXT,
  p_status TEXT,
  p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE journey_sessions
  SET meeting_transcripts = (
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
    FROM jsonb_array_elements(meeting_transcripts) AS elem
  ),
  updated_at = NOW()
  WHERE user_id = p_user_id
  AND (metadata->>'activeJourneyRunId') = p_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
