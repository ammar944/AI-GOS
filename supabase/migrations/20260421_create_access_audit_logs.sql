-- Audit trail for impersonated and sensitive writes

CREATE TABLE IF NOT EXISTS public.access_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text NOT NULL,
  effective_user_id text,
  effective_profile_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_audit_actor ON public.access_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_effective_user ON public.access_audit_logs(effective_user_id);
CREATE INDEX IF NOT EXISTS idx_access_audit_created ON public.access_audit_logs(created_at DESC);

ALTER TABLE public.access_audit_logs ENABLE ROW LEVEL SECURITY;
