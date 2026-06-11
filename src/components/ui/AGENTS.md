# AGENTS.md - src/components/ui

## Purpose

- Owns low-level shadcn/Radix UI primitives and shared presentation components.

## Ownership

- This folder owns reusable primitive APIs, styling variants, and product-neutral UI building blocks.
- Product-specific cards and research renderers belong outside this folder.

## Local Contracts

- Preserve shadcn new-york conventions and check `components.json` before adding generated primitives.
- Keep component APIs stable and typed.
- Use `cn()` for class composition.
- Do not add business logic, provider calls, persistence, or research-specific assumptions here.

## Work Guidance

- Prefer extending existing variants over creating near-duplicate primitives.
- Keep accessibility attributes and Radix semantics intact.
- Use lucide icons where the repo already uses icon buttons.

## Verification

- Run tests that cover changed primitives or consuming components.
- Use browser verification when styling/layout changes affect visible UI.

## Child DOX Index

- No child `AGENTS.md` files yet.
