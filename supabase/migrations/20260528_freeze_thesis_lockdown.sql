-- Lock down freeze_reviewed_brief_snapshot to service_role only.
--
-- The original migration (20260528_freeze_thesis_security_definer_rpc) added
-- the function with the default PUBLIC EXECUTE grant. The Supabase advisor
-- flagged it post-apply because anon + authenticated could call it via
-- /rest/v1/rpc/freeze_reviewed_brief_snapshot. All other lab-engine RPCs
-- follow the explicit-revoke pattern; this brings the new RPC into line.
--
-- Applied to prod 2026-05-28 via Supabase MCP after cutover landed.

revoke execute on function public.freeze_reviewed_brief_snapshot(
  uuid,
  jsonb,
  jsonb,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.freeze_reviewed_brief_snapshot(
  uuid,
  jsonb,
  jsonb,
  timestamptz
) to service_role;
