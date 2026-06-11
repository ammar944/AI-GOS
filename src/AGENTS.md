# AGENTS.md - src

## Purpose

- Owns the Next.js product source: routes, API handlers, React components, hooks, domain libraries, tests, and shared TypeScript types.

## Ownership

- `src/app/` owns App Router pages, layouts, and API route handlers.
- `src/components/` owns reusable UI and research/workspace renderers.
- `src/lib/` owns domain logic, service boundaries, schemas, persistence helpers, AI orchestration, and lab-engine code.
- `src/hooks/`, `src/types/`, and `src/test/` are covered here unless a closer `AGENTS.md` exists.

## Local Contracts

- Keep product source TypeScript-strict with named exports and explicit function return types.
- Use `@/` imports for `src` code.
- Do not import from `research-worker/`; worker/app contracts must be duplicated intentionally.
- Keep server-only code out of client components. Add `'use client'` only when hooks, browser APIs, or client interactivity require it.
- Zod-validate API input, AI output, and persisted cross-boundary data.

## Work Guidance

- Prefer colocated tests in existing `__tests__/` folders.
- Keep route handlers thin; move reusable domain logic into `src/lib/`.
- Keep UI components focused on rendering and interaction. Put persistence and provider calls in routes/lib modules.

## Verification

- Run `npm run test:run` for broad app changes.
- Use scoped Vitest paths for narrow changes, for example `npm run test:run -- src/lib/research-v2`.
- Run `npm run lint` or a touched-file lint equivalent when code changes are made.

## Child DOX Index

- `app/AGENTS.md` - App Router pages, layouts, global app shell files, and API route tree.
- `components/AGENTS.md` - React UI, shadcn primitives, Audit Reader renderers, and workspace card UI.
- `lib/AGENTS.md` - Domain logic, AI/provider contracts, lab engine, journey/research-v2 orchestration, and persistence helpers.
