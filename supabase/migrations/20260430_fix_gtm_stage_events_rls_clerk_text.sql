-- Migration: fix gtm_stage_events RLS to work with Clerk text user IDs
-- Date: 2026-04-30
--
-- Problem:
--   Earlier local/prod copies of 20260430_create_gtm_stage_events.sql contained
--     USING (auth.uid()::text = user_id OR current_setting(...)->>'sub' = user_id)
--   and the matching WITH CHECK branch for inserts.
--   Supabase's auth.uid() casts JWT sub to UUID, which fails for Clerk text ids
--   like "user_38cLJEcQD4FBbI3Rni00d8N3lHD" before the text fallback can match.
--
-- Fix:
--   Drop auth.uid() entirely and read the JWT sub claim as text.

DROP POLICY IF EXISTS "Users can read their own GTM stage events"
  ON public.gtm_stage_events;
CREATE POLICY "Users can read their own GTM stage events"
  ON public.gtm_stage_events
  FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  );

DROP POLICY IF EXISTS "Users can write their own GTM stage events"
  ON public.gtm_stage_events;
CREATE POLICY "Users can write their own GTM stage events"
  ON public.gtm_stage_events
  FOR INSERT
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  );
