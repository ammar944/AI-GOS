# T10 Strategic Rubric Evidence

## Status

Code gate green; live scoring gate pending.

## What Changed

- Added a pure 9/10 strategic rubric module:
  - `STRATEGIC_RUBRIC_PROPERTIES`
  - `scoreStrategicRubric()`
  - `scoreStrategicRubricArtifacts()`
  - `computeKnewThatPassShare()`
  - `buildStrategicRubricChecklistMarkdown()`
  - `buildStrategicRubricPromptBlock()`
- Encoded the eight rubric properties:
  - contrarian thesis
  - cross-section thread
  - named tension with a side
  - second-order implication
  - sequenced moves
  - kill criteria
  - >=40% knew-that pass rate
  - conviction without false certainty
- Encoded disqualifier ceilings:
  - reads like Wikipedia plus brief -> ceiling 5
  - no cross-section insight -> ceiling 6
  - hedges everything -> ceiling 6
- Reused the rubric prompt block in the T8 strategic critic prompt.
- Kept the rubric advisory for live scoring/checklists; it does not block `runSection`, dispatch, or artifact commit.

## Verification

```bash
pnpm exec tsc --noEmit
# pass
```

```bash
pnpm vitest run \
  src/lib/lab-engine/artifacts/__tests__/strategic-rubric.test.ts \
  src/lib/lab-engine/agents/__tests__/strategic-critic.test.ts \
  src/lib/lab-engine/agents/__tests__/run-section-strategic-critic.test.ts
# 3 files / 18 tests passed
```

```bash
pnpm run test:run
# 184 files passed / 1 skipped
# 1564 tests passed / 1 skipped
```

```bash
pnpm run build
# pass; existing baseline-browser-mapping and middleware-to-proxy warnings only
```

```bash
pnpm run lint
# 0 errors / 32 existing warnings
```

## Pending Gate

- Apply this rubric to a live Ramp run and a second-company run in T11.
