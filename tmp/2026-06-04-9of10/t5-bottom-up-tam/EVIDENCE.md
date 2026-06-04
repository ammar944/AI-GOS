# T5 Bottom-Up TAM Evidence

Date: 2026-06-04
Branch: feat/research-quality-truthgate
Scope: T5 bottom-up TAM recipe + Market Category SKILL rewrite

## Code Changes

- Added a required `body.marketSize.bottomUpTam` schema contract for the `keyword-demand-reachable-revenue` recipe.
- Required four bottom-up inputs: `keyword-volume`, `commercial-intent-share`, `conversion-rate`, and `acv`.
- Required sourced inputs to carry valid URLs and evidence-gap inputs to explicitly name the evidence gap.
- Rejected numeric reachable-revenue estimates when any bottom-up input is an evidence gap.
- Rewrote the Market Category SKILL and prompt minimums to make analyst TAM a check, not the basis.
- Added `keyword_volume` to the Market Category section tool allowance.
- Updated fixtures, renderer, and UI tests so the Audit Reader displays the TAM recipe, input labels, source title, source date, and source links.
- Added a legacy renderer fallback so saved artifacts without `bottomUpTam` render four evidence-gap input rows instead of crashing.

## Verification

- `pnpm vitest run src/lib/lab-engine/artifacts/schemas/__tests__/market-category.test.ts src/components/research-v2/section-renderers/__tests__/market-category.test.tsx src/lib/lab-engine/sections/__tests__/section-registry.test.ts src/lib/lab-engine/sections/__tests__/skill-frameworks.test.ts src/lib/lab-engine/agents/__tests__/build-prompts.test.ts src/lib/lab-engine/agents/__tests__/run-section-corpus-only.test.ts src/lib/lab-engine/agents/__tests__/run-section.live-events.test.ts src/lib/lab-engine/agents/__tests__/run-section-artifact-streaming.test.ts src/lib/lab-engine/runs/__tests__/run-store-persistence-gate.test.ts src/lib/research-v2/__tests__/supabase-run-store.test.ts` passed: 10 files, 69 tests.
- `pnpm vitest run src/components/research-v2/section-renderers/__tests__/market-category.test.tsx src/lib/lab-engine/artifacts/schemas/__tests__/market-category.test.ts` passed after final renderer assertion: 2 files, 12 tests.
- `pnpm exec tsc --noEmit` passed.
- `pnpm run test:run` passed: 176 files passed, 1 skipped; 1499 tests passed, 1 skipped.
- `pnpm run build` passed.
- `pnpm run lint` passed with 0 errors and 32 existing warnings.

## QA

- Read-only QA re-review: GO.
- Prior critical blocker resolved: legacy Market Category artifacts missing `marketSize.bottomUpTam` now render the explicit evidence-gap fallback.
- Prior critical blocker resolved: a numeric reachable-revenue estimate is rejected when any recipe input is an evidence gap.
- Prior warning resolved: TAM rows now display label, source title, date observed, and source URL when present.

## Remaining Gate

- Live Market Category run is still pending; this is a code-gate pass only.
