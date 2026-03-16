# Pipeline Sprint 4: Frontend Pipeline View

**Branch:** `redesign/v2-command-center`

**Depends on:** Sprints 1-3 (all backend routes and types must exist)

**What this builds:** The two-panel pipeline page — section cards on the right, per-section chat on the left. Functional scaffolding, not polished UI.

**Estimated scope:** 4 new files. ~400 lines of code.

---

## Context

Read these before starting:
- **Spec:** `docs/superpowers/specs/2026-03-12-sequential-research-pipeline-design.md` (sections: Artifact Panel, Card States, User Experience Flow)
- **Full plan:** `docs/superpowers/plans/2026-03-12-sequential-research-pipeline.md` (Tasks 9-11)
- **Sprint 1 types:** `src/lib/research/pipeline-types.ts` (`PipelineState`, `PipelineSectionId`, `SectionStatus`, `PIPELINE_SECTION_ORDER`, `PIPELINE_SECTION_CONFIG`)
- **Existing hooks:**
  - `src/lib/journey/research-realtime.ts` (`useResearchRealtime` — run-scoped polling with deduplication)
  - `src/lib/journey/research-job-activity.ts` (`useResearchJobActivity` — returns `Record<string, ResearchJobActivity>` keyed by boundary key)
- **Section normalization:** `src/lib/journey/research-sections.ts` (`normalizeResearchSectionId` — converts boundary keys to canonical IDs)
- **Existing card patterns:** `src/components/journey/research-inline-card.tsx` (for reference, don't import)
- **AI SDK frontend:** `@ai-sdk/react` → `useChat`; `ai` → `DefaultChatTransport`
- **Next.js 16:** `params` is a `Promise` in App Router — must `await params`

## Tasks

### Task 9: Pipeline Page + PipelineView

1. **Create `src/app/research/[runId]/page.tsx`**
   - Server Component (no `'use client'`)
   - `async function`, `params: Promise<{ runId: string }>`, `await params`
   - Renders `<PipelineView runId={runId} />`

2. **Create `src/components/research/pipeline-view.tsx`**
   - `'use client'`
   - Uses `useResearchRealtime` with `onSectionComplete` handler:
     - Callback receives boundary section key → normalize via `normalizeResearchSectionId` → store in state
     - Verify `runId` match before applying
   - Polls `/api/journey/session?runId=...` every 2s for pipeline metadata (gate/approval state)
     - Verify `pipeline.runId === runId` before applying
   - Uses `useResearchJobActivity` for worker progress
   - Two-panel layout: left `w-1/3` (chat when gated), right `w-2/3` (section cards)
   - `handleApprove` calls `POST /api/research/pipeline/advance`

### Task 10: Section Card Component

Create `src/components/research/section-card.tsx` per plan Task 10.

**8 card states with visual treatment:**

| Status | Border/Background |
|---|---|
| `pending` | dimmed, `opacity-40 border-zinc-800` |
| `queued` | blue, `border-blue-500/50 bg-blue-500/5` |
| `running` | blue, same as queued |
| `complete` | neutral, `border-zinc-600` |
| `approved` | green, `border-green-500/30 bg-green-500/5` |
| `editing` | purple, `border-purple-500/50 bg-purple-500/5` |
| `stale` | amber, `border-amber-500/50 bg-amber-500/5` + "Needs rerun" badge |
| `error` | red, `border-red-500/50 bg-red-500/5` + Retry button |

**Features:**
- Copy button (copies section data as JSON)
- "Looks good" + "Refine" buttons when gated
- `onRetry` prop for error state retry button
- Worker progress: `activity?.updates?.at(-1)?.message` (NOT `activity?.latestUpdate?.message` — that field doesn't exist)

### Task 11: Gate Controls with Chat

Create `src/components/research/gate-controls.tsx` per plan Task 11.

- `DefaultChatTransport` imported from `'ai'` (NOT `'@ai-sdk/react'`)
- `useChat` with:
  - `transport: new DefaultChatTransport({ api: '/api/research/chat', body: { runId, sectionId } })`
  - `id: \`research-chat-${sectionId}\`` (scopes chat history per section)
  - `experimental_throttle: 50` (batches React re-renders during streaming)
- Messages rendered with `m.parts` pattern (text parts only)
- "Looks good" button at bottom calls `onApprove`

## Verification Gate
```bash
npm run build
```

No tests for frontend components in this sprint (functional scaffold only).

## Commit Pattern
One commit per task (3 total).
