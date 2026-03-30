-- Migration: Add proof_points to business_profiles
-- Date: 2026-03-30
-- Run via Supabase dashboard SQL Editor

ALTER TABLE business_profiles
ADD COLUMN IF NOT EXISTS proof_points JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN business_profiles.proof_points IS
  'User-verified proof points: case studies, testimonials, metrics, credentials';

-- Add diversity score/flags to script_packs
ALTER TABLE script_packs
ADD COLUMN IF NOT EXISTS diversity_score NUMERIC,
ADD COLUMN IF NOT EXISTS diversity_flags JSONB DEFAULT '[]'::jsonb;
