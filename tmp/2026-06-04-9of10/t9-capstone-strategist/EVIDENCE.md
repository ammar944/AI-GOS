# T9 Capstone Strategist Evidence

## Status

Code gate green; live gate pending.

## What Changed

- Rebuilt `positioningSynthesis` and `positioningPaidMediaPlan` as strategy artifacts with:
  - `strategicThesis`
  - `contradictionReconciliation`
  - `orderedMoves[]` with dependencies, learning priority, thesis trace, and `provesWrongIf`
- Routed both capstones through `strategyModel`, matching the cross-section reasoning path.
- Normalized new strategy fields in `runSection` before strict schema validation.
- Rendered the new thesis, contradiction, and ordered moves in Audit Reader capstone views.
- Updated capstone prompts, SKILL contracts, sub-section ordering, fixtures, and profile thesis bookkeeping.

## QA Findings Addressed

- QA initially returned NO-GO because capstone `provesWrongIf` fields accepted placeholders.
- Fixed by reusing `validateProvesWrongIfMinimums()` in both capstone validators.
- Added rejection tests for placeholder kill criteria: `unknown`, `n/a`, and `none`.
- `.gitignore` and the untracked migration plan are pre-existing scope items and are excluded from the T9 commit.

## Verification

```bash
pnpm exec tsc --noEmit
# pass
```

```bash
pnpm vitest run \
  src/lib/lab-engine/artifacts/schemas/__tests__/positioning-synthesis.test.ts \
  src/lib/lab-engine/artifacts/schemas/__tests__/paid-media-plan.test.ts \
  src/lib/lab-engine/agents/__tests__/build-prompts.test.ts \
  src/lib/lab-engine/agents/__tests__/run-section-corpus-only.test.ts \
  src/lib/research-v2/__tests__/orchestrate-db.test.ts \
  src/lib/research-v2/__tests__/supabase-run-store.test.ts \
  src/lib/profiles/__tests__/section-profile-persistence.test.ts \
  src/components/research-v2/section-renderers/__tests__/positioning-synthesis.test.tsx \
  src/components/research-v2/section-renderers/__tests__/paid-media-plan.test.tsx
# 9 files / 90 tests passed
```

```bash
pnpm run test:run
# 183 files passed / 1 skipped; 1557 tests passed / 1 skipped
```

```bash
pnpm run build
# pass
```

```bash
pnpm run lint
# 0 errors / 32 existing warnings
```

## Pending Gate

- Live Ramp/second-company run scored against T10 rubric remains pending.
