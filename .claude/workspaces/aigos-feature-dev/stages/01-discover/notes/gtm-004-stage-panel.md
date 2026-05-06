# GTM-004 Stage Panel

## Discover

1. **Ask, in one sentence.** Implement `GTM-004 - Render stage DAG/status panel` from commit `665fc6d4` in the active `/Users/ammar/Dev-Projects/AI-GOS` checkout.
2. **Success criteria.**
   - Visible Journey/GTM stages render in persisted read-model order.
   - Pending stages explain their upstream dependency wait reason.
   - Active stages show the latest event and elapsed time when available.
   - Blocked, errored, and timed-out stages show plain-language reasons.
   - The `/journey` workspace refreshes from persisted data without exposing raw JSON as primary UX.
3. **In scope.**
   - The active `/journey` workspace surface.
   - The Journey run-view/status data shape.
   - A minimal stage/status panel component and focused tests.
4. **Out of scope.**
   - New or revived `/gtm` runtime routes.
   - Worker/research runtime behavior changes.
   - Drag/drop, manual worker controls, and new invented statuses.
   - Broad dirty-repo cleanup or unrelated lint/test cleanup.
5. **Do-NOT-Load.**
   - `engine/`
   - `graphify-out/`
   - `kiyaapp/`
   - `research-worker/platform-skills/`
   - `research-worker/platform-skills-zips-only/`
6. **Size classification.** half-day because this is a narrow visible UI addition with tests, but it crosses read-model shape, workspace placement, and existing dirty checkout safety.

## Discover Audit

- Completed: 2026-05-07
- Assumption: the terse user message points to commit `665fc6d4` as the handoff to implement, not merely summarize.
- Classification rationale: the card is larger than a 10-minute fix because it requires test-first UI integration and persisted run-view mapping, but it should not require runtime or schema changes.

## Plan

| # | Atom | Model | Budget | Verification |
|---|------|-------|--------|--------------|
| 1 | Inspect `src/lib/journey/run-view.ts` and active `/journey` workspace placement only | Sonnet | 10m / 20 calls | Exact props/data adapter identified in this note |
| 2 | Add focused failing component tests for ordered stages, dependency reasons, latest event/elapsed, and failure/blocker reasons | Sonnet | 15m / 25 calls | Targeted Vitest command fails for missing panel behavior |
| 3 | Implement the minimal stage/status panel component and `/journey` workspace integration | Sonnet | 25m / 40 calls | Targeted Vitest command passes |
| 4 | Run focused lint/test/build checks allowed by the dirty checkout | Sonnet | 20m / 20 calls | Verification output appended to this note |

## Plan Audit

- Total atom count: 4
- Estimated total time: 70 minutes
- Dependencies: atom 2 depends on atom 1; atom 3 depends on atom 2 RED; atom 4 depends on atom 3 GREEN.

## Build Audit

| Atom | Actual | Verification |
|---|---:|---|
| 1 | 10m | Active placement identified: `src/components/workspace/workspace-page.tsx` under the nav, using `/api/journey/session` `view`. |
| 2 | 10m | RED observed with `npm run test:run -- src/components/workspace/__tests__/journey-run-stage-panel.test.tsx`; failed because `journey-run-stage-panel` was absent. |
| 3 | 20m | GREEN observed with `npm run test:run -- src/components/workspace/__tests__/journey-run-stage-panel.test.tsx`; 1/1 test passed. |
| 4 | 20m | Focused verification and broader gates recorded below. |

## Verification Report

- Focused tests passed: `npm run test:run -- src/lib/journey/__tests__/run-view.test.ts src/lib/journey/__tests__/research-job-activity.test.ts src/lib/journey/__tests__/research-realtime.test.ts src/components/workspace/__tests__/workspace-hydration.test.ts src/components/workspace/__tests__/journey-run-stage-panel.test.tsx src/lib/workspace/__tests__/pipeline.test.ts` -> 36/36 tests passed.
- Touched-file lint passed: `npm run lint -- src/components/workspace/journey-run-stage-panel.tsx src/components/workspace/workspace-page.tsx src/components/workspace/__tests__/journey-run-stage-panel.test.tsx`.
- Full test suite remained red outside this card: 7 files failed, 21 tests failed, including `src/lib/ad-library/__tests__/name-matcher.test.ts`, `src/lib/ad-library/__tests__/false-positive-prevention.test.ts`, `src/lib/journey/__tests__/session-state-server.test.ts`, `src/components/journey/__tests__/prefill-stream-view.test.tsx`, `src/lib/workspace/__tests__/card-taxonomy.test.ts`, `src/lib/journey/__tests__/read-research-result.test.ts`, and `src/lib/journey/__tests__/research-sandbox-smoke-checklist.test.ts`.
- Full lint remained red outside this card: 160 total problems, including existing `aigos-design-system-v2.jsx`, React compiler/hook errors in chat/workspace/assets hooks, and pre-existing `no-explicit-any` violations in Firecrawl/media-plan/strategic-blueprint files.
- Build compiled successfully and passed the TypeScript phase, then failed during prerender of `/_not-found` because Clerk publishable key is missing in the local environment.

## Spec Check

- Visible Journey/GTM stages render from persisted run-view order.
- Pending stages render upstream dependency wait reasons.
- Active stages render latest event and elapsed time when persisted activity is available.
- Error/partial stages render the plain-language `blocker` reason from the read model.
- The panel is integrated into `/journey` workspace only; no `/gtm` route or worker behavior was added.
