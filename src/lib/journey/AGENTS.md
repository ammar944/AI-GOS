# AGENTS.md - src/lib/journey

## Purpose

- Owns journey/session contracts, research result contracts, field catalog, realtime subscription logic, dispatch helper, and workspace message helpers.

## Ownership

- `server/dispatch-research.ts` owns app-side dispatch to the worker for worker-backed jobs.
- `research-result-contract.ts` and `schemas/` own journey research data contracts.
- `field-catalog.ts` owns onboarding/profile field definitions.
- `research-realtime.ts` owns client-side research updates.

## Local Contracts

- Frontend route params often pass `run_id`; use `session.id` only where a session primary key is required.
- Worker-backed dispatch must preserve run IDs and tool names exactly.
- New onboarding/profile fields must be synchronized across the field catalog, UI groups, Supabase migrations, worker parse/context logic, and profile JSONB consumers.
- Do not gate live section orchestration on worker-only capability flags.

## Work Guidance

- Keep schema changes paired with tests and migration/worker mirror changes when needed.
- Preserve realtime fallback polling behavior.
- Keep dispatch errors explicit about URL, tool, run ID, and response status.

## Verification

- Run `npm run test:run -- src/lib/journey`.
- For dispatch changes, also run relevant `src/app/api/research-v2/dispatch` or worker tests.

## Child DOX Index

- No child `AGENTS.md` files yet.
