# AGENTS.md - src/app/api

## Purpose

- Owns Next.js API route handlers and HTTP contracts.

## Ownership

- Each route folder owns its request parsing, auth, response shape, and errors.
- Shared persistence, AI, worker, and orchestration logic belongs in `src/lib/`.
- `landing-events/` is a public SaaSLaunch tracker ingest boundary; it must keep origin allowlisting, registry validation, property schema enforcement, and rejection persistence in `src/lib/saaslaunch/`.

## Local Contracts

- Validate request bodies, query params, and route params with Zod or existing typed helpers.
- Return structured errors with useful IDs and context. Do not swallow provider, worker, or DB errors.
- Use `export const runtime = 'nodejs'` for AI, Supabase service, worker, or file-processing routes.
- Use explicit `maxDuration` exports for long-running Vercel Pro research routes; keep the value aligned with the route's controlled job timeout.
- Do not invent API endpoints. Search existing routes first.

## Work Guidance

- Keep route handlers small and testable.
- Prefer shared response helpers only if they already exist in the local path.
- Preserve auth and RLS assumptions when moving logic between routes and lib modules.

## Verification

- Run route-specific Vitest suites under the changed route.
- Run `npm run build` when route exports, runtime, or module boundaries change.

## Child DOX Index

- `research-v2/AGENTS.md` - Live research backend routes used by the `research-v3` page.
- `landing-events/` - Public SaaSLaunch landing analytics ingest route.
