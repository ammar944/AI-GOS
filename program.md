# AIGOS Program

Date: 2026-05-01

## Core Direction

AIGOS is not an AI chat app. AIGOS is a supervised GTM run system.

The first product is not more intelligence. The first product is trust, state, visibility, and recoverability.

Build one trustworthy GTM run workspace before expanding automation.

## Current Milestone

### Milestone 1: Trustworthy GTM Run Workspace

Goal:

`/gtm/new -> create gtm_run -> worker runs stages -> gtm_stage_events stream in -> /gtm/[runId] shows progress -> blockers/errors are human-readable -> artifacts are visible -> refresh preserves state`

This milestone is complete only when a user can answer:

- What did the GTM agent do?
- What is it doing now?
- What did it produce?
- What blocked?
- What can I do next?
- Did refresh preserve the transcript and run state?

## Active Repo Truth

The active GTM surface is `/gtm`, not the older Journey research surface.

Current GTM tables:

- `gtm_runs`
- `gtm_stage_events`
- `gtm_artifacts`
- `gtm_messages`

Current frontend run page:

- `src/app/gtm/[runId]/page.tsx`
- `src/components/gtm/ChatShell.tsx`
- `src/components/gtm/AgentInvocationBlock.tsx`
- `src/components/gtm/ArtifactCard.tsx`

Current worker dispatch:

- `src/app/api/gtm/runs/[runId]/dispatch/route.ts`
- `src/lib/gtm/worker-dispatch.ts`
- `research-worker/src/gtm/dispatch-runner.ts`
- `research-worker/src/gtm/stage-events.ts`

Current issue:

The repo has working pieces, but the control layer is messy. Agents can see old Journey docs, newer `/gtm` code, multiple skill/runtime experiments, generated `.omc` state, and a very dirty checkout. That creates drift unless each task is small and verified.

## Non-Goals Until Milestone 1 Is Stable

Do not work on:

- Slack agent
- full media plan automation
- client success workflows
- landing page workspace
- extra research skills
- broad repo deletion cleanup

Cleanup is allowed only as scoped tasks with exact paths and a rollback plan.

## Board Structure

Use this board shape:

```text
AIGOS
  00 Repo Truth Layer
  01 GTM Run Visibility MVP
  02 Canonical GTM Brief
  03 Research Skill Reliability
  04 Artifact Workspace
  05 Media Plan Automation
  06 Script / Creative Automation
  07 Client Success Automation
  08 Slack / Client Communication Agent
```

## Today Plan

### Step 0: Protect the Current Checkout

Goal:

Understand the mess before cleaning it.

Actions:

- Run `git status --short`.
- Do not revert or delete anything yet.
- Bucket dirty files into product code, generated state, scratch output, docs, and config.
- Treat `.omc`, `.claude`, generated outputs, and skill folders as separate cleanup decisions.

Done when:

- The team knows which files are intentional work and which files are generated noise.

### Step 1: Lock Agent Instructions

Goal:

Make future agents start from the active GTM product truth.

Actions:

- Update `AGENTS.md`.
- Make it point to `program.md`.
- Make it explicit that `/gtm` is the active product surface.
- Make it explicit that broad feature buckets are not agent-ready tasks.

Done when:

- An agent reading `AGENTS.md` knows the current GTM architecture, the active milestone, and the task-size rule.

### Step 2: Write the GTM Run Contract

Goal:

Create the source of truth for run, stage, event, artifact, message, blocker, and dependency semantics.

Agent task:

```markdown
# Task: Create GTM Run Contract Doc

Read `AGENTS.md` and `program.md` first.

## Goal

Create a source-of-truth document for the GTM run lifecycle so the frontend, worker, and future agents all use the same language.

## Create

`docs/GTM_RUN_CONTRACT.md`

## The document must define

1. Run lifecycle statuses
2. Stage lifecycle statuses
3. Stage event types
4. Artifact types
5. Message roles
6. Blocker model
7. Dependency behavior
8. What the UI should render for each state
9. What the worker is responsible for
10. What the Next app is responsible for

## Constraints

- Do not edit code.
- Do not invent new tables unless clearly marked as future proposal.
- Use existing tables: `gtm_runs`, `gtm_stage_events`, `gtm_artifacts`, `gtm_messages`.
- Ground status names in the migrations and current TypeScript helpers.
- Keep it practical for implementation.

## Done When

- `docs/GTM_RUN_CONTRACT.md` exists.
- It gives enough detail for a frontend agent to build the run console.
- It gives enough detail for a worker agent to emit consistent events.
```

Verification:

- `test -f docs/GTM_RUN_CONTRACT.md`
- Review `git diff -- docs/GTM_RUN_CONTRACT.md`

### Step 3: Build the GTM Run Read Model

Goal:

Stop stitching run state manually in the page and chat shell.

Agent task:

```markdown
# Task: Build GTM Run Read Model

Read `AGENTS.md`, `program.md`, and `docs/GTM_RUN_CONTRACT.md` first.

## Goal

Create one read-model helper for `/gtm/[runId]` that loads and normalizes the run state.

## Expected Output

Implement `getGtmRunView(runId)` or the closest existing project convention.

It should return:

- run metadata
- normalized stage list
- latest event per stage
- grouped events by stage
- artifacts grouped by type/stage
- messages in chronological order
- derived blockers
- derived pending dependency reasons

## Constraints

- Do not change worker behavior.
- Do not redesign the database.
- Do not edit unrelated routes.
- Match existing Supabase and Next.js patterns.
- Keep the function testable.

## Acceptance Criteria

- `/gtm/[runId]` can consume one normalized object instead of stitching state manually.
- Missing events, artifacts, and messages do not crash the page.
- Blocked stages expose a human-readable blocker object.
- Pending downstream stages can explain which upstream stage they are waiting on.

## Verification

- Run the new focused tests.
- Run `npm run test:run`.
- Run `npm run build` if the test pass is clean.
```

### Step 4: Render Stage DAG Panel

Goal:

Show a compact run map that makes dependencies visible.

Acceptance criteria:

- Each visible stage shows label, status, latest event, elapsed time, and blocker reason if present.
- Pending downstream stages explain the upstream stage they are waiting on.
- No raw JSON is exposed to the user.
- Refresh keeps the same state.

### Step 5: Render Grouped Event Log

Goal:

Make events useful instead of a noisy raw timeline.

Acceptance criteria:

- Events are grouped by stage.
- Latest event is visible without expanding the full log.
- Full log can be expanded.
- Errors and blockers show human-readable context.

### Step 6: Render Artifact Cards

Goal:

Make produced outputs visible without forcing users into debug logs.

Acceptance criteria:

- Artifacts group by skill/stage.
- Versions are visible.
- Markdown content is readable.
- Missing artifacts do not crash the page.

### Step 7: Persist and Replay Messages

Goal:

Refresh must not wipe the GTM run transcript.

Acceptance criteria:

- User messages persist to `gtm_messages`.
- Assistant/tool/system messages needed for replay persist to `gtm_messages`.
- `/gtm/[runId]` rehydrates messages chronologically.
- Missing `gtm_messages` table still degrades gracefully only while migration rollout is incomplete.

### Step 8: Browser QA One Full Run

Goal:

Prove the whole slice from user input to visible run state.

Checklist:

- Open `/gtm/new`.
- Create a run.
- Confirm redirect to `/gtm/[runId]`.
- Dispatch a stage or full Lighthouse slice.
- Confirm stage events appear.
- Confirm blocker state is readable if blocked.
- Confirm artifacts appear if produced.
- Refresh the page.
- Confirm transcript, stages, events, and artifacts remain.

### Step 9: Commit

Goal:

Create a rollback point.

Actions:

- Stage only files for the completed slice.
- Commit with a clear message.
- Do not include unrelated dirty worktree changes.

## Cleanup Protocol

Do cleanup after the GTM run visibility contract exists, not before.

Cleanup task shape:

```markdown
# Task: Classify Generated Repo Noise

Read `AGENTS.md` and `program.md` first.

## Goal

Classify dirty/untracked files without deleting anything.

## Output

Create a cleanup report with buckets:

- keep and commit
- generated and gitignored
- safe to delete after approval
- needs owner decision

## Constraints

- Do not delete files.
- Do not revert files.
- Do not edit source code.
- Use `git status --short`, `git diff --name-only`, and targeted `git diff -- <path>`.
```

Only after that report should cleanup edits happen.

## Definition of Done

For each slice:

- The requested behavior exists.
- The smallest relevant tests pass.
- Broader tests/build run unless blocked by environment.
- The diff contains only task-related files.
- Risks and skipped checks are stated.
- The work is committed as an atomic checkpoint when the user asks to commit.
