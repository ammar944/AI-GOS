---
name: Workspace Architecture & Approval Flow
description: Complete map of how the workspace manages research cards, section approval, and document compilation
type: reference
---

> **DEPRECATED 2026-05-11** — This file documents implementation that was removed in Phase 6 (journey-page deletion), Phase 7 (workspace-page cluster + 7 legacy worker runners), and F1 (dispatch unification). Kept as history. For current architecture see `docs/journey-ai-layer-architecture-2026-05-07.md` and the `/research-v2` route.

## File Locations & Key Exports

### Core Types
- **File**: `src/lib/workspace/types.ts`
  - `SectionKey` — union of 7 sections (industryMarket, competitors, icpValidation, offerAnalysis, keywordIntel, crossAnalysis, mediaPlan)
  - `SectionPhase` — 'queued' | 'researching' | 'streaming' | 'review' | 'approved' | 'error'
  - `CardState` — { id, sectionKey, cardType, label, content, status: 'draft'|'edited'|'approved', versions[] }
  - `WorkspaceState` — { sessionId, phase, currentSection, sectionStates, sectionErrors, cards }

### Pipeline & Section Constants
- **File**: `src/lib/workspace/pipeline.ts`
  - `SECTION_PIPELINE` — 7 sections in order (includes mediaPlan at end)
  - `RESEARCH_SECTIONS` — 6 sections (excludes mediaPlan, shown in workspace tabs)
  - `createInitialSectionStates()` — returns all sections as 'queued'
  - `getNextSection(current)` — navigates pipeline
  - `isFinalSection()` — true if section === mediaPlan

### Card Parsing & Taxonomy
- **File**: `src/lib/workspace/card-taxonomy.ts`
  - `parseResearchToCards(section: SectionKey, data: Record<string, unknown>): CardState[]`
    - Takes research result JSON and converts to array of CardState objects
    - One function per section: `parseIndustryMarket()`, `parseCompetitorIntel()`, etc.
    - All cards start with `status: 'draft'`, `versions: []`
  - `resetCardIdCounter()` — idempotent counter for card IDs (used in SSR page.tsx)

### Workspace State Management (React Context)
- **File**: `src/lib/workspace/use-workspace.ts` & `src/components/workspace/workspace-provider.tsx`
  - Hook: `useWorkspace()` — returns `WorkspaceActions` from context
  - Provider: `WorkspaceProvider` — wraps children with WorkspaceContext
  - **Key Actions**:
    - `setState(section, phase, error?)` — changes section state
    - `setCards(section, cards)` — bulk set cards for a section
    - `updateCard(cardId, content, editedBy)` — user/AI edit with version history
    - `approveCard(cardId)` — mark individual card as approved
    - `approveSection()` → **returns next SectionKey or null**
      - Marks all cards in current section as 'approved'
      - Sets next section phase (researching or review if cards exist)
      - Moves currentSection forward
    - `navigateToSection(section)` — guard: can't navigate to 'queued' sections
    - `restoreCardVersion(cardId, versionIndex)` — revert to prior version

### UI Components
- **File**: `src/components/workspace/artifact-canvas.tsx`
  - Displays current section's cards
  - Shows states: queued (dots), researching/streaming (activity log), error (retry), review (cards), approved (cards)
  - `approveSection()` button shown only when `isReviewable && sectionCards.length > 0`
  - Check: `allApproved = RESEARCH_SECTIONS.every(key => sectionStates[key] === 'approved')`
    - Note: checks RESEARCH_SECTIONS (excludes mediaPlan), not SECTION_PIPELINE
  - When `allApproved`, shows `ArtifactFooter variant="complete"` (disabled button: "Generate Media Plan")

- **File**: `src/components/workspace/workspace-page.tsx`
  - Orchestrates three sub-bridges:
    - `WorkspaceResearchBridge` — listens to realtime research results, calls `setCards()` and `setSectionPhase()`
    - `WorkspaceApprovalBridge` — fires `onSectionApproved(section)` callback when section state changes to 'approved'
    - `WorkspaceNavBar` — renders `SectionTabs` with `navigateToSection()`

- **File**: `src/components/workspace/artifact-footer.tsx`
  - `variant="approve"` → shows "Looks good →" button (calls `approveSection()`)
  - `variant="complete"` → shows disabled button "Generate Media Plan →" (never clickable)

### Research Document (Read-Only View)
- **File**: `src/app/research/[sessionId]/page.tsx` (SSR, server component)
  - Fetches `journey_sessions` from Supabase
  - Reads `research_results` JSONB column
  - Parses each completed section's data to cards via `parseResearchToCards()`
  - Groups cards by section
  - Renders `ResearchDocument` component

- **File**: `src/components/research/research-document.tsx`
  - Read-only document view
  - Shows back button + section tabs
  - Renders `CardRenderer` for each card (mode="document")

### Supabase Integration
- **File**: `src/lib/actions/journey-sessions.ts`
  - `getCompletedJourneySessions()` — lists all sessions with `research_results` populated
  - Extracts `completedSections` from `research_results[key].status === 'complete'`

- **File**: `src/lib/journey/session-state.server.ts` (in prior memory)
  - `persistJourneyState()` writes `research_results` JSONB to `journey_sessions`

### Local Storage
- **File**: `src/lib/workspace/storage.ts`
  - `loadWorkspaceState(sessionId)` → reads from localStorage[WORKSPACE_STATE]
  - `saveWorkspaceState(state)` → writes to localStorage (auto-saved via useEffect)
  - Includes guard: `state.sessionId !== sessionId` returns null (wrong session)

---

## "Looks Good" Approval Flow

1. **User clicks "Looks good" button** in ArtifactFooter (artifact-canvas.tsx:171)
2. **Handler calls `approveSection()`** (from useWorkspace hook)
3. **In approveSection()** (workspace-provider.tsx:113–150):
   - Marks all cards in `currentSection` as `status: 'approved'`
   - Sets section state to `'approved'`
   - Calculates next section via `getNextSection()`
   - If next exists:
     - Checks if cards already exist for next section
     - Sets next section phase to 'review' (if cards exist) or 'researching' (if empty)
     - Sets `currentSection` to next
   - Returns next SectionKey
4. **State updates trigger:**
   - localStorage save (saveWorkspaceState)
   - WorkspaceApprovalBridge fires `onSectionApproved(section)` callback (workspace-page.tsx:79–95)
5. **Component re-renders:**
   - SectionTabs update (next section now clickable)
   - ArtifactCanvas shows next section or "Research Complete" message
   - ArtifactFooter switches: shows new section's "Looks good" or disabled "Generate Media Plan"

---

## "All Sections Approved" Detection

Check at artifact-canvas.tsx:36–39:
```typescript
const allApproved = useMemo(
  () => RESEARCH_SECTIONS.every((key) => state.sectionStates[key] === 'approved'),
  [state.sectionStates],
);
```

**Important**: Uses `RESEARCH_SECTIONS` (6 sections), NOT `SECTION_PIPELINE` (7 sections).
- This excludes `mediaPlan` from the "all approved" check.
- When all 6 research sections are approved, the footer shows "Generate Media Plan →" (disabled).

---

## Compile & Save Document Flow (To Be Implemented)

**Current behavior**: No document save/export exists yet.

**Needed for "Save approved document to Supabase"**:
1. Collect all approved cards from `state.cards` where `status === 'approved'`
2. Group by `sectionKey`
3. Serialize to a document structure (e.g., JSON, Markdown, or structured format)
4. Call Supabase action to save to `journey_sessions` or new `documents` table
5. Optionally: upload to S3 for PDF/export

**Data available**:
- `state.cards` — all CardState objects with full content
- `state.sectionStates` — verify each section is 'approved'
- `sessionId` — link to journey_sessions
- Card versions — history available if needed

---

## Key Patterns

| Pattern | File | Notes |
|---------|------|-------|
| Research → Cards | workspace-page.tsx + card-taxonomy.ts | `WorkspaceResearchBridge` calls `parseResearchToCards()` on each result |
| Approval → Navigation | workspace-provider.tsx | `approveSection()` moves forward or completes |
| State Persistence | workspace-provider.tsx + storage.ts | localStorage auto-saves on every state change |
| SSR Document View | app/research/[sessionId]/page.tsx | Reads Supabase, no React state needed |
| Realtime Streaming | workspace-page.tsx | `useResearchRealtime()` hook polls/subscribes to results |

---

## Gotchas & Edge Cases

1. **RESEARCH_SECTIONS vs SECTION_PIPELINE**: First is displayed tabs (6), second is execution order (7, includes mediaPlan at end).

2. **MediaPlan not in research approval check**: "All approved" = 6 research sections, not mediaPlan. MediaPlan is handled separately (7th phase).

3. **Card counter is global**: `resetCardIdCounter()` must be called before parsing to ensure unique IDs. SSR page.tsx does this.

4. **Can't navigate to 'queued' sections**: UI guard prevents clicking tabs for sections not yet researched.

5. **Next section phase heuristic**: If next section already has cards (pre-fetched while user reviews), it skips 'researching' and goes straight to 'review'. This can happen with parallel research.

6. **localStorage keyed by sessionId**: Prevents stale state when switching between sessions.

7. **Versions array capped at 5**: `[snapshot, ...versions].slice(0, 5)` keeps only latest 5 snapshots per card.

