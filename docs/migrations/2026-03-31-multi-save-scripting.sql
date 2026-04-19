-- Migration: Multi-Save Scripting — Creative Workbench with Context Provenance
-- Date: 2026-03-31
-- Run via Supabase dashboard SQL Editor

ALTER TABLE script_packs
ADD COLUMN IF NOT EXISTS generation_context JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS script_count INT DEFAULT 0;

COMMENT ON COLUMN script_packs.generation_context IS
  'Immutable snapshot of all inputs at generation time: research session, style refs, proof points, user note';
COMMENT ON COLUMN script_packs.script_count IS
  'Number of scripts in this pack — updated by worker alongside scripts';

-- Backfill script_count for existing packs
UPDATE script_packs
SET script_count = COALESCE(jsonb_array_length(scripts::jsonb), 0)
WHERE scripts IS NOT NULL AND script_count = 0;
