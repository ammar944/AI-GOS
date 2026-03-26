-- Add AI insights columns to business_profiles
-- These are nullable JSONB — existing rows unaffected, no down migration needed.

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS offer_score JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS positioning_strategy JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_research_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN business_profiles.ai_insights IS 'Combined AI insights from research (key insights, synthesis, messaging angles)';
COMMENT ON COLUMN business_profiles.offer_score IS 'Offer analysis 6-dimension score from last research run';
COMMENT ON COLUMN business_profiles.positioning_strategy IS 'Recommended positioning from synthesis (angle, alternatives, differentiator)';
COMMENT ON COLUMN business_profiles.last_research_at IS 'Timestamp of last completed research run for this profile';
