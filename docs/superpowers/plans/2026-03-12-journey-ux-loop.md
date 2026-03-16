# Journey UX Loop Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current hidden-orchestration journey loop with a visible, deterministic section-state flow so `/journey` feels fast, intentional, and coherent from prefill through synthesis.

**Architecture:** Keep the current Next.js + Vercel AI SDK stack, but move section sequencing out of hidden transcript hacks and into a typed journey-state contract. The UI should render visible status transitions for every background action, and the backend should only mark sections as reviewable when final research payloads are actually complete.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vercel AI SDK, Clerk, Supabase, Vitest, React Testing Library

---

## File Map

**Create**

- `src/lib/journey/journey-events.ts`
- `src/lib/journey/journey-section-status.ts`
- `src/lib/journey/__tests__/journey-section-status.test.ts`
- `src/components/journey/journey-status-card.tsx`
- `src/components/journey/__tests__/journey-status-card.test.tsx`

**Modify**

- `src/app/journey/page.tsx`
- `src/app/api/journey/stream/route.ts`
- `src/lib/ai/journey-review-gates.ts`
- `src/lib/journey/chat-auto-send.ts`
- `src/lib/journey/research-realtime.ts`
- `src/lib/journey/journey-section-orchestration.ts`
- `src/lib/ai/prompts/lead-agent-system.ts`
- `src/components/journey/artifact-panel.tsx`
- `src/components/journey/research-inline-card.tsx`
- `src/components/journey/chat-message.tsx`
- `src/app/journey/__tests__/page.test.tsx`
- `src/lib/ai/__tests__/journey-review-gates.test.ts`
- `src/lib/journey/__tests__/research-realtime.test.ts`
- `src/lib/journey/__tests__/chat-auto-send.test.ts`
- `src/components/journey/__tests__/artifact-panel.test.tsx`

---

## Sprint Map

### Sprint 1: Stop the Broken Loop

Outcome:

- No false review states
- No dead air after prefill or approval
- No hidden control messages driving the visible UX without a visible bridge

### Sprint 2: Unify Artifact and Section Navigation

Outcome:

- All sections share one open/view/review contract
- Downstream sections are no longer orphaned in inline cards

### Sprint 3: Speed, Simplify, and Harden

Outcome:

- Faster orchestration turns
- Smaller prompt/runtime surface
- Better observability and regression coverage

---

## Chunk 1: Canonical Section State

### Task 1: Define the section status contract

**Files:**

- Create: `src/lib/journey/journey-section-status.ts`
- Test: `src/lib/journey/__tests__/journey-section-status.test.ts`

- [ ] **Step 1: Write the failing tests**

Cover:

- queued dispatch is not reviewable
- complete artifact payload becomes `ready_for_review`
- approved sections move to `approved`
- downstream sections can become `complete` without review controls

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/journey/__tests__/journey-section-status.test.ts`

Expected: failing test file or missing module error

- [ ] **Step 3: Implement the status helpers**

Add pure helpers for:

- deriving section status from dispatch state + persisted result + approval state
- checking whether a section should auto-open
- checking whether a section needs review controls

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/journey/__tests__/journey-section-status.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/journey/journey-section-status.ts src/lib/journey/__tests__/journey-section-status.test.ts
git commit -m "feat: add canonical journey section status contract"
```

### Task 2: Fix false-complete review gating

**Files:**

- Modify: `src/lib/ai/journey-review-gates.ts`
- Test: `src/lib/ai/__tests__/journey-review-gates.test.ts`

- [ ] **Step 1: Write failing test cases for queued tool outputs**

Add tests proving that:

- `state === "output-available"` with `{ "status": "queued" }` is not complete
- `pendingReviewSection` only appears when output payload status is `complete`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/ai/__tests__/journey-review-gates.test.ts`

Expected: FAIL on queued output cases

- [ ] **Step 3: Implement the readiness fix**

Parse tool output payloads and only treat sections as complete when:

- tool name matches
- part state is `output-available`
- parsed output status is `complete`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/ai/__tests__/journey-review-gates.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/journey-review-gates.ts src/lib/ai/__tests__/journey-review-gates.test.ts
git commit -m "fix: gate journey review states on final research completion"
```

---

## Chunk 2: Replace Hidden Control Flow with Typed Journey Events

### Task 3: Add typed journey events

**Files:**

- Create: `src/lib/journey/journey-events.ts`
- Modify: `src/lib/journey/chat-auto-send.ts`
- Test: `src/lib/journey/__tests__/chat-auto-send.test.ts`

- [ ] **Step 1: Write failing tests for non-chat control events**

Cover:

- real user messages still send through `useChat`
- control events do not depend on fake `[SECTION_APPROVED:*]` transcript strings

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/journey/__tests__/chat-auto-send.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement typed event helpers**

Add:

- event types for `prefill_accepted`, `section_result_received`, `section_approved`, `section_revision_requested`
- helper to detect whether a follow-up turn should be triggered from structured control state instead of hidden user text

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/journey/__tests__/chat-auto-send.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/journey/journey-events.ts src/lib/journey/chat-auto-send.ts src/lib/journey/__tests__/chat-auto-send.test.ts
git commit -m "feat: add typed journey control events"
```

### Task 4: Teach the API route to accept structured control state

**Files:**

- Modify: `src/app/api/journey/stream/route.ts`
- Modify: `src/lib/ai/prompts/lead-agent-system.ts`
- Test: `src/lib/ai/__tests__/journey-post-approval.test.ts`
- Test: `src/lib/ai/__tests__/journey-downstream-research.test.ts`

- [ ] **Step 1: Add failing tests for structured approval/result triggers**

Cover:

- approval follow-up does not require bracketed control text in the transcript
- research-complete follow-up does not rely on hidden user messages

- [ ] **Step 2: Run targeted tests to verify they fail**

Run: `npm run test:run -- src/lib/ai/__tests__/journey-post-approval.test.ts src/lib/ai/__tests__/journey-downstream-research.test.ts`

Expected: FAIL

- [ ] **Step 3: Update route contract**

Add request support for a structured control payload, then:

- read approval/result events from request metadata
- stop inferring orchestration exclusively from fake transcript text
- reduce transient prompt patching where code can decide deterministically
- keep real user messages as the only user-visible transcript input

- [ ] **Step 4: Trim the system prompt**

Move hard sequencing rules out of `LEAD_AGENT_SYSTEM_PROMPT` when code now owns them:

- remove contradictory “queued means success/completed means ready” behavior
- keep tone, research policy, and strategist guidance

- [ ] **Step 5: Run targeted tests to verify they pass**

Run: `npm run test:run -- src/lib/ai/__tests__/journey-post-approval.test.ts src/lib/ai/__tests__/journey-downstream-research.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/journey/stream/route.ts src/lib/ai/prompts/lead-agent-system.ts src/lib/ai/__tests__/journey-post-approval.test.ts src/lib/ai/__tests__/journey-downstream-research.test.ts
git commit -m "refactor: move journey orchestration off hidden transcript controls"
```

---

## Chunk 3: Make State Transitions Visible

### Task 5: Add a visible journey status card component

**Files:**

- Create: `src/components/journey/journey-status-card.tsx`
- Test: `src/components/journey/__tests__/journey-status-card.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Cover:

- launch state
- running state
- ready for review state
- approved handoff state
- error state

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/journey/__tests__/journey-status-card.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement the status card**

Support concise visible messages such as:

- `Launching Market Overview`
- `Competitor Intel is running`
- `Offer Analysis approved. Launching Strategy Synthesis`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/journey/__tests__/journey-status-card.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/journey/journey-status-card.tsx src/components/journey/__tests__/journey-status-card.test.tsx
git commit -m "feat: add visible journey status cards"
```

### Task 6: Rewire the journey page around visible bridge states

**Files:**

- Modify: `src/app/journey/page.tsx`
- Modify: `src/lib/journey/journey-section-orchestration.ts`
- Test: `src/app/journey/__tests__/page.test.tsx`

- [ ] **Step 1: Add failing page tests for the current UX gaps**

Cover:

- prefill accept shows a visible kickoff bridge immediately
- typing indicator renders for `submitted` and `streaming`
- approval keeps a visible handoff on screen before the layout collapses
- hidden wake-up behavior is no longer required for visible continuity

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/journey/__tests__/page.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement page-state changes**

Update the page so that it:

- records structured journey events
- renders visible `JourneyStatusCard` entries
- keeps artifact state open until the next visible transition is mounted
- renders activity affordances during both `submitted` and `streaming`
- stops filtering out the only transition evidence the user needs

- [ ] **Step 4: Simplify section wake-up tracking**

Adjust orchestration helpers so one missed auto-open does not permanently suppress future recovery. Recovery should be status-driven, not one-shot magic.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:run -- src/app/journey/__tests__/page.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/journey/page.tsx src/lib/journey/journey-section-orchestration.ts src/app/journey/__tests__/page.test.tsx
git commit -m "feat: add visible journey transition states"
```

---

## Chunk 4: Unify Artifacts Across All Sections

### Task 7: Open-path parity for downstream sections

**Files:**

- Modify: `src/components/journey/research-inline-card.tsx`
- Modify: `src/components/journey/chat-message.tsx`
- Modify: `src/components/journey/artifact-panel.tsx`
- Modify: `src/app/journey/page.tsx`
- Test: `src/components/journey/__tests__/artifact-panel.test.tsx`
- Test: `src/app/journey/__tests__/page.test.tsx`

- [ ] **Step 1: Add failing tests**

Cover:

- `crossAnalysis` and `keywordIntel` can open the full artifact
- `ResearchInlineCard` exposes the open path in page integration
- page-level artifact trigger logic is not limited to the first four sections

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/components/journey/__tests__/artifact-panel.test.tsx src/app/journey/__tests__/page.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement downstream parity**

Wire the existing `onViewFull` and `onViewResearchSection` callbacks through the page so all supported artifact sections can open through the same panel/dock.

- [ ] **Step 4: Normalize review controls**

Use the canonical section-status contract so:

- review sections show approval controls
- downstream sections show open/view controls without fake review gating

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/components/journey/__tests__/artifact-panel.test.tsx src/app/journey/__tests__/page.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/journey/research-inline-card.tsx src/components/journey/chat-message.tsx src/components/journey/artifact-panel.tsx src/app/journey/page.tsx src/components/journey/__tests__/artifact-panel.test.tsx src/app/journey/__tests__/page.test.tsx
git commit -m "feat: unify journey artifact access across all sections"
```

---

## Chunk 5: Honest Realtime and Faster Turns

### Task 8: Make research delivery honest and observable

**Files:**

- Modify: `src/lib/journey/research-realtime.ts`
- Modify: `src/app/journey/page.tsx`
- Test: `src/lib/journey/__tests__/research-realtime.test.ts`

- [ ] **Step 1: Add failing tests for polling semantics**

Cover:

- polling state is explicit
- stale/mismatched runs remain ignored
- page can surface “waiting for worker write” without pretending the result already streamed

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/journey/__tests__/research-realtime.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement the honest transport update**

Choose one of these and document it in code:

- actual Supabase realtime subscription, or
- intentional polling with visible polling/running state and no misleading “realtime” copy

Either way, keep run-id guarding and stale snapshot protection.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/journey/__tests__/research-realtime.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/journey/research-realtime.ts src/app/journey/page.tsx src/lib/journey/__tests__/research-realtime.test.ts
git commit -m "fix: make journey research delivery state explicit"
```

### Task 9: Reduce orchestration latency

**Files:**

- Modify: `src/app/api/journey/stream/route.ts`
- Modify: `src/lib/ai/prompts/lead-agent-system.ts`
- Test: `src/app/journey/__tests__/page.test.tsx`

- [ ] **Step 1: Add failing tests or assertions around fast kickoff copy**

Cover:

- research launch turns produce short immediate acknowledgements
- strategist turns still allow richer responses

- [ ] **Step 2: Run targeted tests to verify the baseline**

Run: `npm run test:run -- src/app/journey/__tests__/page.test.tsx`

Expected: baseline behavior locked

- [ ] **Step 3: Implement latency cuts**

For orchestration/status turns:

- disable or sharply reduce Anthropic thinking budget
- keep the prompt small
- avoid unnecessary sequential prompt patches

For strategist turns:

- allow richer reasoning only when the user is asking for strategy, not state management

- [ ] **Step 4: Verify no regression in targeted tests**

Run: `npm run test:run -- src/app/journey/__tests__/page.test.tsx src/lib/ai/__tests__/journey-review-gates.test.ts src/lib/journey/__tests__/research-realtime.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/journey/stream/route.ts src/lib/ai/prompts/lead-agent-system.ts src/app/journey/__tests__/page.test.tsx src/lib/ai/__tests__/journey-review-gates.test.ts src/lib/journey/__tests__/research-realtime.test.ts
git commit -m "perf: reduce journey orchestration latency"
```

---

## Chunk 6: Final Verification

### Task 10: Full targeted regression

**Files:**

- Test: `src/app/journey/__tests__/page.test.tsx`
- Test: `src/lib/ai/__tests__/journey-review-gates.test.ts`
- Test: `src/lib/journey/__tests__/research-realtime.test.ts`
- Test: `src/lib/journey/__tests__/chat-auto-send.test.ts`
- Test: `src/components/journey/__tests__/artifact-panel.test.tsx`
- Test: `src/lib/journey/__tests__/journey-section-orchestration.test.ts`

- [ ] **Step 1: Run the full targeted journey suite**

Run:

```bash
npm run test:run -- src/app/journey/__tests__/page.test.tsx src/lib/ai/__tests__/journey-review-gates.test.ts src/lib/journey/__tests__/research-realtime.test.ts src/lib/journey/__tests__/chat-auto-send.test.ts src/components/journey/__tests__/artifact-panel.test.tsx src/lib/journey/__tests__/journey-section-orchestration.test.ts
```

Expected: PASS

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS with no new errors

- [ ] **Step 4: Manual browser smoke check**

Verify:

- prefill accept has no dead air
- approval has no snap-back confusion
- downstream artifacts open
- strategy mode transition is visible

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test: verify journey ux loop remediation"
```
