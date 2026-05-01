# 04 - GTM Run Kanban

Canonical tracker for the current AIGOS execution board.

Static visual mirror:

```text
docs/affine/gtm-run-kanban.html
```

Source order:

1. `AGENTS.md`
2. `program.md`
3. `docs/GTM_RUN_CONTRACT.md`
4. this Kanban page

## Operating Rule

AIGOS is not an AI chat app. AIGOS is a supervised GTM run system.

Until the GTM run workspace is trustworthy, do not prioritize Slack agents, full media plan automation, client success workflows, landing page workspaces, or extra research skills.

One Codex session equals one card. Each card must end with verification, diff review, and an atomic commit boundary.

## Agent Team

- Product Head: owns task priority, product outcome, and acceptance criteria.
- Engineering Lead: converts cards into Codex-ready implementation specs.
- Codex Implementer: executes one card per session.
- Reviewer: reviews the diff against `AGENTS.md`, `program.md`, and `docs/GTM_RUN_CONTRACT.md`.
- QA Operator: runs browser checks and verification after UI slices.

Rules:

- No parallel coding agents in this dirty checkout.
- No `git add .`.
- No broad cleanup without an exact cleanup card.
- No worker behavior changes inside UI/read-model cards.
- No raw JSON as the primary user-facing UX.

## Now

### GTM-002 - Build `getGtmRunView` read model

Status: Now

Bucket: `01 GTM Run Visibility MVP`

Owner: Engineering Lead -> Codex Implementer

Session type: one Codex implementation session

Source: `program.md` Step 3, `docs/GTM_RUN_CONTRACT.md`

Goal:

Create one testable helper that loads and normalizes the `/gtm/[runId]` state into a single view object.

Outcome:

`/gtm/[runId]` can consume one normalized run object instead of stitching raw Supabase rows in the page and `ChatShell`.

Likely files:

- `src/lib/gtm/run-view.ts` or closest existing convention
- `src/lib/gtm/run-view.test.ts`
- `src/app/gtm/[runId]/page.tsx` only if needed for type alignment

Non-goals:

- Do not change worker behavior.
- Do not redesign the database.
- Do not rebuild `ChatShell`.
- Do not touch unrelated GTM routes.

Acceptance criteria:

- Returns run metadata.
- Returns ordered stage list.
- Returns latest event per stage.
- Returns events grouped by stage.
- Returns artifacts grouped by skill/stage.
- Returns messages in chronological order.
- Derives human-readable blockers.
- Derives pending dependency reasons.
- Missing events, artifacts, and messages do not crash.
- Clerk `user_id` scoping stays intact.

Verification commands:

```bash
npm run test:run -- src/lib/gtm
npm run test:run
```

Reviewer role:

Check contract drift, status mapping, blocker derivation, and accidental scope expansion.

Commit boundary:

Only the read-model helper, focused tests, and the smallest consumer/type adjustment if required.

## Next

### GTM-003 - Wire run page to read model

Status: Next

Bucket: `01 GTM Run Visibility MVP`

Owner: Engineering Lead -> Codex Implementer

Session type: one Codex implementation session

Source: `GTM-002`, `docs/GTM_RUN_CONTRACT.md`

Goal:

Make `/gtm/[runId]` load through `getGtmRunView`.

Outcome:

The run page receives a normalized object and stops duplicating Supabase row stitching.

Likely files:

- `src/app/gtm/[runId]/page.tsx`
- `src/components/gtm/ChatShell.tsx` only for prop shape alignment
- focused page/component tests if existing test harness supports it

Non-goals:

- Do not redesign the page layout.
- Do not add new stage UI.
- Do not alter worker dispatch.

Acceptance criteria:

- Existing run page behavior is preserved.
- Auth redirect and not-found behavior are preserved.
- Run, events, artifacts, and messages come from the read model.
- Empty optional collections render safely.
- No raw contract logic is reimplemented in the page.

Verification commands:

```bash
npm run test:run -- src/components/gtm src/app/api/gtm
npm run test:run
```

Reviewer role:

Check that page behavior did not regress and that data normalization is not duplicated.

Commit boundary:

Only run page/read-model consumer wiring and tests.

### GTM-004 - Render stage DAG/status panel

Status: Next

Bucket: `01 GTM Run Visibility MVP`

Owner: Product Head -> Codex Implementer

Session type: one Codex UI session

Source: `docs/GTM_RUN_CONTRACT.md` UI Rendering Contract

Goal:

Show the ordered GTM stage map with status, latest event, elapsed time, blocker, and dependency wait reason.

Outcome:

A user can see what is running, done, blocked, failed, or waiting without reading the event log.

Likely files:

- `src/components/gtm/stage-dag-panel.tsx`
- `src/components/gtm/stage-dag-panel.test.tsx`
- `src/components/gtm/ChatShell.tsx`

Non-goals:

- Do not build drag/drop.
- Do not add worker controls.
- Do not invent new statuses.

Acceptance criteria:

- Visible Lighthouse stages render in order.
- Pending stages explain upstream dependency.
- Active stages show latest event and elapsed time when available.
- Blocked, errored, and timed-out stages show plain-language reason.
- Refresh preserves rendered state from persisted data.

Verification commands:

```bash
npm run test:run -- src/components/gtm
npm run test:run
```

Reviewer role:

Check visual clarity, status mapping, and no raw JSON exposure.

Commit boundary:

Only the stage panel component, tests, and minimal page integration.

### GTM-005 - Render grouped stage event log

Status: Next

Bucket: `01 GTM Run Visibility MVP`

Owner: Engineering Lead -> Codex Implementer

Session type: one Codex UI session

Source: `docs/GTM_RUN_CONTRACT.md` Stage Event Types

Goal:

Make stage events readable by stage instead of a noisy raw timeline.

Outcome:

The user can inspect what happened during a run without reading raw event JSON.

Likely files:

- `src/components/gtm/stage-event-log.tsx`
- `src/components/gtm/stage-event-log.test.tsx`
- `src/components/gtm/ChatShell.tsx`

Non-goals:

- Do not change event persistence.
- Do not add filters that require new state storage.
- Do not hide technical errors from diagnostics.

Acceptance criteria:

- Events group by stage.
- Latest event is visible without expanding the full group.
- Full event list is expandable.
- Error, blocker, and timeout events show plain-language context.
- Metadata stays secondary/diagnostic.

Verification commands:

```bash
npm run test:run -- src/components/gtm
npm run test:run
```

Reviewer role:

Check event ordering, grouping, and diagnostics vs primary UX.

Commit boundary:

Only event log component, tests, and minimal integration.

### GTM-006 - Render blocker UX

Status: Next

Bucket: `01 GTM Run Visibility MVP`

Owner: Product Head -> Codex Implementer

Session type: one Codex UI/read-model session

Source: `docs/GTM_RUN_CONTRACT.md` Blocker Model

Goal:

Give blocked or failed runs a clear reason and next action.

Outcome:

A user understands why the run stopped and what to do next.

Likely files:

- `src/components/gtm/blocker-panel.tsx`
- `src/components/gtm/blocker-panel.test.tsx`
- `src/lib/gtm/run-view.ts`

Non-goals:

- Do not implement rerun controls unless already present.
- Do not suppress worker error details.
- Do not add new blocker table/schema.

Acceptance criteria:

- Shows blocked stage label.
- Shows reason and remediation when available.
- Handles source-gap blockers.
- Handles latest `blocked`, `errored`, and `timed_out` event context.
- Keeps raw details in diagnostics, not as primary copy.

Verification commands:

```bash
npm run test:run -- src/lib/gtm src/components/gtm
npm run test:run
```

Reviewer role:

Check that blocked UX answers "why did it stop?" and "what can I do next?"

Commit boundary:

Only blocker derivation/display and tests.

### GTM-007 - Render artifact cards from persisted artifacts

Status: Next

Bucket: `01 GTM Run Visibility MVP`

Owner: Product Head -> Codex Implementer

Session type: one Codex UI session

Source: `docs/GTM_RUN_CONTRACT.md` Artifact Types

Goal:

Show persisted `gtm_artifacts` as user-readable outputs grouped by skill/stage/version.

Outcome:

A user can see what the GTM run produced without inspecting stage debug output.

Likely files:

- `src/components/gtm/ArtifactCard.tsx`
- `src/components/gtm/ArtifactCard.test.tsx`
- `src/lib/gtm/run-view.ts`

Non-goals:

- Do not create new artifact schema.
- Do not add editing/patching controls.
- Do not parse raw stage output as a replacement for `gtm_artifacts`.

Acceptance criteria:

- Artifacts group by skill/stage.
- Latest version is obvious.
- Older versions remain reachable or clearly listed.
- `source` and `version` are visible as metadata.
- Empty artifact state is calm and non-crashing.

Verification commands:

```bash
npm run test:run -- src/components/gtm src/lib/gtm
npm run test:run
```

Reviewer role:

Check that artifact UI is readable, version-aware, and contract-aligned.

Commit boundary:

Only artifact grouping/display and tests.

### GTM-008 - Persist and replay GTM messages across refresh

Status: Next

Bucket: `01 GTM Run Visibility MVP`

Owner: Engineering Lead -> Codex Implementer

Session type: one Codex API/UI session

Source: `docs/GTM_RUN_CONTRACT.md` Message Roles and Types

Goal:

Make the `/gtm/[runId]` transcript survive page refresh.

Outcome:

Persisted `gtm_messages` reload chronologically before or alongside live stream messages.

Likely files:

- `src/app/api/gtm/runs/[runId]/chat/route.ts`
- `src/components/gtm/ChatShell.tsx`
- `src/lib/gtm/agent-messages.ts`

Non-goals:

- Do not redesign chat.
- Do not invent new message roles or types.
- Do not remove temporary missing-table resilience until migration rollout is confirmed.

Acceptance criteria:

- User messages persist.
- Assistant/tool/system messages needed for replay persist.
- Messages sort by `created_at`.
- Refresh preserves visible transcript.
- Missing rows do not crash.

Verification commands:

```bash
npm run test:run -- src/app/api/gtm/runs/[runId]/chat src/components/gtm src/lib/gtm
npm run test:run
```

Reviewer role:

Check persistence, replay order, duplicate-message risk, and migration assumptions.

Commit boundary:

Only message persistence/replay changes and tests.

### GTM-009 - Browser QA `/gtm/new -> /gtm/[runId] -> refresh`

Status: Next

Bucket: `01 GTM Run Visibility MVP`

Owner: QA Operator

Session type: one QA session after UI slices land

Source: `program.md` Step 8

Goal:

Prove the run workspace works as a user workflow.

Outcome:

The team has a real browser QA report for create-run, run page, stage visibility, artifacts/messages, blocked state, and refresh.

Likely files:

- QA report only, unless defects are found and separately tasked

Non-goals:

- Do not fix bugs inside the QA report session unless explicitly scoped.
- Do not run paid external API loops.
- Do not clean unrelated repo noise.

Acceptance criteria:

- `/gtm/new` creates a run.
- Redirect lands on `/gtm/[runId]`.
- Stage state appears.
- Events appear.
- Artifacts appear when produced.
- Blocked/error state is readable if produced.
- Refresh preserves transcript, stages, events, and artifacts.

Verification commands:

```bash
npm run dev
cd research-worker && npm run dev
```

Reviewer role:

Check the QA report for exact URLs, observed state, failures, screenshots if useful, and follow-up bug cards.

Commit boundary:

QA report only, or no commit if no file is created.

## Blocked / Needs Decision

### GTM-010 - Classify dirty repo noise before cleanup

Status: Blocked / Needs Decision

Bucket: `00 Repo Truth Layer`

Owner: Engineering Lead

Session type: one read-only cleanup planning session

Source: `AGENTS.md` Dirty Worktree Policy, `program.md` Cleanup Protocol

Goal:

Classify generated noise and intentional work before deleting or reverting anything.

Outcome:

A cleanup report splits dirty files into keep-and-commit, generated-and-gitignored, safe-to-delete-after-approval, and needs-owner-decision.

Likely files:

- cleanup report path to be chosen when this card is active

Non-goals:

- Do not delete files.
- Do not revert files.
- Do not edit source code.
- Do not stage broad folders.

Acceptance criteria:

- Uses `git status --short`.
- Uses targeted diffs for representative paths.
- Separates `.omc`, `.claude`, `skills`, `research-worker`, `src`, and `supabase`.
- Produces exact cleanup candidates.
- Stops for owner approval before deletion.

Verification commands:

```bash
git status --short
git --no-pager diff --name-only
```

Reviewer role:

Check that no cleanup action is hidden in the classification task.

Commit boundary:

Report only.

### GTM-011 - Refresh stale AFFiNE Command Center

Status: Blocked / Needs Decision

Bucket: `00 Repo Truth Layer`

Owner: Product Head

Session type: one docs-only session after this board lands

Source: `docs/affine/pages/00-command-center.md`

Goal:

Update stale AFFiNE command-center language so it no longer frames the older research surface as the current production focus.

Outcome:

AFFiNE command center points to `/gtm`, Milestone 1, and this Kanban board.

Likely files:

- `docs/affine/pages/00-command-center.md`

Non-goals:

- Do not touch app code.
- Do not rewrite every AFFiNE page.
- Do not change `program.md` unless the product direction changes.

Acceptance criteria:

- Current focus is GTM Run Visibility.
- Older research-surface production flow is marked legacy or removed.
- Links point to `AGENTS.md`, `program.md`, `docs/GTM_RUN_CONTRACT.md`, and this board.
- Daily workflow matches one-card-per-session execution.

Verification commands:

```bash
rg -n "GTM|Milestone 1|04-backlog-kanban" docs/affine/pages/00-command-center.md
git --no-pager diff -- docs/affine/pages/00-command-center.md
```

Reviewer role:

Check that command-center language does not reintroduce stale architecture.

Commit boundary:

Only the command-center page.

## Done

### GTM-000 - Lock AGENTS/program control layer

Status: Done

Bucket: `00 Repo Truth Layer`

Owner: Engineering Lead

Session type: completed docs session

Source: commit `58060279`

Goal:

Make future agents start from the active `/gtm` product truth.

Outcome:

`AGENTS.md` and `program.md` define the current GTM-first execution model.

Acceptance criteria:

- `AGENTS.md` points agents at `program.md`.
- `/gtm` is marked active product surface.
- Broad feature buckets are marked not agent-ready.
- Sprint order starts with GTM run visibility.

Verification commands:

```bash
test -f AGENTS.md program.md
git --no-pager diff --check -- AGENTS.md program.md
```

Reviewer role:

Check future-agent clarity and task sizing.

Commit boundary:

Completed commit `58060279 docs: lock GTM run program`.

### GTM-001 - Define GTM run contract

Status: Done

Bucket: `00 Repo Truth Layer`

Owner: Engineering Lead

Session type: completed docs session

Source: commit `96cf9458`

Goal:

Create a source-of-truth document for run, stage, event, artifact, message, blocker, and dependency semantics.

Outcome:

`docs/GTM_RUN_CONTRACT.md` gives frontend and worker agents one shared contract.

Acceptance criteria:

- Defines run lifecycle statuses.
- Defines stage lifecycle statuses.
- Defines stage event types.
- Defines artifact and message semantics.
- Defines blocker model and dependency behavior.
- Defines worker and Next app responsibilities.

Verification commands:

```bash
test -f docs/GTM_RUN_CONTRACT.md
git --no-pager diff --check -- docs/GTM_RUN_CONTRACT.md
```

Reviewer role:

Check contract alignment against migrations and helpers.

Commit boundary:

Completed commit `96cf9458 docs: define GTM run contract`.

## Parking Lot

These are real product areas, but they are intentionally parked until Milestone 1 is stable.

### Canonical GTM Brief

Status: Parking Lot

Bucket: `02 Canonical GTM Brief`

Reason parked:

The run workspace must first make state, blockers, and artifacts understandable.

Next likely first card:

Define the visible Business Profile/GTM Brief object before research dispatch.

### Research Skill Reliability

Status: Parking Lot

Bucket: `03 Research Skill Reliability`

Reason parked:

More skill work will produce more confusing output unless the run workspace explains progress and failures.

Next likely first card:

Audit current Lighthouse skill blockers from the run view after GTM-009.

### Artifact Workspace

Status: Parking Lot

Bucket: `04 Artifact Workspace`

Reason parked:

Artifact interaction should follow after artifacts render reliably from persisted state.

Next likely first card:

Define artifact version actions after GTM-007 proves read-only artifact cards.

### Media Plan Automation

Status: Parking Lot

Bucket: `05 Media Plan Automation`

Reason parked:

Media plan generation depends on trustworthy upstream research artifacts.

Next likely first card:

Add a `media_plan` artifact renderer only after core artifact cards are stable.

### Script / Creative Automation

Status: Parking Lot

Bucket: `06 Script / Creative Automation`

Reason parked:

Creative automation depends on reliable strategy, VoC, offer, and media plan artifacts.

Next likely first card:

Define script-pack artifact inputs from completed GTM runs.

### Client Success Automation

Status: Parking Lot

Bucket: `07 Client Success Automation`

Reason parked:

Client automation should not run until internal operator state is trustworthy.

Next likely first card:

Map client-facing statuses from stable internal run statuses.

### Slack / Client Communication Agent

Status: Parking Lot

Bucket: `08 Slack / Client Communication Agent`

Reason parked:

Communication agents should summarize known-good run state, not compensate for unclear state.

Next likely first card:

Design read-only Slack digest from the normalized run view.
