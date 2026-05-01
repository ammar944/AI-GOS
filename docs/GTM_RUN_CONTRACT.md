# GTM Run Contract

Date: 2026-05-01

## Purpose

This document defines the shared language for the `/gtm` run workspace. Frontend, API routes, worker code, and future agents should use this contract before adding run console UI, worker events, artifact renderers, or message replay.

AIGOS is a supervised GTM run system. The first GTM milestone is not more automation; it is making one run trustworthy, visible, and recoverable.

## Source Files

Persisted data model:

- `supabase/migrations/20260430_create_gtm_runs.sql`
- `supabase/migrations/20260430_create_gtm_stage_events.sql`
- `supabase/migrations/20260501_create_gtm_artifacts.sql`
- `supabase/migrations/20260501_create_gtm_messages.sql`

Runtime helpers:

- `src/lib/gtm/stage-state.ts`
- `src/lib/gtm/stage-events.ts`
- `src/lib/gtm/stage-mapping.ts`
- `src/lib/gtm/agent-messages.ts`
- `src/lib/types/gtm-artifact.ts`
- `research-worker/src/gtm/dispatch-runner.ts`
- `research-worker/src/gtm/stage-events.ts`

Important drift to preserve until fixed:

- `src/lib/gtm/schemas/gtm-run.ts` contains the full declared stage order.
- Its `GTM_RUN_STATUSES` enum is older and does not match the persisted `gtm_runs.status` constraint.
- For `/gtm/[runId]`, the persisted `gtm_runs.status` values in this contract are authoritative.

## Tables

### `gtm_runs`

One row per user-created GTM run.

Important columns:

- `id`: UUID primary key.
- `run_id`: stable URL identifier used by `/gtm/[runId]`.
- `user_id`: Clerk text subject.
- `input_url`: prospect URL submitted at `/gtm/new`.
- `status`: run lifecycle status.
- `manifest`: schemaless run metadata.
- `stages`: JSON object keyed by stage name.
- `created_at`, `updated_at`: timestamps.

### `gtm_stage_events`

Append-only event stream for stage progress.

Important columns:

- `run_id`, `user_id`, `stage`
- `event_type`
- `message`
- `status`
- `metadata`
- `duration_ms`
- `tool_name`
- `artifact_path`
- `source_url`
- `error`
- `created_at`

### `gtm_artifacts`

Versioned markdown artifacts produced from skill output or agent patches.

Important columns:

- `run_id`, `user_id`
- `skill`
- `version`
- `parent_id`
- `content_md`
- `source`
- `created_by`
- `metadata`
- `created_at`

### `gtm_messages`

Persisted transcript messages for `/gtm/[runId]`.

Important columns:

- `run_id`, `user_id`
- `role`
- `message_type`
- `content`
- `status`
- `metadata`
- `created_at`

## Run Lifecycle Statuses

Persisted source: `gtm_runs.status`.

Allowed values:

- `queued`: Run exists but no stage has started. UI should show a waiting state and make dispatch availability clear.
- `running`: At least one visible stage is queued or running. UI should show live progress, latest event, and elapsed time for active stages.
- `awaiting_user`: A stage is blocked or has a blocker source gap. UI should show the blocked stage, blocker reason, remediation, and what the user can do next.
- `completed`: All stages in the active ordered slice completed. UI should show produced artifacts and a completed run summary.
- `partial`: Some stage output exists, but the active ordered slice is not fully complete and no stage is actively running. UI should show usable outputs plus the incomplete stages.
- `failed`: At least one stage errored or timed out. UI should show the failed stage, exact error context, and whether a rerun is available.

Derived-status rule:

1. If any active ordered stage is `errored` or `timed_out`, the run is `failed`.
2. Else if any active ordered stage is `blocked` or has a blocker source gap, the run is `awaiting_user`.
3. Else if any active ordered stage is `queued` or `running`, the run is `running`.
4. Else if every active ordered stage is `complete`, the run is `completed`.
5. Else if at least one active ordered stage is `complete`, the run is `partial`.
6. Else the run is `queued`.

Implementation note:

- Current helpers in `src/lib/gtm/stage-state.ts` and `research-worker/src/gtm/dispatch-runner.ts` follow this shape.
- The migration comment for `partial` mentions blocked output, but current code maps blockers to `awaiting_user`. Use `awaiting_user` for blockers.

## Stage Lifecycle Statuses

Persisted source: `gtm_runs.stages[stage].status` and `gtm_stage_events.status`.

Allowed persisted values:

- `queued`: Stage accepted for execution but worker has not started the actual work.
- `running`: Worker started the stage and has not emitted a terminal state.
- `complete`: Stage produced valid output.
- `blocked`: Stage stopped because required input, source coverage, validation, or provider availability was insufficient.
- `timed_out`: Stage exceeded the stale-running timeout or worker timeout policy.
- `errored`: Stage failed because of an execution, validation, worker, route, provider, or persistence error.

Derived UI-only value:

- `pending`: Stage has no persisted state yet. Do not write `pending` to `gtm_runs.stages` or `gtm_stage_events.status`.

Terminal stage statuses:

- `complete`
- `blocked`
- `timed_out`
- `errored`

Active stage statuses:

- `queued`
- `running`

Expected stage state shape:

```ts
{
  status?: "queued" | "running" | "complete" | "blocked" | "timed_out" | "errored";
  started_at?: string;
  completed_at?: string;
  accepted_at?: string;
  output?: unknown;
  raw_output?: unknown;
  summary?: string;
  source_gaps?: unknown[];
  tool_calls?: unknown[];
  artifacts?: Record<string, string>;
  validation?: unknown;
  duration_ms?: number;
  error?: string;
  worker_job_id?: string;
}
```

## Stage Names and Dependencies

Full declared stage order:

1. `discover-url`
2. `discover-identity`
3. `enrich-brief`
4. `review-brief`
5. `lock-brief`
6. `research-market-category`
7. `research-buyer-icp`
8. `research-competitors`
9. `research-voc`
10. `research-demand-intent`
11. `research-offer-funnel`
12. `synthesize-strategy`
13. `generate-media-plan`
14. `generate-scripts`

Current visible and dispatchable Lighthouse slice:

1. `discover-url`
2. `discover-identity`
3. `research-market-category`
4. `research-competitors`
5. `research-buyer-icp`

Current legacy display aliases:

- `ingest-url` -> `discover-url`
- `ingest-identity` -> `discover-identity`
- `research-market` -> `research-market-category`
- `research-competitor` -> `research-competitors`
- `research-icp` -> `research-buyer-icp`

Dependency behavior:

- Stages run in active ordered-slice order unless the route or worker explicitly supports a narrower dispatch.
- A `pending` downstream stage should explain the upstream incomplete stage it is waiting on.
- If an upstream stage is `blocked`, downstream pending stages should render as pending due to dependency.
- If an upstream stage is `errored` or `timed_out`, downstream pending stages should render as waiting on a failed dependency.
- Do not dispatch downstream stages automatically after a blocker, timeout, or error.
- Do not infer success from artifact presence alone. Stage status is authoritative.

## Stage Event Types

Persisted source: `gtm_stage_events.event_type`.

Allowed values:

- `queued`: Next app or worker accepted a stage for execution.
- `started`: Worker started a stage.
- `heartbeat`: Worker is still alive. Use for long-running stages.
- `tool_call`: Worker invoked a skill, tool, local agent, validator, or provider.
- `artifact_written`: Worker recorded an artifact path.
- `validation_started`: Worker began validation.
- `validation_passed`: Validation command or gate passed.
- `validation_failed`: Validation command or gate failed.
- `completed`: Stage reached `complete`.
- `blocked`: Stage reached `blocked`.
- `timed_out`: Stage reached `timed_out`.
- `errored`: Stage reached `errored`.

Event requirements:

- Every event must include `run_id`, `user_id`, `stage`, `event_type`, `message`, and `status`.
- `message` must be human-readable. It is allowed to be concise, but it should not be raw JSON.
- `error` should contain the actionable error string when `event_type` is `errored`, `timed_out`, or `blocked`.
- `metadata` may contain structured details, but the UI should never require users to read raw metadata to understand the stage.
- `duration_ms` must be non-negative when present.
- `tool_name`, `artifact_path`, and `source_url` are optional supporting fields.

## Artifact Types

There is no separate `artifact_type` column today.

Current artifact classification:

- `skill`: the skill or stage slug that owns the artifact.
- `source`: the artifact source.
- `version`: the version within `(run_id, skill)`.

Allowed `source` values:

- `skill_output`: Markdown rendered from fresh skill JSON output.
- `agent_patch`: Markdown patch produced by the orchestrator or chat agent from an existing artifact.

Artifact rules:

- `content_md` is the user-readable artifact body.
- `version` starts at `1` and increments per `(run_id, skill)`.
- `parent_id` points to the prior artifact version when a version supersedes another.
- `created_by` is audit metadata, not the RLS authority.
- UI should group artifacts by `skill`, show latest version first or make version selection explicit, and avoid exposing raw JSON as the main artifact view.

Future proposal boundary:

- If the product later needs explicit artifact types such as `market`, `icp`, `competitor`, `voc`, `media_plan`, or `script_pack`, add a documented schema/migration. Do not fake this by overloading unrelated fields.

## Message Roles and Types

Persisted source: `gtm_messages`.

Allowed `role` values:

- `user`: user-authored message.
- `assistant`: assistant-authored message.
- `system`: system/status message needed for replay or audit.
- `tool`: tool or worker message needed for transcript replay.

Allowed `message_type` values:

- `text`: normal transcript text.
- `thinking`: visible thinking/status segment if intentionally persisted.
- `tool_group`: grouped tool/stage activity.
- `artifact`: artifact update or reference.
- `error`: user-visible error message.
- `system`: internal system-status message intended for replay.

Allowed `status` values:

- `pending`
- `streaming`
- `complete`
- `errored`

Message rules:

- `content` is JSON, but user-visible text should be read from stable fields such as `content.text` when present.
- Messages must sort by `created_at` ascending for replay.
- Refresh should rehydrate persisted messages before or alongside live stream messages.
- Missing `gtm_messages` can degrade gracefully only while migration rollout is incomplete. After the table exists in all environments, failures should be surfaced.

## Blocker Model

A blocker is any condition that prevents a stage from producing trustworthy output and needs user action, operator action, or provider recovery before continuing.

Current blocker sources:

- Stage status is `blocked`.
- Stage state contains `error`.
- Stage output or state contains a source gap with `severity: "blocker"`.
- Latest stage event has `event_type: "blocked"`.
- Validation failed in a way that prevents a trustworthy output.

Expected normalized blocker shape for read models:

```ts
{
  stage: string;
  title: string;
  reason: string;
  remediation?: string;
  source: "stage_status" | "source_gap" | "event" | "validation" | "worker";
  severity: "blocker";
  event_id?: string;
  created_at?: string;
}
```

Rendering rules:

- Show blocker reason in plain language.
- Show remediation when available.
- Show the blocked stage label.
- Do not show raw JSON error payloads as the primary user-facing explanation.
- Preserve technical details in expandable diagnostics or logs when useful.

## UI Rendering Contract

The `/gtm/[runId]` workspace should render from a normalized run view, not from ad hoc stitching inside the component tree.

Minimum read-model output:

- run metadata
- normalized ordered stages
- latest event per stage
- grouped events by stage
- artifacts grouped by skill/stage
- messages in chronological order
- derived blockers
- derived pending dependency reasons

For each run status:

- `queued`: show run metadata, queued state, no completed artifacts unless already present.
- `running`: show active stage, latest event, elapsed time, and in-progress indicator.
- `awaiting_user`: show blocker panel, blocked stage, remediation, and safe next action.
- `completed`: show completed stage DAG, artifacts, and transcript.
- `partial`: show completed outputs and clearly mark incomplete stages.
- `failed`: show failed stage, failure reason, latest error event, and retry/recovery affordance if available.

For each stage row/card:

- stage label
- normalized status
- latest event message
- elapsed time when available
- blocker reason when blocked
- dependency reason when pending
- artifact references when available

## Worker Responsibilities

The worker owns execution.

It must:

- Load the target `gtm_runs` row by `run_id` and `user_id`.
- Mark stages `running` when work starts.
- Emit append-only `gtm_stage_events`.
- Write human-readable event `message` values.
- Preserve structured metadata without requiring the UI to expose raw JSON.
- Persist stage output, raw output, source gaps, tool calls, artifact paths, validation output, duration, and errors in `gtm_runs.stages`.
- Set terminal stage status to `complete`, `blocked`, `timed_out`, or `errored`.
- Update `gtm_runs.status` according to the run lifecycle rule.
- Stop ordered execution after blocker, timeout, or error.

It must not:

- Invent user-facing data not produced by a tool, skill, provider, or validated artifact.
- Continue downstream execution after an upstream blocker unless explicitly requested by a future contract.
- Write `pending` as a persisted stage status.

## Next App Responsibilities

The Next app owns creation, reading, dispatch requests, and rendering.

It must:

- Create `gtm_runs` rows from `/gtm/new`.
- Read runs by `run_id` and `user_id`.
- Dispatch worker-backed stages through the existing worker boundary.
- Load `gtm_stage_events`, `gtm_artifacts`, and `gtm_messages` for the run.
- Normalize run state into one read model for `/gtm/[runId]`.
- Derive pending dependency reasons without writing `pending` to the database.
- Render blockers and errors in human-readable form.
- Preserve refresh behavior by rehydrating persisted run state and messages.
- Degrade gracefully for missing optional records, such as no artifacts yet or no messages yet.

It must not:

- Redesign the database inside a UI task.
- Bypass Clerk `user_id` ownership checks.
- Treat raw stage JSON as the user-facing workspace.
- Dispatch broad background work without a visible stage state.

## Verification Checklist for Future Work

For docs-only contract edits:

- `test -f docs/GTM_RUN_CONTRACT.md`
- `git diff -- docs/GTM_RUN_CONTRACT.md`

For read-model work:

- Focused tests for status normalization.
- Focused tests for blocker derivation.
- Focused tests for dependency pending reasons.
- Focused tests for empty events/artifacts/messages.
- `npm run test:run`
- `npm run build` when tests are clean.

For browser QA:

- `/gtm/new` creates a run.
- `/gtm/[runId]` loads after redirect.
- Stage events appear.
- Blocked/error state is readable.
- Artifacts appear when produced.
- Refresh preserves transcript, stages, events, and artifacts.
