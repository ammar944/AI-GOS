# 04 - Journey Run Visibility Kanban

Canonical tracker for the active AIGOS run-visibility work in this checkout.

Historical source: commit `665fc6d4 docs: hand off GTM-004 stage panel`.

Current adaptation:

- Active repo: `/Users/ammar/Dev-Projects/AI-GOS`
- Active product surface: `/journey`
- Do not revive stale `/gtm` routes or `src/components/gtm/*` paths for these cards.
- The current checkout is dirty; every card must stage narrowly and preserve unrelated work.

## Operating Rules

- One implementation card equals one Codex session unless the user explicitly batches cards.
- Use TDD: RED, GREEN, refactor, verification.
- Use persisted Journey run-view data as the source for visibility UI.
- No worker behavior changes inside UI/read-model cards.
- No raw JSON as the primary user-facing UX.
- No `git add .`.

## Now

### GTM-008 - Persist/replay Journey workspace messages across refresh

Status: Now / Needs rescope

Bucket: `01 Journey Run Visibility MVP`

Scope note:

The historical card targeted `gtm_messages`. Re-read the active Journey chat/session storage before implementation and preserve the Vercel AI SDK `/api/journey/stream` contract.

## Next

### GTM-009 - Browser QA `/journey` run visibility refresh flow

Status: Next after GTM-007/GTM-008 scope is confirmed

Bucket: `01 Journey Run Visibility MVP`

Goal:

Prove the Journey run workspace shows stage status, blocker state, grouped events, hydrated cards, chat, and refresh recovery from a real browser session.

## Done

### GTM-007 - Rescope persisted artifact/card visibility

Status: Done

Bucket: `01 Journey Run Visibility MVP`

Files:

- `src/components/workspace/journey-run-artifact-visibility-panel.tsx`
- `src/components/workspace/__tests__/journey-run-artifact-visibility-panel.test.tsx`
- `src/components/workspace/workspace-page.tsx`
- `src/components/workspace/__tests__/journey-run-stage-panel.test.tsx`

Outcome:

Persisted Journey outputs now render in a section-grouped artifact visibility panel below the run map. Each section shows whether the persisted output has visible workspace cards, flags persisted outputs that do not produce user-facing cards, and keeps source, citation, card-version, duration, and validation diagnostics behind secondary metadata disclosure. No `/gtm` runtime code, worker behavior, or database schema changed.

Verification:

```bash
npm run test:run -- src/components/workspace/__tests__/journey-run-artifact-visibility-panel.test.tsx src/components/workspace/__tests__/journey-run-event-log.test.tsx src/components/workspace/__tests__/journey-run-blocker-panel.test.tsx src/components/workspace/__tests__/journey-run-stage-panel.test.tsx src/components/workspace/__tests__/workspace-hydration.test.ts src/lib/journey/__tests__/run-view.test.ts src/lib/journey/__tests__/research-job-activity.test.ts src/lib/journey/__tests__/research-realtime.test.ts
npm run lint -- src/components/workspace/journey-run-artifact-visibility-panel.tsx src/components/workspace/workspace-page.tsx src/components/workspace/__tests__/journey-run-artifact-visibility-panel.test.tsx src/components/workspace/__tests__/journey-run-stage-panel.test.tsx
npm run test:run
npm run build
```

Result:

- RED was verified by the missing artifact visibility component import.
- GREEN focused Journey/workspace tests passed: 27/27.
- Touched-file lint passed.
- Full `npm run test:run` is still red from unrelated existing failures outside these files.
- `npm run build` compiled and passed TypeScript, then failed prerender because Clerk publishable key is missing.

### GTM-006 - Render blocker UX

Status: Done

Bucket: `01 Journey Run Visibility MVP`

Files:

- `src/components/workspace/journey-run-blocker-panel.tsx`
- `src/components/workspace/__tests__/journey-run-blocker-panel.test.tsx`
- `src/components/workspace/workspace-page.tsx`
- `src/components/workspace/__tests__/journey-run-stage-panel.test.tsx`

Outcome:

Failed or partial Journey run views now show a top-level blocker panel above the stage map. The panel names the blocked stage, gives the plain-language reason, shows latest error context, provides conservative remediation copy, and keeps diagnostic IDs secondary.

Verification:

```bash
npm run test:run -- src/components/workspace/__tests__/journey-run-event-log.test.tsx src/components/workspace/__tests__/journey-run-blocker-panel.test.tsx src/components/workspace/__tests__/journey-run-stage-panel.test.tsx src/lib/journey/__tests__/run-view.test.ts src/lib/journey/__tests__/research-job-activity.test.ts src/lib/journey/__tests__/research-realtime.test.ts
npm run lint -- src/components/workspace/journey-run-event-log.tsx src/components/workspace/journey-run-blocker-panel.tsx src/components/workspace/workspace-page.tsx src/components/workspace/__tests__/journey-run-event-log.test.tsx src/components/workspace/__tests__/journey-run-blocker-panel.test.tsx src/components/workspace/__tests__/journey-run-stage-panel.test.tsx
```

Result:

- Focused Journey/workspace tests passed: 22/22.
- Touched-file lint passed.
- Full `npm run test:run` is still red from unrelated existing failures outside these files.
- `npm run build` compiled and passed TypeScript, then failed prerender because Clerk publishable key is missing.

### GTM-005 - Render grouped stage event log

Status: Done

Bucket: `01 Journey Run Visibility MVP`

Files:

- `src/components/workspace/journey-run-event-log.tsx`
- `src/components/workspace/__tests__/journey-run-event-log.test.tsx`
- `src/components/workspace/workspace-page.tsx`
- `src/components/workspace/__tests__/journey-run-stage-panel.test.tsx`

Outcome:

Persisted Journey run events now render below the stage map, grouped by stage order. Each stage shows the latest event by default, full history is expandable, blocker/error/timeout context is plain-language, and metadata stays in secondary diagnostics.

Verification:

```bash
npm run test:run -- src/components/workspace/__tests__/journey-run-event-log.test.tsx src/components/workspace/__tests__/journey-run-blocker-panel.test.tsx src/components/workspace/__tests__/journey-run-stage-panel.test.tsx src/lib/journey/__tests__/run-view.test.ts src/lib/journey/__tests__/research-job-activity.test.ts src/lib/journey/__tests__/research-realtime.test.ts
npm run lint -- src/components/workspace/journey-run-event-log.tsx src/components/workspace/journey-run-blocker-panel.tsx src/components/workspace/workspace-page.tsx src/components/workspace/__tests__/journey-run-event-log.test.tsx src/components/workspace/__tests__/journey-run-blocker-panel.test.tsx src/components/workspace/__tests__/journey-run-stage-panel.test.tsx
```

Result:

- RED was verified by missing component imports.
- GREEN focused tests passed: 22/22.
- Touched-file lint passed.

### GTM-004 - Render stage DAG/status panel

Status: Done

Bucket: `01 Journey Run Visibility MVP`

Completed commit:

- `1c83d886 feat(journey): render run stage panel`

Outcome:

The Journey workspace renders the persisted stage map with status, latest event, elapsed time, dependency reason, and blocker context.

### GTM-003 - Hydrate workspace from Journey run view

Status: Done

Completed commit:

- `6110d980 feat(journey): hydrate workspace from run view`

### GTM-002 - Build Journey run view read model

Status: Done

Completed commit:

- `fa8aa45a feat(journey): add run view read model`

## Blocked / Needs Decision

### GTM-010 - Dirty repo classification and cleanup

Status: Blocked / Needs Decision

Reason:

The checkout has substantial unrelated dirty work across app, worker, config, generated folders, and local agent folders. Cleanup requires a dedicated classification pass before deleting, reverting, or staging anything broad.
