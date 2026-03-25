-- Create Shared Sessions Table
-- Migration: 20260324_create_shared_sessions.sql
-- Immutable snapshots of journey sessions for public sharing

CREATE TABLE IF NOT EXISTS public.shared_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token text UNIQUE NOT NULL,
  session_id uuid NOT NULL REFERENCES public.journey_sessions(id) ON DELETE CASCADE,
  owner_user_id text NOT NULL,
  title text,
  research_snapshot jsonb,
  media_plan_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_shared_sessions_token
ON public.shared_sessions(share_token);

-- Index for owner lookups (list user's shared sessions)
CREATE INDEX IF NOT EXISTS idx_shared_sessions_owner
ON public.shared_sessions(owner_user_id);

-- Enable RLS
ALTER TABLE public.shared_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can view shared sessions (they're public by design)
CREATE POLICY "Anyone can view shared sessions"
ON public.shared_sessions FOR SELECT
USING (true);

-- Only authenticated users can create shared sessions (ownership enforced in API)
CREATE POLICY "Authenticated users can create shared sessions"
ON public.shared_sessions FOR INSERT
TO authenticated
WITH CHECK (true);

COMMENT ON TABLE public.shared_sessions IS
'Immutable snapshots of journey sessions for public sharing via unique tokens';
