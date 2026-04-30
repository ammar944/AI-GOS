# PRD: GTM Conversational Canvas

**Slug:** `gtm-conversational-canvas`
**Created:** 2026-05-01
**Branch:** `refactor/agent-loop-v1`
**Status:** ready
**PRD #:** 001

---

## Executive summary

Replace the auto-dispatching `ChatShell` with an Ollama-driven chat orchestrator that runs the 5 lighthouse skills as tool calls, stores each output as a versioned markdown artifact in Supabase, and accepts free-form user messages to either re-run skills (paid) or patch artifacts in place (free). The existing worker dispatch pipeline, lighthouse skill bodies, and `gtm_runs`/`gtm_stage_events` schemas are untouched. Phase 1 of a three-phase journey toward a SaaS-GTM workspace; subsequent phases will add synthesis depth (Phase 2) and multi-client management (Phase 3).

---

## Problem

The lighthouse skills produce high-quality, evidence-bound research output (verified: `discover-url` returns 19 confidence-rated fields with source URLs in 200s). The UX, however, presents these outputs as a flat vertical scroll of evidence boxes inside a chat shell whose input is disabled until a stage hits `awaiting_user`. There is no inspector, no sidebar of past runs, no way to refine output without paying for a full skill re-run, and no concept of an editable artifact. The user's stated reaction: "the way this is showing is currently very awful."

## Goal

A single conversational canvas where:

1. The user submits a URL (or brief).
2. An Ollama chat agent dispatches the 5 lighthouse skills as tool calls, in DAG order or as the user directs.
3. Each skill output renders as a versioned markdown artifact (collapsible, openable to canvas).
4. The chat input is always active. User messages route through an intent classifier:
   - **`patch_artifact`** → Ollama edits the existing MD (free, instant, preserves evidence URLs).
   - **`rerun_skill`** → existing dispatch pipeline runs the skill again with new refinement context (paid).
   - **`ask_question`** → Ollama answers from the artifacts in scope (free).

## Non-goals

- Multi-client / account / RBAC layer — Phase 3.
- Synthesis skills (positioning, media plan, scripts) — Phase 2.
- AionUi runtime code lifted into AIGOS — IA + message-shape types only.
- Pixel-matching AionUi — DESIGN.md tokens unchanged.
- Lighthouse skill body changes — out of scope; skills are working.
- Replacing worker, dispatch route, or `gtm_stage_events` model — wrapped, not replaced.

## Success criteria (verifiable)

1. Submit `https://www.airtable.com/`. Orchestrator dispatches all 5 lighthouse skills via DAG. 5 v1 rows appear in `gtm_artifacts`.
2. User: "make the ICP description focus on enterprise only." Orchestrator classifies as `patch_artifact`. ICP artifact v2 row written. No new `gtm_stage_events` row. Zero paid-skill cost (verifiable via DB).
3. User: "rerun the competitor analysis with G2-only sources." Orchestrator classifies as `rerun_skill`. `research-competitor` dispatched again with `refinement_context`. Competitor artifact v2 written.
4. `npm run build` clean. Pre-existing test failures unchanged. New tests for orchestrator, tools, render-md, ArtifactCard, chat route all pass.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Browser: ChatShell (refactored)                                  │
│   - useChat() w/ DefaultChatTransport                            │
│   - chat input ALWAYS active                                     │
│   - inline ArtifactCard per (run_id, skill, latest_version)      │
│   - inline AgentInvocationBlock for in-flight skill calls        │
└───────────────┬──────────────────────────────────────────────────┘
                │  POST /api/gtm/runs/:id/chat (UIMessage[])
                ▼
┌──────────────────────────────────────────────────────────────────┐
│ Next.js: chat route                                              │
│   - Clerk auth + run-ownership check                             │
│   - runOrchestrator(messages, runId) → streamText                │
│   - toUIMessageStreamResponse()                                  │
└───────────────┬──────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────────┐
│ src/lib/ai/orchestrator.ts                                       │
│   - Ollama (qwen2.5-coder:32b OR cloud deepseek-v4-flash)        │
│   - tools: dispatch_skill | patch_artifact | classify_intent     │
│   - sanitizes incomplete tool parts before convertToModelMessages│
└───────────────┬─────────────────────────────────┬────────────────┘
                │                                 │
                │ dispatch_skill                  │ patch_artifact
                ▼                                 ▼
┌─────────────────────────────────┐  ┌──────────────────────────────┐
│ EXISTING dispatch pipeline      │  │ Ollama: edit MD in place     │
│   /api/gtm/runs/:id/dispatch    │  │   - reads current content_md │
│   → research-worker (Railway)   │  │   - applies user instruction │
│   → codex exec (skill folder)   │  │   - returns new MD body      │
│   → JSON output written to      │  │   - writes gtm_artifacts row │
│     gtm_stage_events (UNCHANGED)│  │     vN+1 with parent_id      │
│ orchestrator then renders MD    │  └──────────────────────────────┘
│ → writes gtm_artifacts row v1   │
└─────────────────────────────────┘
```

## Data model

```sql
CREATE TABLE gtm_artifacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      text NOT NULL REFERENCES gtm_runs(run_id) ON DELETE CASCADE,
  skill       text NOT NULL,
  version     int  NOT NULL DEFAULT 1,
  parent_id   uuid REFERENCES gtm_artifacts(id),
  content_md  text NOT NULL,
  source      text NOT NULL CHECK (source IN ('skill_output', 'agent_patch')),
  created_by  text NOT NULL,        -- clerk user_id, or 'orchestrator'
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, skill, version)
);
```

RLS: select/insert iff caller owns parent `gtm_runs.run_id` via Clerk `user_id` text join (mirrors `gtm_runs` RLS pattern from migration 20260430).

## Provider policy

| Layer | Provider | Why |
|---|---|---|
| Orchestrator chat brain | Ollama (`qwen2.5-coder:32b` local, `deepseek-v4-flash` cloud fallback) | Free/near-free tool-calling for routing + edits |
| `patch_artifact` body | Ollama | Same — text patches don't need Claude |
| Skill bodies | Anthropic Claude Opus + Perplexity Sonar (existing worker) | Unchanged. Quality + evidence-binding required. |

`.claude/rules/ai-sdk-patterns.md` will be narrowed: orchestrator may use Ollama; skill bodies remain Anthropic+Perplexity-only.

## Files

**New (10):**
- `supabase/migrations/{ts}_create_gtm_artifacts.sql`
- `src/lib/types/gtm-artifact.ts`
- `src/lib/ai/orchestrator.ts` + `.test.ts`
- `src/lib/gtm/render-md.ts` + `.test.ts`
- `src/lib/gtm/orchestrator-tools.ts` + `.test.ts`
- `src/app/api/gtm/runs/[runId]/chat/route.ts` + `.test.ts`
- `src/components/gtm/ArtifactCard.tsx` + `.test.tsx`
- `src/components/gtm/ArtifactCanvas.tsx`
- `src/app/gtm/[runId]/artifacts/[artifactId]/page.tsx`
- `src/__tests__/e2e/gtm-conversational-canvas.test.ts`

**Modified (5):**
- `src/lib/ai/providers.ts` (add ollama)
- `src/components/gtm/ChatShell.tsx` (remove auto-dispatch, enable input, render ArtifactCards)
- `src/components/gtm/ChatShell.test.tsx`
- `src/app/gtm/[runId]/page.tsx` (fetch artifacts)
- `.claude/rules/ai-sdk-patterns.md` (narrow allowlist)
- `package.json` (+ ollama-ai-provider)
- `.env.example` (OLLAMA_HOST, OLLAMA_API_KEY)

**UNTOUCHED (verifying):**
- `research-worker/` (entire worker)
- `src/app/api/gtm/runs/[runId]/dispatch/route.ts`
- `skills/*` (every skill folder)
- `gtm_stage_events`, `gtm_runs` schemas
- All existing AgentInvocationBlock behavior

## Tasks

See `tasks.yaml`. 12 tasks, 49 complexity points, 4 waves, longest chain T1→T6→T7→T10→T11→T12 (depth 6).

## Risks

See `execution_plan.yaml#risk_register`. Top three:
1. Ollama tool-calling reliability — mitigated by T1 smoke + Cloud fallback.
2. AI SDK v6 transport mismatch — captured in `learned-patterns.md`.
3. Patch hallucination drift — mitigated by prompt-level instruction to preserve evidence URLs verbatim, asserted in T11.

## Phase 2 / 3 — explicit deferral

| Phase | Scope | Trigger |
|---|---|---|
| 1 (this PRD) | Conversational canvas + artifacts | Now |
| 2 | Synthesis skills (positioning, media plan, scripts) wired into orchestrator | After Phase 1 ships and produces 5+ runs of evidence on real client URLs |
| 3 | Multi-client / account model (GoHighLevel-style) | After Phase 2; informed by user feedback on multi-tenancy needs |

---

*Ammar approved 2026-05-01 ~03:55 GMT+5. Auto mode active during scaffold.*
