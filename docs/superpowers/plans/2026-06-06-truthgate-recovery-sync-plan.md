# Truthgate Recovery Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate pipeline completion from quality blockers, keep projections synchronized with committed section truth, and make recovery reruns safe.

**Architecture:** Keep `research_artifact_sections` as the source of truth. Commit-time projection refresh updates profile/share snapshots from committed rows; gate/report code adds additive `projectionSync` and `blockedBy` metadata while preserving compatibility aliases; rerun routes enforce the same capstone evidence readiness used by initial execution.

**Tech Stack:** Next.js 16 App Router, TypeScript strict mode, Supabase, Zod, Vitest.

---

## Chunk 1: Projection Sync

**Files:**
- Modify: `src/lib/research-v2/share-snapshot.ts`
- Modify: `src/lib/research-v2/supabase-run-store.ts`
- Test: `src/lib/research-v2/__tests__/share-snapshot.test.ts`
- Test: `src/lib/research-v2/__tests__/supabase-run-store.test.ts`

- [ ] Add a share snapshot refresh helper that updates existing v3 `shared_sessions` rows for a run from current committed `research_artifact_sections`.
- [ ] After section commit on a completed parent, run a full profile rebuild and share refresh best-effort.
- [ ] Keep pre-completion commits on the existing section patch path.
- [ ] Test stale share/profile projection refresh without touching live DB.

## Chunk 2: Gate Vocabulary And Review Coverage

**Files:**
- Modify: `src/lib/research-v3/live-quality-gate.ts`
- Modify: `scripts/research-quality-gate-report.ts`
- Test: `src/lib/research-v3/__tests__/live-quality-gate.test.ts`
- Test: `src/lib/research-v3/__tests__/research-quality-gate-report.test.ts`

- [ ] Add `projectionSync` as the reader-facing gate while preserving `projectionTrust` as a compatibility alias.
- [ ] Add `blockedBy` to the evaluator/report result.
- [ ] Stop treating `reviewTier="unavailable"` as a research/actionability downgrade; emit review coverage warnings instead.
- [ ] Render `Projection sync` and `Blocked by` in the Markdown report.

## Chunk 3: Rerun Safety

**Files:**
- Modify: `src/app/api/research-v2/rerun-section/route.ts`
- Test: `src/app/api/research-v2/rerun-section/__tests__/route.test.ts`

- [ ] Mirror `run-lab-section` capstone readiness checks in manual reruns.
- [ ] Block capstone reruns with `409 research_evidence_not_ready` when committed core evidence is not ready.
- [ ] Preserve normal core-section rerun behavior.

## Verification

- [ ] Run focused tests for changed files.
- [ ] Regenerate the DB-backed report for `0dc9720b-81a3-487f-ab1f-fac60329b25b`.
- [ ] Run a broader relevant test slice before final handoff.
