# GTM-005 / GTM-006 Next Session Handoffs

Execution update:

- `GTM-005 - Render grouped stage event log` is implemented in the active `/journey` workspace as `src/components/workspace/journey-run-event-log.tsx`.
- `GTM-006 - Render blocker UX` is implemented in the active `/journey` workspace as `src/components/workspace/journey-run-blocker-panel.tsx`.
- The active Kanban tracker is now `docs/affine/pages/04-backlog-kanban.md`.
- Focused Journey/workspace verification passed; full suite remains red from unrelated existing failures.

Source context:

- Active repo: `/Users/ammar/Dev-Projects/AI-GOS`
- Historical board source: commit `665fc6d4 docs: hand off GTM-004 stage panel`
- Active runtime truth: `/journey` is canonical in this checkout; do not revive stale `/gtm` routes or `src/components/gtm/*` paths.
- Latest completed run-visibility commit: `1c83d886 feat(journey): render run stage panel`
- Current checkout is dirty. Start every session with status/diff classification and never stage unrelated dirt.

## Next Session Handoff - GTM-005

Task:

`GTM-005 - Render grouped stage event log`

Starting point:

- Active repo: `/Users/ammar/Dev-Projects/AI-GOS`
- Completed prior commits:
  - `fa8aa45a feat(journey): add run view read model`
  - `6110d980 feat(journey): hydrate workspace from run view`
  - `1c83d886 feat(journey): render run stage panel`
- Prior files: `src/lib/journey/run-view.ts`, `src/lib/journey/research-job-activity-core.ts`, `src/app/api/journey/session/route.ts`, `src/components/workspace/workspace-hydration.ts`, `src/components/workspace/workspace-page.tsx`, `src/components/workspace/journey-run-stage-panel.tsx`, `src/components/workspace/__tests__/journey-run-stage-panel.test.tsx`.
- Current `/api/journey/session` response includes `view.sections[*].events`, `view.sections[*].latestEvent`, `view.eventsBySection`, and `jobStatus`.
- The stage panel already renders the primary status map. GTM-005 should add readable event inspection, not duplicate status cards.

Specialist agent team:

- Product/Scope Lead: restate that `/journey` is canonical, reject stale `/gtm` component paths, and decide whether the event log belongs below `JourneyRunStagePanel` or inside a compact expandable section.
- Repo Explorer A: inspect `JourneyRunStagePanel`, `WorkspacePage`, and workspace tests to find the smallest integration point.
- Repo Explorer B: inspect `run-view.ts`, `research-job-activity-core.ts`, and `useResearchJobActivity` to confirm event ordering, live polling shape, and metadata shape.
- TDD Implementer: owns code changes only after RED tests are written and observed failing.
- Spec Reviewer: checks that events are readable by stage and raw JSON is not the primary UX.
- Code Quality Reviewer: checks minimal diff, strict types, no client/server import violations, no worker behavior changes, and no `git add .`.
- QA Operator: runs browser checks only if the implementation creates a visible expandable event log.

Workflow:

1. EXPLORE / RESEARCH FIRST: use read-only inspection for UI placement and event data shape. Do not edit during this step.
2. SCOPE: Product/Scope Lead confirms the active `/journey` surface and rejects stale `/gtm` file hints if the active repo truth conflicts.
3. RED: write focused failing tests for grouped-by-stage events, latest event visible by default, expandable full event history, error/blocker/timeout plain-language context, and metadata staying diagnostic.
4. GREEN: implement the smallest event-log component and minimal workspace integration.
5. REFACTOR: extract shared formatting only if it removes real duplication with `JourneyRunStagePanel`; do not broaden the read model unless a test proves the gap.
6. REVIEW: run spec review, code-quality review, focused tests, touched-file lint, then broader test/build as environment allows.

Implementation prompt:

```text
You are picking up GTM-005 in /Users/ammar/Dev-Projects/AI-GOS.

Read first:
- AGENTS.md
- docs/journey-ai-layer-architecture-2026-05-07.md
- src/lib/journey/run-view.ts
- src/lib/journey/research-job-activity-core.ts
- src/lib/journey/research-job-activity.ts
- src/app/api/journey/session/route.ts
- src/components/workspace/workspace-page.tsx
- src/components/workspace/journey-run-stage-panel.tsx
- src/components/workspace/__tests__/journey-run-stage-panel.test.tsx

Use specialist agents:
- parallel read-only explorers for workspace placement and run-view/event shape
- product/scope lead before implementation
- one implementer only
- spec reviewer before code-quality reviewer
- QA operator only if browser-visible UI is added

Use TDD and dirty-repo safety:
- start with git status --short and inspect target-file diffs
- do not use git add .
- do not edit or stage unrelated dirty files
- no production code before a failing test
- verify RED
- implement minimal GREEN
- refactor only after focused tests pass

Goal:
Render a grouped Journey stage event log from persisted run-view data so the user can inspect what happened during a run without reading raw event JSON.

Acceptance criteria:
- events group by Journey stage in persisted stage order
- each stage shows the latest event without expanding the full group
- full event lists are expandable
- error, blocker, and timeout events show plain-language context
- event metadata remains secondary/diagnostic, not primary copy
- refresh preserves the event log from persisted data
- no /gtm runtime is added
- no worker behavior changes

Likely implementation shape:
- add `src/components/workspace/journey-run-event-log.tsx`
- add `src/components/workspace/__tests__/journey-run-event-log.test.tsx` or extend a focused workspace integration test if that is smaller
- integrate near `JourneyRunStagePanel` in `src/components/workspace/workspace-page.tsx`
- only adjust `src/lib/journey/run-view.ts` if the existing `events` shape cannot satisfy the test

Verification:
- npm run test:run -- src/components/workspace/__tests__/journey-run-event-log.test.tsx src/components/workspace/__tests__/journey-run-stage-panel.test.tsx src/lib/journey/__tests__/run-view.test.ts src/lib/journey/__tests__/research-job-activity.test.ts src/lib/journey/__tests__/research-realtime.test.ts
- touched-file lint
- npm run test:run, noting unrelated existing failures if any
- npm run build, noting environment blockers such as missing Clerk key if any
```

## Next Session Handoff - GTM-006

Task:

`GTM-006 - Render blocker UX`

Starting point:

- Active repo: `/Users/ammar/Dev-Projects/AI-GOS`
- Completed prior commits:
  - `fa8aa45a feat(journey): add run view read model`
  - `6110d980 feat(journey): hydrate workspace from run view`
  - `1c83d886 feat(journey): render run stage panel`
  - Add the GTM-005 commit hash here after the grouped event log lands.
- Prior files: `src/lib/journey/run-view.ts`, `src/lib/journey/research-job-activity-core.ts`, `src/app/api/journey/session/route.ts`, `src/components/workspace/workspace-page.tsx`, `src/components/workspace/journey-run-stage-panel.tsx`, and the GTM-005 event-log component once it exists.
- Current read model already exposes `view.status`, `view.sections[*].status`, `view.sections[*].blocker`, `view.sections[*].pendingDependencyReason`, `view.sections[*].latestEvent`, and `view.sections[*].activity.error`.
- The GTM-004 panel shows compact blocker text on stage cards. GTM-006 should add a clear top-level blocked-run answer: why it stopped and what the operator should do next.

Specialist agent team:

- Product/Scope Lead: define the exact user-facing blocker copy and confirm that remediation is informational only unless an existing retry control already exists.
- Repo Explorer A: inspect `JourneyRunStagePanel`, GTM-005 event log if landed, `ArtifactCanvas` retry behavior, and workspace placement.
- Repo Explorer B: inspect `run-view.ts`, stored result error shapes, `ResearchJobActivity.error`, and any source-gap/error metadata already persisted.
- TDD Implementer: owns code changes only after RED tests are written and observed failing.
- Spec Reviewer: checks that the blocker UX answers "why did it stop?" and "what can I do next?" without hiding diagnostics.
- Code Quality Reviewer: checks minimal diff, strict types, no new schema/table, no worker behavior changes, and no `git add .`.
- QA Operator: runs browser checks only if a visible blocker panel is added.

Workflow:

1. PRECONDITION: confirm GTM-005 has landed or explicitly decide GTM-006 does not depend on the event-log component. Do not start if the target placement is ambiguous.
2. EXPLORE / RESEARCH FIRST: inspect the run-view blocker/error shape and existing retry/error UI. Do not edit during this step.
3. SCOPE: Product/Scope Lead decides whether the blocker panel sits above the stage map, below it, or replaces a calm empty state when the run is healthy.
4. RED: write focused failing tests for blocked stage label, blocker reason, remediation text, source-gap/error context, latest error event context, diagnostic details staying secondary, and healthy runs not showing blocker chrome.
5. GREEN: implement the smallest blocker panel and minimal workspace integration.
6. REFACTOR: keep derivation local unless multiple components need the same derived blocker model.
7. REVIEW: run spec review, code-quality review, focused tests, touched-file lint, then broader test/build as environment allows.

Implementation prompt:

```text
You are picking up GTM-006 in /Users/ammar/Dev-Projects/AI-GOS.

Read first:
- AGENTS.md
- docs/journey-ai-layer-architecture-2026-05-07.md
- src/lib/journey/run-view.ts
- src/lib/journey/research-job-activity-core.ts
- src/app/api/journey/session/route.ts
- src/components/workspace/workspace-page.tsx
- src/components/workspace/journey-run-stage-panel.tsx
- the GTM-005 event-log component/test if that card has landed
- src/components/workspace/artifact-canvas.tsx only to understand existing retry/error affordances; do not refactor it unless a test requires it

Use specialist agents:
- parallel read-only explorers for blocker data shape and UI placement
- product/scope lead before implementation
- one implementer only
- spec reviewer before code-quality reviewer
- QA operator only if browser-visible UI is added

Use TDD and dirty-repo safety:
- start with git status --short and inspect target-file diffs
- do not use git add .
- do not edit or stage unrelated dirty files
- no production code before a failing test
- verify RED
- implement minimal GREEN
- refactor only after focused tests pass

Goal:
Render a clear Journey blocker panel from persisted run-view data so the user can understand why a run stopped and what action is available next without reading raw diagnostics.

Acceptance criteria:
- blocked or failed run shows the blocked stage label
- reason is shown in plain language from `blocker`, result error, activity error, or latest error event
- remediation copy appears when available or uses a conservative default such as "Review the stage details and retry the section when the input or worker issue is resolved"
- source-gap blockers and latest error/timed-out context are handled without crashing
- raw metadata/details remain secondary/diagnostic
- healthy/running/queued runs do not show alarming blocker chrome
- no rerun controls are added unless an existing retry path is already present and explicitly wired
- no /gtm runtime is added
- no worker behavior or database schema changes

Likely implementation shape:
- add `src/components/workspace/journey-run-blocker-panel.tsx`
- add `src/components/workspace/__tests__/journey-run-blocker-panel.test.tsx`
- integrate above or near `JourneyRunStagePanel` in `src/components/workspace/workspace-page.tsx`
- only adjust `src/lib/journey/run-view.ts` if the existing blocker/error fields cannot satisfy the test

Verification:
- npm run test:run -- src/components/workspace/__tests__/journey-run-blocker-panel.test.tsx src/components/workspace/__tests__/journey-run-stage-panel.test.tsx src/lib/journey/__tests__/run-view.test.ts src/lib/journey/__tests__/research-job-activity.test.ts
- touched-file lint
- npm run test:run, noting unrelated existing failures if any
- npm run build, noting environment blockers such as missing Clerk key if any
```
