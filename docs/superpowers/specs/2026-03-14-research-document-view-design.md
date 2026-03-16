# Research Document View + Section Navigation

**Date:** 2026-03-14
**Status:** Draft
**Branch:** `redesign/v2-command-center`

## Summary

Two features that complete the research workspace experience:

1. **Section Tabs** — clickable pill navigation in the workspace `StatusStrip` area, allowing users to navigate between approved/active sections during research generation
2. **Research Document View** — a read-only page at `/research/[sessionId]` that renders saved research using the same card components, accessible from the dashboard

## Feature 1: Section Tabs in Workspace

### What Changes

Replace the current `StatusStrip` with a `SectionTabs` component that renders all 6 sections as clickable pills with status indicators.

### Tab States

| State | Visual | Clickable |
|-------|--------|-----------|
| `approved` | Green border/bg, checkmark icon | Yes — navigates to section, cards editable |
| `review` (current) | Blue border/bg, pulse dot, bold label | Yes (already viewing) |
| `researching` | Blue border/bg, pulse dot | Yes — navigates, shows "Researching..." loading |
| `streaming` | Blue border/bg, pulse dot (same visual as `researching`) | Yes — navigates, shows "Researching..." loading |
| `queued` | Grey border, muted text | No (`cursor-not-allowed`) |
| `error` | Red border, error icon | Yes — shows error + retry |

Note: `streaming` and `researching` are visually identical in the tab. Both show a blue pulse dot. The distinction only matters inside `ArtifactCanvas` for card rendering logic.

### Navigation Behavior

- `navigateToSection(section: SectionKey)` added to `WorkspaceActions` — only sets `currentSection`, does NOT change `sectionStates`. Guard: rejects if `sectionStates[section] === 'queued'`.
- Clicking an approved tab sets `currentSection` to that section. The section's phase stays `approved` in `sectionStates`. `ArtifactCanvas` adds a new rendering path: when `phase === 'approved'`, render cards with edit capability (same as `review`) but no "Looks good →" footer.
- Clicking back to the section currently in `review` phase restores the footer. The canvas checks: `sectionStates[currentSection] === 'review'` to show the footer.
- Progress counter on the right: `{approvedCount} / 6` (simple count — approved sections only, no fractional progress for in-review sections; this is a deliberate simplification from the old StatusStrip which used `0.5` increments).

### When All 6 Approved

- All tabs green with checkmarks
- Last approved section stays selected, cards visible
- Footer changes: "Research Complete" label + "Generate Media Plan →" CTA button (disabled/placeholder for now — future feature)
- No empty "All sections reviewed" placeholder — user sees actual cards

### Components

**New:** `src/components/workspace/section-tabs.tsx`
- Shared component used in both workspace and document view
- Props: `sections`, `currentSection`, `sectionStates`, `onNavigate`, `mode: 'workspace' | 'document'`
- Workspace mode: shows status indicators (pulse, checkmark, queued)
- Document mode: all sections clickable, active tab highlighted (blue), no status indicators

**Modified:** `src/components/workspace/workspace-page.tsx`
- Replace `<StatusStrip />` with `<SectionTabs mode="workspace" />`

**Modified:** `src/components/workspace/workspace-provider.tsx`
- Add `navigateToSection(section: SectionKey)` action
- Guard: only navigate to sections where `sectionStates[section] !== 'queued'`

**Modified:** `src/components/workspace/artifact-canvas.tsx`
- Add rendering path for `phase === 'approved'`: show section's cards with `ArtifactCard` wrapper (edit/versions enabled) but no footer
- Keep existing `phase === 'review'` path with "Looks good →" footer
- When `allApproved`: show current section's cards (not empty placeholder) + completion footer
- Extract `CardContent` switch statement into `card-renderer.tsx`, import `CardContentSwitch` back

**Modified:** `src/components/workspace/artifact-footer.tsx`
- Add `variant` prop: `'approve' | 'complete'`
- `approve` variant (default): current "Looks good →" button
- `complete` variant: "Research Complete" label on left + disabled "Generate Media Plan →" CTA on right (placeholder for future feature)

**Removed:** `src/components/workspace/status-strip.tsx` — fully replaced by `SectionTabs`

## Feature 2: Research Document View

### Route

`/research/[sessionId]/page.tsx` — server component that fetches research data from Supabase and renders a read-only document.

### Data Flow

The `research_results` JSONB column in `journey_sessions` is structured as:
```typescript
{
  industryMarket: { status: 'complete', data: { categorySnapshot: {...}, painPoints: {...}, ... }, durationMs: 2500 },
  competitors: { status: 'complete', data: { competitors: [...], ... }, durationMs: 3100 },
  // ... one key per SectionKey
}
```

The server component iterates over `SECTION_PIPELINE` and calls `parseResearchToCards(sectionKey, sectionResult.data)` per section:

```
Server Component (page.tsx)
  → Fetch journey_sessions row by sessionId (Supabase, service role)
  → Extract research_results JSONB
  → For each section in SECTION_PIPELINE:
      → If research_results[section]?.status === 'complete':
          → parseResearchToCards(section, research_results[section].data)
          → Collect into cardsBySection: Record<SectionKey, CardState[]>
  → Pass cardsBySection + available sections list to client component
```

### Page Layout

```
┌─────────────────────────────────────────────┐
│ ← Back  │ [Tab] [Tab] [Tab] [Tab] [Tab] [Tab] │  ← SectionTabs mode="document"
├─────────────────────────────────────────────┤
│                                             │
│           max-width: 800px centered         │
│                                             │
│           Module 01                         │
│           Market Overview                   │
│                                             │
│           ┌─ StatGrid card ──────────┐      │
│           │                          │      │
│           └──────────────────────────┘      │
│           ┌─ BulletList card ────────┐      │
│           │                          │      │
│           └──────────────────────────┘      │
│           ┌─ ProseCard ─────────────┐       │
│           │                          │      │
│           └──────────────────────────┘      │
│                                             │
└─────────────────────────────────────────────┘
```

- **No right rail** — full-width layout, content centered at `max-width: 800px`
- **No chat, no editing, no approval buttons** — pure read-only
- **← Back** button navigates to `/dashboard`
- **Sticky SectionTabs** at top for navigation between sections
- Uses same card components (`StatGrid`, `BulletList`, `CompetitorCard`, etc.) rendered via `CardRenderer mode="document"` which strips edit/approve/version controls

### Components

**New:** `src/components/research/research-document.tsx`
- Client component receiving pre-parsed cards grouped by section
- Manages `currentSection` state locally (no WorkspaceProvider needed)
- Renders `SectionTabs mode="document"` + `SectionHeader` + card list

**New:** `src/components/research/card-renderer.tsx`
- Contains `CardContentSwitch` — the card type switch statement extracted from `ArtifactCanvas`'s `CardContent`
- Also exports `CardRenderer` wrapper component
- Props: `card: CardState`, `mode: 'workspace' | 'document'`, `index?: number`
- `workspace` mode: wraps `CardContentSwitch` in `ArtifactCard` (provides `CardEditingContext` via `CardEditingContext.Provider`, enabling edit/approve/versions)
- `document` mode: wraps `CardContentSwitch` in a static `CardEditingContext.Provider` with `{ isEditing: false, draftContent: card.content, updateDraft: () => {} }` — this ensures all card components (including `keyword-grid` which calls `useCardEditing()`) receive context without errors. No `ArtifactCard` wrapper, no edit/approve buttons — just the clean card container with label + content.

**New:** `src/app/research/[sessionId]/page.tsx`
- Server component — fetches `journey_sessions` row via Supabase service role client
- Validates session belongs to authenticated user (Clerk `auth()`)
- Parses `research_results` into cards using `parseResearchToCards`
- Returns `<ResearchDocument>` with pre-parsed data

**New:** `src/app/research/[sessionId]/not-found.tsx`
- Simple not-found page for invalid session IDs

**Modified:** `src/components/workspace/artifact-canvas.tsx`
- Extract `CardContent` switch statement into `card-renderer.tsx`
- Import and use `CardRenderer mode="workspace"` in its place

### Supabase Query

```sql
SELECT id, research_results, created_at, collected_fields
FROM journey_sessions
WHERE id = $1 AND user_id = $2
```

No new tables or migrations needed — `research_results` JSONB already contains all section data written by the Railway worker.

### Dashboard Integration

**New:** `src/lib/actions/journey-sessions.ts`
- Server action `getCompletedJourneySessions()` — no args, uses `auth()` internally to get userId (matches pattern of sibling actions `getUserBlueprints()` and `getUserMediaPlans()`)
- Query: `SELECT id, created_at, collected_fields, research_results FROM journey_sessions WHERE user_id = $userId AND research_results IS NOT NULL ORDER BY created_at DESC`
- Returns `JourneySessionRecord[]`:
  ```typescript
  interface JourneySessionRecord {
    id: string;
    title: string;        // derived: collected_fields.companyName ?? collected_fields.url ?? 'Untitled Research'
    created_at: string;
    completedSections: SectionKey[]; // derived: sections where research_results[key].status === 'complete'
  }
  ```
- Derives `title` and `completedSections` from raw data before returning — dashboard doesn't parse JSONB. The `title` field ensures sort compatibility with the existing `sortItems<T extends { title: string; created_at: string }>` helper in `document-tabs.tsx`.

**New:** `src/app/dashboard/_components/research-card.tsx`
- Card component for journey sessions, matching `BlueprintCard` visual pattern
- Shows: company name (or "Untitled Research"), creation date, section count badge (e.g. "6/6 sections"), link to `/research/[id]`
- No delete for now (research sessions are tied to journey state)

**Modified:** `src/app/dashboard/_components/document-tabs.tsx`
- Add `"research"` to `TabValue` union: `"all" | "blueprints" | "media-plans" | "research"`
- Add to `tabs` array: `{ value: "research", label: "Research" }`
- Add `journeySessions: JourneySessionRecord[]` to `DocumentTabsProps`
- Add `DashboardItem` variant: `{ type: "research"; data: JourneySessionRecord }`
- Update `getResultLabel`, `tabCounts`, `currentItems`, and rendering switch to handle `"research"` type → render `<ResearchCard>`
- Add `"research"` to `EmptyState` variant handling (empty state when research tab selected but no sessions exist)

**Modified:** `src/app/dashboard/_components/dashboard-content.tsx`
- Import and call `getCompletedJourneySessions(userId)` alongside existing `getUserBlueprints` and `getUserMediaPlans`
- Pass `journeySessions` prop to `<DocumentTabs>`

## Shared Infrastructure

### SectionTabs Component API

```typescript
interface SectionTabsProps {
  sections: SectionKey[];
  currentSection: SectionKey;
  sectionStates?: Record<SectionKey, SectionPhase>; // workspace mode
  onNavigate: (section: SectionKey) => void;
  mode: 'workspace' | 'document';
}
```

### CardRenderer Component API

```typescript
interface CardRendererProps {
  card: CardState;
  mode: 'workspace' | 'document';
  index?: number; // for stagger animation
}
```

## Styling

All styling uses existing CSS variables and design tokens:
- `--bg-base`, `--bg-hover`, `--bg-raised` for backgrounds
- `--border-subtle`, `--border-default` for borders
- `--accent-blue`, `--accent-green`, `--accent-red` for status colors
- `--text-primary`, `--text-secondary`, `--text-tertiary` for text
- Same border-radius (`--radius-md`), font stacks, spacing

No new design tokens needed.

## Animation

- Tab transitions: `AnimatePresence mode="wait"` on card area when switching sections (same as current workspace behavior)
- Card stagger: same `CARD_STAGGER = 0.05s` and `CARD_DURATION = 0.2s` constants
- Document view uses identical Framer Motion patterns

## Error Handling

- **Missing session:** `/research/[sessionId]` returns `notFound()` if session doesn't exist or doesn't belong to user
- **Partial research:** If only some sections have results, document view shows available sections in tabs, others show "Research not completed for this section"
- **Empty research_results:** Redirect to `/dashboard` with toast

## Testing

- Unit tests for `SectionTabs` — tab state rendering, click handlers, disabled states
- Unit tests for `CardRenderer` — mode switching, all card types render in both modes
- Integration test for `navigateToSection` in workspace provider
- Server component test for `/research/[sessionId]` — auth check, data fetching

## Files Changed Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/workspace/section-tabs.tsx` | New | Shared section tab navigation |
| `src/components/research/card-renderer.tsx` | New | Shared card rendering with mode + CardContentSwitch |
| `src/components/research/research-document.tsx` | New | Document view client component |
| `src/app/research/[sessionId]/page.tsx` | New | Document view server component (default export) |
| `src/app/research/[sessionId]/not-found.tsx` | New | 404 page (default export, no props) |
| `src/lib/actions/journey-sessions.ts` | New | Server action for fetching completed sessions |
| `src/app/dashboard/_components/research-card.tsx` | New | Dashboard card for research sessions |
| `src/components/workspace/workspace-provider.tsx` | Modified | Add `navigateToSection` action |
| `src/components/workspace/workspace-page.tsx` | Modified | Replace StatusStrip with SectionTabs |
| `src/components/workspace/artifact-canvas.tsx` | Modified | Add `approved` rendering path, extract CardContent, completion state |
| `src/components/workspace/artifact-footer.tsx` | Modified | Add `variant` prop (`approve` / `complete`) |
| `src/components/workspace/status-strip.tsx` | Deleted | Replaced by SectionTabs |
| `src/app/dashboard/_components/document-tabs.tsx` | Modified | Add `research` tab + `JourneySessionRecord` handling |
| `src/app/dashboard/_components/dashboard-content.tsx` | Modified | Fetch + pass journey sessions to DocumentTabs |
