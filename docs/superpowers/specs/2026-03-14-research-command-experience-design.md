# Research Command Experience — Sprint Spec

## Problem

The research generation experience is lifeless. When AIGOS runs the 6 research sections, users see:
- A dead "Researching..." text
- No indication of what the agent is actually doing
- No streaming activity
- Competitor Intel returns empty with a clickable "Looks good" (fixed in quick wins)
- No way to save/export the completed research as a document

Compare to Manus: shows live terminal output, step-by-step progress, tool usage, and makes the AI feel alive and competent.

## Goals

1. **Give the research generation life** — animated activity feed showing what the agent is doing in real-time
2. **Research document compilation** — save all 6 sections as one viewable document after "Looks good" on all
3. **Blueprints section in sidebar** — navigate to saved research documents
4. **Fix competitor data pipeline** — empty results need investigation
5. **Smooth animations throughout** — butter-smooth transitions between states

## Design

### 1. Research Activity Feed (Manus-style)

**During each section's researching/streaming phase**, replace the current skeleton with a **live activity log**:

```
┌─────────────────────────────────────────┐
│  ● Running research — Competitor Intel  │  ← Status badge
│                                         │
│  02 · COMPETITOR INTEL                  │  ← Section header
│                                         │
│  ┌─ Activity ──────────────────────┐    │
│  │ ▸ Querying Perplexity Sonar Pro │    │  ← Typing in char by char
│  │ ▸ Found 4 competitor domains    │    │
│  │ ▸ Scraping competitor pricing   │    │  ← Each line fades in
│  │ ▸ Analyzing keyword gaps...     │    │  ← Pulsing dots on active
│  │ ▸ ── partial result ──         │    │
│  │ ┌ Competitor Card ─────────┐   │    │  ← Rich card materializes
│  │ │ Acme Corp — $99/mo      │   │    │
│  │ │ Direct competitor        │   │    │
│  │ └─────────────────────────┘   │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌─ Skeleton cards (more coming) ─┐    │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░  │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Implementation**:
- New SSE event types from Railway worker: `step-progress` with message text
- Each runner emits progress messages: "Querying Perplexity...", "Found N results...", "Analyzing..."
- New `ResearchActivityLog` component that receives these messages
- Messages type in with a small delay (50ms per char) for terminal effect
- Partial result cards fade in between log lines
- The whole feed auto-scrolls

**Worker changes** (each of the 6 runners):
- Add `onProgress(message: string)` callback
- Emit at key milestones: query start, results count, analysis start, completion
- Write progress to Supabase `job_status` JSONB so frontend can poll via realtime

### 2. Research Document Compilation

When all 6 sections are approved ("Looks good"), compile them into a single research document:

- **Trigger**: All 6 sections reach `approved` state
- **Action**: Aggregate all section cards into a single structured document
- **Storage**: Save to Supabase `journey_sessions.research_document` JSONB
- **View**: New route `/research/[sessionId]` showing the compiled document
- **Format**: Section-by-section with cards, stats, narratives rendered as a scrollable report

### 3. Blueprints/Research in Sidebar

Add a 4th nav item to the sidebar:

```
🏠 Home       → /dashboard
🧭 Journey    → /journey
📄 Research   → /dashboard?tab=research  (or /research)
⚙️ Settings   → /settings
```

This links to a list of saved research sessions. Each entry shows:
- Company name
- Date
- Section completion status (6/6)
- Click to view the compiled document

### 4. Competitor Data Pipeline Fix

Investigate why Competitor Intel returns 0 cards:
- Check if the Railway worker's competitor runner is failing silently
- Check if `parseResearchToCards('competitors', data)` is parsing correctly
- Check Supabase `research_results` for the competitor section data
- May be a schema mismatch between worker output and card taxonomy

### 5. Mascot/Animation (Stretch)

Optional: Small animated mascot (like Claude's thinking animation) that shows during research:
- SVG-based, 2-3 frame animation
- Positioned in the activity feed or loading state
- "Working on it" personality without being cheesy
- Can be deferred to a later sprint

## Files to Modify

| File | Change |
|------|--------|
| `research-worker/src/runners/*.ts` | Add `onProgress` callbacks to each runner |
| `research-worker/src/index.ts` | Wire progress messages to Supabase writes |
| `src/lib/journey/research-realtime.ts` | Subscribe to progress events |
| `src/components/workspace/artifact-canvas.tsx` | Render activity feed during loading |
| `src/components/workspace/research-activity-log.tsx` | **NEW** — activity feed component |
| `src/components/shell/app-sidebar.tsx` | Add Research nav item |
| `src/app/research/[sessionId]/page.tsx` | Research document view page |
| `src/lib/workspace/card-taxonomy.ts` | Debug competitor card parsing |

## Effort Estimate

| Task | Effort |
|------|--------|
| Activity feed component (frontend) | 1 session |
| Worker progress events (backend) | 1 session |
| Research document compilation + view | 1 session |
| Sidebar + navigation wiring | Quick (already partially done) |
| Competitor pipeline debug | 1 session |
| Mascot animation | Stretch — defer |

**Total**: ~4 focused sessions

## What Was Already Shipped (Quick Wins)

- [x] Animated loading state with pulsing orb + skeleton cards
- [x] "Looks good" hidden on empty sections
- [x] 6 sections in tabs (Media Plan removed)
- [x] Improved error/queued states with design system
