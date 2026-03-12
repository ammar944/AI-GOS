# Journey Stability Remediation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the current Journey regressions: Anthropic thinking-block request failures, artifact panels reopening after approval, duplicate hidden wake-up loops, stale session rehydration, and weak local worker reliability.

**Architecture:** Treat this as a state-management repair, not a UI polish pass. The fix should separate immutable model history from display-only transforms, give artifact-open state one owner on the client, and isolate each Journey run from stale Supabase and local session state. Avoid partial fixes that leave the hidden wake-up and approval logic split across multiple independent code paths.

**Tech Stack:** Next.js 16 App Router, React 19, Vercel AI SDK, Anthropic, Clerk, Supabase, Vitest, React Testing Library

---

## Root Cause Summary

- The Journey API mutates assistant messages before resend while Anthropic thinking is enabled. That is the strongest explanation for the `thinking` / `redacted_thinking` error.
- Artifact-open state has too many writers. Approval closes the panel, then later effects and realtime handlers reopen it.
- Hidden follow-up messages are triggering server-side approval and sequential-recovery directives repeatedly, which produces duplicate “locked in” assistant replies.
- The latest server-side `journey_sessions` row is rehydrated on mount, so stale research can leak into a fresh run.
- The local dev frontend is up on `:3000`, but the research worker was not listening on `:3001` during this investigation. That is an operational issue that increases confusion during QA.

## Files Likely In Scope

- Modify: `src/app/journey/page.tsx`
- Modify: `src/app/api/journey/stream/route.ts`
- Modify: `src/lib/ai/journey-stream-prep.ts`
- Modify: `src/lib/ai/journey-review-gates.ts`
- Modify: `src/lib/journey/research-realtime.ts`
- Modify: `src/app/api/journey/session/route.ts`
- Test: `src/app/journey/__tests__/page.test.tsx`
- Test: `src/lib/ai/__tests__/journey-stream-prep.test.ts`
- Test: `src/lib/ai/__tests__/journey-review-gates.test.ts`
- Test: `src/lib/journey/__tests__/research-realtime.test.ts`
- Test: new focused tests near the route or extracted Journey state helpers if needed

## Sprint 1: Stop Broken Requests And Repeated Approval Replies

### Task 1: Lock down the failing Anthropic-history behavior with tests

**Files:**
- Modify: `src/lib/ai/__tests__/journey-stream-prep.test.ts`
- Create or modify: route-adjacent test for Journey stream request prep if needed

- [ ] **Step 1: Write a failing test for latest assistant message immutability**

Add a case where the latest assistant message contains both `reasoning` parts and a `tool-*` part in `input-available` or `approval-requested` state.

Expected:
- `sanitizeJourneyMessages(...)` must not strip or rewrite that latest assistant message.
- Older messages may still be compacted or normalized if explicitly allowed.

- [ ] **Step 2: Add a second failing test for approval path replay**

Model a conversation containing:
- completed research output
- hidden `[SECTION_APPROVED:competitors] Looks good`
- a later hidden wake-up user message

Expected:
- request-prep logic must not regenerate the same approval-only directive indefinitely.

- [ ] **Step 3: Run the focused tests to confirm failure**

Run: `./node_modules/.bin/vitest run src/lib/ai/__tests__/journey-stream-prep.test.ts src/lib/ai/__tests__/journey-review-gates.test.ts`

Expected: the new tests fail before implementation.

### Task 2: Remove unsafe assistant-message mutation before Anthropic resend

**Files:**
- Modify: `src/lib/ai/journey-stream-prep.ts`
- Modify: `src/app/api/journey/stream/route.ts`

- [ ] **Step 1: Replace blanket sanitization with an immutable-safe strategy**

Implementation target:
- do not filter parts out of the latest assistant message
- do not mutate any assistant message that includes reasoning/thinking blocks
- prefer dropping only truly invalid user-generated incomplete tool parts, or stop sanitizing assistant tool parts entirely and let the AI SDK convert valid UI messages itself

- [ ] **Step 2: Keep compaction separate from validation**

Do not mix:
- provider compatibility fixes
- token compaction
- UI-only filtering

If compaction stays, it must only affect older safe messages and must not alter thinking-bearing assistant turns.

- [ ] **Step 3: Update route usage**

Ensure [`src/app/api/journey/stream/route.ts`] uses the new prep path without recreating the same mutation through another helper.

- [ ] **Step 4: Run focused tests**

Run: `./node_modules/.bin/vitest run src/lib/ai/__tests__/journey-stream-prep.test.ts src/lib/ai/__tests__/journey-review-gates.test.ts`

Expected: PASS

### Task 3: Make approval progression event-driven enough to avoid duplicate “locked in” replies

**Files:**
- Modify: `src/app/api/journey/stream/route.ts`
- Modify: `src/lib/ai/journey-review-gates.ts`
- Test: `src/lib/ai/__tests__/journey-review-gates.test.ts`

- [ ] **Step 1: Add a failing test for duplicate post-approval replay**

Expected:
- once a section approval has already triggered its next-step handoff, later hidden wake-up messages must not re-emit the same handoff verbatim unless a new state transition occurred

- [ ] **Step 2: Add one-shot transition guards**

Possible implementation directions:
- track the latest actionable approval event instead of recomputing from full history every time
- or persist “next section launched” markers in request-visible metadata and gate directives against them

Pick one clear mechanism. Do not layer multiple partial guards.

- [ ] **Step 3: Verify no regression to existing review-gate behavior**

Run: `./node_modules/.bin/vitest run src/lib/ai/__tests__/journey-review-gates.test.ts`

Expected: PASS

## Sprint 2: Make Artifact Review Deterministic

### Task 4: Give artifact-open state a single owner

**Files:**
- Modify: `src/app/journey/page.tsx`
- Test: `src/app/journey/__tests__/page.test.tsx`

- [ ] **Step 1: Add failing tests for artifact close/reopen regressions**

Cover:
- approving an artifact closes it and it stays closed until a different section genuinely needs review
- later `researchResults` changes do not reopen the already approved section
- a newly completed section can still open when that is intended

- [ ] **Step 2: Remove the unconditional reopen effect**

Specifically replace the broad behavior around the current reopen logic in [`src/app/journey/page.tsx`] with a single transition-based controller.

Rules:
- artifact open should be driven by section transition, not by any `researchResults` object change
- approval should mark the section as acknowledged
- acknowledged sections should not reopen unless invalidated or explicitly re-requested

- [ ] **Step 3: Collapse multi-writer open calls into one orchestration path**

Current open events come from:
- dispatch
- realtime completion
- queued wake-up flush
- reopen effect

Refactor so all open/close decisions route through one function or reducer.

- [ ] **Step 4: Run focused page tests**

Run: `./node_modules/.bin/vitest run src/app/journey/__tests__/page.test.tsx`

Expected: PASS

### Task 5: Deduplicate hidden wake-ups and stop invisible transcript churn

**Files:**
- Modify: `src/app/journey/page.tsx`
- Test: `src/app/journey/__tests__/page.test.tsx`

- [ ] **Step 1: Add failing tests for repeated hidden sends**

Cover:
- one completed non-review section produces one wake-up send, not many
- review sections do not generate extra hidden sends after approval and close

- [ ] **Step 2: Replace `pendingWakeUpsRef` array semantics with deduped transition tracking**

Implementation target:
- use a `Set` or explicit transition map
- mark sections as “wake-up emitted” or “artifact surfaced”
- do not push the same section repeatedly through multiple effects

- [ ] **Step 3: Keep hidden transport messages inspectable during development**

Do not keep hidden control traffic completely invisible to debugging. Add development logging or a debug-only transcript surface so QA can see what caused the next assistant turn.

- [ ] **Step 4: Run focused tests**

Run: `./node_modules/.bin/vitest run src/app/journey/__tests__/page.test.tsx`

Expected: PASS

## Sprint 3: Isolate Each Journey Run From Stale Session Data

### Task 6: Fix stale session hydration on load and on “skip website analysis”

**Files:**
- Modify: `src/app/journey/page.tsx`
- Modify: `src/lib/journey/research-realtime.ts`
- Modify: `src/app/api/journey/session/route.ts`
- Test: `src/lib/journey/__tests__/research-realtime.test.ts`
- Test: `src/app/journey/__tests__/page.test.tsx`

- [ ] **Step 1: Add failing tests for stale first-section hydration**

Cover:
- a fresh session should not surface prior `industryMarket` results from the latest server row
- `handleSkipPrefill` must clear or isolate previous remote research state before entering chat

- [ ] **Step 2: Add explicit run/session isolation**

Preferred direction:
- give each new Journey run a run id or session id
- send that id with worker dispatches and session fetches
- ignore `/api/journey/session` results that belong to an older run

Do not rely only on `updatedAt` time comparisons.

- [ ] **Step 3: Close the missing reset path**

Ensure “skip website analysis” performs the same stale-research cleanup as accepted prefill and “start fresh”.

- [ ] **Step 4: Make session fetch semantics explicit**

Do not blindly read “latest row for user” if the UI is operating on a different run. Either:
- fetch by active session id, or
- persist the active run id locally and on the server and filter by it.

- [ ] **Step 5: Run focused tests**

Run: `./node_modules/.bin/vitest run src/lib/journey/__tests__/research-realtime.test.ts src/app/journey/__tests__/page.test.tsx`

Expected: PASS

### Task 7: Reconcile frontend approval state with backend approval state

**Files:**
- Modify: `src/app/journey/page.tsx`
- Modify: `src/lib/ai/journey-review-gates.ts`
- Test: `src/app/journey/__tests__/page.test.tsx`
- Test: `src/lib/ai/__tests__/journey-review-gates.test.ts`

- [ ] **Step 1: Add failing tests for frontend/backend approval mismatch**

Cover:
- local UI should not clear approval for a section that the backend still treats as approved
- approval badges, artifact panel state, and route gating should agree after transition

- [ ] **Step 2: Decide the source of truth**

Choose one:
- server-derived approval state reflected into the client
- or client state persisted and read back as explicit approval metadata

Avoid hybrid inference from both hidden messages and local transient state.

- [ ] **Step 3: Implement the chosen source of truth**

Update page logic and route helpers so approval is represented once and interpreted once.

- [ ] **Step 4: Run focused tests**

Run: `./node_modules/.bin/vitest run src/app/journey/__tests__/page.test.tsx src/lib/ai/__tests__/journey-review-gates.test.ts`

Expected: PASS

## Sprint 4: Operational Hardening And QA

### Task 8: Surface worker availability and dev-mode failure states clearly

**Files:**
- Modify: `src/app/journey/page.tsx` or a related status component
- Modify: worker startup or env validation surfaces if needed
- Test: add small focused tests where practical

- [ ] **Step 1: Add a visible worker-health indicator or dispatch failure banner**

Requirements:
- if the research worker is not reachable on `:3001` or via configured worker URL, do not leave the app in an ambiguous “processing” state
- tell the user whether the issue is queueing, worker unavailable, or completed-with-error

- [ ] **Step 2: Make local dev logs actionable**

Ensure logs distinguish:
- chat transport errors
- worker unavailability
- stale-session hydration
- duplicate wake-up suppression

- [ ] **Step 3: Verify the local dev loop**

Manual check:
- frontend running on `:3000`
- worker healthy
- one full Journey run from fresh start through at least Market Overview, Competitor Intel, and ICP Validation

### Task 9: Add regression coverage for the exact weird behaviors reported

**Files:**
- Modify: `src/app/journey/__tests__/page.test.tsx`
- Modify: `src/components/journey/__tests__/chat-message.test.tsx`
- Modify: route/helper tests as needed

- [ ] **Step 1: Add tests for these exact user-reported regressions**

Cover:
- artifact reopens after clicking “Looks Good”
- duplicate “Competitor intel locked in.” responses
- hidden control messages not visible but still driving assistant output
- stale first section appearing on new session entry
- thinking-block replay errors prevented by request prep

- [ ] **Step 2: Add a renderer robustness test around malformed or partial parts**

This is the likely place to catch the `Cannot read properties of undefined (reading 'state')` symptom before it hits the browser again.

- [ ] **Step 3: Run the full relevant Journey suite**

Run: `npm run test:run`

Expected: PASS

- [ ] **Step 4: Build verification**

Run: `npm run build`

Expected: PASS

## Release Order

1. Sprint 1 first. The Anthropic-history bug can break the whole flow even if the UI state is cleaned up.
2. Sprint 2 second. This removes the “haunted” artifact behavior and duplicate assistant chatter.
3. Sprint 3 third. This stops old runs from polluting new ones.
4. Sprint 4 last. Use it to make regressions visible and prevent recurrence.

## Notes For Implementation

- The existing test in [`src/lib/ai/__tests__/journey-stream-prep.test.ts`] currently encodes behavior that is probably wrong for Anthropic thinking turns. Replace it rather than preserving it blindly.
- Do not fix this by simply disabling Anthropic thinking unless you explicitly choose that as a temporary hotfix with sign-off. The structural bug is message mutation.
- Do not leave `artifactOpen` controlled from four different places after refactoring. One owner only.
- Do not keep using “latest row for user” as the effective session identity once multiple Journey runs exist.

## Verification Checklist

- [ ] No Anthropic `thinking` / `redacted_thinking` replay errors during artifact approval
- [ ] Approving a section closes the panel and it stays closed until a genuinely new review section is ready
- [ ] Only one next-step assistant handoff is emitted per section approval
- [ ] Fresh runs do not hydrate stale research from prior sessions
- [ ] Missing worker / worker timeout states are obvious in UI and logs
- [ ] `npm run test:run` passes
- [ ] `npm run build` passes
