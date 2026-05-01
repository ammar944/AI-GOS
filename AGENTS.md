# AGENTS.md - AIGOS Project Instructions

> AIGOS is a supervised GTM run system. The first product milestone is trust, state, visibility, and recoverability for one GTM run workspace.

## First Read

Read these before editing:

1. `AGENTS.md`
2. `program.md`
3. The files named by the current task

`CLAUDE.md` contains useful historical and local workflow context, but it currently includes older Journey and skill-first notes. When it conflicts with this file or `program.md`, follow `AGENTS.md` and `program.md`.

## Current Product Priority

Do not ask an agent to "build the GTM workspace" or "automate client success." Those are programs, not implementation tasks.

The active sprint is:

**Milestone 1: Trustworthy GTM Run Workspace**

The user should be able to open one GTM run and understand:

- what stage is running
- what stage completed
- what stage is blocked
- why it is blocked
- what artifact was produced
- what happened after refresh

Do not work on Slack agents, full media-plan automation, client success automation, landing pages, or extra research skills until the GTM run workspace is understandable and stable.

## Current GTM Architecture

Active user-facing GTM routes:

- `src/app/gtm/page.tsx`
- `src/app/gtm/new/page.tsx`
- `src/app/gtm/[runId]/page.tsx`

Active GTM API routes:

- `src/app/api/gtm/runs/route.ts`
- `src/app/api/gtm/runs/[runId]/route.ts`
- `src/app/api/gtm/runs/[runId]/dispatch/route.ts`
- `src/app/api/gtm/runs/[runId]/chat/route.ts`
- `src/app/api/gtm/runs/[runId]/artifacts/route.ts`

Active GTM persistence tables:

- `gtm_runs`
- `gtm_stage_events`
- `gtm_artifacts`
- `gtm_messages`

Active GTM contract/source files:

- `src/lib/gtm/stage-state.ts`
- `src/lib/gtm/stage-events.ts`
- `src/lib/gtm/stage-mapping.ts`
- `src/lib/gtm/agent-messages.ts`
- `src/lib/types/gtm-artifact.ts`
- `supabase/migrations/20260430_create_gtm_runs.sql`
- `supabase/migrations/20260430_create_gtm_stage_events.sql`
- `supabase/migrations/20260501_create_gtm_artifacts.sql`
- `supabase/migrations/20260501_create_gtm_messages.sql`

Worker boundary:

- Next app creates and reads runs.
- Next app dispatches worker-backed stages through `src/lib/gtm/worker-dispatch.ts`.
- Worker execution lives under `research-worker/`.
- Worker GTM dispatch lives in `research-worker/src/gtm/dispatch-runner.ts`.
- Worker event writes live in `research-worker/src/gtm/stage-events.ts`.

Important stage truth:

- Full declared stage order is in `src/lib/gtm/schemas/gtm-run.ts`.
- Current visible/dispatchable Lighthouse slice is in `src/lib/gtm/stage-mapping.ts`.
- Do not invent stage names. Normalize legacy names only through existing mapping helpers.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run test:run
```

The worker has its own package:

```bash
cd research-worker
npm run dev
npm test
```

Use `npm` in this repo unless a checked-in package manager file proves otherwise.

## Coding Rules

- TypeScript strict mode. No `any`.
- Named exports only.
- Explicit return types on functions.
- Use `@/` imports for app code.
- Use Zod schemas for API inputs, AI outputs, and persisted JSON contracts.
- Use `cn()` or `clsx` for conditional classes.
- Keep diffs minimal and task-bound.
- Do not refactor unrelated files.
- Do not silently swallow errors.
- Error messages must include useful context such as `run_id`, `user_id`, status code, route, or stage.

## Agent Task Shape

Every implementation task should be one vertical slice with:

- Goal
- Context
- Files likely involved
- Non-goals
- Acceptance criteria
- Verification commands

A task is too big if it requires more than one of these at once:

- new data model
- new route
- new worker behavior
- new UI surface
- new prompt or agent behavior
- new artifact format
- new integration
- new test harness

Prefer tasks that change one layer:

- docs only
- schema only
- read model only
- UI component only
- worker event emission only
- validation only
- artifact renderer only
- browser QA only

## Dirty Worktree Policy

This repo often has many modified, deleted, and untracked files from other tools. Do not treat "cleanup" as permission to delete or revert broadly.

Before editing:

```bash
git status --short
```

Then classify changes:

- user/product code changes
- generated logs and sessions
- scratch outputs
- docs/spec changes
- dependency/config changes

Never revert or delete unrelated changes unless the user explicitly asks for that exact operation. If cleanup is needed, propose a small cleanup task with exact paths and risk.

## GTM Sprint Order

Follow `program.md` for the current step-by-step plan. The next implementation sequence is:

1. Create `docs/GTM_RUN_CONTRACT.md`.
2. Add a `getGtmRunView` read model.
3. Render a stage DAG panel from the read model.
4. Render grouped stage events.
5. Render blocker reasons.
6. Render artifact cards.
7. Persist and replay messages across refresh.
8. Browser QA `/gtm/new -> /gtm/[runId]`.
9. Commit an atomic checkpoint.

Do not skip the contract/read-model steps. They prevent each agent from inventing a different run-state interpretation.

## Verification

For docs-only changes, verify file existence and review the diff.

For code changes, run the smallest relevant test first, then broaden:

```bash
npm run test:run
npm run lint
npm run build
```

If a command cannot run because of environment state, report the blocker with the exact command and error.
