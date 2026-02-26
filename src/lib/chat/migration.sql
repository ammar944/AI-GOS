-- =============================================================================
-- Chat Conversations Persistence Table
-- Run this migration in the Supabase SQL editor or via the CLI.
-- =============================================================================

-- Main table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT        NOT NULL,
  blueprint_id TEXT        NOT NULL,
  messages     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  title        TEXT        NOT NULL DEFAULT 'New conversation',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite index for the primary list query (user + blueprint, ordered by updated_at)
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_blueprint
  ON chat_conversations(user_id, blueprint_id);

-- Supporting index for ordering by recency
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated
  ON chat_conversations(updated_at DESC);

-- =============================================================================
-- Row-Level Security
-- =============================================================================

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- Users can read/insert/update/delete only their own rows.
-- auth.uid() is cast to TEXT because user_id stores Clerk user IDs (text).
CREATE POLICY "Users can manage own conversations"
  ON chat_conversations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- =============================================================================
-- Auto-update trigger for updated_at
-- (optional — the application layer always sets updated_at explicitly,
--  but this guard ensures consistency for any direct DB writes)
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
