# Claude Code Execution Prompt: Agent Intelligence Sprint

> Paste this entire prompt into a new Claude Code session on branch `aigos-v2`.
> ⚠️ Execute the Reliability Sprint first — this sprint assumes a stable research pipeline.

---

## Execution Prompt

```
We are executing the Agent Intelligence Sprint for AI-GOS V2.

**Plan file:** `docs/plans/2026-03-04-sprint-agent-intelligence.md`
**Branch:** `aigos-v2`
**Goal:** Enforce the 3-Stage progressive intelligence architecture that's already documented in the system prompt but not reliably triggered. Add a journey state tracker, a competitor detector, a Strategist Mode guard, and precision-tightened system prompt language so the agent's behavior matches its specification.

---

## Required Skills — invoke ALL of these in order:

**Step 1: Start with execution skill**
Use the `superpowers:executing-plans` skill to load and execute the plan at `docs/plans/2026-03-04-sprint-agent-intelligence.md`.

**Step 2: Use subagent-driven development**
Use the `superpowers:subagent-driven-development` skill throughout execution. Each task is dispatched to a fresh subagent. Do NOT accumulate multiple tasks in a single agent context — each task modifies different files and needs fresh eyes.

**Step 3: Dispatch parallel agents where possible**
Use the `superpowers:dispatching-parallel-agents` skill for independent tasks:
- Task 1 (`journey-state.ts`) and Task 2 (`competitor-detector.ts`) are fully independent — run them in parallel.
- Task 3 (re-trigger guard) depends on Task 1 — run after Task 1 completes.
- Task 4 (route wiring) depends on Tasks 1, 2, and 3 — run after all three complete.
- Task 5 (system prompt precision) and Task 6 (verification) are sequential after Task 4.

**Step 4: Agent team QC after every task**
After each task completes and commits, spawn a `code-reviewer` agent to verify:
- Pure functions return correct results for all test cases
- No route changes modify the streaming response format (only system prompt addenda)
- Tests pass: `npm run test:run -- src/lib/ai/__tests__/`
- Build passes: `npm run build`

**Step 5: Smoke test QC team after Task 4**
After Task 4 (route wiring) is complete, spawn an agent team for integration validation:
- `researcher` — reads `route.ts` and verifies the injection logic is correct and doesn't break existing tool registrations
- `code-reviewer` — checks that `journeySnap.synthComplete` guard only fires AFTER `synthesizeResearch` tool result is present in history
- `tester` — runs `npm run test:run` and `npm run build`

**Step 6: Finish the branch**
Use the `superpowers:finishing-a-development-branch` skill to complete the sprint, create a PR, and write a summary.

---

## Critical Context

**What's already built (don't rebuild):**
- `src/lib/ai/tools/competitor-fast-hits.ts` — FULLY BUILT Haiku sub-agent, registered in route. Do NOT modify this file.
- `src/lib/ai/prompts/lead-agent-system.ts` — 216-line system prompt with 3-Stage architecture already documented. Task 5 only refines trigger language in lines 95-127.
- All 8 research tools are registered in `route.ts` lines 112-121.

**What's missing (build this):**
- `src/lib/ai/journey-state.ts` — new file, pure functions only
- `src/lib/ai/competitor-detector.ts` — new file, pure functions only
- `src/app/api/journey/stream/route.ts` — addenda injected AFTER existing systemPrompt construction (lines 97-104), before `streamText` call (line 107)

**Key constraint:**
The system prompt addenda are injected per-request and must be stateless — derived entirely from `messages` history. No new database calls, no new API calls. Pure function state derivation only.

**Test commands:**
- `npm run test:run -- src/lib/ai/__tests__/journey-state.test.ts`
- `npm run test:run -- src/lib/ai/__tests__/competitor-detector.test.ts`
- `npm run build`

**Known typo already fixed in plan:** `IMPORTANTLY` (not `IMPORTEDLY`) in Task 4 Step 3 system prompt injection string.

**Commit after every task. Never batch multiple tasks into one commit.**
```
