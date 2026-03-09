# Journey Chat UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Journey onboarding-to-chat transition feel intentional by replacing the generic post-prefill start state with a state-aware handoff, clearer orientation, and more explicit next-step copy.

**Architecture:** Keep the existing single-page Journey flow and derive a lightweight handoff/orientation state inside `src/app/journey/page.tsx`. Update the related presentation components to use that derived state without changing APIs or persistence schemas.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library

---

### Task 1: Lock down visible question and CTA copy

**Files:**
- Modify: `src/components/journey/__tests__/welcome-state.test.tsx`
- Modify: `src/components/journey/__tests__/journey-prefill-review.test.tsx`
- Create or Modify: `src/components/journey/__tests__/chat-message.test.tsx`
- Modify: `src/components/journey/ask-user-card.tsx`
- Modify: `src/components/journey/welcome-state.tsx`
- Modify: `src/components/journey/journey-prefill-review.tsx`

**Step 1: Write the failing tests**

Add assertions for:

- welcome buttons using consequence-based labels
- prefill review action buttons using transition-oriented labels
- `AskUserCard` rendering the question text visibly in the document

**Step 2: Run tests to verify they fail**

Run:
`npm run test:run -- src/components/journey/__tests__/welcome-state.test.tsx src/components/journey/__tests__/journey-prefill-review.test.tsx src/components/journey/__tests__/chat-message.test.tsx`

Expected:
- FAIL because the old labels and missing visible question are still in place

**Step 3: Write minimal implementation**

Update:

- `WelcomeState` button and loading/stop copy
- `JourneyPrefillReview` primary/secondary CTA labels
- `AskUserCard` to render the prompt text above the chip group

**Step 4: Run tests to verify they pass**

Run:
`npm run test:run -- src/components/journey/__tests__/welcome-state.test.tsx src/components/journey/__tests__/journey-prefill-review.test.tsx src/components/journey/__tests__/chat-message.test.tsx`

Expected:
- PASS

### Task 2: Reframe the orientation card

**Files:**
- Create: `src/components/journey/__tests__/profile-card.test.tsx`
- Modify: `src/components/journey/profile-card.tsx`

**Step 1: Write the failing test**

Add a test asserting that the card:

- renders `What I know so far`
- shows answered-field progress
- includes short next-step guidance

**Step 2: Run test to verify it fails**

Run:
`npm run test:run -- src/components/journey/__tests__/profile-card.test.tsx`

Expected:
- FAIL because the card still renders `Client Dossier` and lacks next-step guidance

**Step 3: Write minimal implementation**

Update `ProfileCard` copy and supporting display logic to present the card as a user-facing orientation surface while keeping the compact grid/progress structure.

**Step 4: Run test to verify it passes**

Run:
`npm run test:run -- src/components/journey/__tests__/profile-card.test.tsx`

Expected:
- PASS

### Task 3: Add seeded handoff behavior in the Journey page

**Files:**
- Modify: `src/app/journey/__tests__/page.test.tsx`
- Modify: `src/app/journey/page.tsx`

**Step 1: Write the failing tests**

Add page-level assertions for:

- accepted prefill entering chat mode with state-aware kickoff content instead of the generic welcome copy
- manual start entering chat with handoff/orientation state
- header state being derived from journey state before the first real chat message exists
- right rail staying hidden when it only has dev-only debug UI and no user-facing content

**Step 2: Run tests to verify they fail**

Run:
`npm run test:run -- src/app/journey/__tests__/page.test.tsx`

Expected:
- FAIL because the page still renders the generic welcome path and always exposes the debug-only right rail in tests

**Step 3: Write minimal implementation**

In `page.tsx`:

- derive a seeded handoff state from confirmed/prefill-reviewed data
- compute a state-aware kickoff message for the pre-message chat state
- update header label/detail derivation to use journey state
- suppress the right rail when it has no user-facing content

**Step 4: Run test to verify it passes**

Run:
`npm run test:run -- src/app/journey/__tests__/page.test.tsx`

Expected:
- PASS

### Task 4: Refine and verify the focused Journey UX slice

**Files:**
- Modify: recently touched files only if needed

**Step 1: Run focused test suite**

Run:
`npm run test:run -- src/app/journey/__tests__/page.test.tsx src/components/journey/__tests__/welcome-state.test.tsx src/components/journey/__tests__/journey-prefill-review.test.tsx src/components/journey/__tests__/chat-message.test.tsx src/components/journey/__tests__/profile-card.test.tsx`

Expected:
- PASS

**Step 2: Check lint diagnostics**

Run the editor diagnostics on the touched files and fix any introduced lint or type issues.

**Step 3: Sanity-check copy and state transitions**

Verify that:

- welcome copy matches the new labels
- seeded chat shows handoff-oriented content
- orientation card copy is user-facing
- prompt chips always show visible question text

**Step 4: Stop**

Do not widen scope into progress-model unification or deeper provenance UX unless explicitly requested.
