# Pipeline Sprint 1: Core State Machine + Context Builders

**Branch:** `redesign/v2-command-center` (continue on current branch)

**What this builds:** Pure TypeScript pipeline controller and context builders — no routes, no frontend, no DB. Just tested business logic.

**Estimated scope:** 3 new files + 2 test files. ~400 lines of code.

---

## Context

Read these before starting:
- **Spec:** `docs/superpowers/specs/2026-03-12-sequential-research-pipeline-design.md`
- **Full plan:** `docs/superpowers/plans/2026-03-12-sequential-research-pipeline.md` (Tasks 1-3 only)
- **Runner context format:** `research-worker/src/runners/synthesize.ts` (look for `extractSynthesisSectionBlocks`, `Business context:`, `Existing persisted research to reuse:`)
- **Runner keyword format:** `research-worker/src/runners/keywords.ts` (look for `extractKeywordCompetitorNames`, `- Top Competitors:`)
- **Existing section mappings:** `src/lib/journey/research-sections.ts`

## Tasks

### Task 1: Pipeline Types and Constants
Create `src/lib/research/pipeline-types.ts` per plan Task 1.

### Task 2: Pipeline Controller State Machine
Create `src/lib/research/pipeline-controller.ts` with TDD per plan Task 2.
- `createInitialPipelineState(runId)`
- `getNextSectionId(approvedSectionIds)`
- `markSectionRunning(state, sectionId, jobId)`
- `markSectionComplete(state, sectionId, data)`
- `markSectionApproved(state, sectionId)` — with idempotency guard
- `invalidateDownstream(state, editedSectionId)` — excludes the edited section itself from stale set

Tests in `src/lib/research/__tests__/pipeline-controller.test.ts`.

### Task 3: Context Builders
Create `src/lib/research/pipeline-context.ts` with TDD per plan Task 3.

**CRITICAL:** Read the actual runner files FIRST (Step 1 in plan). The builders must emit:
```
Business context:
- Company Name: X
- Industry: Y
- Top Competitors: A, B, C

Existing persisted research to reuse:

## Market Overview
{"marketSize": "$5B", ...}

## Competitor Intel
{...}
```

Section headings must be: `Market Overview`, `Competitor Intel`, `ICP Validation`, `Offer Analysis`, `Strategic Synthesis`.

The `- Top Competitors:` line MUST appear inside the `Business context:` block (before `Existing persisted research to reuse:`).

Tests in `src/lib/research/__tests__/pipeline-context.test.ts` — all 6 builders tested.

## Verification Gate
```bash
npm run test:run -- src/lib/research/__tests__/
npm run build
```

## Commit Pattern
One commit per task (3 total).
