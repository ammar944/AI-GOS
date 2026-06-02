# Codex Handoff — research-v3 next tasks (B2 streaming + B1/B4 perf + VoC + sign-off)

**Author:** Claude (HQ) · **Date:** 2026-06-01 · **For:** Codex (`-c model_reasoning_effort=xhigh`)
**Branch:** `feat/v2-lab-section-wire` · **Worktree (system of record):** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
**Base commit:** `5032eb7f` · **Do NOT work in the main checkout** (`/Users/ammar/Dev-Projects/AI-GOS`).

> Line numbers below are anchors as of `5032eb7f`. They drift as you edit. **Re-grep the named symbol** before trusting a line number. Symbols are stable; lines are not.

---

## 0. Operating constraints (non-negotiable)

1. **Never read/print/log `.env` / `.env.*`.** The deny-list hard-blocks it. Check key presence by boolean/count only, never values. A probe may *load* env via `node --env-file=` for its own use, but must log only non-secret names (provider/model id, `Boolean(process.env.X)`).
2. **Paid APIs (SearchAPI, Firecrawl, Perplexity) never loop without an abort condition.** A full live audit costs **~$2**. Run **one** at a time. The consolidated behavioral run is **T6** — don't burn a $2 run per task.
3. **Do NOT edit source while a live audit run is active on the dev server.** Next.js hot-reload corrupts the in-flight run. Build first, then run.
4. **Commit, don't push.** Atomic commits on `feat/v2-lab-section-wire`. **Do not push, do not deploy** — both are user-gated. Conventional-commit messages, one logical change per commit.
5. **Lab engine runs IN-PROCESS in Next.js** (not the Railway worker) for the 6 positioning sections. QA needs only `npm run dev`. `SEARCHAPI_KEY` etc. must be in `.env.local` (they are, for the dev env).
6. **The fabrication/provenance gate is the product's core value. Never weaken it.** Every task that touches the section path must keep the gate running exactly once on the *complete, validated* artifact.

### Browser QA leverage (the point of this handoff)

You have a browser connected to the running app. Use it to QA from the live product instead of guessing:
- App: `http://localhost:3000` → `/research-v2`. Start it with `npm run dev` (one terminal).
- Auth: Clerk, `ammarv67@gmail.com`, **code-based login** — request the code from the user when prompted (it's emailed/SMS at login time; you can't pre-fill it).
- Use whatever browser binding you have (chrome-devtools MCP, or gstack `/browse`). Avoid `wait --networkidle` (the app polls continuously, networkidle never fires).
- Cross-check the DB with the Supabase MCP — project **AIGOS**, ref `sidrtuxpqftyzwdusdha`. Tables: `research_section_runs` (status, telemetry, started_at/completed_at), `research_section_events` (payload jsonb), `research_artifact_sections`, `journey_sessions`.
- **Per-task** browser checks should be cheap (one section, read the DB, eyeball the feed). The **one** full ~$2 audit is **T6**.

### Verification gate (every task, before commit)

- `npm run build` exits 0 · `npm run test:run` green · `npm run lint` clean · `npx tsc --noEmit` at frontend baseline (0 new errors).
- If you touch `research-worker/`: `cd research-worker && npm run build` — **capture ITS baseline first** (the worker has pre-existing `@types/*` gaps that don't show in the frontend tsc count). Don't inherit the frontend baseline as the worker gate.
- Pre-existing TS errors in openrouter tests + chat blueprint tests are expected — ignore them.
- When you delete/replace a source file, also delete its `__tests__/*.test.ts*` and remove it from any barrel/registry (`index.ts`, tool maps, type unions) — orphan tests emit `TS2307` and silently fail the baseline.

---

## 1. What already shipped (context — do not redo)

- **`b05e406b`** — B3 primary (ads) + B4 primary (repair storm): `cleanAdvertiserQuery()` added to `advertiser-match.ts` and wired into `buildCompetitorSeeds()` (`corpus-to-research-input.ts`) so decorated competitor names ("Acme — the X platform (formerly Y)") are cleaned before the ad probe; `constructedAdLibraryLinkPattern` in `claim-extractor.ts` exempts ad-library **search** deep-links (not detail URLs) from the URL verifier, which was the dominant cause of CompetitorLandscape's 186s / 4-repair storm.
- **`5032eb7f`** — B1 legibility: running sections no longer mislabel as "Queued" (`deriveSectionPhase` now returns `Compiling context` for a running section with no events yet); decorative skeleton bars hidden once the feed has items; `QueuedPlaceholder` copy clarified.

Both verified: tsc 0, 1232 tests green. **Not pushed.** These are the baseline you build on.

**Deferred by the user (do NOT build):** "follow-active-section" (auto-advancing the reader to the next running section) — the user chose **leave as-is**. Don't reintroduce it.

---

## 2. Shared ground truth (from a 6-agent research pass — saves you the rediscovery)

### 2a. How the 6 sections are generated TODAY (the path you're changing in T3)
- Dispatch: `lab-section-job.ts` → `runSection` (`run-section.ts`, ~:4144) → for the 6 positioning ids (`answerToolSectionIds`, ~:729) → **`runSectionViaAnswerTool`**.
- The artifact is produced by an **`answer` TOOL CALL**, not `Output.object`: `defaultAnswerToolRunner` (`section-agent.ts:370-409`) builds `new ToolLoopAgent({ tools: {...externalTools, answer}, stopWhen:[stepCountIs, hasSuccessfulAnswerResult] })` and calls **`agent.generate()`** (atomic, ~:394). The validated answer input = `getAnswerInput(steps)`.
- **The gate** runs once on the COMPLETE parsed body inside **`buildAnswerToolAttempt`** (`run-section.ts:2940-3026`): `definition.sectionOutputSchema.parse(...)` → `structuralVerifier({ body, toolResults, corpusExcerpts })` → `validateMinimums` → `checkRequiredEvidenceClasses` → VoC self-source check → DemandIntent keyword provenance → `evaluateEvidenceSupport` (unsupported load-bearing). Failure → repair loop (`answerToolMaxRepairAttempts = 2`); `getBestCommittableAttempt` picks the lowest-unsupported attempt; hard-fail ceiling = `LAB_VERIFIER_MAX_UNSUPPORTED` (default `Infinity` = advisory/non-terminal). `deriveGroundedConfidence` overrides the model's self-reported confidence.
- **The course-pattern machinery already exists but is dead in production:** `streamStructuredResult` (`section-agent.ts:1189`, `Output.object` at :1198) → `defaultStructuredStreamer` (:1352) exposes `partialOutputStream`. `run-section.ts` already consumes it in a structured *attempt* runner: `streamStructured` (:2655) → `consumePartialsUntilAbort` (:2711) → `writeArtifactPartial` (:2724, emits a `data-artifact-partial` UI frame). `streamSectionViaAnswerTool` (:3469) and `streamRunSection` (:3770) are explicitly tagged `// UNUSED-in-production`. **T3 revives/routes through this machinery.**

### 2b. AI SDK v6 streaming API (verified against current docs — not training memory)
- **Structured streaming, ONE model call:** `const r = streamText({ model, tools, output: Output.object({ schema }), stopWhen: stepCountIs(N) })` → iterate `r.partialOutputStream` for partials, `await r.output` for the **validated** final typed object. Tools coexist with `Output.object` in the same request ("structured output generation counts as a step").
- **Partials are NOT schema-validated** ("incomplete data may not yet conform"). Only `await r.output` validates (throws `TypeValidationError` on mismatch). **The gate must run on `r.output`, never on partials.**
- **Server-side completion on disconnect:** call `r.consumeStream()` **without await** so `onFinish` + the gate + the DB commit still run if the browser disconnects.
- **Abort:** pass `abortSignal: req.signal`; `onAbort({ steps })` fires only on abort (persist/clean partials there), `onFinish` only on normal completion.
- **DECISIVE caveat:** incremental streaming is **provider-dependent**. The SDK does NOT synthesize deltas. A non-streaming provider needs `simulateStreamingMiddleware()` — which only fakes streaming *after* the full response, i.e. **no real latency/UX win**. → This is why **T3 step 0 is a probe.**

### 2c. Provider reality (corrects prior memory)
- **Code default = Anthropic `claude-sonnet-4-5`** (`src/lib/lab-engine/ai/models.ts:54-72`, `resolveSectionModelProvider`). **DeepSeek `deepseek-v4-flash` only when `LAB_ENGINE_PROVIDER='deepseek-direct'|'deepseek-ollama'`** (:114-138). Prior memory's "DeepSeek is the code default" is **wrong**; DeepSeek is an env override, not the default.
- `@ai-sdk/deepseek` (^2.0.35) is OpenAI-compatible; DeepSeek streams content/token deltas + tool_calls, but has only `json_object` JSON mode (not strict `json_schema`). Tool-arg-delta streaming for `deepseek-v4-flash` specifically is **unproven** — the probe settles it.
- There is **no `response_format`/`json_schema` warning anywhere in the repo** (grep + git log = zero). Earlier notes claiming a live warning were unconfirmed; disregard.
- **Determine which provider the dev env actually uses** in the probe (`process.env.LAB_ENGINE_PROVIDER`, log the value — it's not a secret). Prod may differ; report what you tested against.

### 2d. Transport reality
- **Today = poll, not Realtime.** Server emits typed `ActivityEvent`s → `supabase.rpc('append_section_event')` → INSERT into `research_section_events.payload` (jsonb). Frontend **polls** `GET /api/research-v2/audit-state` every **2500ms** (`use-audit-state.ts:16`). **Zero `.channel()`/`postgres_changes` subscriptions exist anywhere in `src`.**
- `research_section_events` is **already in the `supabase_realtime` publication** (`20260514_research_artifact_normalized.sql:97-105`) — `postgres_changes` would need no migration. But for high-frequency partials, **broadcast** (ephemeral, no DB write, no RLS-JWT dependency) is the right transport — see T3.
- **Customer-safe allowlist** (`src/lib/research-v2/section-activity.ts`): `EVENT_PHASE` map (:121-134) drops any event type not listed; `JSON_HINT` regex + `translateReason` (:149-160) + `searchChip` (:164-175) + `safeMessage` (:191-196) strip all raw payload from title/detail/chip (this closed a confirmed jargon leak). **Partial-artifact frames must bypass this path entirely** — never route a JSON body through `buildSectionActivityFeed`.
- **No throttling exists** on the emit path — one RPC INSERT per `appendEvent`. Realtime hard limit ~**256KB/message**. T3 must throttle.

### 2e. Reader reality
- Strictly commit-gated: `sectionsByZone[zone]` is populated only from `status === 'complete'` rows (`audit-state/route.ts:570`). Running → `LiveActivity` narration only (no body).
- Committed card renders via `TypedArtifactRenderer` (`typed-artifact-renderer.tsx:463-496`) → 8 per-section renderers that do **unguarded deep dereferences** (e.g. `market-category.tsx:102-245`) → **crash on partial/invalid JSON**. `GenericTypedArtifactRenderer` (:402-461) **is partial-tolerant** (reflects over keys, skips missing) — use it for drafting.
- `pickPositioningTypedArtifact`'s guard requires `verdict + statusSummary + confidence + sectionTitle` — early partials fail it; **don't reuse it** for partials. Render the raw partial body through the generic renderer with synthesized placeholder envelope fields.
- `live.sectionsByZone[id]` truthiness is treated as "complete" (`audit-reader-shell.tsx:1161`). **Never write partials into `sectionsByZone`/`typedByZone`** — it would flip a running section to the committed-card path and corrupt the gate.

---

## 3. Tasks

Recommended order: **T1 → T2 → T4 → T3 → T5 → T6.** T1/T2 are independent quick wins. T4 is a small `run-section.ts` perf fix — land it before T3, which restructures the same file. T3 is the centerpiece. T5 is conditional on T6's live data. T6 proves everything in one run.

---

### T1 — B1a: per-zone event query (kill feed silence) [headline B1 fix]

**GOAL:** Every running zone gets its own recent events, so a noisy zone can't starve a quiet one's feed (the "feed goes silent" complaint).

**ROOT CAUSE:** `audit-state/route.ts` runs ONE global query — `select … order created_at desc limit (12 * workerSectionIds.length)` (`eventLimit` at ~:524, query ~:526-530). A busy zone fills the global limit; quiet zones get zero rows → their feed looks dead. `buildEventsByZone` then caps at 12/zone (~:239) but the global LIMIT already dropped the quiet zones' rows upstream.

**FILES:** `src/app/api/research-v2/audit-state/route.ts`; new `supabase/migrations/20260601_research_section_events_zone_index.sql`; `src/app/api/research-v2/audit-state/__tests__/route.test.ts`.

**CONSTRAINTS:** Don't change the event schema or the allowlist. Keep the 12/zone cap.

**STEPS:**
1. Replace the single global query with **per-zone bounded fetches**: for each zone in `workerSectionIds`, `select … .eq('artifact_id', parentId).eq('zone', zone).order('created_at', { ascending: false }).limit(12)`. Run them with `Promise.all`. Merge into `eventsByZone`. This guarantees up to 12 events for *every* zone regardless of neighbors' volume.
2. Add the index migration (matches the per-zone access pattern; follows the `idx_<table>_<cols>` convention seen in `20260514`/`20260520`):
   ```sql
   create index if not exists idx_research_section_events_zone_created
     on research_section_events (artifact_id, zone, created_at desc);
   ```
   The migration FILE you author. **Applying it to the prod AIGOS DB is user-gated** — additive/reversible/low-risk, but confirm with the user (or apply to a Supabase branch) before `apply_migration`.
3. Update `route.test.ts` for the per-zone shape (assert each zone returns its 12 even when one zone has 100+ events).

**VERIFY:** unit (per-zone fetch isolation) · tsc/lint/tests green · **Browser (T6):** during a multi-section run, every running zone's feed shows live activity; none silent.

---

### T2 — VoC telemetry mismatch (investigate → fix)

**GOAL:** No section shows phase `Needs review`/`failed` while its `status === 'complete'` (observed on VoiceOfCustomer in the phase-0 audit).

**GROUND TRUTH:** `phase` is **derived**, not stored: `deriveSectionPhase(status, latestEventType)` makes terminal status win (`complete → Committed`; `needs-review/error/aborted → Needs review`). So a `complete` status should already yield `Committed`. The mismatch means one of: (a) the status fed to `deriveSectionPhase` ≠ the displayed status (two read paths diverge), (b) a failed earlier attempt's row/event is selected over the successful one, or (c) a stale/duplicate `research_section_runs` row.

**FILES:** `src/app/api/research-v2/audit-state/route.ts` (`buildWorkerStateReadModel` ~:299-360; row selects ~:432, ~:466), `derive-section-phase.ts`, `src/lib/research-v2/supabase-run-store.ts`.

**STEPS:**
1. **Reproduce via browser + DB:** run a flow, find a VoC section that's complete but reads Needs review/failed. Query `research_section_runs` + `research_section_events` for that `(artifact_id, zone)` via Supabase MCP — inspect actual `status`, `started_at/completed_at`, and the latest event type.
2. Root-cause (3 questions: why does the architecture allow it / exact repro conditions / regression risk).
3. **Fix the row SELECTION** (pick the authoritative/latest-by-completion row, or ensure a `complete` status wins over a stale `section-failed` event). Do **not** paper over it inside `deriveSectionPhase`.
4. Test.

**VERIFY:** unit (a `complete` row with a prior `section-failed` event → phase `Committed`) · tsc/lint/tests · **Browser (T6):** VoC and all sections show correct terminal phase.

---

### T3 — B2: gate-safe artifact streaming (Option B, course-exact) [centerpiece]

**GOAL:** The 6 sections stream their artifact into the reader as it's written, while the fabrication gate still runs **exactly once** on the complete, validated artifact before commit.

**APPROACH — Option B (the user's explicit choice):** produce section output via **`streamText` + `Output.object` + `partialOutputStream`** (the course pattern) instead of `agent.generate()` + the `answer` tool. Re-wire the gate onto `await result.output`. Preserve the repair loop. Stream throttled partials to the reader over **Supabase Realtime broadcast**. Render partials in a drafting view via the **partial-tolerant generic renderer**.

> The user accepts Option B's tradeoff vs the `answer`-tool path (coarser repair feedback: `TypeValidationError` from `await result.output` instead of the `answer` tool's `__answerRejected` field-level issues). **Preserve as much repair signal as possible** from the validation error, and keep the gate + repair-loop semantics intact.

**FILES:** `src/lib/lab-engine/agents/run-section.ts`, `src/lib/lab-engine/agents/section-agent.ts`, `src/lib/lab-engine/events/activity-event.ts` (new partial frame type if needed), `src/lib/research-v2/supabase-run-store.ts` (broadcast emit) or a new `src/lib/research-v2/realtime-broadcast.ts`, `src/app/api/research-v2/audit-state/route.ts` (only if a partial channel name needs surfacing), a new client subscribe hook (e.g. `src/lib/research-v2/use-section-partials.ts`), `src/components/research-v2/audit-reader-shell.tsx`, plus `__tests__`.

**STEPS:**

**0. PROBE FIRST (pennies — gates the whole task).** Confirm the configured provider streams `partialOutputStream` **incrementally** (not one buffered chunk). Write a throwaway script (e.g. `/tmp/b2-probe.ts`) that:
   - resolves the section model the SAME way production does (read `LAB_ENGINE_PROVIDER`; construct the Anthropic `claude-sonnet-4-5` or DeepSeek `deepseek-v4-flash` model per `models.ts`). **Log only the provider + model name**, never keys.
   - runs `streamText({ model, output: Output.object({ schema: <small zod> }), prompt })`, iterates `partialOutputStream`, logs each snapshot + timestamp, then `await result.output`.
   - reports: **number of partial snapshots and over what duration** → incremental (many over seconds = ✅) vs buffered (one chunk at the end = ✗).
   - Run with `node --env-file=.env.local --import tsx /tmp/b2-probe.ts` (or your tsx equivalent) from the worktree.
   - **Corroborate in the browser:** watch one live section and confirm the server actually emits partials over time.
   - **If buffered (✗):** STOP and report. Token-streaming isn't available on this provider without `simulateStreamingMiddleware()` (no real win) or a provider change — escalate to the user before building the UI. Do not fake it.

**1. Server — produce output via the structured streaming path.** Route the 6 `answerToolSectionIds` through `streamText` + `Output.object` (reuse `streamStructuredResult`/`defaultStructuredStreamer`, `section-agent.ts:1189-1365`). **Keep the research tools** (search / ad-library / keyword) available in the same call — `Output.object` coexists with tools. Use `stopWhen: stepCountIs(N)`; pass `abortSignal`. Read partials from `partialOutputStream`; get the final via `await result.output`.

**2. Gate — unchanged semantics, new input surface.** Run `structuralVerifier` + `validateMinimums` + `checkRequiredEvidenceClasses` + VoC self-source + DemandIntent keyword provenance + `evaluateEvidenceSupport` on **`(await result.output).body`** (the validated final), exactly as `buildAnswerToolAttempt` does (`run-section.ts:2940-3026`). Keep `deriveGroundedConfidence`, the `answerToolMaxRepairAttempts = 2` repair loop, `getBestCommittableAttempt`, and the `LAB_VERIFIER_MAX_UNSUPPORTED` ceiling. **Never gate on partials.** Commit (saveArtifact + `artifact-saved` + `sub-section-committed` + `section-completed`) only after the gate passes.

**3. Partial transport — throttled broadcast.** Throttle to **one snapshot / ~500-750ms** (or per top-level sub-section boundary). Send the current best-effort-parsed snapshot (not raw deltas) via **Supabase Realtime broadcast** on a per-run channel (e.g. `section-partials:<runId>`). Do **not** INSERT per-partial rows into `research_section_events` (write-amplification; the allowlist's `JSON_HINT` would mangle them). Stay well under 256KB (a section body is typically <50KB). If server-side broadcast via supabase-js is awkward from the in-process function, use Supabase's REST broadcast endpoint (`POST …/realtime/v1/api/broadcast`) with the service-role key — confirm the working mechanism during the probe.

**4. Reader — drafting view, committed path untouched.** Add a client subscription to the broadcast channel (net-new — there are zero subscriptions today). In `audit-reader-shell.tsx`, add a branch in the `activeStatus === 'running'` region (~:1543): when a partial snapshot exists for the active zone, render it through **`GenericTypedArtifactRenderer`** wrapped in a "Drafting…" affordance, in place of / above `LiveActivity`. Synthesize placeholder envelope fields (don't reuse `pickPositioningTypedArtifact`). **Never** write into `sectionsByZone`/`typedByZone`, **never** use the typed `TypedArtifactRenderer` dispatch for partials. On commit (poll flips `status → complete`), the committed typed card replaces the drafting view; clear the partial snapshot. **Add an error boundary** around the committed-card branch too (the typed renderers crash on any malformed body, not just partials).

**5. Abort + completion.** `result.consumeStream()` **without await** so the gate + commit finish on disconnect. Handle `onAbort` to clear partials. Keep the 2.5s poll as the source of truth for terminal/committed state; broadcast is overlay-only and the poll reconciles if the channel drops.

**NON-GOALS:** Don't change the committed typed renderers' output. Don't remove the poll. Don't persist partials to the DB. Don't weaken the gate. Don't revive the dead `streamSectionViaAnswerTool` wholesale (it accumulates only `textStream`, which is empty for structured output) — use the `Output.object`/`partialOutputStream` machinery.

**VERIFY:**
- Probe shows incremental partials on the live provider.
- Unit: gate runs on `result.output` (not partials); repair loop fires on evidence shortfall; throttle coalesces; reader drafting branch renders the generic renderer on a partial and **never** writes `sectionsByZone`; committed path unchanged. `npm run test:run`, tsc 0, lint 0.
- **Browser (cheap, single section):** run a flow on `/research-v2`, watch ONE section — the drafting view fills progressively, then the committed typed card replaces it; no white-screen on partial JSON.
- Full end-to-end proof → **T6**.

**RISKS:** provider may not stream structured output (probe gates this); broadcast auth/mechanism from serverless (verify in probe); repair loop can replace the artifact mid-stream → the UI must **reconcile/replace**, not append.

---

### T4 — B4 secondary: ad probe off critical path + parallelize advertiser matching

> **Sequencing:** same file as T3 (`run-section.ts`). Land T4 **before** T3, or coordinate the merge. B4 *primary* (the repair storm) already shipped in `b05e406b`; this is the remaining ~20s of latency.

**GOAL:** Shave CompetitorLandscape latency: the ad-evidence pre-pass blocks the model start, and advertiser matching is serial.

**FILES:** `src/lib/lab-engine/agents/run-section.ts` — `buildAnswerToolAdEvidence` (def ~:2831, called on the critical path at ~:3114), advertiser loop ~:2476 (`for (const [index, advertiserRecord] of advertisers.entries())`, serial), stale comment ~:3100.

**STEPS:**
1. **Parallelize** the advertiser `for…of` loop (:2476) → `Promise.all` with **bounded concurrency**; respect the lookup budget (`adReservedLookups`/`maxExternalLookups`) — don't blow it.
2. **Investigate** whether `buildAnswerToolAdEvidence` (:3114) can overlap other prep instead of blocking. It feeds `prepassGroups` into the model prompt (~:3152, ~:3250), so it can't be deferred *past* the model call — overlap it with other independent prep. If it genuinely can't move without starving the prompt, **document why and skip** rather than forcing it.
3. Fix the stale comment (~:3100).

**NON-GOALS:** Don't change ad-probe results or budget semantics (that's T5/B3). Don't loop paid APIs.

**VERIFY:** unit (parallel loop returns the same set as serial, within budget) · tsc/lint/tests · **Browser (T6):** CompetitorLandscape completes faster; repair count low (check `research_section_runs.telemetry`).

---

### T5 — B3 secondary: budget verify (+ optional LinkedIn/Foreplay ad port) [conditional on T6]

**GOAL:** Confirm the B3 primary (advertiser-name normalization, `b05e406b`) actually makes ad creatives render on a live run; rebalance budget only if still starved; optionally widen ad sources.

**GROUND TRUTH:** B3 primary shipped. Lab ad path is **Google + Meta only**; the full engine (LinkedIn + Meta + Google + Foreplay, ~1429 lines) is orphaned in `research-worker/src/tools/adlibrary.ts`.

**STEPS:**
1. **After T6's live run**, check whether CompetitorLandscape rendered real ad creatives (browser + `research_artifact_sections` adEvidence groups via MCP).
   - Rendered → close B3, document only.
   - Still 0 ads → diagnose: budget exhaustion (rebalance `maxExternalLookups`/`adReservedLookups`) vs advertiser still unmatched (improve normalization) vs SEARCHAPI yield.
2. **OPTIONAL, user-gated:** port LinkedIn + Foreplay adapters from the orphaned worker engine into the lab path. **Must rewrite** `competitor-ad-adapter.test.ts` + `adlibrary.test.ts`. Mind the lookup budget. Larger lift — **confirm with the user before starting.**

**NON-GOALS:** No paid-API loops without an abort condition.

**VERIFY:** Browser live run shows ad creatives in CompetitorLandscape; DB confirms non-empty adEvidence.

---

### T6 — Gates + live re-run sign-off (browser-driven, ~$2) [proves T1–T5]

**GOAL:** ONE consolidated live audit that behaviorally proves T1–T5 plus the already-shipped `b05e406b`/`5032eb7f`.

**STEPS:**
1. All prior tasks merged; gates green: `npm run build`, `npm run test:run`, `npm run lint`, `npx tsc --noEmit` (frontend baseline); `cd research-worker && npm run build` (worker baseline captured first).
2. `npm run dev`; log in via the connected browser (Clerk, `ammarv67@gmail.com`, **ask the user for the code**).
3. Run **ONE** real audit (e.g. `ramp.com` or `notion.so`) end-to-end. **~$2 — one run only, no loop.** Don't edit source while it runs.
4. Observe + screenshot:
   - **T1:** every running zone's feed shows live activity; none silent.
   - **T3:** sections stream a drafting view that fills in, then the committed typed card replaces it; no white-screen.
   - **B3/T5:** CompetitorLandscape renders real ad creatives.
   - **B4/T4:** CompetitorLandscape latency down, repair count low.
   - **T2:** no section reads Needs review/failed while complete.
5. Cross-check `research_section_runs` (status/telemetry/timings) + `research_artifact_sections` via Supabase MCP.
6. **Report:** pass/fail per item with screenshots + DB evidence.

**NON-GOALS:** Don't push or deploy (user-gated). Don't run multiple $2 audits.

---

## 4. Appendix

### Commands
```bash
# frontend (worktree root)
npm run dev            # localhost:3000  (lab engine runs in-process here)
npm run build
npm run test:run
npm run test:run -- src/app/api/research-v2/audit-state/__tests__/route.test.ts
npm run lint
npx tsc --noEmit

# worker (only if touched — capture baseline first)
cd research-worker && npm run build
```

### Env flags relevant here
- `LAB_ENGINE_PROVIDER` — unset → Anthropic `claude-sonnet-4-5`; `deepseek-direct`/`deepseek-ollama` → `deepseek-v4-flash`.
- `LAB_VERIFIER_MAX_UNSUPPORTED` — gate hard-fail ceiling; default `Infinity` (advisory/non-terminal). Leave as-is unless asked.

### Symbol index (re-grep before trusting line numbers)
| Symbol | File |
|---|---|
| `runSection`, `runSectionViaAnswerTool`, `buildAnswerToolAttempt`, `answerToolSectionIds` | `src/lib/lab-engine/agents/run-section.ts` |
| `buildAnswerToolAdEvidence`, advertiser loop, `streamStructured`/`consumePartialsUntilAbort`/`writeArtifactPartial` | `src/lib/lab-engine/agents/run-section.ts` |
| `defaultAnswerToolRunner`, `streamStructuredResult`, `defaultStructuredStreamer`, `Output.object` | `src/lib/lab-engine/agents/section-agent.ts` |
| `createAnswerTool`, `getAnswerInput` | `src/lib/lab-engine/agents/answer-tool.ts` |
| `structuralVerifier` / `extractClaims` / `evaluateEvidenceSupport` | `src/lib/lab-engine/agents/verification/*` |
| `resolveSectionModelProvider`, model ids | `src/lib/lab-engine/ai/models.ts` |
| `deriveSectionPhase`, event query, `buildWorkerStateReadModel` | `src/app/api/research-v2/audit-state/route.ts`, `derive-section-phase.ts` |
| `EVENT_PHASE`, `translateReason`, `JSON_HINT`, `buildSectionActivityFeed` | `src/lib/research-v2/section-activity.ts` |
| `append_section_event` emit | `src/lib/research-v2/supabase-run-store.ts` |
| `TypedArtifactRenderer`, `GenericTypedArtifactRenderer` | `src/components/research-v2/typed-artifact-renderer.tsx` |
| reader status ternary / `LiveActivity` / `sectionsByZone` | `src/components/research-v2/audit-reader-shell.tsx` |
| poll loop | `src/lib/research-v2/use-audit-state.ts` |

### Done = 
All tasks committed atomically on `feat/v2-lab-section-wire` (not pushed), all gates green, T6 live run reported pass/fail per item with evidence. Push + deploy + the index-migration apply are user-gated — stop and ask.
