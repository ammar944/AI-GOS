# AGENTS.md - src/app

## Purpose

- Owns Next.js App Router entrypoints: pages, layouts, global styles, route groups, and API routes.

## Ownership

- Page routes own URL-level behavior and composition only.
- API routes under `api/` own HTTP boundaries and request/response contracts.
- Shared UI belongs in `src/components/`; reusable business logic belongs in `src/lib/`.

## Local Contracts

- `research-v3/` is the canonical live research front door.
- The `/research-v2` page route and `/journey` page route are deleted. Do not re-add or reference them as current surfaces unless explicitly asked.
- AI/API route handlers must use Node.js runtime, not Edge, when provider SDKs, Supabase server clients, or long-running research work are involved.
- Keep Clerk auth checks explicit on protected routes.

## Work Guidance

- Keep pages as orchestrators that compose components and lib functions.
- Avoid duplicating state machines or schemas in page files.
- Prefer route-level tests already colocated under route `__tests__/` directories.

## Verification

- For page changes, run relevant React/Vitest tests and inspect the page in browser when UI behavior changes.
- For route changes, run route tests and `npm run build` when runtime/export behavior changes.

## Child DOX Index

- `api/AGENTS.md` - All HTTP API route handlers.
- `research-v3/AGENTS.md` - Canonical Audit Reader front door and live research page.
