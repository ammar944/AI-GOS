# AGENTS.md - src/lib/lab-engine/artifacts

## Purpose

- Owns schema-validated lab artifact output contracts for typed Audit Reader cards.

## Ownership

- `schemas/` owns per-section Zod schemas and schema tests.
- Artifact contracts coordinate with renderers, persistence, verification, and share/restore paths.

## Local Contracts

- Every artifact shape change must remain Zod-validated.
- Do not make required evidence optional to bypass failing output.
- Keep discriminants, section IDs, and field names stable unless all consumers are updated.
- Artifact schemas must describe real persisted data, not UI-only convenience shapes.

## Work Guidance

- Update fixtures and renderer tests when schemas change.
- Prefer additive changes when persistence compatibility matters.

## Verification

- Run `npm run test:run -- src/lib/lab-engine/artifacts src/components/research-v2`.

## Child DOX Index

- No child `AGENTS.md` files yet.
