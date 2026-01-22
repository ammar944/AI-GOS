-- Add Onboarding Tracking Fields
-- Migration: 20260122_add_onboarding_fields.sql
-- Adds fields to track user onboarding completion status and persist form data

-- Add onboarding tracking columns
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
ADD COLUMN IF NOT EXISTS onboarding_data jsonb;

-- Add index for querying users by onboarding status
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_completed
ON public.user_profiles(onboarding_completed);

-- Add index for querying users by completion date
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_completed_at
ON public.user_profiles(onboarding_completed_at DESC)
WHERE onboarding_completed_at IS NOT NULL;

-- Add check constraint to ensure onboarding_completed_at is set when onboarding_completed is true
ALTER TABLE public.user_profiles
ADD CONSTRAINT check_onboarding_completed_at_when_completed
CHECK (
  (onboarding_completed = false AND onboarding_completed_at IS NULL) OR
  (onboarding_completed = true)
);

-- Comment on columns for documentation
COMMENT ON COLUMN public.user_profiles.onboarding_completed IS
'Indicates whether the user has completed the 9-step onboarding process';

COMMENT ON COLUMN public.user_profiles.onboarding_completed_at IS
'Timestamp when the user completed onboarding. Should be set when onboarding_completed becomes true';

COMMENT ON COLUMN public.user_profiles.onboarding_data IS
'JSONB storage for the 9-step onboarding form data including: businessBasics, icpData, productOffer, marketCompetition, customerJourney, brandPositioning, assetsProof, budgetTargets, compliance';

-- Enable RLS on user_profiles if not already enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;

-- RLS Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.user_profiles FOR SELECT
TO authenticated
USING (id = auth.jwt() ->> 'sub');

-- RLS Policy: Users can update their own profile
-- This allows users to update onboarding fields
CREATE POLICY "Users can update their own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (id = auth.jwt() ->> 'sub')
WITH CHECK (id = auth.jwt() ->> 'sub');

-- RLS Policy: Allow authenticated users to insert their own profile
-- This is needed for initial profile creation if not done via webhook
CREATE POLICY "Users can insert their own profile"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.jwt() ->> 'sub');

-- Note: Service role (used by Clerk webhook) bypasses RLS automatically
-- This allows the webhook to upsert user profiles without restrictions
