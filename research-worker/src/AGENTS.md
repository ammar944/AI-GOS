# AGENTS.md - research-worker/src

## Purpose

- Owns the worker runtime source for HTTP dispatch, runner execution, worker-side contracts, provider calls, Supabase writes, progress events, and diagnostics.

## Ownership

- `index.ts` owns Express routes such as `/run`, `/abort`, `/health`, and `/capabilities`.
- `contracts.ts` owns worker-side Zod schemas.
- `runners/`, `tools/`, `intelligence/`, `competitors/`, and `skills/` own their local worker domains.
- Root worker infra files own auth, env, models, telemetry, Supabase, events, and dead-letter handling.

## Local Contracts

- Do not import from app `src/lib/`.
- Validate runner inputs and outputs with worker-local contracts.
- Preserve API-key auth and structured error responses.
- Worker `/capabilities` is diagnostic and may not match in-process app capabilities.
- Do not add positioning section execution here unless the architecture is explicitly changed.

## Work Guidance

- Keep runner side effects explicit and progress events meaningful.
- Keep provider credentials in env access modules and out of logs.
- Mirror app contract changes deliberately with tests.

## Verification

- Run `cd research-worker && npm run build`.
- Run `cd research-worker && npm run test:run` or a targeted worker test.

## Child DOX Index

- `runners/AGENTS.md` - Worker runner implementations.
- `tools/AGENTS.md` - Worker provider/tool integrations.
- `intelligence/AGENTS.md` - Worker intelligence cards, evidence packing, and fabrication sweeps.
- `competitors/AGENTS.md` - Legacy competitor worker modules.
- `skills/AGENTS.md` - Worker prompt/methodology skills.
