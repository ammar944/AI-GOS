# Codex Handoff — Task 6: Doc alignment (CLAUDE.md + CONTEXT.md → reality)

> **Executor:** Codex (`-c model_reasoning_effort=xhigh -s workspace-write`). Edit files only — do NOT run git. Runs LAST (after worker deslop, FE-1, verifier teeth, phase honesty land), so it documents the final state.
> **Grounded in:** assessment slop item #6 (doc rot — docs point a new engineer at a deleted architecture) + the DeepSeek provider decision.

## GOAL
Make the two load-bearing docs describe what the code actually is now: the **in-process lab engine** (`src/lib/lab-engine/`, answer-tool path + structural verifier + evidence-support repair), **provider-agnostic running DeepSeek**, fan-out with **no waves**, and the **managed-agents migration abandoned** (runtime + webhook deleted this session; only `schemas/` remains pending FE-2). Pure documentation — touch no code.

## EDITS — `CLAUDE.md`
1. **Delete the entire "Managed Agents (Phase 1 migration):" block** (the `MANAGED_AGENTS_WEBHOOK_SECRET` / `MANAGED_AGENTS_POSITIONING_ENABLED` / `MANAGED_AGENTS_MAX_CUSTOM_TOOL_RETRIES` / `APP_DOMAIN`-webhook bullets). The runtime, webhook route, and flags were deleted 2026-05-29; `executionMode` is now `z.literal('lab')` only.
2. **Stack line:** `Anthropic Claude` → `Anthropic Claude / DeepSeek (provider-agnostic via AI SDK v6; positioning sections run DeepSeek by default)`. Also drop `and ad scripts` from "produces: 6 research sections, a media plan, and ad scripts" (ad-scripts removed per ADR-0009) → "6 positioning sections and a media plan".
3. **Flow step 5:** remove the waves claim. `Sections commit as drafts in parallel (bounded by ORCHESTRATOR_CONCURRENCY, default 3 → two waves of three).` → `Sections fan out and commit as drafts in parallel (Promise.allSettled over all six).`
4. **Flow step 6:** `live "Wave X of Y / N running / N queued" telemetry.` → `live per-section phase (Compiling context → Reading sources → Drafting → Validating → Committed) + tool/source activity.` (Reflects the task-5 phase-honesty work.)
5. **Research dispatch line:** `→ Railway worker → Anthropic skills/tools/API-backed research →` → `→ in-process lab engine (DeepSeek section agents + Brave web_search) for sections; Railway worker for corpus/identity/meeting →`.
6. **research-v2 feature flags section:** if any of the four flags (`ENABLE_POSITIONING_ORCHESTRATOR`, `NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS`, `NEXT_PUBLIC_ARTIFACT_UI_V2`, `ORCHESTRATOR_CONCURRENCY`) have **zero live `process.env` reads** in `src/` + `research-worker/src/`, mark them `(legacy — no longer read)` or remove; verify with `rg` before editing. Do not invent status.

## EDITS — `CONTEXT.md`
The "Current target stack" describes the **deleted** worker-subagent + `streamObject` architecture (`research-worker/src/agents/subagents/…` — that dir was deleted this session). Update it:
1. Add a dated banner at the top: the runtime is the in-process lab engine (`src/lib/lab-engine/`), answer-tool path (`run-section.ts` → `runSectionViaAnswerTool`), structural verifier + evidence-support repair (`verification/`), provider-agnostic on DeepSeek. The 2026-05-14 worker-subagent/`streamObject` design is **superseded**.
2. Fix now-broken path references (`research-worker/src/agents/subagents/index.ts`, `…/subagents/schemas/`) → the lab-engine equivalents (`src/lib/lab-engine/agents/`, `src/lib/lab-engine/artifacts/schemas/`).
3. Note managed-agents migration abandoned (ADR-0006 Phase F): runtime + webhook deleted 2026-05-29; `managed-agents/schemas/` rehome pending (FE-2).
Keep the glossary/domain vocabulary (Artifact/Section/Subagent/Card/Skill) — only the stack/path facts are stale.

## CONSTRAINTS
- Docs only. No code, no `src/` changes. Don't delete the glossary or ADR history. Be accurate — verify any flag/path claim with `rg` before writing it. Do NOT run git.

## VERIFY (Claude re-runs)
```bash
cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
rg -n "MANAGED_AGENTS|two waves of three|Wave X of Y|and ad scripts" CLAUDE.md   # expect: no output
rg -n "agents/subagents" CONTEXT.md   # expect: no output (or only in superseded/historical context)
```
## DONE WHEN
CLAUDE.md + CONTEXT.md describe the lab engine + DeepSeek reality with no references to the deleted managed-agents runtime, waves, ad-scripts, or worker-subagent paths as if current.
