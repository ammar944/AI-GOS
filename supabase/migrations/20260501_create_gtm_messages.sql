-- Migration: persisted GTM agent transcript messages
-- Date: 2026-05-01

CREATE TABLE IF NOT EXISTS public.gtm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL REFERENCES public.gtm_runs(run_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL,
  message_type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'complete',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gtm_messages_role_check CHECK (role IN (
    'user',
    'assistant',
    'system',
    'tool'
  )),
  CONSTRAINT gtm_messages_message_type_check CHECK (message_type IN (
    'text',
    'thinking',
    'tool_group',
    'artifact',
    'error',
    'system'
  )),
  CONSTRAINT gtm_messages_status_check CHECK (status IN (
    'pending',
    'streaming',
    'complete',
    'errored'
  ))
);

CREATE INDEX IF NOT EXISTS idx_gtm_messages_run_id
  ON public.gtm_messages(run_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_gtm_messages_user_id
  ON public.gtm_messages(user_id, created_at DESC);

ALTER TABLE public.gtm_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own GTM messages"
  ON public.gtm_messages;
CREATE POLICY "Users can read their own GTM messages"
  ON public.gtm_messages
  FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  );

DROP POLICY IF EXISTS "Users can write their own GTM messages"
  ON public.gtm_messages;
CREATE POLICY "Users can write their own GTM messages"
  ON public.gtm_messages
  FOR INSERT
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  );

COMMENT ON TABLE public.gtm_messages IS
  'Persisted GTM agent transcript for /gtm/[runId]. The live AI SDK stream remains transient, but user/tool/system messages survive refreshes.';
