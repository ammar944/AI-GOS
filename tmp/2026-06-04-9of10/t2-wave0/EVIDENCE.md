# T2 Wave 0 Evidence

Date: 2026-06-04
Branch: feat/research-quality-truthgate

## Code Changes

- VoC source-thin, self-domain, and single-source-majority quote failures now produce a committed evidence-gap artifact instead of a terminal section failure.
- `run-section.ts` now uses deterministic `structuralVerifier()` at the live runner call site, retiring the model-based `structuralVerifierWithEntailment()` call from section execution.
- Agentic review is bounded by `LAB_REVIEW_TIMEOUT_MS` at the Supabase commit path, defaulting to 45000ms.

## Verification

- `pnpm vitest run src/lib/lab-engine/artifacts/schemas/__tests__/voice-of-customer.test.ts src/lib/lab-engine/agents/__tests__/run-section-voice-of-customer-candidates.test.ts src/lib/lab-engine/agents/review/__tests__/agentic-section-review.test.ts src/lib/research-v2/__tests__/supabase-run-store.test.ts` passed: 4 files, 39 tests.
- `pnpm exec tsc --noEmit` passed with zero errors.
- `pnpm run test:run` passed: 173 files passed, 1 skipped; 1473 tests passed, 1 skipped.
- `pnpm run build` passed.

## Remaining Gate

T2 is not fully accepted until the live Ramp run reaches 6/6 plus capstones and the reviewed sections are in the upgraded audit quality class.
