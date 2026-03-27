-- Add profile_id FK to journey_sessions for linking sessions to business profiles.
-- This enables the Research tab on the profile detail page.

-- Step 1: Add the column
ALTER TABLE journey_sessions
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES business_profiles(id) ON DELETE SET NULL;

-- Step 2: Index for fast profile-scoped queries
CREATE INDEX IF NOT EXISTS idx_journey_sessions_profile_id
  ON journey_sessions(profile_id)
  WHERE profile_id IS NOT NULL;

-- Step 3: Backfill — match sessions to profiles by (user_id, company_name from metadata)
UPDATE journey_sessions js
SET profile_id = bp.id
FROM business_profiles bp
WHERE js.user_id = bp.user_id
  AND js.metadata->>'companyName' = bp.company_name
  AND js.profile_id IS NULL;
