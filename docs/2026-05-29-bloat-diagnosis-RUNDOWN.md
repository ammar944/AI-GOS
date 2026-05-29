# Bloat Diagnosis Rundown

Date: 2026-05-29
Worktree: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
Branch/HEAD checked: `feat/v2-lab-section-wire` at `74c090a674d1c6fb799614d7718bbb27ef1d6e1b`

This pass was diagnosis and planning only. I did not start a paid run and did not write feature code.

## Runtime Evidence

- Local dev server on `:3000` is running from this worktree. The listening process cwd is `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`.
- Effective app env, loaded through the same Next env loader used by the app:
  - `LAB_ENGINE_LIVE_TOOLS=null` (unset, so live tools are not stripped)
  - `LAB_ENGINE_PROVIDER=deepseek-direct`
  - `SEARCHAPI_KEY` present
  - `ANTHROPIC_API_KEY` present
- Free run from the handoff, `db41a945-b8d1-4f02-83a7-6481f7d3500e`, exists and is complete: parent artifact `c7824975-a20f-43bd-8617-04054eb3691f`, `children_complete=6`, `children_total=6`, created `2026-05-29T03:03:19.235248+00:00`, updated `2026-05-29T03:08:03.246+00:00`.
- The current browser-polled run in the dev logs, `5b437206-8a3b-4963-844a-ae60b5621966`, also exists and is complete: parent artifact `f1c23a1e-6de2-43d2-9336-d47cc8b1fc36`, `children_complete=6`, `children_total=6`, created `2026-05-29T07:12:30.819285+00:00`, updated `2026-05-29T07:17:04.373+00:00`.
- Codex in-app browser opened `http://localhost:3000/research-v3?run_id=5b437206-8a3b-4963-844a-ae60b5621966`. After clicking the visible `Resume` button, the UI rendered the reader, Section 1 of 7, `Market & Category Intelligence`, with verified/unsupported and confidence badges. That confirms the local browser is on the same completed run, not a stale static page.

## Symptom Rundown

### 1. Onboarding is bloated

Status: Confirmed by code. Runtime browser could not show the completed run's onboarding step because the run had already moved to the reader, but the mounted component matches the operator's description.

Evidence:
- `src/components/onboarding/onboarding-wizard.tsx:159` defines `FieldStateBadge`; it is rendered beside each field at `src/components/onboarding/onboarding-wizard.tsx:395`.
- Per-field source chips render at `src/components/onboarding/onboarding-wizard.tsx:398`.
- Per-field controls are driven by `renderField` and `renderFieldControl` at `src/components/onboarding/onboarding-wizard.tsx:352` and `src/components/onboarding/onboarding-wizard.tsx:570`.
- The header says `GTM Brief Review` and `Confirm every field` at `src/components/onboarding/onboarding-wizard.tsx:586`.
- The step counter/progress bar is at `src/components/onboarding/onboarding-wizard.tsx:687`; desktop and mobile rails are at `src/components/onboarding/onboarding-wizard.tsx:714` and `src/components/onboarding/onboarding-wizard.tsx:828`.
- The required submit contract is load bearing: `handleSubmit` validates `OnboardingV2Schema` and calls `onComplete(parsed.data, buildOnboardingReviewMetadata(...))` at `src/components/onboarding/onboarding-wizard.tsx:337`.
- The server route requires both `data: OnboardingV2Schema` and `reviewMetadata` at `src/app/api/research-v2/onboarding/route.ts:38`.
- The schema has many required fields beginning at `src/lib/research-v2/onboarding-v2-types.ts:162`, and the eight-section field metadata starts at `src/lib/research-v2/onboarding-v2-types.ts:285`.
- This component is shared by `/research-v2` and `/research-v3`: `src/app/research-v2/page.tsx:542` and `src/app/research-v3/page.tsx:554`.

Root cause:
The UI is doing field-level review, source display, validation, editing, and step navigation in one shared component. It is safe to simplify mechanically only if the payload and review metadata contract remain intact. The v3-only vs shared scope is a product decision.

### 2. First seconds feel dead

Status: Partial.

Evidence:
- In run `db41a945...`, parent artifact was created at `03:03:19.235`, and the first section event persisted at `03:03:23.867`, about 4.6 seconds later.
- In run `5b437206...`, parent artifact was created at `07:12:30.819`, and the first section event persisted at `07:12:35.279`, about 4.5 seconds later.
- The client polls `/api/research-v2/audit-state` every 2500 ms (`src/lib/research-v2/use-audit-state.ts:15`, `src/lib/research-v2/use-audit-state.ts:95`).
- `/research-v3` fires orchestrate as a fire-and-forget fetch after onboarding completes at `src/app/research-v3/page.tsx:445` and renders the reader at `src/app/research-v3/page.tsx:562`.

Root cause:
The DB has a real startup gap of roughly 4-5 seconds in the inspected runs, plus the 2.5 second polling cadence. That can present as dead air, especially if the first poll lands before seed/events are visible. The inspected runs did not prove a full 10 second backend gap.

### 3. Sections sit at "0% preparing context"

Status: Confirmed.

Evidence:
- The progress strip percent is whole-section completion only: `completedCount / READER_SECTION_IDS.length` at `src/components/research-v2/audit-reader-shell.tsx:823`. It is not per-section progress.
- Phase labels derive from the latest persisted event. `section-started` and `skill-loaded` both map to `Compiling context`, while tool events map to `Reading sources` at `src/app/api/research-v2/audit-state/derive-section-phase.ts:9`.
- The answer-tool path buffers tool events in memory at `src/lib/lab-engine/agents/run-section.ts:2789`, appends on `flushBufferedEvents` at `src/lib/lab-engine/agents/run-section.ts:2792`, collects `onStep` events without persisting them at `src/lib/lab-engine/agents/run-section.ts:2842`, and flushes after the first answer-tool attempt resolves at `src/lib/lab-engine/agents/run-section.ts:2888`.
- Runtime proof from run `5b437206...`, `positioningCompetitorLandscape`: the first persisted tool event is at `07:13:46.488`, while `skill-loaded` was at `07:12:35.995`, a 70 second gap.
- Stronger buffering proof: a persisted `adlibrary finished` row has DB `created_at=2026-05-29T07:13:58.01609+00:00`, but its payload `createdAt=2026-05-29T07:12:54.228Z`. A persisted `google_ads finished` row has DB `created_at=2026-05-29T07:13:59.995159+00:00`, but payload `createdAt=2026-05-29T07:12:56.285Z`.

Root cause:
The section is doing work earlier than the reader shows, but tool events are buffered and persisted late. The visible "0%" is also mislabeled: it means `0/6 sections complete`, not current section progress.

### 4. No section body streams; it appears atomically

Status: Confirmed.

Evidence:
- The production lab job imports and calls `runSection`, not `streamRunSection`, at `src/lib/research-v2/lab-section-job.ts:11` and `src/lib/research-v2/lab-section-job.ts:41`.
- The answer-tool runner uses blocking `agent.generate(...)` at `src/lib/lab-engine/agents/section-agent.ts:394`.
- The `answer` tool description requires one final structured JSON object and says not to call with partial input at `src/lib/lab-engine/agents/answer-tool.ts:58`.
- The Supabase store commits one complete artifact patch through `commitArtifactSection` at `src/lib/research-v2/supabase-run-store.ts:346`.
- The reader renders `TypedArtifactRenderer` only when `activeStatus === 'complete' && activeTyped` at `src/components/research-v2/audit-reader-shell.tsx:1508`. Running sections render `LiveActivity` instead at `src/components/research-v2/audit-reader-shell.tsx:1544`.
- A partial streaming path exists but is unused by the production job: `writeArtifactPartial` emits `data-artifact-partial` at `src/lib/lab-engine/agents/run-section.ts:474`, `streamSectionViaAnswerTool` starts at `src/lib/lab-engine/agents/run-section.ts:3110`, and `streamRunSection` starts at `src/lib/lab-engine/agents/run-section.ts:3408`.

Root cause:
This is current architecture, not an accidental missing UI hook. True body streaming is a verifier/product decision because the existing verifier and repair loop validate complete structured output before committing.

### 5. Section 5 failed

Status: Partial, with a different root cause than the handoff hypothesis.

Evidence:
- In free run `db41a945...`, `positioningDemandIntent` completed normally with no `section-failed` events.
- In current run `5b437206...`, `positioningDemandIntent` has a `research_section_runs` row with `status=error`, started `07:12:36.337`, completed `07:13:44.296`, and error:
  `commit_artifact_section failed for positioningDemandIntent section_run_id=e1388350-9202-430f-a811-fb0dff608edf revision=0: conflict=true`.
- The same current run's normalized `research_artifact_sections` row for `positioningDemandIntent` is `status=complete`, title `Demand & Intent Signals`, updated `07:13:44.384`.
- The event sequence proves the contradiction: `section-failed` persisted at `07:13:44.154`, then `artifact-saved` persisted at `07:13:44.679`, then `section-completed` persisted at `07:13:45.002` and again at `07:13:45.692`.
- There were no DemandIntent `validation-failed` events in the current run. The strict DemandIntent minimums still exist at `src/lib/lab-engine/artifacts/schemas/demand-intent.ts:132`, but they were not the observed failure cause here.
- Commit conflict is thrown by the store when `commitArtifactSection` returns `ok=false` at `src/lib/research-v2/supabase-run-store.ts:354`.
- `seed_orchestration` returns a `reused` flag (`src/lib/research-v2/orchestrate-db.ts:13`) and reuses `queued`, `running`, or `complete` section runs (`supabase/migrations/20260528_seed_orchestration_complete_idempotency.sql:50`), but the route still dispatches lab jobs after seeding at `src/app/api/research-v2/orchestrate/route.ts:217`.

Root cause:
The current failure is a duplicate/idempotency race, not a DemandIntent quota miss. Multiple writers appear to target the same section run, one loses the revision compare-and-swap and emits a failure even though a later/parallel writer commits the artifact successfully.

### 6. Competitor section took a long time

Status: Confirmed.

Evidence:
- Free run `db41a945...`: `positioningCompetitorLandscape` elapsed `187760ms` and completed.
- Current run `5b437206...`: `positioningCompetitorLandscape` elapsed `244184ms` and completed. It started at `07:12:36.980` and the normalized section updated at `07:16:40.979`.
- It did not hit the 270 second job timeout in the current run, but it came close.
- The section has the heaviest allowlist and budget: `web_search`, `firecrawl`, `adlibrary`, `google_ads`, `meta_ads`, `reviews`, with `maxExternalLookups=6`, at `src/lib/lab-engine/sections/section-registry.ts:143`.
- The deterministic ad probe is competitor-only at `src/lib/lab-engine/agents/run-section.ts:3539` and calls Google and Meta ad tools per advertiser at `src/lib/lab-engine/agents/run-section.ts:2244`.
- Timeout hierarchy is inconsistent: job timeout is `270000ms` at `src/lib/research-v2/lab-section-dispatch.ts:14`, route `maxDuration` is 300 seconds at `src/app/api/research-v2/run-lab-section/route.ts:36`, while answer-tool timeout is `540000ms` at `src/lib/lab-engine/agents/run-section.ts:680`.
- The live orchestration fans out all six sections concurrently via `Promise.allSettled` at `src/app/api/research-v2/orchestrate/route.ts:97`.

Root cause:
The competitor section is legitimately heavier, and the timeout hierarchy can still create a terminal failure if the section crosses 270 seconds. The inspected current run completed in 244 seconds, so this pass did not reproduce a timeout.

### 7. "No tools wired in" and no competitor ads

Status: Refuted for tool wiring; confirmed for no useful ad evidence in the current run.

Evidence:
- Runtime env has `LAB_ENGINE_LIVE_TOOLS=null`, not `'false'`, so `getLabEngineAllowedTools()` does not strip tools (`src/lib/research-v2/lab-section-job.ts:88`).
- `SEARCHAPI_KEY` is present.
- The code wiring is real: CompetitorLandscape allows ad tools at `src/lib/lab-engine/sections/section-registry.ts:143`, `buildToolMap` wraps allowed tools at `src/lib/lab-engine/agents/tool-registry.ts:11`, `google_ads` and `meta_ads` delegate to `adLibraryAgentTool` at `src/lib/lab-engine/agents/tools/google-ads.ts:34` and `src/lib/lab-engine/agents/tools/meta-ads.ts:34`.
- The ad library calls SearchAPI through `fetchSearchApiJson` at `src/lib/lab-engine/agents/tools/adlibrary.ts:210`, including Google engines at `src/lib/lab-engine/agents/tools/adlibrary.ts:467` and Meta engines at `src/lib/lab-engine/agents/tools/adlibrary.ts:526`. It requires `SEARCHAPI_KEY` at `src/lib/lab-engine/agents/tools/adlibrary.ts:636`. The fetch helper uses real `fetch` at `src/lib/lab-engine/agents/tools/_shared.ts:82`.
- Free run `db41a945...` CompetitorLandscape had 53 `tool-started` and 53 `tool-finished` events. Tool counts included `web_search`, `firecrawl`, `reviews`, `adlibrary`, and `answer`.
- Current run `5b437206...` CompetitorLandscape had 68 `tool-started` and 68 `tool-finished` events. Tool counts included `web_search`, `firecrawl`, `reviews`, `adlibrary`, `google_ads`, and `answer`.
- Current run ad events are gaps: `adlibrary finished` for `saashero`, `ColdIQ`, and `SaaSLaunch` returned `gap.reason=rate_limited`, `message=section budget exhausted after 6 lookups`; `google_ads finished` for `saashero`, `ColdIQ`, and `SaaSLaunch` returned the same rate limit gap.
- The budget wrapper returns `type: "gap", reason: "rate_limited"` once the per-section budget is exhausted at `src/lib/lab-engine/agents/tool-registry.ts:35`.

Root cause:
The tools are wired and live in the inspected runtime. The ad evidence path is being starved by the shared six-lookup section budget before competitor ad probes can produce useful ad rows. The current persisted stream showed `google_ads` but no useful ads, and no visible `meta_ads` rows.

## Prioritized Fix Plan

### P0 [safe-to-execute] Stop duplicate section jobs and false failures

Files and lines:
- `src/app/api/research-v2/orchestrate/route.ts:204`
- `src/lib/research-v2/orchestrate-db.ts:13`
- `supabase/migrations/20260528_seed_orchestration_complete_idempotency.sql:50`
- `src/lib/research-v2/supabase-run-store.ts:354`

Change:
Use the seeded `reused` information plus current section statuses to avoid dispatching a lab section job when its section is already `running` or `complete`. At minimum, do not dispatch all six unconditionally after an idempotent seed. A repeated orchestrate POST should return the existing parent/section IDs without creating competing writers.

Risk:
Low if scoped to dispatch gating. Medium if the route needs to distinguish legitimate retry/rerun from idempotent duplicate kickoff.

Verification:
Call orchestrate twice for a test run and verify each zone has one `section-started`, one terminal event, no `commit_artifact_section ... conflict=true`, and no false `section-failed` event after a successful artifact commit.

### P0 [safe-to-execute] Make ad evidence budget explicit and usable

Files and lines:
- `src/lib/lab-engine/sections/section-registry.ts:143`
- `src/lib/lab-engine/agents/tool-registry.ts:35`
- `src/lib/lab-engine/agents/run-section.ts:2179`
- `src/lib/research-v2/lab-section-job.ts:88`

Change:
Do not frame this as "wire tools"; they are wired. Instead:
1. Emit an early activity event stating whether live tools are enabled or disabled and whether ad credentials are present/missing.
2. Give deterministic ad probes their own small budget, or reserve budget before generic web/firecrawl/reviews calls consume all six lookups.
3. Surface `rate_limited` ad gaps as first-class ad evidence gaps in the reader.

Risk:
Medium. Increasing live lookup budget can increase cost and latency. A reserved ad budget is safer than simply raising `maxExternalLookups`.

Verification:
Run a single CompetitorLandscape rerun with no more than one paid attempt. Expected: `adlibrary` or `google_ads`/`meta_ads` events persist with either non-empty `ads[]` or a specific gap (`no_confident_match`, `api_error`, `missing_credential`) instead of generic `rate_limited` from shared budget exhaustion.

### P0/P1 [safe-to-execute] Kill the frozen feed by persisting tool events live

Files and lines:
- `src/lib/lab-engine/agents/run-section.ts:2789`
- `src/lib/lab-engine/agents/run-section.ts:2842`
- `src/lib/lab-engine/agents/run-section.ts:2888`
- `src/app/api/research-v2/audit-state/derive-section-phase.ts:9`

Change:
Persist `tool-started`/`tool-finished` events inside `onStep`, or flush the buffer immediately after each step. Wrap telemetry writes so event persistence failure cannot abort the section. Also emit an early post-skill heartbeat such as `Reading sources` before the first model/tool step.

Risk:
Medium. Appending inside `onStep` adds async DB work to a hot model loop. If fire-and-forget is used, failures must be logged without losing ordering entirely.

Verification:
During a single-section run, compare payload `createdAt` to DB `created_at`; the gap should be near-zero instead of 60+ seconds. The reader should move from `Compiling context` to `Reading sources` while the section is still running.

### P1 [safe-to-execute] Reconcile the timeout hierarchy

Files and lines:
- `src/lib/research-v2/lab-section-dispatch.ts:14`
- `src/app/api/research-v2/run-lab-section/route.ts:36`
- `src/lib/lab-engine/agents/run-section.ts:680`

Change:
Make the section job timeout, route `maxDuration`, and answer-tool timeout agree. Since the route is 300 seconds, the answer-tool timeout cannot truthfully be 540 seconds in this environment. Either increase the route/platform budget if available, or lower answer-tool timeout below the job/route budget and record a controlled terminal failure before the platform kills the request.

Risk:
Medium. Lowering too far can cut off the competitor section, which completed at 244 seconds in the current run. Increasing duration may not be available on all deployment targets.

Verification:
Unit-test timeout constants and run one slow-section simulation. The terminal error should be an app-authored timeout event, not an orphaned running row or platform abort.

### P1 [needs operator decision] Collapse onboarding review

Files and lines:
- `src/components/onboarding/onboarding-wizard.tsx:159`
- `src/components/onboarding/onboarding-wizard.tsx:337`
- `src/components/onboarding/onboarding-wizard.tsx:586`
- `src/app/research-v2/page.tsx:542`
- `src/app/research-v3/page.tsx:554`

Change:
Replace the stepper/per-field review UI with one minimal confirm screen while preserving the complete `OnboardingV2Schema` payload and `buildOnboardingReviewMetadata` submit contract.

Decision needed:
Is this shared for `/research-v2` and `/research-v3`, or should v3 fork a smaller component? Should fields be read-only with one edit escape hatch, or still editable inline with less chrome?

Risk:
Medium. The submit payload is load bearing. Dropping `reviewMetadata` breaks `/api/research-v2/onboarding`.

Verification:
RTL coverage for the submit payload and metadata shape, plus browser verification that Run Audit reaches orchestrate and the reader.

### P1/P2 [needs operator decision] "Watch it write": live event feed vs true body streaming

Files and lines:
- `src/lib/lab-engine/agents/section-agent.ts:394`
- `src/lib/lab-engine/agents/answer-tool.ts:58`
- `src/lib/lab-engine/agents/run-section.ts:474`
- `src/components/research-v2/audit-reader-shell.tsx:1508`

Change:
Recommended path: make phase/tool/subsection events live and readable. Avoid true token/body streaming unless the product accepts showing unverified claims before the verifier and repair loop finish.

Risk:
Event-feed path is medium-low. True body streaming is high because it cuts across verification and artifact commit semantics.

Verification:
For event-feed path, browser observes active source/tool/subsection updates without partial body claims. For true body streaming, add a separate unverified/draft state and ensure final repair can replace earlier content honestly.

### P2 [safe-ish] Reclassify DemandIntent failure handling

Files and lines:
- `src/lib/lab-engine/artifacts/schemas/demand-intent.ts:132`
- `src/lib/research-v2/supabase-run-store.ts:354`
- `src/lib/research-v2/lab-section-job.ts:163`

Change:
Do not loosen DemandIntent minimums based on the current failure. The observed current failure was a commit conflict. First fix duplicate dispatch. Then, if a real validation failure recurs, tune minimums, repair attempts, or skill instructions from the actual `validation-failed` issues.

Risk:
Low if this remains a diagnosis correction. Medium if minimums are loosened without runtime proof.

Verification:
After P0 duplicate-dispatch fix, rerun DemandIntent once. It should either complete once or fail with a real validator issue path, not `commit_artifact_section ... conflict=true`.

### P2 [safe-to-execute] Relabel the "0%" chrome

Files and lines:
- `src/components/research-v2/audit-reader-shell.tsx:823`

Change:
Relabel the strip value as section completion (`0/6`, `1/6`, etc.) or replace it with a phase-based indicator. Do not imply per-section progress unless a real per-section progress model exists.

Risk:
Low.

Verification:
Browser check during a run: before any section commits, UI says `0/6 complete` or equivalent, not `0%` for active work.

### P3 [safe-to-execute] Clean documentation and dead-path confusion

Files and lines:
- `src/lib/lab-engine/agents/run-section.ts:3110`
- `src/lib/lab-engine/agents/run-section.ts:3408`
- `src/lib/lab-engine/ai/models.ts:54`
- `src/lib/lab-engine/agents/verification/evidence-support.ts:56`
- `src/lib/research-v2/lab-section-job.ts:88`

Change:
Document the three real lab-engine knobs (`LAB_ENGINE_PROVIDER`, `LAB_VERIFIER_MAX_UNSUPPORTED`, `LAB_ENGINE_LIVE_TOOLS`) and mark the partial streaming path as unused unless the product deliberately revives it. Also document that worker positioning copies are not the live frontend lab engine.

Risk:
Low.

Verification:
`rg` for legacy flags shows no runtime reads. Docs match the current live code path.
