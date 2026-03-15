-- Add research_document column to store compiled approved cards
-- and document_saved_at to track when the document was saved
ALTER TABLE journey_sessions
  ADD COLUMN IF NOT EXISTS research_document JSONB,
  ADD COLUMN IF NOT EXISTS document_saved_at TIMESTAMPTZ;
