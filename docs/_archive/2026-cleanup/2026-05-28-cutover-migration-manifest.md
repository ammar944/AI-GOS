# Cutover migration manifest

New migrations to apply on prod Supabase (in this exact order via Supabase MCP `apply_migration`).
Per the read-only audit, all are forward-only, no destructive changes.

1. `20260421_add_app_roles_to_user_profiles.sql` - RBAC columns on `user_profiles`.
2. `20260421_create_access_audit_logs.sql` - Audit log table for impersonated and sensitive writes.
3. `20260421_create_client_allowlist.sql` - Invite-only client allowlist table.
4. `20260511_add_onboarding_data_to_journey_sessions.sql` - `onboarding_data` JSONB on `journey_sessions`.
5. `20260512_audit_chat_messages.sql` - Audit chat messages table keyed by research-v2 run.
6. `20260514_research_artifact_normalized.sql` - Normalized research artifact tables plus compare-and-swap RPCs.
7. `20260515_phase5_abort_guard_and_reaper.sql` - Abort-respecting section commit guard and orphaned-run reaper.
8. `20260519_managed_agents_webhook_events.sql` - Managed Agents webhook event log for dedupe, telemetry, and retry counts.
9. `20260520_orchestrate_parent_child.sql` - Parent/child orchestration model and `seed_orchestration` RPC.
10. `20260521_commit_artifact_section_qualify_revision.sql` - Postgres 17 revision qualification fix for `commit_artifact_section`.
11. `20260522_seed_orchestration_qualify_zone.sql` - Postgres 17 zone qualification fix for `seed_orchestration`.
12. `20260523_commit_artifact_section_variable_conflict.sql` - `#variable_conflict use_column` fix for `commit_artifact_section`.
13. `20260524_research_artifact_sections_data.sql` - Durable typed artifact `data` column on section rows.
14. `20260525_commit_artifact_section_allow_revision_supersede.sql` - Revision-based section-run supersede behavior.
15. `20260526_media_plan_brief_fields.sql` - Documentation comments for v3 paid-media brief fields in JSONB.
16. `20260526_rollup_parent_on_section_commit.sql` - Parent artifact rollup sync on section commit.
17. `20260528_freeze_thesis_security_definer_rpc.sql` - Atomic `freeze_reviewed_brief_snapshot` RPC.
18. `20260528_seed_orchestration_complete_idempotency.sql` - Reuse complete section runs when re-seeding lab fan-out.

## Order dependencies

- `commit_artifact_section` RPC is replaced 6 times in sequence (20260514 -> 20260515 -> 20260521 -> 20260522 -> 20260523 -> 20260524 -> 20260525)
- `seed_orchestration` RPC is replaced 3 times (20260520 -> 20260522 -> 20260528)
- Apply in chronological filename order; do not skip.

## Modified-in-place migration

- `20260514_research_artifact_normalized.sql` was modified in commit `8cac151d` (insert-on-conflict fix + active-run guard). Supabase will see the current file state, so this is informational only - no special handling needed.

## Irreversible changes

None. All migrations use `IF NOT EXISTS` / `IF EXISTS` guards.
