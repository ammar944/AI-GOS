# AGENTS.md - src/lib/workspace

## Purpose

- Owns non-UI workspace helpers such as card taxonomy, pipeline metadata, and workspace data contracts.

## Ownership

- This folder owns typed mappings consumed by `src/components/workspace/` and research renderers.

## Local Contracts

- Keep card/section IDs stable across API, lib, and component consumers.
- Do not introduce rendering concerns here.
- When adding a card or section type, update consumers and tests together.

## Work Guidance

- Prefer explicit discriminated unions and Zod-backed contracts where data crosses route or persistence boundaries.

## Verification

- Run `npm run test:run -- src/lib/workspace src/components/workspace`.

## Child DOX Index

- No child `AGENTS.md` files yet.
