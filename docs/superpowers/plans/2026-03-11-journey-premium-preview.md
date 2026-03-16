# Journey Premium Preview Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a preview-only dark premium Journey concept with upgraded welcome, research cards, artifact panel, and composer using dummy data and scene-based review.

**Architecture:** Add a dedicated preview route and a scene-driven preview component that reuses shared Journey pieces where helpful. Shared components may gain preview-only variants, but live `/journey` must remain on existing variants and behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest, React Testing Library

---

### Task 1: Add failing preview tests

**Files:**
- Modify: `src/components/journey/__tests__/journey-chat-input.test.tsx`
- Create: `src/components/journey/__tests__/journey-premium-preview-scenes.test.tsx`

- [ ] **Step 1: Write a failing test for the new premium composer variant**
- [ ] **Step 2: Write failing tests for welcome, research card, artifact panel, and chat preview scenes**
- [ ] **Step 3: Run the focused tests and confirm the expected failures**

### Task 2: Build the preview-only premium scenes

**Files:**
- Create: `src/app/test/journey-premium/page.tsx`
- Create: `src/components/journey/journey-premium-preview-scenes.tsx`
- Modify: `src/components/journey/chat-input.tsx`

- [ ] **Step 1: Add the premium preview route with `scene` query support only**
- [ ] **Step 2: Add a premium composer variant without changing live Journey behavior**
- [ ] **Step 3: Render every preview scene inside the current Journey shell/workspace framing, not a separate landing-page layout**
- [ ] **Step 4: Implement the welcome scene with one primary URL intake, 3-4 quick-start prompts, and readiness/status signals**
- [ ] **Step 5: Implement the research cards scene with dossier-style cards that show a module label, strategic headline, 2-3 proof bullets, compact metrics/meta, and one clear action**
- [ ] **Step 6: Implement the artifact scene as a decision dock with summary, key findings, risks/opportunities, evidence/citations strip, and sticky approval actions**
- [ ] **Step 7: Implement the chat scene with the premium composer, including mode/context chips and stronger operator-bar hierarchy**
- [ ] **Step 8: Keep all preview content dummy/static and keep live `/journey` on existing variants**
- [ ] **Step 9: Re-run the focused preview tests until green**

### Task 3: Verify preview isolation

**Files:**
- Verify only: `src/app/journey/page.tsx`

- [ ] **Step 1: Confirm live `/journey` still uses existing variants and no premium preview route is wired into production**
- [ ] **Step 2: Run focused lint/tests for touched preview files**
- [ ] **Step 3: Capture the final route/scene paths for review**
