# Fathom Sales Call Intelligence — Design Spec

**Date:** 2026-04-10
**Branch:** `redesign/v2-command-center`
**Status:** Approved — ready for implementation

## Overview

Add a "Sales Call Intelligence" feature to the AIGOS journey flow. Users paste Fathom meeting links after the document upload step. The system fetches the transcript, extracts structured insights via Claude, and injects those insights as ground-truth context into every research runner.

## Goals

1. Accept multiple Fathom meeting links per journey session
2. Fetch transcripts and metadata via the Fathom API (`https://api.fathom.ai/external/v1`)
3. Extract structured insights (pain points, budget signals, competitor mentions, etc.) with mandatory source quotes — no fabrication
4. Display extracted insights in a dedicated panel before research runs
5. Inject sales call context into all downstream research runners as highest-priority signal
6. Store raw transcript + structured insights using the existing `business_profile_documents` pattern

## Architecture: Hybrid (Frontend Fetch, Worker Extract)

### Phase 1 — Fast Fetch (Next.js API route, ~2-4s)

```
User pastes Fathom link
  → POST /api/fathom/fetch { shareUrl, runId }
  → Resolve share URL → recording_id via GET /meetings pagination
  → GET /recordings/{recording_id}/transcript
  → Format transcript as speaker-labeled markdown
  → Write to business_profile_documents (parsed_markdown, doc_kind='sales_call_transcript')
  → Append to journey_sessions.fathom_calls
  → Return metadata + dispatch extraction to worker
```

### Phase 2 — Deep Extraction (Railway worker, ~10-20s)

```
Worker receives { tool: 'extractFathomCall', context: transcript, documentId }
  → Claude generateObject() with SalesCallInsights schema
  → Write extracted_fields back to business_profile_documents
  → Update journey_sessions.fathom_calls[].status = 'ready'
  → Realtime subscription pushes update to frontend
```

## Data Model

### New column: `journey_sessions.fathom_calls`

```sql
ALTER TABLE journey_sessions
ADD COLUMN IF NOT EXISTS fathom_calls JSONB DEFAULT '[]'::jsonb;
```

TypeScript type:

```typescript
interface FathomCallMeta {
  recordingId: number
  shareUrl: string
  title: string
  date: string                    // scheduled_start_time ISO
  durationSeconds: number         // derived from start/end
  attendees: Array<{
    name: string | null
    email: string | null
    isExternal: boolean
  }>
  summary: string | null          // default_summary.markdown_formatted
  actionItems: Array<{
    description: string
    assignee?: string
    completed: boolean
  }>
  documentId: string              // FK to business_profile_documents.id
  status: 'fetching' | 'extracting' | 'ready' | 'error'
  error?: string
}
```

### Reuse: `business_profile_documents`

No schema changes. Fields used:

| Field | Value |
|-------|-------|
| `doc_kind` | `'sales_call_transcript'` |
| `parsed_markdown` | Speaker-labeled transcript: `**Alice** (00:05:32): Let's revisit...` |
| `extracted_fields` | `SalesCallInsights` JSON (populated by worker) |
| `section_tags` | `['industryMarket', 'icpValidation', 'competitors', 'offerAnalysis', 'crossAnalysis']` |
| `file_name` | `"Fathom: {title} — {date}"` |
| `mime_type` | `'application/json'` |
| `token_count` | Estimated from transcript length |

### Environment variable

```
FATHOM_API_KEY=    # Platform-level key, added to .env.local and Railway worker env
```

## Extraction Schema

```typescript
interface SalesCallInsights {
  businessHealthSummary: string

  callType: 'discovery' | 'demo' | 'follow_up' | 'closing' | 'other'

  painPoints: Array<{
    pain: string
    severity: 'critical' | 'moderate' | 'minor'
    quote?: string
  }>

  budgetSignals: {
    mentionedSpend?: string
    willingnessToPay?: string
    priceSensitivity: 'low' | 'medium' | 'high'
    quotes: string[]
  }

  competitorMentions: Array<{
    name: string
    sentiment: 'positive' | 'negative' | 'neutral'
    context: string
    quote?: string
  }>

  buyingTriggers: Array<{
    trigger: string
    urgency: 'immediate' | 'near_term' | 'exploratory'
    quote?: string
  }>

  objections: Array<{
    objection: string
    resolution?: string
    quote?: string
  }>

  icpSignals: {
    companySize?: string
    role?: string
    industry?: string
    decisionProcess?: string
    decisionTimeline?: string
  }

  currentMarketing: {
    channels: string[]
    whatWorks?: string
    whatFails?: string
    monthlySpend?: string
    quotes: string[]
  }

  goalsAndOutcomes: {
    primaryGoal?: string
    successMetrics?: string
    desiredTransformation?: string
    quotes: string[]
  }

  notableQuotes: Array<{
    quote: string
    context: string
    relevance: string
  }>
}
```

## Fathom API Integration

### Authentication

Header: `X-Api-Key: {FATHOM_API_KEY}`

### Share Link Resolution

No direct "resolve share URL" endpoint exists. Strategy:

```typescript
async function resolveShareUrl(shareUrl: string): Promise<FathomMeeting> {
  const shareId = new URL(shareUrl).pathname.split('/').pop()
  // Search recent meetings first (90 days), expand if not found
  let cursor: string | null = null
  const createdAfter = new Date(Date.now() - 90 * 86400000).toISOString()
  do {
    const res = await fathomGet('/meetings', { cursor, limit: 50, created_after: createdAfter })
    const match = res.items.find(m => m.share_url === shareUrl || m.share_url.includes(shareId))
    if (match) return match
    cursor = res.next_cursor
  } while (cursor)
  throw new FathomResolutionError('Meeting not found')
}
```

### Transcript Fetch

```
GET /recordings/{recording_id}/transcript
→ { transcript: [{ speaker: { display_name, matched_calendar_invitee_email }, text, timestamp }] }
```

### Rate Limit

60 calls/min across all keys. Retry with backoff on 429.

## API Routes

### `POST /api/fathom/fetch`

```typescript
// Input
{ shareUrl: string, runId: string }

// Output
{ documentId: string, recordingId: number, title: string, attendees: Attendee[],
  summary: string | null, actionItems: ActionItem[], status: 'extracting' }

// Steps
1. Auth check (Clerk)
2. Validate shareUrl format (fathom.video/share/*)
3. Resolve share URL → meeting object
4. Fetch transcript via recording_id
5. Format transcript as markdown
6. Write to business_profile_documents
7. Append to journey_sessions.fathom_calls
8. Dispatch extraction to worker (fire-and-forget)
9. Return metadata
```

### Worker Runner: `research-worker/src/runners/fathom-extract.ts`

```typescript
// Input (via /run endpoint)
{ tool: 'extractFathomCall', context: string, userId: string,
  jobId: string, runId: string, documentId: string }

// Steps
1. Write job_status: 'running'
2. Build extraction prompt with SalesCallInsights schema
3. Claude generateObject() — model: claude-haiku-4-5 (sonnet fallback for >50K tokens)
4. Progress updates via job_status
5. Write extracted_fields to business_profile_documents WHERE id = documentId
6. Update journey_sessions.fathom_calls[].status = 'ready'
7. Write job_status: 'complete'
```

## Runner Integration

### Context Injection

The dispatch route (`src/app/api/journey/dispatch/route.ts`) already fetches `business_profile_documents` by `section_tags`. Fathom transcripts tagged with all sections flow in automatically via the 25K token budget.

Additionally, a structured "Sales Call Intelligence" block is prepended to runner context when `fathom_calls` exist:

```
══ SALES CALL INTELLIGENCE ══
Source: {title} ({date}, {duration}min)
Attendees: {names}

Business Health: {businessHealthSummary}

Pain Points:
- {pain} (severity: {severity}) — "{quote}"

Budget: {mentionedSpend}, sensitivity: {priceSensitivity}

Competitors Mentioned: {name} ({sentiment}): {context}

Buying Triggers: {trigger} (urgency: {urgency})

Current Marketing: {channels}, spending {monthlySpend}

Goals: {primaryGoal}, success = {successMetrics}
══ END SALES CALL INTELLIGENCE ══
```

### Runner Prompt Addition

Conditional block added to each runner's system prompt when sales call data exists:

```
If "SALES CALL INTELLIGENCE" blocks appear in the context, these contain
verified first-party data from actual client conversations. You MUST:
1. Prioritize sales call data over web-scraped or inferred data
2. When sales call data contradicts web research, note the discrepancy
   and prefer the sales call version
3. Cite sales call quotes using format: [Sales Call: "exact quote"]
4. Use pain points from calls to inform channel/targeting recommendations
5. Use budget signals from calls to ground media spend recommendations
6. Use competitor mentions from calls to focus competitive analysis
```

### Extraction System Prompt

```
You are a sales intelligence analyst extracting actionable insights from a
sales call transcript for a paid media strategy team.

RULES:
- Only extract what is EXPLICITLY stated in the transcript. Never infer or fabricate.
- Every insight MUST include the source quote from the transcript.
- If a category has no relevant data, return an empty array — do NOT fill with guesses.
- Speaker attribution matters: note WHO said what (prospect vs salesperson).
- Budget figures must be exact quotes, not rounded or estimated.
- Competitor mentions must use the exact name the prospect used.

CONTEXT: This data feeds into an AI research pipeline that produces paid media
strategies. The sales call insights are treated as GROUND TRUTH. Accuracy is
critical because fabricated insights will contaminate downstream recommendations.
```

## Frontend: Sales Call Intelligence Panel

### Placement

Dedicated step in the journey stepper, between "Review Fields" and "Start Research".

### Layout (Option B — Full Panel)

- Header with Fathom branding, description, and link input + "Add Call" button
- Each call renders as an expandable card showing:
  - Title, date, duration, attendees, status badge
  - 2x2 grid of insight categories (pain points, budget, competitors, buying signals)
  - Business health summary block
  - Notable quotes section
- Multiple calls stack vertically, ordered by date

### Processing States

| State | UI |
|-------|-----|
| `fetching` | Spinner + "Loading call from Fathom..." (~2-4s) |
| `extracting` | Transcript loaded, shows Fathom summary + action items. Progress bar for extraction (~10-20s) |
| `ready` | Full insight grid visible. Green "Ready" badge |
| `error` | Error message with specific guidance (link not found, API key invalid, still processing) |

### Component Structure

```
src/components/journey/
  sales-call-panel.tsx          — main panel component
  sales-call-card.tsx           — individual call card with insights
  sales-call-input.tsx          — link input + validation
  sales-call-insight-grid.tsx   — 2x2 categorized insights view
```

### Realtime Updates

Uses existing `useResearchRealtime` pattern — subscribes to `journey_sessions` changes, watches `fathom_calls` array for status transitions.

## Supabase Migration

```sql
-- Migration: add fathom_calls column
ALTER TABLE journey_sessions
ADD COLUMN IF NOT EXISTS fathom_calls JSONB DEFAULT '[]'::jsonb;

-- Atomic merge function for fathom call updates
CREATE OR REPLACE FUNCTION merge_journey_session_fathom_call(
  p_user_id TEXT,
  p_run_id TEXT,
  p_recording_id INTEGER,
  p_call_data JSONB
) RETURNS VOID AS $$
DECLARE
  v_existing JSONB;
  v_idx INTEGER;
BEGIN
  SELECT fathom_calls INTO v_existing
  FROM journey_sessions
  WHERE user_id = p_user_id
  AND (metadata->>'activeJourneyRunId') = p_run_id;

  -- Find existing call index
  SELECT i INTO v_idx
  FROM jsonb_array_elements(COALESCE(v_existing, '[]'::jsonb)) WITH ORDINALITY AS t(elem, i)
  WHERE (elem->>'recordingId')::integer = p_recording_id;

  IF v_idx IS NOT NULL THEN
    -- Update existing call
    UPDATE journey_sessions
    SET fathom_calls = jsonb_set(fathom_calls, ARRAY[(v_idx - 1)::text], p_call_data),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND (metadata->>'activeJourneyRunId') = p_run_id;
  ELSE
    -- Append new call
    UPDATE journey_sessions
    SET fathom_calls = COALESCE(fathom_calls, '[]'::jsonb) || jsonb_build_array(p_call_data),
        updated_at = NOW()
    WHERE user_id = p_user_id
    AND (metadata->>'activeJourneyRunId') = p_run_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid URL format | Client-side validation rejects before API call |
| Meeting not found | "We couldn't find this meeting. Make sure the link is shared and your Fathom account has access." |
| Fathom API 401 | "Fathom API key is invalid or expired." (admin-level error) |
| Fathom API 429 | Retry with exponential backoff (60 calls/min limit) |
| Transcript still processing | "This call is still being processed by Fathom. Try again in a few minutes." |
| Extraction fails | Raw transcript persists. "Loaded transcript but couldn't extract structured insights. Full transcript will still be used in research." |
| Duplicate link | Detect by recording_id, show "This call is already linked" |

## Testing Strategy

| Layer | Scope |
|-------|-------|
| **Unit** | Share URL parsing, transcript → markdown formatting, extraction schema Zod validation, context block formatting |
| **Integration** | Fathom API mock → fetch route → document creation, worker extraction → extracted_fields write, dispatch context injection with sales call data |
| **E2E** | Paste link → call card appears → insights populate → start research → verify runner output references sales call data |

### Mock Data

```typescript
const MOCK_MEETING = {
  recording_id: 12345,
  title: "Discovery Call — Acme Corp",
  share_url: "https://fathom.video/share/abc123",
  scheduled_start_time: "2026-04-03T14:00:00Z",
  scheduled_end_time: "2026-04-03T14:42:00Z",
  calendar_invitees: [
    { name: "Alice", email: "alice@acme.com", is_external: true }
  ],
  default_summary: { markdown_formatted: "Discussion about paid media strategy..." },
  action_items: [
    { description: "Send proposal by Friday", assignee: { name: "Bob" }, completed: false }
  ]
}

const MOCK_TRANSCRIPT = {
  transcript: [
    { speaker: { display_name: "Alice" }, text: "We're spending about 15K a month on Google.", timestamp: "00:05:32" },
    { speaker: { display_name: "Bob" }, text: "What's your biggest challenge?", timestamp: "00:05:38" },
    { speaker: { display_name: "Alice" }, text: "We can't track ROAS across channels.", timestamp: "00:05:45" }
  ]
}
```

## Files to Create/Modify

### New Files
- `src/app/api/fathom/fetch/route.ts` — fetch API route
- `src/lib/fathom/client.ts` — Fathom API client (auth, pagination, share URL resolution)
- `src/lib/fathom/types.ts` — TypeScript types for Fathom API responses + SalesCallInsights
- `src/lib/fathom/transcript-formatter.ts` — raw transcript → markdown
- `src/lib/fathom/context-block.ts` — structured insights → runner context block
- `src/lib/fathom/schemas.ts` — Zod schemas for extraction + API validation
- `src/components/journey/sales-call-panel.tsx` — main panel
- `src/components/journey/sales-call-card.tsx` — individual call card
- `src/components/journey/sales-call-input.tsx` — link input
- `src/components/journey/sales-call-insight-grid.tsx` — insight categories grid
- `research-worker/src/runners/fathom-extract.ts` — extraction runner
- `supabase/migrations/YYYYMMDD_add_fathom_calls.sql` — migration

### Modified Files
- `src/app/api/journey/dispatch/route.ts` — inject Sales Call Intelligence block
- `src/app/journey/page.tsx` — add sales call panel step
- `research-worker/src/index.ts` — register `extractFathomCall` tool
- `research-worker/src/runners/index.ts` — export new runner
- Each runner system prompt — conditional sales call priority block
- `.env.example` — add `FATHOM_API_KEY`
