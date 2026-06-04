# T7 Cross-Section Reasoning Agent Evidence

## Scope

Added `positioningCrossSectionReasoning` as a post-six "thinker" stage between the six committed positioning sections and the synthesis/paid-media capstones.

## Implementation

- Added a cross-section reasoning artifact schema, fixture, renderer, and registry entry.
- Added the `positioning-cross-section-reasoning` skill with no external tools and a frontier-model runner path via `strategyModel`.
- Added validator requirements for:
  - 1-6 cross-section threads.
  - Each thread citing at least two distinct committed positioning sections.
  - Overall coverage of at least four of the six committed positioning sections.
  - Non-vacuous strategic text for `clientBlindSpot`, `namedTension`, `secondOrderRisk`, and `contrarianInversion`.
- Added `ResearchInput.crossSectionReasoningArtifact` so synthesis and paid media can consume the thinker output.
- Updated audit sequencing:
  - Six core positioning sections complete first.
  - Cross-section reasoning dispatches after 6/6.
  - Synthesis and paid media dispatch only after the thinker commits.
- Updated initial dispatch and rerun routes:
  - `run-lab-section` blocks synthesis and paid media until the thinker artifact exists.
  - `rerun-section` now supports post-six sections, resets the target section row, rebuilds the committed-artifact input, and then schedules.
- Updated audit reader order and status copy:
  - Six core sections -> Thinker -> Synthesis -> Paid Media.
  - The thinker is excluded from the six-section parent rollup.
- Added SQL migration `20260604_cross_section_reasoning_rollup_exclusion.sql` so the thinker seeds as `counts_toward_rollup = false`.

## Verification

- `pnpm exec tsc --noEmit`: passed.
- Focused rerun fix suite:
  - `pnpm vitest run src/app/api/research-v2/rerun-section/__tests__/route.test.ts src/app/api/research-v2/run-lab-section/__tests__/route.test.ts src/components/research-v2/__tests__/audit-reader-shell.test.tsx src/lib/research-v2/__tests__/use-audit-state.test.tsx`
  - 4 files / 54 tests passed.
- Expanded T7 suite:
  - `pnpm vitest run src/lib/lab-engine/artifacts/schemas/__tests__/cross-section-reasoning.test.ts src/components/research-v2/section-renderers/__tests__/cross-section-reasoning.test.tsx src/lib/lab-engine/sections/__tests__/section-registry.test.ts src/lib/lab-engine/sections/__tests__/skill-registry-parity.test.ts src/lib/lab-engine/sections/__tests__/skill-resolution.test.ts src/lib/lab-engine/agents/__tests__/build-prompts.test.ts src/components/research-v3/__tests__/reader-sections.test.ts src/components/research-v2/__tests__/audit-reader-shell.test.tsx src/app/research-v3/__tests__/page-rehydrate.test.tsx src/app/api/research-v2/run-lab-section/__tests__/route.test.ts src/app/api/research-v2/rerun-section/__tests__/route.test.ts src/app/api/research-v2/audit-state/__tests__/route.test.ts src/lib/research-v2/__tests__/use-audit-state.test.tsx src/types/__tests__/positioning-artifact.test.ts src/lib/research-v3/__tests__/soak-monitor.test.ts`
  - 15 files / 114 tests passed.
- `pnpm run test:run`: 180 files / 1527 tests passed / 1 skipped.
- `pnpm run build`: clean.
- `pnpm run lint`: 0 errors / 32 existing warnings.
- QA re-review: GO after fixing the post-six rerun no-op path and adding synthesis gate coverage.

## Residual Risk

Rerunning one of the six core sections still does not automatically invalidate already-complete downstream thinker/synthesis/paid-media rows. That is stale-dependent-artifact risk for rerun workflows, not a blocker for the initial T7 path. T8/T9 should either add explicit downstream invalidation/versioning or document that operators must rerun dependent post-six sections after rerunning a core section.

## Live Gate

Pending. A live run must still prove at least one genuine cross-section thread: a claim that is invisible or false if any single section is read in isolation.
