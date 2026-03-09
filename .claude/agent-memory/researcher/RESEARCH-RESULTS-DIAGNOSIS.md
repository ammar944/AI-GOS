# Diagnosis: Research Results Not Appearing in Journey UI

## Executive Summary
Research results are flowing correctly through the backend pipeline and persisting to Supabase, but there is a **complete disconnect** between what the backend writes to Supabase and what the frontend actually displays. The frontend is trying to reconstruct research status from tool calls in the chat history rather than reading from Supabase.

---

## The Data Flow Architecture

### Backend → Supabase Pipeline (WORKING ✓)

```
generateResearch tool (line 197-370 in src/lib/ai/tools/generate-research.ts)
  ↓
  1. Emits data-research-status events (line 240-243): { sectionId, status: 'running', startedAt }
  2. Generates section content
  3. Emits data-research-status event: { sectionId, status: 'complete' }
  4. Persists to Supabase (line 268-302):
     - Table: journey_sessions
     - Column: research_results (JSONB)
     - Structure: { [sectionId]: { status, section, data, durationMs } }
```

### Frontend Data Flow (BROKEN ✗)

The frontend receives data at multiple points but only processes parts of it:

```
Stream events (from generateResearch):
  ├─ data-research-chunk (line 282-293 in page.tsx)
  │   └─ Stored in researchStreaming state (running text)
  ├─ data-research-status (line 294-309 in page.tsx)
  │   └─ Stored in researchStreaming state (status updates)
  └─ These are transient, streaming-only updates

Tool output (in messages array):
  └─ generateResearch tool result (lines 482-536 in chat-message.tsx)
     └─ Only available AFTER tool completes
     └─ Only shown in chat history, not in progress panel

Supabase subscription (useResearchRealtime hook):
  ├─ Subscribes to journey_sessions updates (line 122-146)
  ├─ Calls onSectionComplete callback
  └─ But these callbacks are NO-OPS in page.tsx (lines 406-419)!
```

---

## The Critical Problem: Supabase Data Is Ignored

### What useResearchRealtime Does
File: `src/lib/journey/research-realtime.ts` (lines 38-157)

- **Subscribes to Supabase**: Listens for UPDATE events on journey_sessions where user_id matches
- **On initial mount**: Polls Supabase for already-completed sections
- **On every change**: Calls `onSectionComplete(section, result)` with data from the database

### What JourneyPageContent Does With It
File: `src/app/journey/page.tsx` (lines 406-419)

```typescript
useResearchRealtime({
  userId: user?.id,
  sessionId,
  onSectionComplete: (_section: string, _result: ResearchSectionResult) => {
    // Section completion is driven by streamed messages in the current Journey flow.
  },
  onAllSectionsComplete: () => {
    // No-op: the lead agent continues the narrative inside chat.
  },
  onTimeout: () => {
    if (!hasResearchStartedRef.current) return;
    setResearchTimedOut(true);
  },
});
```

**The callbacks are completely ignored.** The underscores (`_section`, `_result`) explicitly signal "not used."

---

## How Research Status Is Actually Determined

### Current Path (Chat Message Analysis)
File: `src/lib/journey/message-analysis.ts` (lines 27-126)

The `analyzeJourneyMessages` function reconstructs research status by:

1. **Looking at tool-generateResearch parts** in the messages array (line 66)
2. **Checking tool part states** (line 42-43):
   - `state = "output-available"` → section status = `"complete"` (line 93)
   - `state = "output-error"` → section status = `"error"` (line 97)
   - Otherwise → `"running"` (line 99)
3. **Fallback to researchStreaming** (line 104-112):
   - Uses the transient streaming state as secondary source
   - Only covers text that arrived during the current session

### What's Missing
- **No reading from Supabase research_results column**
- **No reconstruction of sections from persistent data**
- **No handling of page refresh** where messages array is empty but research is complete in DB

---

## The Evidence: Why "0 of 7" Appears

### ResearchProgress Component
File: `src/components/journey/research-progress.tsx` (lines 29-35)

```typescript
export function ResearchProgress({ sectionStatuses, ... }) {
  const completed = Object.values(sectionStatuses).filter((s) => s === 'complete').length;
  const total = CANONICAL_RESEARCH_SECTION_ORDER.length;  // Always 7
  
  // Display: "{completed} of {total} complete"
}
```

- **Input**: `sectionStatuses` prop from `page.tsx` (line 976)
- **Source of sectionStatuses**: `messageAnalysis.sectionStatuses` (line 431)
- **How it's built**: `analyzeJourneyMessages()` function

If the messages array is fresh or doesn't contain tool results, `sectionStatuses` is empty, showing "0 of 7".

---

## Three Disconnects

### 1. Stream Events Don't Persist Across Page Reloads
- `researchStreaming` state (page.tsx line 126-128) is local memory only
- On page refresh, all transient streaming data is lost
- Backend has already written to Supabase, but frontend doesn't read it

### 2. Tool Results Aren't Created Until Tool Completes
- `generateResearch` tool calls `persistResearchToSupabase` (line 268-302)
- But the tool result is only added to messages AFTER Supabase write completes
- If user refreshes between persist and tool result, they see nothing

### 3. Supabase Subscription Is Silent
- `useResearchRealtime` hook fetches data on mount AND subscribes to changes
- But the journey page doesn't do anything with that data
- The subscription is an orphaned listener that fires but has no effect

---

## Data Flows Diagram

### What SHOULD Happen
```
generateResearch executes
  ├─ Emits data-research-status (running) → researchStreaming updates ✓
  ├─ Streams text → researchStreaming.text accumulates ✓
  ├─ Emits data-research-status (complete) → researchStreaming updates ✓
  ├─ Persists to Supabase:
  │   └─ journey_sessions.research_results[sectionId] = { status, data, ... }
  ├─ Tool completes → tool part added to messages ✓
  ├─ Supabase RLS trigger fires
  ├─ Frontend subscription receives update
  ├─ onSectionComplete callback fires → SHOULD update UI ✗ (NO-OP)
  └─ ResearchProgress re-renders with updated sectionStatuses ✗
```

### What's Actually Happening
```
generateResearch executes
  ├─ Emits data-research-status (running) → researchStreaming updates ✓
  ├─ Streams text → researchStreaming.text accumulates ✓
  ├─ Emits data-research-status (complete) → researchStreaming updates ✓
  ├─ Persists to Supabase (silently successful) ✓
  └─ Tool completes → tool part added to messages ✓
     ├─ analyzeJourneyMessages() scans messages for tool-generateResearch
     ├─ Finds state="output-available" → sectionStatuses[sectionId] = "complete"
     └─ ResearchProgress re-renders ✓

On page refresh:
  ├─ researchStreaming state resets to {} (memory lost)
  ├─ messages array resets to [] (no chat history)
  ├─ useResearchRealtime polls Supabase ✓
  ├─ Gets back complete research results from DB ✓
  ├─ Calls onSectionComplete(...) → NO-OP ✗
  ├─ analyzeJourneyMessages([]) → empty messages → no tool parts
  └─ sectionStatuses = {} → "0 of 7" ✗
```

---

## Critical Files Involved

### Frontend Status Reconstruction
| File | Role | Issue |
|------|------|-------|
| `src/app/journey/page.tsx:406-419` | Hook setup | Callbacks are NO-OPS |
| `src/app/journey/page.tsx:421-428` | Status derivation | Only uses messages + researchStreaming |
| `src/lib/journey/message-analysis.ts` | Status builder | Only looks at tool parts, never reads Supabase |
| `src/components/journey/research-progress.tsx` | Display | Depends on `sectionStatuses` from messages |

### Backend Data Writes (Working Correctly)
| File | Role | Status |
|------|------|--------|
| `src/lib/ai/tools/generate-research.ts:268-302` | Supabase persist | ✓ Writes correctly |
| `src/lib/journey/session-state.server.ts` | Persist function | ✓ Sends to DB |

### Subscription Hook (Set Up But Unused)
| File | Role | Issue |
|------|------|-------|
| `src/lib/journey/research-realtime.ts` | Supabase listener | ✓ Subscribed correctly |
| `src/lib/journey/research-realtime.ts:75-96` | Callback trigger | Callbacks do nothing |

---

## Type Mismatches

### ResearchSectionResult (From Supabase)
`src/lib/journey/research-realtime.ts:7-13`
```typescript
interface ResearchSectionResult {
  status: 'complete' | 'error';
  section: string;
  data?: unknown;
  error?: string;
  durationMs: number;
}
```

### What analyzeJourneyMessages Needs
`src/lib/journey/message-analysis.ts:20-25`
```typescript
interface JourneyMessageAnalysis {
  sectionStatuses: Record<string, 'queued' | 'running' | 'complete' | 'error'>;
  completedResearchOutputCounts: Record<string, number>;
  pendingAskUser: PendingAskUserPrompt | null;
  hasPendingApproval: boolean;
}
```

**The types are compatible**, but the connection between them is missing.

---

## Expected vs. Actual Behavior

### Scenario: User Submits Research Request

**Expected (Per Architecture)**:
1. Agent calls generateResearch → "running" event → UI shows progress
2. Section completes → "complete" event + Supabase persist → UI shows "1 of 7"
3. User sees live progress in research-progress panel while typing
4. Page refreshes → Supabase subscription loads previous sections → UI still shows "1 of 7"

**Actual**:
1. Agent calls generateResearch → "running" event → researchStreaming updates → UI shows progress ✓
2. Section completes → "complete" event + Supabase persist ✓
   - Supabase write succeeds silently ✓
   - Tool result added to messages ✓
   - messageAnalysis finds tool → sectionStatuses updates ✓
   - UI shows "1 of 7" ✓
3. Page refreshes → messages = [] → researchStreaming = {} → sectionStatuses = {} → UI shows "0 of 7" ✗
   - Supabase subscription fires with complete data ✗ (ignored)
   - onSectionComplete callback is NO-OP ✗

---

## Root Cause Summary

The journey page has **two independent systems** for tracking research status:

1. **Streaming + Message Analysis** (works during active chat)
   - Temporary, in-memory only
   - Lost on page refresh
   
2. **Supabase Subscription** (meant for persistence)
   - Properly set up
   - Callbacks are stubbed out (NO-OPS)
   - Never integrated with UI state

**The fix requires connecting system #2 to the UI by implementing the stub callbacks.**

