# Pipeline Sprint 3: Edit + Chat Routes

**Branch:** `redesign/v2-command-center`

**Depends on:** Sprint 2 (persistence helpers, pipeline controller must exist)

**What this builds:** The section direct-edit route and the per-section Sonnet chat agent with `editSection` tool.

**Estimated scope:** 2 new route files. ~250 lines of code.

---

## Context

Read these before starting:
- **Spec:** `docs/superpowers/specs/2026-03-12-sequential-research-pipeline-design.md` (sections: Chat Agent, Artifact Panel → Direct Edit Persistence)
- **Full plan:** `docs/superpowers/plans/2026-03-12-sequential-research-pipeline.md` (Tasks 7-8)
- **Sprint 1-2 output:** `src/lib/research/pipeline-types.ts`, `pipeline-controller.ts` (for `invalidateDownstream`)
- **Existing merge RPC:** `merge_journey_session_research_result(p_user_id, p_section, p_result)` in Supabase
- **AI SDK patterns:** `.claude/rules/ai-sdk-patterns.md` — use `inputSchema` (NOT `parameters`), sanitize messages before `convertToModelMessages`
- **Existing chat agent for reference:** `src/app/api/chat/agent/route.ts` (message sanitization pattern)

## Tasks

### Task 7: PATCH /api/research/section (Direct Edit)

Create `src/app/api/research/section/route.ts` per plan Task 7.
- Clerk auth + run ownership via `readPipelineState`
- Receives `{ runId, sectionId, updates }`
- Reads existing section result from Supabase `research_results`
- Deep merges `updates` into `result.data`
- Writes via `merge_journey_session_research_result` RPC
- Calls `invalidateDownstream(state, sectionId)` — marks downstream sections `stale`, removes from `approvedSectionIds`
- Persists updated pipeline state

### Task 8: POST /api/research/chat (Per-Section Chat Agent)

Create `src/app/api/research/chat/route.ts` per plan Task 8.
- Clerk auth + run ownership
- `export const maxDuration = 60`
- Model: `claude-sonnet-4-20250514`
- Short system prompt (~200 tokens): section name + current data + instructions
- **`editSection` tool:**
  - Uses `inputSchema:` (NOT `parameters:`)
  - Schema: `{ sectionId: z.enum([...]), updates: z.record(z.unknown()), summary: z.string() }`
  - Execute: read existing → merge → write via RPC → invalidate downstream → persist pipeline state
- **Message sanitization:** Filter incomplete tool parts BEFORE `convertToModelMessages()` (prevents `MissingToolResultsError`)
- `streamText` + `toUIMessageStreamResponse()`
- `maxSteps: 3`

## Key Rules (from CLAUDE.md)
- `inputSchema` not `parameters` for tool definitions
- `maxOutputTokens` not `maxTokens`
- Sanitize messages before `convertToModelMessages` — it throws on unmatched tool calls
- `toUIMessageStreamResponse()` requires `DefaultChatTransport` on frontend

## Verification Gate
```bash
npm run test:run
npm run build
```

## Commit Pattern
One commit per task (2 total).
