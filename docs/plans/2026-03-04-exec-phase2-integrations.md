# Claude Code Execution Prompt: Phase 2 Integrations Sprint

> Paste this entire prompt into a new Claude Code session on branch `aigos-v2`.
> ⚠️ Execute Reliability Sprint first. This sprint requires a stable research pipeline to be testable.

---

## Execution Prompt

```
We are executing the Phase 2 Integrations Sprint for AI-GOS V2.

**Plan file:** `docs/plans/2026-03-04-sprint-phase2-integrations.md`
**Branch:** `aigos-v2`
**Goal:** Build API clients and betaZodTool wrappers for Google Ads, Meta Ads Manager, and Google Analytics 4. Wire them into a new `mediaPlanner` Opus sub-agent runner in the Railway worker. Register `researchMediaPlan` as the 7th research tool in the lead agent. All integrations gracefully degrade when credentials are absent.

---

## Required Skills — invoke ALL of these in order:

**Step 1: Start with execution skill**
Use the `superpowers:executing-plans` skill to load and execute the plan at `docs/plans/2026-03-04-sprint-phase2-integrations.md`.

**Step 2: Use subagent-driven development**
Use the `superpowers:subagent-driven-development` skill throughout execution. This is the largest sprint (9 tasks across two codebases). Each task must be a fresh subagent — context contamination between tasks will cause path alias errors (the `src/` and `research-worker/src/` codebases use different module resolution).

**Step 3: Dispatch parallel agents where possible**
Use the `superpowers:dispatching-parallel-agents` skill aggressively — the first 3 integration tiers are independent:
- **Tier 1 (parallel)**: Task 1 (Google Ads client), Task 3 (Meta Ads client), Task 5 (GA4 client) — all independent API clients, run simultaneously
- **Tier 2 (parallel, after Tier 1)**: Task 2 (Google Ads betaZodTool), Task 4 (Meta Ads betaZodTool), Task 6 (GA4 betaZodTool) — each depends only on its own Tier 1 client
- **Tier 3 (sequential)**: Task 7 (env vars) → Task 8 (mediaPlanner runner) → Task 9 (pipeline wiring)

**Step 4: Architecture QC agent after Tier 1**
After all three API clients are written, spawn a `code-reviewer` agent to verify:
- Each client follows the SpyFu client pattern (`src/lib/ai/spyfu-client.ts`) — class-based, retry logic, typed Zod responses
- `isAvailable()` method checks env vars and returns false gracefully (no throws)
- No imports from `@/` path aliases in worker-side tools (wrong codebase)
- Build passes: `npm run build`

**Step 5: Integration QC team after Task 8 (mediaPlanner runner)**
After the `mediaPlanner` runner is written in `research-worker/src/runners/media-planner.ts`, spawn an agent team:
- `code-reviewer` — verify the runner follows the existing runner pattern (e.g., `research-worker/src/runners/industry.ts`) — same `Promise.race` timeout, same error return shape, same Supabase write pattern
- `researcher` — read `research-worker/src/index.ts` to verify the `TOOL_RUNNERS` dispatch table is ready to accept the new `researchMediaPlan` tool name
- `tester` — run `npm run build` in both root (`/`) and worker (`research-worker/`) directories

**Step 6: Full pipeline QC team after Task 9 (wiring)**
After the `researchMediaPlan` tool is registered in the lead agent route, spawn a full QC team:
- `code-reviewer` — reviews `src/app/api/journey/stream/route.ts` to confirm tool registration doesn't break existing tools
- `code-reviewer` (second instance) — reviews `src/lib/ai/prompts/lead-agent-system.ts` to verify the Strategist Mode trigger update (now fires after `researchMediaPlan`, not after `synthesizeResearch`) is consistent with the existing Stage 3 sequence
- `researcher` — reads `src/lib/env.ts` to confirm the 9 new env vars are in `OPTIONAL_ENV_VARS.server` only (NOT required)
- `tester` — full test suite + build

**Step 7: Finish the branch**
Use the `superpowers:finishing-a-development-branch` skill to complete the sprint, create a PR with a detailed description of all 3 new integrations and their env var requirements.

---

## Critical Context

**Architecture rule — two codebases, no shared imports:**
```
Next.js app (src/):          Uses @/ path aliases. betaZodTool wrappers used by lead agent.
Railway worker (research-worker/src/):  Uses relative imports only. Own betaZodTool wrappers that call the same APIs via raw fetch.
```
The Railway worker CANNOT import from `src/lib/`. Every tool needed by a sub-agent runner must have its own implementation in `research-worker/src/tools/`.

**Pattern to follow exactly:**
- API clients: `src/lib/ai/spyfu-client.ts` (552 lines) — class-based, retry with backoff, Zod response validation
- betaZodTool wrappers: `src/lib/ai/tools/mcp/spyfu-tool.ts` — minimal wrapper, delegates to client
- Worker tools: `research-worker/src/tools/spyfu.ts` — independent fetch-based implementation
- Runner pattern: `research-worker/src/runners/industry.ts` — Promise.race timeout, error return shape, Supabase write

**index.ts sequencing (IMPORTANT — already fixed in plan):**
- Task 2 adds ONLY `googleAdsTool` export to `research-worker/src/tools/index.ts`
- Task 4 adds ONLY `metaAdsTool` export
- Task 6 adds ONLY `ga4Tool` export
- Do NOT write the "full file" with all 3 exports until all three tasks are complete

**All env vars are optional — graceful degradation:**
When credentials are absent, the `mediaPlanner` runner must still produce output using industry benchmarks rather than throwing or returning an error. Users without platform API access still get a strategy document.

**Test commands:**
- `npm run test:run` (root)
- `cd research-worker && npm run build` (type-check the worker separately)
- `npm run build` (root)

**Commit after every task. Never batch multiple tasks into one commit.**
```
