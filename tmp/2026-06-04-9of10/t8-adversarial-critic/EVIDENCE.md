# T8 Adversarial Critic Evidence

## Scope

- Added a bounded strategic critic pass for `positioningCrossSectionReasoning`.
- The critic runs after structured artifact validation/repair and before the existing evidence gate and artifact commit in `runSection`.
- Upgraded artifacts are re-verified and evidence support shortfall is recomputed before commit.
- The critic rejects new or reassigned `sectionId` + `sourceUrl` refs, validates cross-section minimums, applies the 40% "knew-that" pass floor, and falls back to the original thinker artifact on model/parse/validation failure.
- Caller aborts before and during the critic call propagate instead of fallback-committing the original artifact.
- Kept/deepened critique metadata must point to text in the final body.
- Critique metadata persists through the artifact envelope, typed artifact picker, and Audit Reader UI without entering the artifact body or copied markdown.

## Verification

- `pnpm exec tsc --noEmit`
  - Exit 0.
- Focused T8 suite:
  - `pnpm vitest run src/lib/lab-engine/agents/__tests__/strategic-critic.test.ts src/lib/lab-engine/agents/__tests__/run-section-strategic-critic.test.ts src/lib/lab-engine/artifacts/__tests__/artifact-envelope.test.ts src/lib/lab-engine/events/__tests__/activity-event.test.ts src/types/__tests__/positioning-artifact.test.ts src/components/research-v2/__tests__/audit-reader-shell.test.tsx`
  - 6 files passed.
  - 62 tests passed.
- Expanded T8 suite:
  - `pnpm vitest run src/lib/lab-engine/agents/__tests__/strategic-critic.test.ts src/lib/lab-engine/agents/__tests__/run-section-strategic-critic.test.ts src/lib/lab-engine/agents/__tests__/run-section-artifact-streaming.test.ts src/lib/lab-engine/agents/__tests__/build-prompts.test.ts src/lib/lab-engine/artifacts/__tests__/artifact-envelope.test.ts src/lib/lab-engine/events/__tests__/activity-event.test.ts src/lib/lab-engine/artifacts/schemas/__tests__/cross-section-reasoning.test.ts src/types/__tests__/positioning-artifact.test.ts src/components/research-v2/__tests__/audit-reader-shell.test.tsx src/components/research-v2/section-renderers/__tests__/cross-section-reasoning.test.tsx`
  - 10 files passed.
  - 90 tests passed.
- `pnpm run test:run`
  - 182 files passed.
  - 1 file skipped.
  - 1543 tests passed.
  - 1 test skipped.
- `pnpm run build`
  - Exit 0.
  - Existing warnings only: stale `baseline-browser-mapping` data and deprecated Next.js `middleware` convention.
- `pnpm run lint`
  - Exit 0.
  - 0 errors.
  - 32 existing warnings.

## Remaining Gate

- Live before/after quality proof is still pending under T11/T10 rubric gates.
