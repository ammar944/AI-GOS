# AGENTS.md - research-worker/src/runners

## Purpose

- Owns worker runner implementations for long-running worker-backed jobs.

## Ownership

- `deep-research-program.ts` owns corpus generation.
- `meeting-extract.ts` owns meeting transcript extraction.
- `journey-section-synthesis.ts` owns worker-side synthesis behavior where still used.
- `base.ts` owns shared runner helpers.

## Local Contracts

- Runner outputs must satisfy worker contracts and Supabase persistence expectations.
- Preserve progress events, abort behavior, and timeout boundaries.
- Do not add live positioning section runners here.

## Work Guidance

- Keep provider/tool calls explicit and source-backed.
- Include run ID, tool name, and provider context in errors.

## Verification

- Run worker tests for changed runners and `cd research-worker && npm run build`.

## Child DOX Index

- No child `AGENTS.md` files yet.
