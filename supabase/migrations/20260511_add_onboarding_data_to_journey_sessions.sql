-- Add onboarding_data column to journey_sessions for V2 wizard submissions.
-- Stores the flat 47-field OnboardingV2Data object collected by OnboardingWizardV2.
-- Written by POST /api/research-v2/onboarding and read by
-- buildJourneyResearchDispatchContext to inject user answers into section runner context.

ALTER TABLE journey_sessions
  ADD COLUMN IF NOT EXISTS onboarding_data jsonb;

COMMENT ON COLUMN journey_sessions.onboarding_data IS
  'Flat 47-field object from OnboardingWizardV2. Keys match OnboardingV2Data interface in src/lib/research-v2/onboarding-v2-types.ts.';
