-- Documents the v3 paid-media brief field expansion.
-- The new fields live in JSONB, so no physical column change is required.

COMMENT ON COLUMN public.journey_sessions.onboarding_data IS
  'Flat OnboardingV2Data object from OnboardingWizardV2. Includes v3 media-plan brief fields: salesProcessDocs, salesLoomUrl, gtmMotion, creativeCapacity, leadListAvailable.';

COMMENT ON COLUMN public.business_profiles.all_fields IS
  'Merged Journey/onboarding field JSONB, including v3 media-plan brief fields used by the paid-media synthesis section.';
