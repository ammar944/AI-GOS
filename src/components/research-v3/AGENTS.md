# AGENTS.md - src/components/research-v3

## Purpose

- Owns v3-specific reader section configuration used by the canonical research page.

## Ownership

- `reader-sections.ts` owns section labels, order, grouping, and reader metadata for v3 display.
- Tests in `__tests__/` own mapping expectations.

## Local Contracts

- Keep display order aligned with the live pipeline and Audit Reader expectations.
- Do not fetch, persist, or generate research content here.
- Changes to section IDs must be coordinated with `src/lib/research-v2/`, `src/lib/lab-engine/`, and renderers.

## Work Guidance

- Keep this folder small and configuration-focused.

## Verification

- Run `npm run test:run -- src/components/research-v3`.

## Child DOX Index

- No child `AGENTS.md` files yet.
