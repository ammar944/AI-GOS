-- Create Shared Blueprints Table
-- Migration: 20260202_create_shared_blueprints_table.sql
-- Stores publicly shareable blueprints with unique share tokens

CREATE TABLE IF NOT EXISTS public.shared_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token text UNIQUE NOT NULL,
  title text NOT NULL,
  blueprint_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  view_count integer DEFAULT 0
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_shared_blueprints_token
ON public.shared_blueprints(share_token);

-- Enable RLS
ALTER TABLE public.shared_blueprints ENABLE ROW LEVEL SECURITY;

-- Anyone can read shared blueprints (they're public by design)
CREATE POLICY "Anyone can view shared blueprints"
ON public.shared_blueprints FOR SELECT
USING (true);

-- Only authenticated users can create shared blueprints
CREATE POLICY "Authenticated users can create shared blueprints"
ON public.shared_blueprints FOR INSERT
TO authenticated
WITH CHECK (true);

COMMENT ON TABLE public.shared_blueprints IS
'Publicly shareable blueprints accessible via unique share tokens';
