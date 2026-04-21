---
name: Pre-existing test failures
description: Known failing tests across root and worker that are NOT related to recent changes — do not flag these in reviews
type: project
---

## Root project (src/)

Pre-existing TS errors in test files only:
- `src/lib/ai/chat-tools/__tests__/deep-dive.test.ts` — AsyncIterable type mismatches (old chat blueprint pattern)
- `src/lib/ai/chat-tools/__tests__/query-blueprint.test.ts` — same AsyncIterable issue
- `src/app/journey/__tests__/page.test.tsx` — expects 1 argument but test passes 2
- `src/components/journey/__tests__/profile-dropdown.test.tsx` — missing BusinessProfile properties

Pre-existing test failures (Vitest):
- `src/lib/workspace/__tests__/pipeline.test.ts` — pipeline section order changed (ICP before competitors now)
- `src/lib/ad-library/__tests__/false-positive-prevention.test.ts` — name-matcher scoring thresholds changed
- `src/lib/ad-library/__tests__/name-matcher.test.ts` — substring match scoring expectations outdated

## Research worker (research-worker/src/)

Pre-existing test failures:
- `src/__tests__/competitors.test.ts` — tests for old agentic loop architecture (replaced by parallel pipeline)
- `src/__tests__/contracts.test.ts` — `marketMaturity: 'mature'` enum strictness test (schema was relaxed to z.string().optional())
- `src/__tests__/keywords.test.ts` — repair/rescue tests for old architecture
- `src/__tests__/supabase.test.ts` — mock issue with `.eq()` chaining (2 tests)

**Why:** These tests reference old architecture patterns (agentic toolRunner loop, strict enums) that were replaced in recent refactors. They are not related to current feature changes.

**How to apply:** When reviewing diffs, ignore these failures. If a new change causes a NEW failure in any of these files, investigate — but the existing failures listed above are known.
