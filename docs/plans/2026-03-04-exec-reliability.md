# Claude Code Execution Prompt: Reliability Sprint

> Paste this entire prompt into a new Claude Code session on branch `aigos-v2`.

---

## Execution Prompt

```
We are executing the Reliability Sprint for AI-GOS V2.

**Plan file:** `docs/plans/2026-03-04-sprint-reliability.md`
**Branch:** `aigos-v2`
**Goal:** Fix the fire-and-forget research pipeline — add dispatch retry, surface Supabase write failures, make worker job loss detectable, surface research errors to the user, add synthesis readiness polling, and validate the RAILWAY_WORKER_URL env var on startup.

---

## Required Skills — invoke ALL of these in order:

**Step 1: Start with execution skill**
Use the `superpowers:executing-plans` skill to load and execute the plan at `docs/plans/2026-03-04-sprint-reliability.md`.

**Step 2: Use subagent-driven development**
Use the `superpowers:subagent-driven-development` skill throughout execution. Each task in the plan should be dispatched to a fresh subagent. Do NOT implement multiple tasks in a single agent context.

**Step 3: Dispatch parallel agents where possible**
Use the `superpowers:dispatching-parallel-agents` skill for tasks that have no dependencies on each other. Specifically:
- Task 1 (dispatch retry in `dispatch.ts`) and Task 6 (env validation in `env.ts`) are independent — run them in parallel.
- Task 2 (observable Supabase writes) must complete before Task 5 (synthesis readiness polling) since polling reads from the same Supabase table.
- Task 3 (worker job durability) and Task 4 (user-visible error states in system prompt) are independent — run them in parallel after Task 2.

**Step 4: Agent team QC after every task**
After each task completes and commits, spawn a `code-reviewer` agent to verify:
- The implementation matches the plan exactly
- No silent error swallowing remains (no `.catch(() => {})` patterns added)
- Tests pass: `npm run test:run -- src/lib/ai/tools/research/` and `npm run test:run -- src/lib/journey/`
- Build passes: `npm run build`

**Step 5: Full QC team before branch finish**
Before finishing the branch, spawn an agent team of:
- `code-reviewer` — reviews all changes against the plan
- `tester` — runs the full test suite and reports results
- `researcher` — verifies the Railway worker changes are correct (reads `research-worker/src/index.ts` and `research-worker/src/supabase.ts`)

**Step 6: Finish the branch**
Use the `superpowers:finishing-a-development-branch` skill to complete the sprint, create a PR, and write a summary of what changed.

---

## Critical Context

**What's broken (from codebase audit):**
- `research-worker/src/index.ts`: Returns 202 then runs `setImmediate(async () => { ... })` — if worker crashes between HTTP response and callback, job is permanently lost
- `src/lib/journey/session-state.server.ts`: Both `persistToSupabase` and `persistResearchToSupabase` swallow all errors silently
- `src/app/api/journey/stream/route.ts` lines 85-94: Callers use `.catch(() => {})` — failures are invisible
- `src/lib/ai/tools/research/dispatch.ts`: No retry on transient network failures (only rate-limit retry exists)
- Lead agent never polls to know if research completed before triggering synthesize

**What must NOT change:**
- The fire-and-forget architecture stays (stream must not block) — make failures observable, not synchronous
- `maxRetries: 0` on `streamText` stays — this is intentional
- Rate-limit retry in `research-worker/src/runners/` stays — don't touch those files

**Test commands:**
- `npm run test:run -- src/lib/ai/tools/research/dispatch.test.ts`
- `npm run test:run -- src/lib/journey/session-state-server.test.ts`
- `npm run test:run -- src/lib/journey/research-readiness.test.ts`
- `npm run build`

**Commit after every task. Never batch multiple tasks into one commit.**
```
