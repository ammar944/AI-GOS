-- Migration: fix gtm_runs RLS to work with Clerk text user IDs
-- Date: 2026-04-30
-- Applied via Supabase MCP (project sidrtuxpqftyzwdusdha) on 2026-04-30
--
-- Problem:
--   Earlier local/prod copies of 20260430_create_gtm_runs.sql contained
--     USING (auth.uid()::text = user_id OR current_setting(...)->>'sub' = user_id)
--   Postgres evaluates auth.uid() eagerly, and Supabase's auth.uid() casts
--   the JWT `sub` claim to UUID. Clerk subs are text like
--   "user_38cLJEcQD4FBbI3Rni00d8N3lHD" (NOT UUID format), so the cast threw
--   "invalid input syntax for type uuid" before the OR branch could match.
--
-- Fix:
--   Drop the auth.uid() branch entirely. Keep only the JSON-path form,
--   which reads the sub claim as text without casting.

DROP POLICY IF EXISTS "Users can manage their own runs" ON public.gtm_runs;

CREATE POLICY "Users can manage their own runs"
  ON public.gtm_runs
  FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  )
  WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'sub' = user_id
  );
