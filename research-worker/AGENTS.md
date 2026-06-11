# AGENTS.md - research-worker

## Purpose

- Owns the separate Railway worker package for corpus research, identity resolution, meeting extraction, worker tools, and worker evals.

## Ownership

- `src/` owns the worker runtime, contracts, runners, tools, prompts, telemetry, and Supabase writes.
- `evals/` owns worker evaluation scripts and golden data.
- `platform-skills/` owns worker-side platform skill materials.
- `package.json` owns worker-local commands and dependencies.

## Local Contracts

- This package is a separate Node process and cannot import from `src/lib/`.
- Worker-backed jobs are reached through `RAILWAY_WORKER_URL` and `RAILWAY_API_KEY`.
- The worker does not own live positioning section execution. Those sections run in `src/lib/lab-engine/`.
- Any shared schema/type with the app must be mirrored intentionally.
- Preserve bounded concurrency, timeouts, auth, and progress/error reporting.

## Work Guidance

- Use worker-local commands from this directory.
- Keep worker dependencies in `research-worker/package.json`.
- Do not fix app-side lab-engine behavior by editing worker legacy copies.

## Verification

- Run `cd research-worker && npm run build`.
- Run `cd research-worker && npm run test:run` for worker code changes.

## Child DOX Index

- `src/AGENTS.md` - Worker runtime source, contracts, runners, tools, prompts, and infra.
- `evals/AGENTS.md` - Worker evaluation scripts, baselines, snapshots, and golden data.
- `platform-skills/AGENTS.md` - Worker platform skill materials.
