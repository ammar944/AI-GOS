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

Status: Now

Bucket: `01 Journey Run Visibility MVP`

Owner: Product Head -> Codex Implementer

Goal:

When an operator chats in the `/journey` workspace, refreshes the browser, switches away, or reopens the same run later, the relevant workspace chat thread replays from persisted Journey session state. This must work for real `activeRunId` scoped sessions and must not bleed messages across different runs or sections.

Current repo truth:

- `/journey` workspace chat is `src/components/chat/unified-chat.tsx`, not `src/components/workspace/right-rail.tsx`.
- `UnifiedChat` uses Vercel AI SDK `useChat` with `DefaultChatTransport` and `api: /api/journey/stream`.
- `UnifiedChat` currently starts from in-memory `useChat` state only; it does not hydrate with `setMessages` from Supabase and does not persist messages after replies.
- `src/app/api/journey/session/route.ts` already selects `journey_sessions.messages` and returns `view`, but the route does not expose a typed message-persistence contract yet.
- `src/lib/journey/run-view.ts` normalizes a legacy flat `messages` array for visibility, but workspace chat needs full AI SDK `UIMessage` parts so tool calls/edit proposals can replay safely.

The historical card targeted `gtm_messages`. Re-read the active Journey chat/session storage before implementation and preserve the Vercel AI SDK `/api/journey/stream` contract.

Non-goals:

- Do not add `/gtm` runtime code, `gtm_messages`, or new GTM tables.
- Do not replace `useChat`, `DefaultChatTransport`, or `/api/journey/stream`.
- Do not persist raw chain-of-thought or hidden reasoning text.
- Do not change worker behavior, research dispatch, database schema, or artifact generation.
- Do not save streaming partials as final chat history.

Proposed file boundary:

- Create `src/lib/journey/workspace-messages.ts` for Zod validation, legacy compatibility, per-section scoping, and safe serialization of AI SDK `UIMessage[]`.
- Test `src/lib/journey/__tests__/workspace-messages.test.ts`.
- Modify `src/app/api/journey/session/route.ts` to accept a scoped message persistence payload and return persisted workspace messages for a requested run.
- Test `src/app/api/journey/__tests__/session-messages.test.ts` or extend the existing session route test if one exists.
- Modify `src/components/chat/unified-chat.tsx` to hydrate `useChat` with `setMessages` after `GET /api/journey/session?runId=...`, and persist after `status === 'ready'` with a short debounce.
- Add or extend a component test around `UnifiedChat` message hydration and persistence if the existing test harness can mock `useChat` safely.
- Modify `src/lib/journey/run-view.ts` only if needed to keep visibility summaries compatible with the new persisted message shape.

Storage shape requirement:

- Prefer the existing `journey_sessions.messages` JSONB column; no migration.
- Store full `UIMessage[]` by workspace section under a versioned envelope, for example:

```ts
{
  schemaVersion: 1,
  workspace: {
    industryMarket: UIMessage[],
    competitors: UIMessage[]
  }
}
```

- Read legacy flat arrays without crashing.
- Persist by `user_id + run_id`; never update the latest session if `activeRunId` is available.
- Preserve unknown future message channels when saving one section.

Acceptance criteria:

- A message sent in the `industryMarket` workspace chat persists after the assistant response reaches `ready`.
- Refreshing `/journey` with the same `activeRunId` restores that section's message history into `UnifiedChat`.
- Switching to another section does not show the first section's messages unless that section has its own saved thread.
- Returning to the first section restores its saved thread.
- Starting a new Journey run starts with empty workspace chat history, even if an older run has saved messages.
- Stored messages remain compatible with `/api/journey/stream` replay and do not trigger missing-tool-result errors.
- The UI never renders raw JSON message payloads as the primary chat UX.
- Message persistence failures are visible in structured console warnings and do not silently corrupt chat state.

TDD execution steps:

1. Write RED tests for `workspace-messages.ts`: empty state, legacy flat array read, versioned per-section read, preserve other sections on merge, reject malformed messages.
2. Run: `npm run test:run -- src/lib/journey/__tests__/workspace-messages.test.ts`
3. Implement the message envelope helpers.
4. Add RED API tests for `GET/PATCH /api/journey/session` message persistence scoped by `runId`.
5. Run the API tests and verify the expected failure.
6. Implement the session route message branch with explicit errors for missing `activeRunId`, invalid section, and malformed message payloads.
7. Add RED UI test or hook-level test proving `UnifiedChat` calls `setMessages` with persisted section messages after hydration.
8. Implement `UnifiedChat` hydration and ready-state debounced persistence.
9. Run the focused tests.
10. Run the Journey/workspace regression ladder below.
11. Commit only the GTM-008 files.

Verification:

```bash
npm run test:run -- src/lib/journey/__tests__/workspace-messages.test.ts src/app/api/journey/__tests__/session-messages.test.ts
npm run test:run -- src/components/workspace/__tests__/journey-run-artifact-visibility-panel.test.tsx src/components/workspace/__tests__/journey-run-event-log.test.tsx src/components/workspace/__tests__/journey-run-blocker-panel.test.tsx src/components/workspace/__tests__/journey-run-stage-panel.test.tsx src/components/workspace/__tests__/workspace-hydration.test.ts src/lib/journey/__tests__/run-view.test.ts src/lib/journey/__tests__/research-job-activity.test.ts src/lib/journey/__tests__/research-realtime.test.ts
npm run lint -- src/lib/journey/workspace-messages.ts src/app/api/journey/session/route.ts src/components/chat/unified-chat.tsx
npm run build
```

Reviewer role:

Reject the implementation if messages only survive in local component state, if the storage shape cannot support per-section chat, if the code stores partial streaming/tool-input states as final history, or if the route can overwrite another run's messages.

Commit boundary:

`feat(journey): persist workspace chat messages`

## Next

### GTM-009 - Browser QA `/journey` run visibility refresh flow

Status: Next after GTM-008

Bucket: `01 Journey Run Visibility MVP`

Goal:

Prove the Journey run workspace shows stage status, blocker state, grouped events, hydrated cards, chat, and refresh recovery from a real browser session.

Why this card matters:

Unit tests are not enough for this slice. The user-facing failure mode is opening `/journey` after several sessions and seeing empty chat, raw worker noise, missing artifact cards, or disconnected panels. This card must verify the actual browser flow and produce evidence.

Non-goals:

- Do not fix unrelated full-suite failures inside this QA card.
- Do not redesign the workspace UI.
- Do not add fake demo data to production code.
- Do not mark this done if Clerk/env/auth prevents real browser verification.

Preflight:

- Confirm the latest GTM-007 and GTM-008 commits are present.
- Confirm whether the app has valid Clerk and Supabase env locally.
- Start the app: `npm run dev`.
- If research execution is part of the scenario, also start the worker: `cd research-worker && npm run dev` and ensure `RAILWAY_WORKER_URL=http://localhost:3001`.
- Use the Browser Use plugin or Playwright. Do not substitute screenshots with unit-test output.

Scenario A - restore existing run:

1. Create or identify a Journey run with persisted `run_id`, metadata, research results, job status, cards, events, and workspace messages.
2. Open `http://localhost:3000/journey`.
3. Restore or select the target run without editing database rows manually after the browser opens.
4. Verify the workspace shows, above the canvas:
   - blocker panel only when the run is failed or partial,
   - stage map,
   - artifact visibility panel,
   - grouped event log.
5. Verify the primary workspace card surface renders section cards, not raw JSON.
6. Verify the workspace chat replays the persisted messages for the active section.
7. Refresh the browser.
8. Verify the same run, section, cards, panels, and chat messages return.

Scenario B - isolation across sessions:

1. Start a new Journey run.
2. Verify prior run chat messages do not appear.
3. Send one workspace chat message in one section.
4. Switch sections.
5. Verify the other section does not show that first section's thread.
6. Switch back and verify the original section thread returns.
7. Refresh again and verify the same isolation.

Scenario C - no slop audit:

Check the visible workspace for these explicit failures:

- raw JSON blobs in primary UX,
- duplicated panels that say the same thing,
- raw worker/debug rows in primary cards,
- empty artifact canvas when persisted cards exist,
- chat rail hidden while the operator needs it,
- message history lost after refresh,
- section messages bleeding into the wrong section,
- blocked/error state hidden behind diagnostics only,
- source/version/diagnostic metadata shown as primary content instead of secondary disclosure.

Acceptance criteria:

- Browser evidence proves refresh recovery for cards, status panels, event log, artifact visibility, and workspace chat.
- Browser evidence proves cross-run and cross-section chat isolation.
- Any remaining blocker is recorded with exact URL, command, screenshot path, console error, and network/API response.
- `docs/affine/pages/04-backlog-kanban.md` is updated with the QA result.
- No implementation work is committed under this QA card unless the user explicitly widens scope.

Verification artifacts:

- Save screenshots under `/tmp/aigos-journey-qa/`.
- Record the tested run ID, browser URL, and exact date/time.
- Include the exact `npm run dev` and worker status.
- If using Playwright, save the trace or screenshot paths.

Verification commands:

```bash
npm run test:run -- src/components/workspace/__tests__/journey-run-artifact-visibility-panel.test.tsx src/components/workspace/__tests__/journey-run-event-log.test.tsx src/components/workspace/__tests__/journey-run-blocker-panel.test.tsx src/components/workspace/__tests__/journey-run-stage-panel.test.tsx src/components/workspace/__tests__/workspace-hydration.test.ts src/lib/journey/__tests__/run-view.test.ts src/lib/journey/__tests__/research-job-activity.test.ts src/lib/journey/__tests__/research-realtime.test.ts
npm run lint -- src/components/workspace/journey-run-artifact-visibility-panel.tsx src/components/workspace/journey-run-event-log.tsx src/components/workspace/journey-run-blocker-panel.tsx src/components/workspace/journey-run-stage-panel.tsx src/components/workspace/workspace-page.tsx src/components/chat/unified-chat.tsx
npm run build
```

Reviewer role:

Reject the card if it only proves mocked tests, if it cannot show the actual `/journey` browser state after refresh, or if the final notes do not say exactly what run was tested.

Commit boundary:

Docs-only if QA passes without code changes: `docs(journey): record run visibility browser qa`

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

Status: Final cleanup / Plan mode handoff

Reason:

The checkout has substantial unrelated dirty work across app, worker, config, generated folders, and local agent folders. Cleanup requires a dedicated classification pass before deleting, reverting, or staging anything broad.

Goal:

Before any final landing or broad cleanup, classify every dirty path into an explicit bucket and produce a plan the user can approve. This is plan-mode work first. Do not delete, revert, stash, or stage broad paths until the classification is reviewed.

Current dirty-state warning:

- This checkout contains unrelated modified app files, worker files, config files, generated/local agent folders, and untracked research/engine assets.
- Prior GTM visibility commits were staged narrowly. Keep that discipline.
- `src/components/workspace/workspace-page.tsx` has an unstaged pre-existing chat-rail change that is not part of GTM-007.

Required buckets:

- Keep as intentional product work.
- Commit as a separate feature/fix.
- Stash for later.
- Delete generated/local-only artifact.
- Needs user decision.
- Do not touch.

Plan-mode steps:

1. Run `git status --short`.
2. Run `git --no-pager diff --stat`.
3. For each dirty path, inspect only enough diff to classify ownership and risk.
4. Write a cleanup table with path, bucket, rationale, suggested action, and risk.
5. Identify any path that may contain user work and mark it `Needs user decision`.
6. Propose an execution order that starts with safest generated artifacts and ends with risky app/worker code.
7. Ask for approval before any destructive command.

Hard rules:

- No `git add .`.
- No `git reset --hard`.
- No `git checkout -- <path>`.
- No deleting `.agents`, `.codex`, `.omc`, generated folders, or worker skill assets without explicit approval.
- Do not mix cleanup with GTM-008 or GTM-009 implementation.
- If the final plan needs stashing, use named stashes and list exact paths.

Acceptance criteria:

- Every dirty path is classified.
- The user can approve or reject each bucket without needing to rediscover context.
- The plan separates code, docs, generated artifacts, local agent folders, and dependency/config churn.
- No cleanup action is executed until approval.

Verification:

```bash
git status --short
git --no-pager diff --stat
git --no-pager diff -- <path>
```

Commit boundary:

Planning-only: no commit unless the user explicitly asks to save the cleanup handoff.
