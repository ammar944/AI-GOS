# Backend / Persistence Audit — research-v2 (lab-section-wire)

Date: 2026-05-27
Branch / worktree: `feat/v2-lab-section-wire` (`/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`)
Scope: research-v2 API routes, lab job/dispatch layer, lab-engine RunStore, worker boundary, Supabase persistence + RPCs.
Method: READ-ONLY. Every finding is backed by file:line or migration/column evidence.

Bar applied: clean typed API contracts; correct auth; idempotent + resumable jobs; complete, queryable telemetry; NO silent failures; NO fail-soft-to-empty that masks missing data; no fabricated/defaulted values passed downstream.

---

## Architecture recap (what actually runs in this worktree)

`/api/research-v2/orchestrate` with `executionMode:'lab'` (and `run-lab-section`, `rerun-section` lab path) is the **canonical front-door flow** here. It:

1. `seedOrchestration()` → Postgres RPC creates ONE parent `research_artifacts` row + six `research_section_runs` (`status='queued'`) + six `research_artifact_sections` (`status='queued'`).
2. `createSupabaseRunStore(...)` wraps those rows in the lab-engine `RunStore` contract.
3. `input.schedule(...)` = Vercel `after()` → `runLabSectionJob` → `runSection` (lab-engine ToolLoopAgent) runs **inside the Next.js serverless invocation**, NOT on the Railway worker.
4. Section events flow to `research_section_events` via the `append_section_event` RPC; terminal state + telemetry flow to `research_section_runs`; the typed artifact + markdown commit to `research_artifact_sections` via `commit_artifact_section`.
5. `GET /api/research-v2/audit-state` projects all of the above for the reader UI.

The Railway **worker** path (`positioning-audit-orchestrator.ts`) is a *separate, richer* implementation used by `executionMode:'draft'|'deep'|'managed'`. Much of the divergence below is the lab path being a thinner reimplementation of the worker path that drops capabilities the read model still expects.

---

## H — High severity

### H1. Lab telemetry is structurally incomplete — `latestTool` / `latestSource` / `capabilityGaps` / `nextStep` / `wave` / `totalWaves` / `concurrency` are NEVER persisted on the canonical path
- Evidence:
  - `src/lib/research-v2/supabase-run-store.ts:54-75` `buildLabSectionTelemetry()` is the ONLY thing the lab path writes to `research_section_runs.telemetry`. It emits exactly: `executionMode, phase, phaseStartedAt, latestActivity, provider, model, modelId, transport, runtimeTimings, elapsedMs`. No `latestTool`, `latestSource`, `nextStep`, `wave`, `totalWaves`, `concurrency`, `capabilityGaps`.
  - It is called from `markSectionRunning` (`:420`), `saveArtifact` (`:366`), `markSectionFailed` (`:478`) — those are the only `research_section_runs.telemetry` writers in the lab path.
  - `src/app/api/research-v2/audit-state/route.ts:215-231` `buildWorkerStateReadModel` reads exactly those fields (`latestTool`, `latestSource`, `nextStep`, `wave`, `totalWaves`, `concurrency`, `capabilityGaps`) from `telemetry` — and therefore returns them `null`/`[]` for every lab run.
  - Contrast: worker path `research-worker/src/runners/positioning-audit-orchestrator.ts:527-546, 588-607` writes `latestTool`, `latestActivity`, `nextStep`, `wave`, `totalWaves`, `concurrency`, `capabilityGaps` via `updateSectionRunPhase` (`research-worker/src/db/artifact-runs.ts:199-246`). So the read model contract was designed around the worker, and the lab path silently under-fills it.
- Bar violated: complete, queryable telemetry; no abandoned telemetry.
- Impact: The reader UI's per-zone "currently using tool X / reading source Y / wave N of M / N running" surfaces are dead on the canonical flow — they render null. This is exactly the "show streaming progress" requirement the product cares about. Also `capabilityGaps` (missing-credential / API-error signals) never reach the UI on lab, so a section that silently produced thin output because a tool was unavailable looks identical to a healthy one.
- Severity: H. Effort: M. Fix: in `buildLabSectionTelemetry` accept + persist `latestTool`/`latestSource`/`capabilityGaps`/`nextStep`/`wave`/`totalWaves`/`concurrency`, and have the lab job thread tool/source/gap info into the store (see H2 for where that data already exists but is dropped). At minimum populate `latestTool`/`latestSource` from the agent steps already captured in `run-section.ts buildToolEvents`.

### H2. Source URLs visited during research are never persisted anywhere queryable — `activityEventSchema` tool events carry only `toolName`, not the URL/source
- Evidence:
  - `src/lib/lab-engine/events/activity-event.ts:47-51` `toolMetadataSchema = { toolName }` (`.strict()`). `tool-finished` (`:108-118`) adds only `outputSummary` + `gap`. There is NO url / source field on any event variant.
  - `src/lib/lab-engine/agents/run-section.ts:307-359` `buildToolEvents` only ever sets `metadata.toolName` (+ `outputSummary`/`gap`). The `web_search` / `firecrawl` URLs that `research-worker/src/runner.ts:646-699` extracts and surfaces are NOT extracted in the lab-engine equivalent — the lab agent runs via `defaultAnswerToolRunner`/`defaultEvidencePassRunner` (`section-agent.ts:289-455`) whose `summarizeStep` (`:136-162`) captures `toolName` + raw input/output but the event builder discards the URL.
  - Net: `research_section_events.payload` for lab runs has no source URL, and `research_section_runs.telemetry.latestSource` is never written (H1). The only place URLs end up is the FINAL artifact's `sources[]` (committed via `commit_artifact_section`) — there is no record of *what was browsed during* the run.
- Bar violated: complete/queryable telemetry; "stream visible progress" product requirement.
- Impact: No "reading example.com…" live feed possible on the canonical path; no audit trail of which sources a section actually consulted vs. which made it into the final citations. Debugging "why is this section thin" is blind.
- Severity: H. Effort: M. Fix: extend the `tool-started`/`tool-finished` event metadata (and the answer-tool step summarizer) to carry the tool input URL / query, and project it into `latestSource`.

### H3. Lab jobs run in Vercel `after()` but the orphan reaper only runs on Railway worker boot — crashed/timed-out lab sections can hang in `running` forever
- Evidence:
  - Lab work executes in `after()` inside the Next.js function: `src/app/api/research-v2/orchestrate/route.ts:285-288` → `dispatchLabSectionJobs`; `run-lab-section/route.ts:300-308` → `scheduleLabSectionJob({ schedule: after })`; `lab-section-dispatch.ts:45-64`.
  - The ONLY reaper is `research-worker/src/index.ts:953-980` `reapOrphanedSectionRuns()` invoked from `app.listen` boot (`:979`), calling `reap_orphaned_section_runs(15min)` (migration `20260515_phase5_abort_guard_and_reaper.sql:147-181`).
  - The lab job's own 270s timeout (`lab-section-dispatch.ts:14,47-53`) only fires `markSectionFailed` IF the `after()` invocation is still alive. If Vercel freezes/kills the function (cold-stop, OOM, deploy, or the platform reclaiming the post-response `after()` budget) before the timeout callback runs, nothing writes a terminal status.
  - `audit-state` (`audit-state/route.ts`) and the `run-lab-section`/`orchestrate` lab path have NO stale-running guard. (Only the legacy `dispatch/route.ts:150-199` has a stale-threshold check, and it reads `journey_sessions.job_status`, which the lab path doesn't write.)
- Bar violated: resumable jobs; no silent failures.
- Impact: A lab section orphaned by a function kill sits `running` indefinitely. `markParentCompleteWhenAllSectionsCommit` never fires (parent stuck), `audit-state` shows a permanently-spinning chip, and there's no automated recovery unless an unrelated worker process happens to reboot. User-visible "stuck forever."
- Severity: H. Effort: M. Fix: either (a) run `reap_orphaned_section_runs` from a Vercel cron / on `audit-state` read for the queried parent, or (b) move lab execution onto the worker so the existing boot reaper covers it. Short term: have `audit-state` treat `running` rows older than the threshold as `error` (mirror of the worker reaper) so the UI un-sticks.

### H4. `corpus-to-research-input.findSourceForEvidence` fail-soft to `sources[0]` silently mis-attributes evidence to an unrelated source
- Evidence:
  - `src/lib/research-v2/corpus-to-research-input.ts:343-363`: `findSourceForEvidence` tries URL match, then title match, then `return matchingTitleSource ?? sources[0]!`.
  - `buildSources` (`:286-341`) builds the `sources[]` set ONLY from `corpus.sources` (+ uploaded docs). It does NOT include `corpus.evidence[].url`.
  - But the corpus contract guarantees each evidence item has its OWN url: `research-worker/src/runners/deep-research-program.ts:83-89` schema — `evidence: [{ claim, source, url ("Exact cited source URL supporting this evidence"), quote, confidence }]`. The model can (and the prompt invites it to) cite an evidence URL that is not one of the `corpus.sources` entries.
  - When that happens both URL-match and title-match miss → the excerpt's `sourceId`/`sourceUrl` are set to `sources[0]` (`buildEvidenceExcerpt` `:383-396`), i.e. an arbitrary unrelated source.
  - The existing test (`__tests__/corpus-to-research-input.test.ts:14-39`) only uses fixtures where every evidence URL is ALSO in `corpus.sources`, so the fallback branch is never exercised — the masking is invisible in CI.
- Bar violated: no fail-soft that masks missing data; no fabricated/defaulted values passed downstream; the "easy path masked a hard correctness problem" pattern explicitly called out.
- Impact: Downstream section runners receive corpus excerpts whose cited `sourceUrl` points at the wrong document. A quote about pricing can be stamped with the homepage URL. This is a silent provenance corruption feeding every positioning section — directly contradicts the "no fabricated pricing / verified source URLs only" product rule.
- Severity: H. Effort: S. Fix: merge `corpus.evidence[].url` into the `sources[]` set (deduped) BEFORE excerpt mapping so each evidence excerpt resolves to its own real source; if still unresolved, drop the excerpt or mark `sourceId:null` rather than borrowing `sources[0]`.

---

## M — Medium severity

### M1. Impersonation data-path broken on every research-v2 route — queries use actor `userId`, never `effectiveUserId`
- Evidence:
  - `orchestrate/route.ts:159-205`, `run-lab-section/route.ts:188-235`, `dispatch/route.ts:202-240`, `rerun-section/route.ts:141-185`, `abort-section/route.ts:29-52`, `audit-state/route.ts:260-278` all derive `userId` from `auth()` and then query `.eq('user_id', userId)` / `loadOwnedResearchSession({ userId })` with the raw Clerk actor id.
  - `requireApiUser()` resolves `effectiveUserId` (`src/lib/auth/app-access.ts:291-303`) and the codebase ships a `getJourneyDataUserId` helper for exactly this — but `grep` shows ZERO API routes import it. `run-lab-section`/`orchestrate` even assert `apiUser.actorUserId !== userId` (so they explicitly use actor, not effective).
- Bar violated: correct auth.
- Impact: When an admin/internal impersonates a client, these routes operate on the ADMIN's `journey_sessions` / `research_artifacts`, not the client's. Orchestration, dispatch, abort, and state-read all target the wrong tenant. (Consistent with the MEMORY note "impersonation data-path deferred" — flagging because it's a live correctness gap, not because it's news.)
- Severity: M (data-path is a known deferral; no cross-tenant *leak* since it stays within the actor's own rows, but the feature is silently wrong). Effort: M. Fix: route all research-v2 data access through `effectiveUserId` (via `getJourneyDataUserId(access)`).

### M2. `seedOrchestration` is not idempotent against already-`complete` sections — re-call inserts a fresh `queued` section_run row per completed zone
- Evidence:
  - `supabase/migrations/20260520_orchestrate_parent_child.sql:85-103`: the reuse `select` filters `status in ('queued','running')`. A `complete` (or `error`/`aborted`) run is NOT reused, so `v_run_id` is null → a NEW `gen_random_uuid()` row is inserted with `status='queued'`.
  - The `research_artifact_sections` upsert (`:107-121`) DOES preserve a completed section (keeps its `section_run_id`/`status` when `status='complete'`), so the committed artifact is safe — but the `research_section_runs` table now has an orphan `queued` run for an already-complete zone.
  - `audit-state/route.ts:373-377` selects an `active` (`queued`/`running`) run *before* falling back to the committed run, but guards it: `active && normalizeStatus==='running' ? active : committed ?? active`. A `queued` (not running) orphan won't override a committed-complete projection — but it WILL count as a non-terminal child for any logic that treats queued runs as in-flight, and it's dangling DB state. No test covers this (`__tests__/orchestrate-db.test.ts` only tests `buildFrozenGtmBriefThesisPatch`).
- Bar violated: idempotent jobs; the orchestrate route's own docstring claims "Idempotent: a second call … returns the same six section_run_ids."
- Impact: Re-running orchestrate after a partial completion (very common — user re-submits, or a rerun fans out) leaves orphan `queued` `research_section_runs` rows and can mis-seed `children_total` perception. The documented idempotency contract is violated for the mixed-terminal case.
- Severity: M. Effort: M. Fix: in `seed_orchestration`, also reuse a terminal `complete` run for the zone (return it with `reused=true`) instead of inserting a new queued row, or skip insert when the section row is already `complete`.

### M3. Active-run guard regressed in the latest commit_artifact_section migration
- Evidence:
  - `20260514` (`:294-298`), `20260515` (`:106-110`), `20260524` (`:96-99`) all carried: on the UPDATE path, `if v_current_run_id is not null and v_current_run_id <> p_section_run_id then return conflict`. This blocks a stale runner from overwriting a section that advanced to a newer run.
  - The newest migration `20260526_rollup_parent_on_section_commit.sql:118-134` redefines `commit_artifact_section` and DROPS that `v_current_run_id` check entirely (it doesn't even `select section_run_id into v_current_run_id`). Only the revision compare-and-swap + aborted_at guard remain.
- Bar violated: no silent failures (stale-writer protection weakened).
- Impact: Two runs for the same zone that happen to read the same revision (e.g. a rerun racing a slow original that wasn't aborted) can now both pass the revision check across sequential commits; the older runner is no longer rejected by run-id mismatch. Revision CAS still prevents a same-revision double-write, but the explicit "you are not the active run" protection that earlier migrations added is gone. Likely an accidental omission when the rollup was bolted on.
- Severity: M. Effort: S. Fix: re-add the `v_current_run_id <> p_section_run_id` conflict check to the update path in the `20260526` definition (it's the last-applied, so it wins).

### M4. `_capabilities` fail-soft hides worker/key misconfiguration as a normal-looking response
- Evidence: `src/app/api/research-v2/_capabilities/route.ts:42-58` returns `worker_version:'unreachable', orchestrate_supported:false` on any non-2xx OR thrown fetch, and `'unconfigured'` when `RAILWAY_WORKER_URL` is empty (`:28-30`). Always HTTP 200.
- Bar violated: no silent failures (borderline — this is a diagnostics endpoint, so soft-fail is partly intentional).
- Impact: For the lab path this is mostly cosmetic (lab doesn't need the worker), but it means a genuinely-down worker for `draft`/`deep`/`managed` looks identical to "intentionally not configured." The string `'unreachable'` is the only signal and it's easy to miss. Acceptable as-is IF the UI distinguishes the strings; flagging because it's a soft-fail surface.
- Severity: M (mostly informational). Effort: S. Fix: keep 200 but include a structured `worker_reachable: boolean` + last error so callers don't string-match.

### M5. `freezeReviewedBriefSnapshot` is a non-atomic read-modify-write race on parent `thesis`
- Evidence: `src/lib/research-v2/orchestrate-db.ts:82-129` reads `research_artifacts.thesis`, computes a patch in JS (`buildFrozenGtmBriefThesisPatch`), then `update(...).eq('id', parentAuditRunId)`. No row lock / CAS. Called from both `orchestrate` (managed `:247` and seed `:278`) and could overlap with a concurrent re-submit.
- Bar violated: idempotency under concurrency.
- Impact: Two near-simultaneous orchestrate calls can both read an unfrozen thesis and both write — last-writer-wins. The `shouldUpdate:false` guard reduces but doesn't eliminate the window (both reads see unfrozen). Low blast radius (thesis snapshot only), but it's a genuine lost-update.
- Severity: M. Effort: M. Fix: do the freeze inside a SECURITY DEFINER RPC with `for update`, or a conditional update (`where thesis->>'source' is distinct from 'onboarding_v2_review'`).

### M6. `auth()` wrapped in bare `try/catch → userId=null` masks real Clerk failures as 401
- Evidence: `orchestrate/route.ts:159-168` and `run-lab-section/route.ts:188-198` wrap `await auth()` in `try { } catch { userId = null }` → returns 401. (`dispatch`, `rerun-section`, `abort-section`, `audit-state` call `auth()` unguarded, which is the correct shape.)
- Bar violated: no silent failures.
- Impact: A transient Clerk outage or misconfig (which throws) is reported to the client as `401 unauthorized` rather than a 5xx, so retries/alerting treat an infra fault as an auth problem. Inconsistent with the sibling routes.
- Severity: M. Effort: S. Fix: drop the try/catch (match the other routes) or distinguish thrown errors (500) from "no userId" (401).

---

## L — Low severity

### L1. `markSectionRunning` in the lab store sets `research_section_runs.status='running'` but never updates `research_artifact_sections.section_run_id`; relies on seed having pinned it
- Evidence: `supabase-run-store.ts:408-449` updates only `research_section_runs`. The `append_section_event` RPC (`20260514_...sql:337-366`) requires `ras.section_run_id = p_section_run_id` (active-run join). This works ONLY because `seed_orchestration` pre-pinned `section_run_id` on the sections row (`20260520:107-121`). For a lab RERUN of an already-`complete` zone, the sections-row guard keeps the OLD `section_run_id` (M2), so the new run's events would be silently rejected by `append_section_event` (returns null, "stale run rejected") — events vanish with no error surfaced to the store (`appendEvent` only throws on `error`, not on null return).
- Bar violated: no silent failures (event drop on rerun).
- Impact: Lab rerun of a completed zone can produce zero activity events (silently) because the sections row still points at the prior run. Narrow (rerun-of-complete + lab), but a real silent data loss.
- Severity: L. Effort: M. Fix: lab rerun should re-pin `research_artifact_sections.section_run_id` to the new run (a `start_section_run`-style update) before emitting events; or `appendEvent` should detect the null RPC return and log.

### L2. `markParentCompleteWhenAllSectionsCommit` (lab) duplicates the DB-side `roll_up_research_artifact` trigger logic in app code
- Evidence: `supabase-run-store.ts:180-218` re-reads complete zones and updates `research_artifacts` after each commit. Migration `20260526:110-112,144-146` already calls `roll_up_research_artifact` INSIDE `commit_artifact_section` on every `complete`. So the parent rollup happens twice per commit (once in-RPC, once in app). Harmless (both use `greatest()` / idempotent) but redundant work + a second failure surface (`SupabaseRunStoreError` at `:213`).
- Bar violated: surgical/simple (minor).
- Impact: Extra round-trips; a transient error in the app-side rollup throws AFTER the artifact already committed + rolled up in-RPC, so `saveArtifact` can report failure for an already-successful commit.
- Severity: L. Effort: S. Fix: drop the app-side `markParentCompleteWhenAllSectionsCommit` now that the RPC rolls up.

### L3. `audit-state` caps events at 60 total across all 6 zones, then 12/zone — high-activity zones can starve
- Evidence: `audit-state/route.ts:317-322` `.limit(60)` ordered `created_at desc`, then `:428-439` keeps first 12 per zone. With 6 zones, a single chatty zone (many tool calls) can consume most of the 60-row budget, leaving other zones with stale/empty feeds even though newer events exist for them.
- Bar violated: complete/queryable telemetry (minor).
- Impact: Live feed for quiet zones can show nothing while a chatty zone dominates. Cosmetic.
- Severity: L. Effort: S. Fix: query per-zone (6 × `limit 12`) or use a window function, instead of a global 60 cap.

### L4. `dispatch` route stale-running guard depends on `journey_sessions.job_status` the lab path never writes
- Evidence: `dispatch/route.ts:118-200` reads `journey_sessions.job_status` for the active-job guard. The lab path writes job state to `research_section_runs`, not `journey_sessions.job_status`. So `dispatch` (used by `rerun-section` non-lab + corpus) and the lab path use two different in-flight signals; a lab section in flight is invisible to `dispatch`'s guard and vice-versa.
- Bar violated: idempotency (cross-path dedupe gap).
- Impact: A `dispatch` call and a lab orchestrate for the same zone won't see each other's in-flight state. Narrow given lab vs deep are usually not mixed per run, but the dedupe is path-local.
- Severity: L. Effort: M. Fix: unify the in-flight signal on `research_section_runs.status` for both paths.

### L5. Several `console.warn`-and-return-null reads can produce a misleading empty UI
- Evidence: `orchestration-session.ts:29-37` (session read failure → returns null → 404 `session_not_found`, masking a DB error as "not found"); `dispatch/route.ts:85-90, 131-137` (status reads warn + return null → guard fails open). These are fail-open reads where a transient Supabase error is indistinguishable from "no data."
- Bar violated: no fail-soft that masks missing data.
- Impact: A Supabase blip during `loadOwnedResearchSession` surfaces to the user as `404 session_not_found` (looks like their run vanished) rather than a retryable 5xx.
- Severity: L. Effort: S. Fix: distinguish read error (500) from genuine empty (404/empty) in these helpers.

---

## Things checked that are CORRECT (no finding)

- `run_id` vs `id` handling in `audit-state` / `abort-section` / `rerun-section` / `run-lab-section` is correct: all query `.eq('run_id', runId)` on `research_artifacts`, then use `parent.id` (the uuid) for child `artifact_id` joins. `use-audit-state.ts:96` posts `run_id` consistently. No confusion found in scope.
- `commit_artifact_section` revision compare-and-swap + `for update nowait` + `aborted_at` guard is sound (aside from the M3 run-id regression).
- `append_section_event` active-run join correctly rejects stale post-abort writers (it just isn't re-pinned on lab rerun — L1).
- RLS: end users get SELECT-only; all writes go through SECURITY DEFINER RPCs granted to `service_role` only; `revoke ... from public, anon, authenticated` is applied (`20260514:374-382`). Correct.
- `buildCommitPatch` (`webhook-handler.ts:526-552`) persists the full typed artifact into `data` and real `sources` — typed-artifact persistence is intact (migration `20260524` adds the `data` column and the RPC writes it).
- The worker path telemetry (`updateSectionRunPhase`) IS complete — the gap is specifically the lab reimplementation (H1).
