# Codex Handoff — Wave 2 (streaming + telemetry vertical: make progress visible, stop hangs & double-charges)

> Dispatch with `model_reasoning_effort=xhigh`, working root = this worktree
> (`feat/v2-lab-section-wire`), **after Wave 1 has landed + passed its QA gate** (Wave 1 and Wave 2 both touch `run-section.ts` in *different* regions — rebase on Wave 1 first to avoid conflicts).
> Tasks 1–4 are the committed scope, four atomic commits, in order. Task 5 is OPTIONAL (see its header).
> Report only what you changed + build/test output + the commit SHAs + anything that didn't match this spec.
> Full audit context: `docs/2026-05-27-pipeline-audit-and-restructure.md` + sub-reports `docs/audit/2026-05-27-ui-streaming-kinks.md` and `docs/audit/2026-05-27-backend-persistence-kinks.md`.

## Mission & landing context
This is the canonical lab path (`executionMode:'lab'` → `src/lib/lab-engine/` running in Vercel `after()`, persisting to Supabase; the reader polls `GET /api/research-v2/audit-state` every 2.5s). Wave 0 (search/grounding/mode) and Wave 1 (competitor ads) have landed. **Wave 2 makes the live surface actually show progress and stops two reliability/cost bugs.**

**The one architectural fact that drives this wave:** the reader is **100% poll + DB-based**. It *ignores the engine's UI message stream entirely* (`use-audit-state.ts` only fetches `audit-state`; no SSE/WS). So every progress signal the reader can show must be **persisted to the DB** — `research_section_runs.telemetry`, `research_section_events`, `research_artifact_sections`. The engine already emits rich tool/status events to the UI stream via `writeToolEvents`/`writeArtifactPartial`, but those go nowhere for the reader. What the reader *can* see:
- `research_section_events` (the activity feed — already persisted per tool event; the feed is "genuinely good" per audit). 
- `research_section_runs.telemetry` (the per-zone header chip — `latestTool`/`latestSource`/`capabilityGaps`/`wave` all read by `audit-state` but **never written** on the lab path → always null).

So the headline win is cheap and high-value: **the data for "using web_search / reading gong.io / 2 gaps" already flows through `buildToolEvents` — it's just dropped before it reaches the reader.** Light it up.

Two reliability bugs ride along: lab sections orphaned by a Vercel function kill hang `running` forever (the only reaper runs on Railway worker boot, which the lab path never touches), and the kickoff can double-fire and double-charge (~$1.50–2/pull).

## Global constraints (apply to every task)
- **Surgical.** Change only what each task specifies. Match existing style. No unrelated refactors.
- **Secrets:** never read/print/commit `.env*`.
- **Zod for model-facing schemas:** no `.min()/.max()` on number fields in tool/model schemas (`.min(1)` on strings ok). The activity-event schemas are `.strict()` — new fields must be added explicitly.
- **Do NOT touch the legacy worker positioning path** (`research-worker/src/runners/positioning*`). You MAY read `research-worker/src/index.ts` + `supabase/migrations/*` to reuse the existing reaper RPC.
- **Do NOT reintroduce** the `commit_artifact_section` run-id guard (intentional revision-CAS, out of scope).
- **Build/test gate (frontend only):** baseline at this point = the Wave 1 final `test:run` count (≥ 1059 + Wave 1's new tests). After each commit: `npm run build` exit 0, `npm run test:run` no *new* failures. Pre-existing openrouter/chat-blueprint TS errors are expected.
- **Commits:** atomic commits on `feat/v2-lab-section-wire` (no branch, no push). Co-Authored-By trailer on each.

---

## Task 1 — Capture tool source URLs + surface live tool/source/gaps (F2 + F1)
**GOAL:** the reader's per-zone "currently using tool X · reading source Y · N capability gaps" surfaces are dead (always null) because `buildLabSectionTelemetry` never writes them, even though `buildToolEvents` has the data. Fix the capture (add the URL to the event) and the surfacing (derive the live signals in `audit-state` from the events already in the DB — no new writes, no race).

**FILES**
- `src/lib/lab-engine/events/activity-event.ts` (`toolMetadataSchema` :47-51; `tool-started`/`tool-finished` variants :100-118)
- `src/lib/lab-engine/agents/run-section.ts` (`buildToolEvents` :307-359)
- `src/app/api/research-v2/audit-state/route.ts` (`buildWorkerStateReadModel` :206-232; per-zone assembly :367-386; events fetch :316-323; `eventsByZone` build :427-441)
- tests: `activity-event` test + `audit-state` route test (extend)

**STEPS**
1. **Event schema (F2):** add `query: z.string().min(1).optional()` and `sourceUrl: z.string().url().optional()` to `toolMetadataSchema` (:47-51, `.strict()`). Both flow to `tool-started` and `tool-finished` (the latter extends `toolMetadataSchema`).
2. **Capture in `buildToolEvents`** (:307-359): each `step.toolCalls[i]` carries `.input` (confirmed — `AgentStep.toolCalls: { toolName, input }`, populated by `summarizeStep` at `section-agent.ts:136-162`). For the `tool-started` event, pull a human source signal from the input by tool:
   - `web_search` → `input.q` → set `query`.
   - `firecrawl` → `input.url` → set `sourceUrl`.
   - `google_ads`/`meta_ads`/`adlibrary` → `input.advertiser` (+ `input.domain` if present) → set `query`.
   - others → omit. Read defensively (`input` is `unknown`; guard with a small `asRecord`/`firstString` helper or reuse existing ones in the file).
3. **Confirm persistence:** these events are persisted to `research_section_events` via `appendEvent`→`append_section_event`; verify the event `metadata` reaches the row `payload` (audit-state selects `payload` at :316-323). If the append path strips unknown metadata keys, include `query`/`sourceUrl` so they land in `payload`. (Do not add a migration — `payload` is already `jsonb`.)
4. **Surface in `audit-state` (F1), read-time + write-free:** the handler already fetches the section events. Build a per-zone map of the **newest** tool signal: latest `tool-started`/`tool-finished` event per zone → `latestTool` = its `toolName`, `latestSource` = its `payload.sourceUrl ?? payload.query`. Build per-zone `capabilityGaps` from `tool-finished` events whose `payload.gap` is set (collect `{reason/message}` — feed the existing `normalizeCapabilityGaps` at :230). Pass this map into `buildWorkerStateReadModel` (add params) or merge it onto each `byZone` entry after both `byZone` (:367-386) and the events are available. Prefer the events-derived values; fall back to `telemetry.*` when no events exist. **This avoids any write during the run and surfaces data already persisted.**
5. (Optional, only if step 4's read-time path is awkward) you may instead thread `latestTool`/`latestSource`/`capabilityGaps` into `buildLabSectionTelemetry` (`supabase-run-store.ts:54-75`) and write them — but that needs the store to know the latest tool mid-run, which it doesn't cleanly; the read-time derivation in step 4 is the recommended, lower-risk path. Pick one; don't do both.

**VERIFY:** `activity-event` test: a `tool-started` with `query`/`sourceUrl` parses; `.strict()` still rejects unknown keys. `audit-state` route test: given section events with a `web_search` `query` and a `firecrawl` `sourceUrl`, the zone's `latestTool`/`latestSource` are populated and a gap event yields `capabilityGaps`. `npm run build` exit 0; full `test:run` no new failures.
**COMMIT:** `feat(research-v2): capture tool query/source URLs and surface live tool/source/gaps in audit-state`

---

## Task 2 — Per-zone event query so chatty sections don't starve quiet ones (D4)
**GOAL:** the activity feed caps events at **60 total across all zones** then keeps 12/zone. With 6 parallel sections, one chatty zone evicts other zones' events before the UI ever polls them — a fast section's early steps silently never render.

**FILES**
- `src/app/api/research-v2/audit-state/route.ts` (events fetch :316-323; `eventsByZone` build :427-441)

**STEPS**
1. Replace the single global `.limit(60)` (:316-323) ordered `created_at desc` with a per-zone bound so each of the 6 zones independently keeps its newest ~12 events. Two acceptable shapes: (a) a Postgres window-function query (`row_number() over (partition by zone order by created_at desc)` ≤ 12) via an RPC or `execute_sql`-style select; or (b) the simpler app-side fix: raise the global limit enough that 12×(zones) fit (e.g. `.limit(12 * workerSectionIds.length)`) **and** keep the existing per-zone 12 cap (:438) — but order so each zone's newest survive. Prefer (a) if a clean query exists; (b) is acceptable and lower-risk. Keep the final per-zone ascending re-sort (:438-441).
2. Don't change the per-zone display cap (12 is fine); the bug is the *global* cap starving zones before the per-zone slice runs.

**VERIFY:** `audit-state` route test: with 6 zones each having >12 events, every zone returns its own newest events (no zone empty due to another zone's volume). `npm run build` exit 0; full `test:run` no new failures.
**COMMIT:** `fix(research-v2): per-zone event budget in audit-state so chatty sections don't starve others`

---

## Task 3 — Un-stick orphaned lab sections (F3)
**GOAL:** lab work runs in Vercel `after()`; if the function is killed (cold-stop, OOM, deploy) before the 270s timeout callback fires, the section hangs `running` forever — the parent never completes, the reader spins forever. The only reaper (`reapOrphanedSectionRuns`) runs on **Railway worker boot** (`research-worker/src/index.ts:979`), which the lab path never triggers. Reuse the existing, battle-tested reaper RPC from the read path.

**CONTEXT (verified):** `reap_orphaned_section_runs(p_threshold_minutes int)` exists in `supabase/migrations/20260515_phase5_abort_guard_and_reaper.sql:147-187` — `security definer`, granted to `service_role`, atomically flips stale `running` rows (and their `research_artifact_sections`) to `error`. Threshold default 15 min (`WORKER_STALE_RUN_THRESHOLD_MIN`). It's idempotent and bounded. No Vercel cron or audit-state path calls it today (confirmed).

**FILES**
- `src/app/api/research-v2/audit-state/route.ts`

**STEPS**
1. In the `audit-state` GET handler, after loading the section runs, detect a stale orphan: any selected run with `status === 'running'` and `started_at` older than the threshold (read `WORKER_STALE_RUN_THRESHOLD_MIN`, default 15). 
2. When (and only when) a stale running row is detected for this parent, invoke `reap_orphaned_section_runs({ p_threshold_minutes })` via the service-role Supabase client (the same client the route already uses for reads), then **re-read** the section runs/sections so the response reflects the now-`error` rows. Guard it so it runs only on stale detection (not on every poll) to avoid needless RPC calls. Errors from the RPC: log + continue (don't fail the read).
3. This both persists the terminal state (parent can complete / UI un-sticks) and is safe to call repeatedly. Do NOT add a new reaper implementation — reuse the RPC.

**VERIFY:** `audit-state` route test: a `running` row with `started_at` older than threshold triggers the RPC (mock it) and the response surfaces the section as terminal; a fresh `running` row does NOT trigger it. `npm run build` exit 0; full `test:run` no new failures.
**COMMIT:** `fix(research-v2): reap orphaned lab sections on audit-state read so runs don't hang forever`

---

## Task 4 — De-dupe the double `/orchestrate` kickoff (F10)
**GOAL:** both `page.tsx` (onboarding-complete) and `audit-reader-shell.tsx` (parent-null recovery) POST `/orchestrate`. The shell's guard is a `useRef` that **resets to `false` on any non-ok response** (`audit-reader-shell.tsx:602-632`) and the effect re-fires when `workerStates.length` changes — so a transient failure or a 0→6 length change can re-dispatch, duplicating the paid fan-out (~$1.50–2/pull). Server idempotency on `run_id` is the backstop, but the client should not race itself.

**FILES**
- `src/components/research-v2/audit-reader-shell.tsx` (kickoff effect :602-632; `kickoffFired` ref :573)

**STEPS**
1. Replace the per-mount `useRef` guard with a **module-level `Set<string>` keyed by `runId`** (survives remounts within the session). Before firing, `if (kickedOffRunIds.has(runId)) return;` then `kickedOffRunIds.add(runId)` *before* the fetch.
2. **Do not reset the guard on non-ok.** On failure, log (as today) but keep the runId in the set — the server is idempotent on `run_id`, so a re-fire only wastes a call. If you want a single retry, gate it behind an explicit, bounded retry counter, not an automatic reset.
3. Leave `page.tsx`'s kickoff as the primary; the shell remains the parent-null recovery. The set ensures at most one shell dispatch per runId regardless of re-renders/length changes.

**VERIFY:** shell test (`audit-reader-shell.test.tsx`): mount with `parent_audit_run_id: null` + workerStates present fires exactly one POST; a re-render with changed `workerStates.length` does NOT fire a second; a non-ok response does NOT cause a re-fire. `npm run build` exit 0; full `test:run` no new failures.
**COMMIT:** `fix(research-v2): de-dupe orchestrate kickoff with per-runId guard, stop re-fire on transient failure`

---

## Task 5 — OPTIONAL / RECOMMEND DEFER — per-section progressive structured reveal (D1 + D3)
> **Read this header before starting.** The roadmap lists "reader field-by-field" under Wave 2. After reading the code, the honest finding is: the 6 shipped sections run the **answer-tool path** (`streamSectionViaAnswerTool`), which assembles the section body **atomically** (`answerResult.answerInput` is complete only at the end) — there is no incremental field-by-field stream to forward. True field-by-field streaming would require the answer tool to stream its input (an architectural change, Wave 3+). What this task *can* do surgically is surface the assembled body **one beat before the final commit** (before validation/rollup), so a slow-validating section paints sooner. **Marginal value (~1s earlier paint) for a migration + 4-layer change.** Tasks 1–4 already deliver the "no silent gaps / live progress" goal via DB-backed telemetry + trace. **Recommendation: ship Tasks 1–4, decide Task 5 with the user.** Spec below if approved.
>
> **NON-GOAL (explicit):** intra-section field-by-field token streaming. Out of scope for Wave 2.

**FILES (if approved)**
- NEW migration `supabase/migrations/<ts>_section_partial_data.sql` — add nullable `partial_data jsonb` to `research_artifact_sections`; update `commit_artifact_section` only if needed to clear it on commit (else leave — partial is ignored once `data` is set).
- `src/lib/research-v2/supabase-run-store.ts` — add `savePartialArtifact(runId, sectionId, partial)` writing `partial_data` (throttle: skip if last write < ~1s ago).
- `src/lib/lab-engine/agents/run-section.ts` — `streamSectionViaAnswerTool` (:2523-2806): at the insertion point between `flushBufferedEvents()` (~:2678) and `buildAnswerToolAttempt(...)` (~:2696), call `writeArtifactPartial({ deps, partial: answerResult.answerInput, runId, sectionId })` (already exists, :446-460, for the UI stream) **and** persist via the store's `savePartialArtifact` so the poll-based reader can see it.
- `src/app/api/research-v2/audit-state/route.ts` — in the `sectionsByZone` assembly (:388-403), when `status !== 'complete'` but `partial_data` is present, surface it as `{ data: partialData, partial: true }` (add `partial?: boolean` to the response type). Keep the `complete` branch authoritative.
- `src/components/research-v2/audit-reader-shell.tsx` — in the non-complete branch, if a partial body is present, render it best-effort via `TypedArtifactRenderer` behind a subtle "drafting…" affordance (do NOT run persistence validation on the partial; render defensively, fall back to the skeleton/`LiveActivity` on any shape error).

**VERIFY (if approved):** migration applies; store test writes/clears `partial_data`; audit-state test surfaces partial with `partial:true` only when not complete; shell renders a partial without crashing on a malformed partial. `npm run build` exit 0; full `test:run` no new failures.
**COMMIT (if approved):** `feat(research-v2): surface assembled section body as a partial before final commit`

---

## Out of scope for Wave 2 (do not touch)
- Competitor ad engine / relevance filter / `adEvidence` renderer → **Wave 1** (must land first).
- Claim/citation verifier, fail-closed evidence gating, eval harness → Wave 3.
- Skill↔registry parity + diff test, dead-capability cleanup, SERP-shim renames, section-scoped context, the `--text-primary`/`--accent-blue` color sweep, the 320px rail collapse, the copy-button fix, generic-renderer Paid Media Plan → Wave 4.
- Intra-section field-by-field token streaming (see Task 5 non-goal).
- `commit_artifact_section` revision CAS (working as intended).

## Note for a later wave (not Wave 2 work)
Wave 0's source-attribution fix now **silently drops** corpus evidence that has no URL (defensible — "verified sources only"). Once `capabilityGaps` is flowing (Task 1), the corpus stage should emit a typed gap ("N evidence items dropped: no source URL") so the drop is visible rather than silent. Track for Wave 3 (trust layer).

## Report back
The commit SHAs (4 for the committed scope, +1 if Task 5 approved); baseline vs final `test:run` counts; `build` exit code; confirmation that (a) `latestTool`/`latestSource`/`capabilityGaps` are populated from persisted events (state which approach — read-time derivation vs telemetry write), (b) the per-zone event budget no longer starves zones, (c) a stale `running` row is reaped on read, (d) the kickoff fires at most once per runId; and anything that didn't match this spec.
