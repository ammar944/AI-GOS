# Pipeline Sprint 2: Persistence + Start/Advance Routes

**Branch:** `redesign/v2-command-center`

**Depends on:** Sprint 1 (pipeline-types, pipeline-controller, pipeline-context must exist)

**What this builds:** Supabase migration for atomic metadata writes, persistence helpers, and the two core pipeline routes (`/start` and `/advance`).

**Estimated scope:** 1 migration + 2 modified files + 2 new route files. ~350 lines of code.

---

## Context

Read these before starting:
- **Spec:** `docs/superpowers/specs/2026-03-12-sequential-research-pipeline-design.md` (sections: Pipeline Controller, New API Routes)
- **Full plan:** `docs/superpowers/plans/2026-03-12-sequential-research-pipeline.md` (Tasks 4-6)
- **Sprint 1 output:** `src/lib/research/pipeline-types.ts`, `pipeline-controller.ts`, `pipeline-context.ts`
- **Dispatch function:** `src/lib/ai/tools/research/dispatch.ts` (`dispatchResearchForUser` signature)
- **Supabase client:** `src/lib/supabase/server.ts` (`createAdminClient`)
- **Existing session state:** `src/lib/journey/session-state.server.ts`

## Tasks

### Task 4: Pipeline State Persistence Helpers

1. **Create Supabase migration** `supabase/migrations/20260312_add_journey_session_metadata_merge_function.sql`
   - `merge_journey_session_metadata_keys(p_user_id text, p_keys jsonb)` RPC
   - INSERT ON CONFLICT with `metadata || p_keys` merge
   - This is a HARD prerequisite — routes depend on it

2. **Add to `session-state.server.ts`:**
   - `readPipelineState(userId)` — reads `metadata.researchPipeline` via `maybeSingle()`
   - `persistPipelineState(userId, pipelineState, extraMetadata?)` — uses `merge_journey_session_metadata_keys` RPC (atomic, no read-then-write)

### Task 5: POST /api/research/pipeline/start

Create `src/app/api/research/pipeline/start/route.ts` per plan Task 5.
- Clerk auth
- Receives `{ onboardingData }`
- Creates `runId` via `crypto.randomUUID()`
- Calls `createInitialPipelineState(runId)`
- Dispatches section 0 via `dispatchResearchForUser(toolName, boundaryKey, context, userId, { activeRunId: runId })`
- Persists state + onboardingData in ONE call: `persistPipelineState(userId, state, { onboardingData })`
- Returns `{ status: 'started', runId, section }`

### Task 6: POST /api/research/pipeline/advance

Create `src/app/api/research/pipeline/advance/route.ts` per plan Task 6.
- Clerk auth + run ownership verification
- Reads pipeline state, verifies current section is `complete`
- `markSectionApproved` → `getNextSectionId` → build context → dispatch next
- Context builder routing via `buildContextForSection()` helper (exhaustive switch, throws on unknown)
- Reads `onboardingData` and `research_results` from Supabase for context building
- Returns `{ status: 'advanced', section }` or `{ status: 'complete' }`

## Verification Gate
```bash
npm run test:run
npm run build
```

Also manually verify the migration SQL is valid (no syntax errors).

## Commit Pattern
One commit per task (3 total).
