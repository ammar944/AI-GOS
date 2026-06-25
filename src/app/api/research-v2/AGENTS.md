# AGENTS.md - src/app/api/research-v2

## Purpose

- Owns the live research backend routes consumed by `src/app/research-v3/page.tsx`.

## Ownership

- `orchestrate/` fans out all positioning sections.
- `run-lab-section/` executes the in-process lab engine.
- `run-paid-media-plan/` owns the dedicated paid-media composer dispatch after the six positioning sections complete.
- `dispatch/` and `rerun-section/` are single-section/corpus dispatch paths with worker proxy behavior where applicable.
- `chat/` owns post-research workspace chat/edit behavior.
- `_capabilities/`, `audit-state/`, `abort-section/`, `onboarding/`, `review-section/`, and `executive-brief/` own their route-specific diagnostics and state operations.

## Local Contracts

- These routes are current even though the old `/research-v2` page is deleted.
- Do not move positioning section execution back into `research-worker/`.
- `orchestrate` is the canonical multi-section fan-out path after GTM Brief review.
- Paid-media composer dispatch may run through `run-paid-media-plan/` so GLM compose/projector work has an isolated route clock.
- `_capabilities` is diagnostic. Do not gate valid in-process section runs on stale worker capability flags.
- Always preserve run IDs, session IDs, profile IDs, section IDs, and zone IDs in errors and logs.
- Persisted Supabase state is the durable truth for section status and artifacts.

## Work Guidance

- Keep request validation close to route entry.
- Put reusable orchestration, DB, and realtime logic in `src/lib/research-v2/` or `src/lib/journey/`.
- When route output shape changes, update consumers, tests, and any mirrored contracts.

## Verification

- Run `npm run test:run -- src/app/api/research-v2`.
- For live research behavior, also run the relevant `src/lib/research-v2` or `src/lib/lab-engine` tests.

## Child DOX Index

- No child `AGENTS.md` files yet. Route folders are governed by this file unless a closer file is added.
