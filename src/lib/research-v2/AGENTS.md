# AGENTS.md - src/lib/research-v2

## Purpose

- Owns live research orchestration glue used by the `research-v3` page and `src/app/api/research-v2/*` routes.

## Ownership

- State machine, corpus context, corpus-to-input mapping, onboarding review, orchestration session, lab section dispatch/job helpers, DB run store, realtime broadcast, section partials, share snapshots, and verification-tier helpers live here.

## Local Contracts

- `research-v2` here is not legacy. It is the live backend/library layer for `research-v3`.
- Preserve the form-driven flow: corpus, GTM Brief review, orchestrated fan-out, section commits, reader updates.
- DB state is durable truth for section commits, partials, verification tiers, and shared snapshots.
- Do not add silent fallbacks around Supabase writes, run claims, or section completion checks.
- Preserve idempotency and run-claim semantics when touching orchestration.

## Work Guidance

- Keep route handlers thin by putting reusable orchestration logic here.
- When persistence shape changes, update tests, Supabase migrations, reader consumers, and share restore logic.
- Keep client hooks separate from server-only modules.

## Verification

- Run `npm run test:run -- src/lib/research-v2`.
- For route-coupled changes, also run `npm run test:run -- src/app/api/research-v2`.

## Child DOX Index

- No child `AGENTS.md` files yet.
