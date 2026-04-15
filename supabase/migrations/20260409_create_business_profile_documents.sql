-- Business Profile Documents: persistent parsed documents uploaded during onboarding.
-- Runners consume parsed_markdown at dispatch time via section_tags filtering.
-- Raw originals are NOT stored (V1) — only the parsed text matters for runner context.

CREATE TABLE IF NOT EXISTS business_profile_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  business_profile_id UUID REFERENCES business_profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INT NOT NULL,
  parsed_markdown TEXT NOT NULL,
  extracted_fields JSONB,
  section_tags TEXT[] NOT NULL DEFAULT '{}',
  doc_kind TEXT,  -- pitch_deck, icp_doc, case_study, brand_book, pricing_sheet, competitor_analysis, market_research, other
  token_count INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fast lookups by user and profile
CREATE INDEX IF NOT EXISTS idx_bpd_user_id ON business_profile_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_bpd_profile_id ON business_profile_documents(business_profile_id);

-- GIN index for overlaps queries on section_tags (dispatch route uses @> / &&)
CREATE INDEX IF NOT EXISTS idx_bpd_section_tags ON business_profile_documents USING GIN(section_tags);

-- RLS: users can only access their own documents
ALTER TABLE business_profile_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own documents"
  ON business_profile_documents
  FOR ALL
  USING (
    auth.uid()::text = user_id
    OR current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  )
  WITH CHECK (
    auth.uid()::text = user_id
    OR current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  );
