# Journey Onboarding Bugfix Design

**Date**: 2026-03-08
**Branch**: `aigos-v2`
**Scope**: 5 bugs across the journey onboarding flow

---

## Problem Summary

The journey onboarding flow is broken from a UX perspective:

1. After website analysis + prefill review, the page goes blank and the agent loses context
2. Research sections don't stream progress to the UI
3. Buttons appear unresponsive (consequence of #1)
4. Ask-user card has dual state sources that can diverge
5. Research revision has no loading feedback

## Approach: Two Parallel Tracks

**Track 1 — State & Context** (Bugs 1 + 3): Fix `journeySnap` to incorporate `resumeState` data.
**Track 2 — Streaming & Feedback** (Bugs 2 + 4 + 5): Fix research streaming + UI interaction polish.

Tracks are independent — different files, no overlap. Can be executed with parallel sub-agents.

---

## Track 1: State & Context Fix

### Root Cause

`route.ts:178` derives the agent's state snapshot from message history only:

```typescript
const journeySnap = parseCollectedFields(sanitizedMessages);
```

`parseCollectedFields()` in `journey-state.ts:92-96` only calls `extractAskUserResults(messages)` and `extractConfirmedJourneyFields(messages)`. After prefill review, messages are empty — so `journeySnap.collectedFields = {}` and `requiredFieldCount = 0`.

Meanwhile, `resumeState` IS injected into the system prompt text at `route.ts:167-174`, but this doesn't affect the structured `journeySnap` that controls all downstream logic (Stage 2 directives, Strategist Mode guard, competitor detection, field completion).

### Fix

**File: `src/lib/ai/journey-state.ts`**

Add a `mergeExternalFields` helper:

```typescript
export function mergeExternalFields(
  snapshot: JourneyStateSnapshot,
  externalFields: Record<string, unknown>,
): JourneyStateSnapshot {
  const merged = { ...snapshot.collectedFields };
  for (const [key, value] of Object.entries(externalFields)) {
    if (isCollectedValue(value) && !isCollectedValue(merged[key])) {
      merged[key] = value;
    }
  }
  const requiredFieldCount = REQUIRED_FIELDS.filter((f) =>
    isCollectedValue(merged[f])
  ).length;

  return {
    ...snapshot,
    collectedFields: merged,
    requiredFieldCount,
  };
}
```

Key design decisions:
- Message-derived fields take priority over external fields (if a field is already collected from messages, don't override)
- Recomputes `requiredFieldCount` after merge
- Pure function, no side effects
- `REQUIRED_FIELDS` already exists in the file (line 16-24)

**File: `src/app/api/journey/stream/route.ts`**

After line 178, merge `resumeState`:

```typescript
const journeySnap = parseCollectedFields(sanitizedMessages);

// Merge prefill/resume fields not yet visible in message history
if (body.resumeState && typeof body.resumeState === 'object') {
  const merged = mergeExternalFields(journeySnap, body.resumeState as Record<string, unknown>);
  Object.assign(journeySnap, merged);
}
```

Import `mergeExternalFields` from `@/lib/ai/journey-state`.

### What This Fixes

- `journeySnap.requiredFieldCount` reflects prefill data -> correct phase routing
- `journeySnap.collectedFields` has prefill values -> no conflicting signals
- Stage 2 directives, Strategist Mode guard work correctly
- Agent responds coherently after prefill review (Bug 1 resolved)
- Transition feels responsive because agent actually has context (Bug 3 resolved)

### Test Plan

- Unit test: `mergeExternalFields()` merges correctly, message fields take priority
- Unit test: `requiredFieldCount` recomputed after merge
- Integration: After prefill review, first agent response acknowledges collected fields
- Manual: Complete prefill → submit review → verify agent doesn't re-ask known fields

---

## Track 2: Streaming & Feedback Fix

### Bug 2: Research Streaming Not Visible

**Status: Needs runtime verification.**

The code pipeline APPEARS correct:
- `runner.ts:106-108`: `stream.on('text', (text) => { opts?.onDelta?.(text); })` — calls onDelta during streaming
- `generate-research.ts:206-211`: `onDelta` writes `data-research-chunk` to `writer` with `transient: true`
- `page.tsx:376-404`: `onData` callback in `useChat` handles `data-research-chunk` and `data-research-status` events
- `message-analysis.ts:104-111`: merges `researchStreaming` dict into `sectionStatuses`
- `research-progress.tsx`: renders timeline from `sectionStatuses`

**Possible failure points (to investigate):**

1. **AI SDK transient event delivery during tool execution**: When `streamText` is waiting for a tool's `execute()` to resolve, the model stream is paused. Direct `writer.write()` calls during tool execution may not flush to the HTTP response until the model resumes. This would mean chunks accumulate server-side but never reach the client until the tool completes (at which point the section is already "complete" and streaming is pointless).

2. **`onData` callback timing**: The `useChat` hook's `onData` may only fire for data events that arrive between message boundaries, not during tool execution chunks.

**Investigation approach:**
- Add a `console.log('[research-chunk]', sectionId)` in the `onData` handler to verify events arrive
- Check AI SDK source for how `writer.write()` with `transient: true` behaves during tool execution
- If events don't arrive during execution, consider writing chunks to Supabase realtime instead (the `useResearchRealtime` subscription already exists)

**Fallback fix if streaming events don't reach frontend:**
Use the existing Supabase realtime channel. The worker already writes incremental results to `journey_sessions.research_results`. Wire `useResearchRealtime` to also emit `researchStreaming` state updates (not just section-complete events). This bypasses the AI SDK stream entirely for research progress.

### Bug 4: Ask-User Card Dual State

**File: `src/components/journey/ask-user-card.tsx`**

The card has both an `isSubmitted` prop AND internal `cardState` that independently control disabled state. When the parent sets `isSubmitted = true` but `cardState` is still `'selecting'`, the chip visuals don't match.

**Fix:** Remove the `isSubmitted` prop and derive it from `cardState === 'submitted'`. Or: sync `cardState` to `'submitted'` when `isSubmitted` prop changes via a useEffect. The simpler approach is to use `cardState` as the single source of truth and initialize it based on the prop.

### Bug 5: No Revision Loading Feedback

**File: `src/components/journey/research-cards/research-card-shell.tsx`**

After clicking "Submit revision" (line 247-251), the composer closes and `revisionNote` clears, but there's no loading indicator.

**Fix:** Add a `revisionPending` local state. Set it `true` on submit, show a spinner or "Revising..." label, and clear it when the section status changes back to `'running'` (driven by `researchStreaming` prop).

### Test Plan

- Bug 2: Console log test to verify `onData` receives research chunk events during tool execution
- Bug 4: Unit test that chips are disabled after submission regardless of entry path
- Bug 5: Visual test that revision submit shows loading state

---

## Files Changed

### Track 1 (State & Context)
| File | Change |
|------|--------|
| `src/lib/ai/journey-state.ts` | Add `mergeExternalFields()` helper |
| `src/app/api/journey/stream/route.ts` | Call `mergeExternalFields()` after `parseCollectedFields()` |
| `src/lib/ai/journey-state.ts` | Export `REQUIRED_FIELDS` if not already exported (needed by helper) |

### Track 2 (Streaming & Feedback)
| File | Change |
|------|--------|
| `src/app/journey/page.tsx` | Add console.log in onData for debugging |
| `src/components/journey/ask-user-card.tsx` | Consolidate dual state into single source |
| `src/components/journey/research-cards/research-card-shell.tsx` | Add revision loading state |

### Shared (no changes, reference only)
| File | Role |
|------|------|
| `src/lib/ai/tools/generate-research.ts` | Writes streaming events (already correct) |
| `src/lib/ai/sections/runner.ts` | Calls onDelta during streaming (already correct) |
| `src/lib/journey/message-analysis.ts` | Merges streaming into sectionStatuses (already correct) |

---

## Execution Order

1. **Track 1 first** — it's the showstopper and the fix is verified
2. **Track 2.Bug2 investigation** — runtime check to determine if streaming is actually broken or just needs UI connection
3. **Track 2.Bug4 + Bug5** — UI polish, can run in parallel

## Risk Assessment

- **Track 1**: Low risk. Pure function addition + one merge call in route. No behavior change for existing paths where messages already have tool outputs.
- **Track 2.Bug2**: Medium risk. May require switching from AI SDK stream events to Supabase realtime for research progress. Fallback path exists.
- **Track 2.Bug4**: Low risk. Component-level state consolidation.
- **Track 2.Bug5**: Low risk. Adding local loading state.
