-- App-level RBAC for client rollout (Clerk identity + DB roles)

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS app_role text,
  ADD COLUMN IF NOT EXISTS account_status text,
  ADD COLUMN IF NOT EXISTS primary_profile_id uuid REFERENCES public.business_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS role_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS role_assigned_by text;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_app_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_app_role_check
  CHECK (app_role IS NULL OR app_role IN ('admin', 'internal', 'client'));

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_account_status_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_account_status_check
  CHECK (account_status IS NULL OR account_status IN ('pending', 'active', 'disabled'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_app_role ON public.user_profiles(app_role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_status ON public.user_profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_primary_profile ON public.user_profiles(primary_profile_id);

-- Grandfather existing users as internal + active (pre-RBAC installs)
UPDATE public.user_profiles
SET
  app_role = COALESCE(app_role, 'internal'),
  account_status = COALESCE(account_status, 'active')
WHERE deleted_at IS NULL
  AND (app_role IS NULL OR account_status IS NULL);
