# Sequential Research Pipeline with Gated Artifacts

## Summary

Replace the lead-agent research sequencing logic with a deterministic TypeScript pipeline that executes 6 research sections sequentially. Each section produces a live artifact card. A gate after each section lets the user approve, refine via chat, or direct-edit before the next section fires.

This design reuses the existing `journey_sessions` row, `research_results`, `job_status`, and worker dispatch path. It does **not** introduce a new `sessionId` contract in v1. Instead, every pipeline run is scoped by the existing `activeRunId` / `runId` model already used to prevent stale worker writes.

The result is a complete research blueprint composed of 6 validated artifact cards, with gate state persisted server-side instead of hidden in chat messages.

## Problem

The current architecture uses an expensive, slow LLM (Claude Opus with a 5,000-token thinking budget) to orchestrate what is fundamentally a deterministic pipeline. The lead agent decides when to ask questions, when to trigger research, and what to say between steps. In the current repo this produces:

- 8-13 seconds before the first streamed text response
- about 578 lines of route logic in `src/app/api/journey/stream/route.ts`
- about 271 lines of system prompt logic in `src/lib/ai/prompts/lead-agent-system.ts`
- a UX where the user waits on narrated text even though research already runs asynchronously through the Railway worker

The current backend primitives already support async research:

- `dispatchResearchForUser()` dispatches the worker and returns immediately
- the worker writes `job_status` before returning `202`
- final artifacts are written to `journey_sessions.research_results`
- the client already has run-scoped snapshot hooks for research results and job activity

The orchestration layer is the expensive part, not the worker infrastructure.

## Architecture

### What Gets Removed

This needs to happen in phases, not as a single delete:

- **Phase 1:** remove the lead agent's responsibility for research sequencing, gating, and section-to-section transitions
- **Phase 2:** once the pipeline UI owns approvals and reruns, delete `src/app/api/journey/stream/route.ts` and `src/lib/ai/prompts/lead-agent-system.ts`
- `askUser`, `competitorFastHits`, `src/lib/ai/journey-state.ts`, and `src/lib/ai/competitor-detector.ts` are removable only after `/journey` no longer supports conversational onboarding

### What Stays

- The 6 Railway worker runners in `research-worker/src/runners/`
- The dispatch mechanism in `src/lib/ai/tools/research/dispatch.ts`
- `journey_sessions.research_results` and `journey_sessions.job_status`
- The merge RPCs:
  - `merge_journey_session_research_result`
  - `merge_journey_session_job_status`
- Run-scoped stale-write protection via `activeRunId` / `runId`
- Existing research section schemas and artifact renderers
- Existing `/api/journey/session?runId=...` snapshot path during migration

### Non-Goals (Excluded From This Spec)

- `researchMediaPlan` as a 7th section
- Parallel execution
- PDF/doc export
- Reusing the existing `POST /api/blueprints` + `/shared/[token]` flow without an explicit mapping layer

### Migration Constraints From The Current Repo

- `journey_sessions` currently has a single row per user via a unique `user_id` constraint. V1 should reuse that row instead of introducing a new per-session table.
- Approval state is currently encoded in chat messages like `[SECTION_APPROVED:industryMarket]`. The new pipeline must persist approvals outside chat.
- `job_status` is keyed by `jobId`, not by section.
- The synthesis and keyword runners expect structured text / markdown context, not raw `JSON.stringify(...)` payloads.
- Direct edits to an upstream section must invalidate downstream sections.

## Three New Components

### 1. Pipeline Controller

Pure TypeScript state machine. No LLM.

**Canonical identifiers** (must match codebase exactly):

| # | Tool Name | Canonical Section ID | Boundary Section Key | Display Name |
|---|---|---|---|---|
| 0 | `researchIndustry` | `industryResearch` | `industryMarket` | Market Overview |
| 1 | `researchCompetitors` | `competitorIntel` | `competitors` | Competitor Intel |
| 2 | `researchICP` | `icpValidation` | `icpValidation` | ICP Validation |
| 3 | `researchOffer` | `offerAnalysis` | `offerAnalysis` | Offer Analysis |
| 4 | `synthesizeResearch` | `strategicSynthesis` | `crossAnalysis` | Strategic Synthesis |
| 5 | `researchKeywords` | `keywordIntel` | `keywordIntel` | Keyword Intelligence |

These match the current split between:

- worker persistence keys in `research-worker/src/section-map.ts`
- canonical section ids in `src/lib/journey/research-sections.ts`
- boundary keys still used by parts of the current UI

#### Canonical Run Identity

V1 should reuse the existing run-scoping model:

- `journey_sessions` remains one row per user
- each pipeline execution gets a fresh `runId`
- `runId` is stored in `metadata.activeJourneyRunId`
- every worker dispatch passes `activeRunId: runId`
- every result and job-status read is filtered back to that same `runId`

Do **not** introduce a separate `sessionId` API contract in v1 unless a new data model is added first.

```typescript
type PipelineRunId = string

type SectionId =
  | 'industryResearch'
  | 'competitorIntel'
  | 'icpValidation'
  | 'offerAnalysis'
  | 'strategicSynthesis'
  | 'keywordIntel'

type PipelineState = {
  runId: PipelineRunId
  currentSectionId: SectionId | null
  status: 'idle' | 'running' | 'gated' | 'complete' | 'error'
  approvedSectionIds: SectionId[]
  sections: SectionState[]
}

type SectionState = {
  id: SectionId
  toolName: string
  boundaryKey: string
  displayName: string
  status:
    | 'pending'
    | 'queued'
    | 'running'
    | 'complete'
    | 'approved'
    | 'editing'
    | 'stale'
    | 'error'
  data: Record<string, unknown> | null
  jobId?: string | null
  error?: string | null
}
```

Persist this under `journey_sessions.metadata.researchPipeline` in v1. A dedicated table can come later if multi-session history becomes a requirement.

#### Execution Flow

1. User finishes structured onboarding outside the current `/journey` chat onboarding flow.
2. Frontend calls `POST /api/research/pipeline/start` with `onboardingData`.
3. Server creates a fresh `runId`, writes `activeJourneyRunId` + initial `researchPipeline` metadata, and dispatches section 0 via:

   `dispatchResearchForUser(toolName, boundaryKey, context, userId, { activeRunId: runId })`

4. Worker returns `202` immediately, writes `job_status[jobId]`, then writes the final artifact into `research_results[canonicalSectionId]` with the same `runId`.
5. Frontend listens for updates either through direct Supabase Realtime or the existing `/api/journey/session?runId=...` snapshot/polling path during migration.
6. When a completed result for the active `runId` arrives, the card renders and the pipeline enters `gated`.
7. User approves the current gated section.
8. Frontend calls `POST /api/research/pipeline/advance` with `runId`.
9. Server persists approval for the current section, dispatches the next section, and updates metadata.
10. Repeat until all 6 sections are approved.

#### Context Builders

Do **not** pass raw `JSON.stringify({ onboardingData, priorResults })` payloads to the workers.

Add `src/lib/research/pipeline-context.ts` with explicit builders:

- `buildIndustryContext(onboardingData)`
- `buildCompetitorContext({ onboardingData, industryResearch })`
- `buildIcpContext({ onboardingData, industryResearch, competitorIntel })`
- `buildOfferContext({ onboardingData, industryResearch, competitorIntel, icpValidation })`
- `buildSynthesisContext({ onboardingData, industryResearch, competitorIntel, icpValidation, offerAnalysis })`
- `buildKeywordContext({ onboardingData, industryResearch, competitorIntel, icpValidation, offerAnalysis, strategicSynthesis })`

These builders must emit the text structure the current runners already parse:

- synthesis and keyword runners consume `## Section Name` blocks
- keyword runner expects a `- Top Competitors:` line
- offer analysis benefits from first-party URL bullet lines

This is the current contract in the worker code. Replacing it with raw JSON would silently degrade sections 4-6.

#### Special Cases

- **Section 4 (`synthesizeResearch`)** reads canonical results for `industryResearch`, `competitorIntel`, `icpValidation`, and `offerAnalysis` from Supabase, then passes a built synthesis context string to the worker.
- **Section 5 (`researchKeywords`)** reads `strategicSynthesis` plus supporting sections and passes a built keyword context string to the worker.

#### New API Routes

`POST /api/research/pipeline/start`

- Requires Clerk auth
- Body: `{ onboardingData }`
- Creates a fresh `runId`
- Persists:
  - `metadata.activeJourneyRunId = runId`
  - `metadata.researchPipeline = initialState`
- Dispatches `researchIndustry`
- Returns: `{ status: 'started', runId, section: 'industryResearch' }`

`POST /api/research/pipeline/advance`

- Requires Clerk auth
- Body: `{ runId }`
- Verifies:
  - authenticated user owns the `journey_sessions` row
  - `runId` matches `metadata.activeJourneyRunId`
  - `metadata.researchPipeline.currentSectionId` exists
  - the current section result is `status: 'complete'`
- Persists approval of the current gated section in `metadata.researchPipeline.approvedSectionIds`
- Resolves latest worker state for the current or next section by scanning `job_status` rows for matching `tool + runId`
- Dispatches the next section or returns `{ status: 'complete' }`

Do **not** derive the next section by counting non-null keys in `research_results`.

#### Completion Detection

The migration `20260309_enable_realtime_journey_sessions.sql` already enables Realtime on `journey_sessions`, so direct Realtime is a valid target. But the current repo already has working run-scoped snapshot hooks that poll `/api/journey/session?runId=...`.

MVP options:

- keep the current snapshot/polling path and swap to direct Realtime later
- wire direct Realtime immediately

In both cases, the client must ignore results whose embedded `runId` does not match the active pipeline `runId`.

New files:

- `src/lib/research/pipeline-controller.ts`
- `src/lib/research/pipeline-context.ts`

### 2. Chat Agent (Per-Section Refinement)

Lightweight Sonnet agent that activates only when a section is gated or being edited.

- Model: Claude Sonnet
- System prompt: short, section-scoped, no global orchestration
- Context: current section data, structured onboarding inputs, current `runId`
- Chat history is preserved per section, but context resets when the active section changes

**Target:** sub-second time-to-first-token for refinement chat, not for worker-computed artifact completion.

**`editSection` tool definition:**

```typescript
{
  name: 'editSection',
  description: 'Update the current research section data based on user feedback',
  inputSchema: z.object({
    sectionId: z.enum([
      'industryResearch',
      'competitorIntel',
      'icpValidation',
      'offerAnalysis',
      'strategicSynthesis',
      'keywordIntel',
    ]),
    updates: z.record(z.unknown()),
    summary: z.string().describe('One-line description of what changed'),
  }),
}
```

#### How `editSection` Is Applied

1. Agent calls `editSection` with a partial object of fields to update.
2. Route handler extracts `userId` from Clerk auth and verifies the current `runId` matches `activeJourneyRunId`.
3. Route reads the existing stored section result, deep-merges `updates` into `result.data`, and preserves wrapper fields like `status`, `section`, `durationMs`, `runId`, `citations`, `provenance`, and `validation` unless intentionally changed.
4. Route writes the merged section back through `merge_journey_session_research_result`.
5. Route computes downstream invalidation using the existing dependency graph in `src/lib/journey/research-sections.ts`.
6. Any downstream section becomes `stale`, loses approval state, and must be rerun before the pipeline can complete again.
7. Tool returns the merged section payload.

New API route: `src/app/api/research/chat/route.ts`

- `POST`
- receives `messages`, `runId`, `sectionId`
- uses `streamText` + `toUIMessageStreamResponse()`
- requires Clerk auth
- rejects writes for stale or non-active runs

### 3. Artifact Panel (Frontend)

Two-panel layout:

- Left: per-section chat panel, inactive until a gate opens
- Right: artifact panel with 6 stacked section cards

The new container logic cannot reuse `src/app/journey/page.tsx` as-is because that page is currently coupled to:

- synthetic realtime chat messages
- `[SECTION_APPROVED:*]` user messages
- chat-driven approval recovery

The current artifact renderers can still be reused, but approval state and orchestration must move out of chat history.

#### Card States

- **Pending:** dimmed, section label only
- **Queued / Running:** loading state with worker activity
- **Complete:** artifact content available, awaiting approval
- **Approved:** locked and accepted
- **Editing:** inline edit active
- **Stale:** upstream edit invalidated this section; rerun required
- **Error:** worker or validation failure

#### Card Features

- Copy action
- Direct inline editing
- "Looks good" approval CTA
- Stale badge + rerun CTA when upstream changes invalidate downstream output

#### Direct Edit Persistence

Inline edits save via `PATCH /api/research/section` with body:

`{ runId, sectionId, updates }`

The route:

- requires Clerk auth
- verifies the row owner
- verifies `runId` matches `activeJourneyRunId`
- deep-merges into the stored section wrapper
- writes via `merge_journey_session_research_result`
- clears approvals / marks stale downstream sections when needed

Frontend can use optimistic updates, but must revert to the last server-confirmed result on failure.

## User Experience Flow

### Step 1: Start Research

User finishes structured onboarding, clicks "Start Research", and the app immediately transitions to the two-panel pipeline view. The pending card stack should render in under 1 second.

### Step 2: Section Builds

The first card ("Market Overview") enters queued/running state. Full artifact content appears only when the worker completes and writes the final result to `research_results`.

### Step 3: Gate

When the section completes, the card becomes reviewable:

- "Looks good" persists approval and advances the pipeline
- chat becomes active for section-specific refinement
- direct inline editing is available

### Step 4: Edit And Invalidate If Needed

If the user edits an upstream section after downstream sections already exist, the pipeline marks dependent sections as stale and requires reruns.

### Step 5: Approve And Advance

Approval calls `POST /api/research/pipeline/advance` with `runId`, not `sessionId`.

### Step 6: Blueprint Complete

All 6 sections are approved. User can reopen any section, but editing an upstream section may invalidate downstream artifacts.

## Sharing

Sharing is **not** part of the MVP unless one explicit approach is chosen.

### Option A: Map To Existing Blueprint Share Flow

Add a mapper from the six research cards into `StrategicBlueprintOutput`, then reuse:

- `POST /api/blueprints`
- `shared_blueprints.blueprint_data`
- `/shared/[token]`

### Option B: Create A Dedicated Research Share View

Add a separate read-only route such as `/shared/research/[token]` for raw research artifacts.

### Recommendation

Do **not** send the raw six-card research JSON directly to the existing blueprint share endpoint. That route currently expects `StrategicBlueprintOutput`, not canonical research-card payloads.

## Performance Targets

| Metric | Current | Target |
|---|---|---|
| Time before first visible pipeline UI | 8-13 seconds of narrated chat | < 1 second |
| Time before first artifact content | tied to worker completion | unchanged worker latency |
| Chat response during gated refinement | 8-13 seconds | < 1 second |
| System prompt size for refinement chat | 11,000 tokens | < 1,000 tokens |
| Full context per refinement request | 11,000+ tokens | section-scoped only |
| Model for orchestration | Opus | none |
| Model for refinement chat | Opus | Sonnet |

## Data Flow

```text
Structured onboarding data
  -> POST /api/research/pipeline/start
  -> server creates runId and persists metadata.researchPipeline
  -> dispatchResearchForUser(..., { activeRunId: runId })
  -> Railway worker writes job_status[jobId] and later research_results[canonicalSectionId]
  -> client observes only rows/results whose runId matches activeRunId
  -> gated artifact card opens
  -> optional section chat
    -> editSection tool
    -> merge_journey_session_research_result
    -> invalidate downstream sections if dependencies changed
  -> optional direct edit
    -> PATCH /api/research/section
    -> merge_journey_session_research_result
    -> invalidate downstream sections if dependencies changed
  -> POST /api/research/pipeline/advance
    -> persist approval
    -> dispatch next section
  -> repeat until all 6 approved
```

## Error Handling

- `job_status` is keyed by `jobId`, so pipeline code must resolve the latest job for a section by matching `tool + runId`
- Worker timeout / stale detection should follow the worker's actual threshold (currently 5 minutes), not an invented 120-second gate
- If the latest job for the active run is `error`, the card shows error state and offers retry
- If the snapshot or Realtime connection drops, refetch `/api/journey/session?runId=...` and rebuild state
- If an upstream edit invalidates downstream sections, keep them visible but mark them `stale` until rerun

## Migration Plan

### Phase 1

- Add pipeline controller, context builders, and pipeline routes
- Persist approval / gate state in metadata
- Launch the pipeline from structured onboarding data
- Reuse current worker infrastructure and artifact renderers

### Phase 2

- Switch the primary research flow away from lead-agent orchestration
- Move artifact approval out of chat-message state
- Keep `/api/journey/session` as compatibility surface until direct Realtime is stable

### Phase 3

- Delete `src/app/api/journey/stream/route.ts`
- Delete `src/lib/ai/prompts/lead-agent-system.ts`
- Delete chat-only approval / recovery logic
- Delete conversational onboarding helpers only after that experience is fully retired

## What This Enables Later

- Synthesis chat over all 6 approved sections
- `researchMediaPlan` as a 7th section
- Dedicated research-share pages
- Multi-run history if `journey_sessions` is later split into a true session table
