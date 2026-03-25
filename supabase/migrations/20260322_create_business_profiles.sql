-- Business Profiles: persistent company/client profiles extracted from onboarding.
-- A user can have multiple profiles (one per company they analyze).
-- The unified chat injects the active profile into the system prompt.

CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,                        -- Clerk user ID
  session_id UUID REFERENCES journey_sessions(id) ON DELETE SET NULL,

  -- Identity
  company_name TEXT,
  website_url TEXT,
  headquarters TEXT,

  -- Business
  business_model TEXT,
  industry_vertical TEXT,
  product_description TEXT,
  core_deliverables TEXT,
  value_prop TEXT,
  unique_edge TEXT,
  pricing_tiers TEXT,
  monthly_ad_budget TEXT,

  -- ICP
  primary_icp TEXT,
  job_titles TEXT,
  company_size TEXT,
  geography TEXT,
  buying_triggers TEXT,

  -- Competition
  top_competitors TEXT,
  market_problem TEXT,

  -- Goals
  goals TEXT,
  target_cpl TEXT,
  target_cac TEXT,
  campaign_duration TEXT,

  -- All fields as JSONB (for forward compatibility — new fields don't need migrations)
  all_fields JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT unique_user_company UNIQUE (user_id, company_name)
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id ON business_profiles(user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_business_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_business_profiles_updated_at
  BEFORE UPDATE ON business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_business_profiles_updated_at();

-- RLS
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own profiles
CREATE POLICY "Users can manage their own profiles"
  ON business_profiles
  FOR ALL
  USING (auth.uid()::text = user_id OR current_setting('request.jwt.claims', true)::json->>'sub' = user_id)
  WITH CHECK (auth.uid()::text = user_id OR current_setting('request.jwt.claims', true)::json->>'sub' = user_id);

-- Also create the atomic merge RPC for research_results (from eng review TODO)
CREATE OR REPLACE FUNCTION patch_research_section(
  p_session_id UUID,
  p_section_key TEXT,
  p_new_data JSONB
) RETURNS VOID AS $$
BEGIN
  UPDATE journey_sessions
  SET research_results = COALESCE(research_results, '{}'::jsonb) || jsonb_build_object(p_section_key, p_new_data),
      updated_at = now()
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
