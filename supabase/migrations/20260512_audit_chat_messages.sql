-- Unified audit chat messages keyed by research-v2 run.

CREATE TABLE IF NOT EXISTS public.audit_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  intent text NULL CHECK (intent IS NULL OR intent IN ('rerun', 'patch', 'converse')),
  target_section text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_chat_messages_user_run_fkey
    FOREIGN KEY (user_id, run_id)
    REFERENCES public.journey_sessions(user_id, run_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_chat_messages_user_run_created_at
  ON public.audit_chat_messages(user_id, run_id, created_at);

ALTER TABLE public.audit_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own audit chat messages"
  ON public.audit_chat_messages;
DROP POLICY IF EXISTS "Users can insert their own audit chat messages"
  ON public.audit_chat_messages;

CREATE POLICY "Users can view their own audit chat messages"
  ON public.audit_chat_messages
  FOR SELECT
  TO authenticated
  USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert their own audit chat messages"
  ON public.audit_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.jwt() ->> 'sub');
