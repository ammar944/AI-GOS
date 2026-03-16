# Journey Research Sandbox Observability Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sandbox-only sequential runner for the first six Journey research sections and a unified observability report that exposes timings, logs, tokens, cost, and chart status while preserving the production worker path.

**Architecture:** Extend the worker/app telemetry contract with optional usage and chart metadata, add deterministic sandbox orchestration helpers for the first six sections, then update the dev sandbox UI to run the sequence and render a unified report from persisted validated artifacts.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Supabase JSONB session persistence, Railway worker

---

### Task 1: Add failing helper tests for first-six sequencing and report aggregation

**Files:**
- Modify: `src/lib/journey/__tests__/research-sandbox.test.ts`
- Create or Modify: `src/lib/journey/__tests__/research-sandbox-observability.test.ts`

- [ ] **Step 1: Write failing tests for the first-six sandbox sequence**
- [ ] **Step 2: Run the tests to verify the expected failures**
- [ ] **Step 3: Implement the minimal helper logic**
- [ ] **Step 4: Re-run the tests until green**

### Task 2: Add failing telemetry contract tests

**Files:**
- Modify: `research-worker/src/__tests__/contracts.test.ts`
- Modify: `research-worker/src/__tests__/supabase.test.ts`
- Modify: `src/lib/journey/__tests__/research-result-contract.test.ts`

- [ ] **Step 1: Write failing tests for usage/cost/chart telemetry normalization**
- [ ] **Step 2: Run the focused tests to verify failures**
- [ ] **Step 3: Implement the minimal worker/app contract changes**
- [ ] **Step 4: Re-run the tests until green**

### Task 3: Implement worker telemetry persistence

**Files:**
- Modify: `research-worker/src/runner.ts`
- Modify: `research-worker/src/index.ts`
- Modify: `research-worker/src/supabase.ts`
- Modify: `research-worker/src/contracts.ts`
- Modify: section runners as needed for chart/model metadata

- [ ] **Step 1: Thread usage and chart telemetry through the worker result/job status path**
- [ ] **Step 2: Persist telemetry without breaking existing result validation**
- [ ] **Step 3: Verify worker tests remain green**

### Task 4: Implement sandbox sequence runner and unified observability view

**Files:**
- Modify: `src/lib/journey/research-sandbox.ts`
- Modify: `src/app/api/journey/dev/research-sandbox/route.ts`
- Modify: `src/components/journey/journey-research-sandbox.tsx`
- Add helper/component files only if the existing page becomes unclear

- [ ] **Step 1: Add deterministic helpers for first-six sequence + report building**
- [ ] **Step 2: Add sandbox actions/state for `Run First Six Sections`**
- [ ] **Step 3: Render the unified observability report with timings, logs, usage, cost, and charts**
- [ ] **Step 4: Keep single-section controls intact**

### Task 5: Add UI/route parity tests and verify

**Files:**
- Modify: `src/components/journey/__tests__/journey-research-sandbox*.test.tsx`
- Add route tests if missing under the existing Journey route test pattern

- [ ] **Step 1: Write failing tests for the unified observability view**
- [ ] **Step 2: Write route/helper tests proving the sandbox still uses the real production dispatch path**
- [ ] **Step 3: Run focused test suites**
- [ ] **Step 4: Run broader validation for touched areas**
