-- Invite-only allowlist; intended role before first login

CREATE TABLE IF NOT EXISTS public.client_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  intended_role text NOT NULL CHECK (intended_role IN ('admin', 'internal', 'client')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked')),
  claimed_user_id text,
  claimed_at timestamptz,
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_allowlist_email ON public.client_allowlist(lower(email));
CREATE INDEX IF NOT EXISTS idx_client_allowlist_status ON public.client_allowlist(status);

ALTER TABLE public.client_allowlist ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.client_allowlist IS 'Invite-only access control; managed by admin API with service role. RLS on, no policies — only service role bypasses.';
