# GLM Live Wire-Up — Execution Progress Log

> Companion to `docs/plans/2026-06-24-glm-live-wireup-execution-plan.md`.
> One section per phase. Each records: what changed (file:line), tests added, tsc count vs baseline, test pass/fail, BLOCKED reasons.
> Working tree only — NO commits (owner reviews ONE diff at the end).

---

## Baseline (2026-06-24 16:55 PKT)

Captured on branch `refactor/architecture-deepening` with the existing uncommitted working-tree changes in place. This is the regression baseline all later phases compare against.

### tsc

- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **0 errors**.
- Offending-file families: **none surface in the current working tree.** CLAUDE.md / learned-patterns note that the openrouter tests + chat-blueprint tests carry known pre-existing TS errors, but `tsc --noEmit` reports zero against this working tree right now (those files are evidently excluded from the tsc project scope, or their errors are not currently present). 
- **Gate for later phases:** NO NEW errors beyond this baseline of **0**. Any `error TS` introduced is a regression and must be fixed before the phase closes. If pre-existing openrouter/chat-blueprint errors reappear (e.g. after a config touch), treat the families named in CLAUDE.md as the allowed baseline, not new regressions.

### Tests — P1/P2 verifier suite scope

Command: `npm run test:run -- src/lib/lab-engine/evidence src/lib/research-v2 src/app/api/research-v2/orchestrate`

- **39 test files passed / 39.**
- **291 tests passed / 291. 0 failed.**
- Duration ~3.4s.
- This is the exact suite scope the P1 (ledger-readable) and P2 (flip-one-section + telemetry) verifiers reuse. Includes `src/lib/lab-engine/evidence/__tests__/research-fact-store.test.ts` (2 tests) — the file P1 Cluster A extends with the cross-instance SELECT test — and `lab-section-dispatch.test.ts`, `lab-section-job.test.ts`, `orchestrate-db.test.ts` which the P1 Cluster B concurrency rewire must keep green.

### Notes for downstream phases

- The plan's `research-fact.test.ts` path reference resolves to `src/lib/lab-engine/evidence/__tests__/research-fact-store.test.ts` in this tree (2 tests). Re-grep exact line anchors before editing — `run-section.ts` is ~15.7k lines with uncommitted changes, so plan line numbers (`:286-294`, `:333`, `:444/470/690`, `:13016/...`, etc.) may have drifted.

---

## P1 — Ledger readable + honest concurrency telemetry (2026-06-24 17:06 PKT)

Status: **DONE** (tsc 0 = baseline; all targeted suites green). NO commits.

### What changed (file:line)

**Cluster A — shared research_facts ledger READABLE (getFacts union SELECT + factStore threading):**
- `src/lib/lab-engine/evidence/research-fact.ts`
  - `ResearchFactStore.getFacts` (~:61): flipped to `() => Promise<ResearchFact[]>` (was sync `ResearchFact[]`). Updated `createInMemoryResearchFactStore` (~:67) + `createNoopResearchFactStore` (~:80) to `async`.
  - `readResearchFactsFromStore` (~:86): now `async` + `await store.getFacts()` before `safeParse`.
  - New `ResearchFactsSelectResult` / `ResearchFactsSelectBuilder` + extended `ResearchFactsTableBuilder` (insert **and** `select(cols).eq(col,val)`) so the client interface has SELECT capability (mirrors `evidence-pool.ts:519-522`). Removed dead `ResearchFactsInsertBuilder` alias (no external importer).
  - `fromResearchFactRow` (new): snake→camel row mapper, inverse of `toResearchFactRow`; NULL `parent_audit_run_id` omitted; invalid rows dropped (return null) so one bad row never poisons the SELECT.
  - `researchFactDedupKey` (new): content key (no `id` field on `ResearchFact` — DB `id` is not round-tripped; **deviation from prompt's "dedup by fact id"**, stated loudly).
  - `createResearchArtifactsResearchFactStore(client, parentAuditRunId?)` (~:333): 2nd arg added. `getFacts` now returns the **UNION (deduped)** of (a) in-process `appended` AND (b) a real `select('*').eq('parent_audit_run_id', parentAuditRunId)`. When no `parentAuditRunId` → echo-only (no SELECT). Did NOT replace echo with select-only.
- `src/lib/lab-engine/agents/run-section.ts`
  - `buildPreparedSectionContext` (~:683) → `async`, `await readResearchFactsFromStore(factStore)`.
  - `getPreparedSectionContext` (~:731) → `async`.
  - 4 call sites (runAgenticGLMSection ~:13030, runSectionViaAnswerTool ~:13569, runSectionViaStructuredBodyStream ~:14371, runSection ~:15243): `const preparedContext = await getPreparedSectionContext({...})`.
- **KEYSTONE** `src/lib/research-v2/lab-section-dispatch.ts:133-149` — factStore now constructed with `seeded.parent_audit_run_id` (2-arg); `prepareSectionContext(..., { store })` → `{ store, factStore, parentAuditRunId: seeded.parent_audit_run_id }`. This single seam is why the ledger was write-only in practice (preparedContext won via `??` short-circuit so the job's factStore was dead).
- **Defense-in-depth** `src/lib/research-v2/lab-section-job.ts:64-83` — the in-job fallback `prepareSectionContext(..., { store })` now also threads `factStore`+`parentAuditRunId` when present.

**Cluster B — honest concurrency telemetry (pilot-pragmatic, NO lease/p-limit):**
- `src/app/api/research-v2/orchestrate/route.ts:107-148` — rewrote the misleading "Bounded section pool … prevents provider rate-limit starvation + token explosion" comment to state the REALITY: `dispatchBounded` bounds only HTTP kickoffs (each `/run-lab-section` POST schedules work in `after()` and returns 202 immediately), NOT the GLM tool-loops — all 6 sections run concurrently across 6 lambdas regardless of the number. Added a `console.info('[orchestrate:lab] fanning out sections', { kickoffConcurrency, note: '...GLM section loops run unbounded across separate lambdas (no real pool)' })` log. No lease/p-limit added (pilot decision). `run-lab-section/route.ts` had no pool-fiction comment to fix (its "fan-out wave"/"fan-out-contention" language is accurate and left untouched).

### Tests added (failing-first, then green)
- `src/lib/lab-engine/evidence/__tests__/research-fact-store.test.ts`: +3 tests — (a) getFacts SELECTs by `parent_audit_run_id` and returns a SIBLING-written fact (cross-instance, the case the echo array structurally cannot cover); (b) getFacts returns the UNION of appended + DB-selected, deduped; (c) no parentAuditRunId → no SELECT, echo-only. Extended the fake client with a `.select().eq()` builder + a backing in-memory rows table.
- `src/lib/research-v2/__tests__/lab-section-dispatch.test.ts`: +1 test (R1 keystone) — a `research_facts` SELECT returning a sibling fact under the parent surfaces into `preparedContext.factRows`. Added `supabaseClientWithFacts()` helper; pointed the base `supabaseClient()` at it (empty rows) so the now-real SELECT during dispatch doesn't blow up the bare `{ rpc }` mock.
- Async-ripple updates (not new behavior): `research-fact.test.ts` (4 assertions → await/async + `.rejects.toThrow`), `run-section-research-facts-ledger.test.ts` + `...-streaming.test.ts` (`(await factStore.getFacts()).filter(...)`).

### tsc vs baseline
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **0** (baseline 0; NO new errors).

### Test pass/fail
- `research-fact-store.test.ts` (5), `research-fact.test.ts`, `lab-section-dispatch.test.ts` (9), `run-section-research-facts-ledger{,-streaming}.test.ts`, `run-lab-section/route.test.ts` (16), `orchestrate/route.test.ts`, `run-section-corpus-only.test.ts` (28), `prepared-section-context.test.ts`, `resume-and-partial.test.ts` — **ALL GREEN** (consolidated runs: 60/60 and 55/55, 0 failed).

### Deferred / findings for later phases
- **Section→section LIVE sharing is OUT of scope (deferred, as instructed):** `prepareSectionContext` runs ONCE at dispatch time, before sibling sections write. The SELECT captures orchestrator facts (written earlier, in P4) but MISSES facts a sibling section writes after this section's dispatch. Orchestrator→section visibility (the pilot goal) works; section→section does not. To get section→section, the SELECT must move INSIDE the section job just before drafting (not done here).
- **FINDING for P4 (orchestrator wiring), NOT fixed here:** orchestrator-written facts carry `sectionId="orchestrator"`, but the downstream read filter `factMatchesPreparedSection` (`run-section.ts:613`) returns `false` for non-supported section ids — so an `"orchestrator"` fact is dropped from `preparedContext.factRows` even though the SELECT now returns it. P1's job (readable ledger plumbing) is complete; whoever wires the orchestrator in P4 must relax `factMatchesPreparedSection` to admit `"orchestrator"` facts (or promote them under a real section id) or the seeded facts still won't reach sections. The keystone test proves the plumbing with a `positioningBuyerICP` fact (sibling-section case) end-to-end.

---

## P1 VERDICT — Adversarial Verify (2026-06-24 17:10 PKT)

Status: **PASS**. Independent re-read (via cat, hook-safe) + tried-to-break pass over criteria (a)-(e). NO commit; HEAD still `7afc84fc`; nothing staged.

- **(a) Ledger READABLE — PASS.** `createResearchArtifactsResearchFactStore.getFacts` (`research-fact.ts:397-428`) issues a REAL `client.from("research_facts").select("*").eq("parent_audit_run_id", parentAuditRunId)`. Table + column names match the migration `supabase/migrations/20260618_research_facts_ledger.sql` (`research_facts`, `parent_audit_run_id` text, indexed). Returns the **deduped UNION** of (a) in-process `appended` and (b) DB SELECT — NOT select-only. The in-process echo is seeded into the dedup map FIRST (`:399-401`), so it is never dropped. Cross-instance read proven by test `getFacts SELECTs ... returns a SIBLING-written fact (cross-instance)`: a reader store with an EMPTY appended array still surfaces a sibling-written fact via the SELECT (the case the echo array structurally cannot cover). Union+dedup proven by the `UNION ... deduped` test (own fact present in BOTH appended array and SELECT collapses to exactly one). Echo-only fallback when no parentAuditRunId proven by the third test (0 SELECTs captured). Dedup key is content-based (`researchFactDedupKey`, no `id` round-trip) — stated as a loud deviation in the P1 log; acceptable (DB `id` is not on the `ResearchFact` type).
- **(b) factStore threaded into prepareSectionContext AND read path — PASS.** `lab-section-dispatch.ts:144-149` constructs `factStore` with `seeded.parent_audit_run_id` (`:133-137`) and passes `{ store, factStore, parentAuditRunId: seeded.parent_audit_run_id }` into `prepareSectionContext`. (Plan cited `:138`; actual seam drifted to `:144-149` — confirmed by re-grep, expected.) `prepareSectionContext` (`run-section.ts:763-789`) -> `buildPreparedSectionContext` -> `readResearchFactsFromStore(factStore)` + `buildPreparedFactRows` filtered by `factMatchesPreparedRun` + `factMatchesPreparedSection`. `PrepareSectionContextDeps` (`:442-445`) types both fields, so the dispatch call is type-clean. Keystone test (`...R1 keystone`) injects a sibling `research_facts` row under the same `PARENT_ID` with `section_id='positioningBuyerICP'` (a SUPPORTED id, so it passes `factMatchesPreparedSection`) and asserts it reaches `preparedContext.factRows` through the REAL `scheduleLabSectionJob` path. Defense-in-depth in `lab-section-job.ts:66-104` confirmed real (conditional threading of factStore+parentAuditRunId into the in-job fallback).
- **(c) tsc — PASS.** `npx tsc --noEmit 2>&1 | grep -c "error TS"` -> **0** (baseline 0, NO new errors).
- **(d) targeted suite — PASS.** `npm run test:run -- src/lib/lab-engine/evidence src/lib/research-v2 src/app/api/research-v2/orchestrate` -> **39 files / 295 tests passed, 0 failed** (+4 new vs the 291 baseline: 3 in research-fact-store + 1 keystone in lab-section-dispatch).
- **(e) NO lease/p-limit; honest concurrency; no commit; minimal diff — PASS.** Diff grep for `p-limit|pLimit|acquireLease|DB-lease|semaphore` additions returns ONLY the explanatory comment disclaiming them — no new pool primitive. `orchestrate/route.ts:107-148` comment + the new `console.info('[orchestrate:lab] fanning out sections', { ..., note: 'kickoffConcurrency bounds HTTP kickoffs only; GLM section loops run unbounded across separate lambdas (no real pool)' })` now tell the truth. (Note: `parseConcurrencyLimit` still reads env `LAB_SECTION_POOL_CONCURRENCY` and the pre-existing `dispatchBounded` worker-pool over HTTP kickoffs is unchanged — that is the kickoff bound, NOT a GLM-loop pool, and the comment now says so.) `git log` HEAD = `7afc84fc` unchanged; `git diff --cached` empty; NO commit made.

**Out-of-scope note carried forward (not a P1 failure):** section->section LIVE sharing is deferred (SELECT runs once at dispatch, before sibling sections write); and an `"orchestrator"`-section_id fact would still be dropped by `factMatchesPreparedSection` — P4 (orchestrator wiring) must relax that filter or promote orchestrator facts under a real section id. Both already recorded in the P1 "Deferred / findings" block.

---

## P2 — Flip Market agentic on live path + quote-at-URL bugfix + loud fallback telemetry (2026-06-24 17:22 PKT)

Status: **DONE**. tsc 0 (baseline 0, no new). All targeted suites green. NO commit (working tree only).

### What changed (file:line)
- **Tool-sourcing / agentic flip (NO code change needed):** re-grep proved the live path is ALREADY correct. `run-section.ts:13077` `agenticAllowedTools = deps.allowedTools ?? definition.allowedTools` → `buildAgenticTools` (`agentic-glm-runner.ts:101`). On the live path `lab-section-job.ts:155-156` `getLabEngineAllowedTools()` returns `undefined` (when `LAB_ENGINE_LIVE_TOOLS !== 'false'`), so `agenticAllowedTools` falls to `definition.allowedTools` (Market = `["web_search","firecrawl","keyword_volume","perplexity_research"]`). Market is in BOTH `answerToolSectionIds` (`run-section.ts:6048`) and `PROJECTABLE_SECTION_IDS` (`:12774`), short id `"market"` (`:12755`), so the dispatch gate (`:15231` `shouldUseAgenticGLM(input.sectionId, deps.env ?? process.env)`) routes Market to `runAgenticGLMSection` and the GLM model is reached via `generateAgenticGLMSection → getAgenticGLMModel(env)` (`agentic-glm-runner.ts:226`, `models.ts:617`). The flag is read from `process.env` on the live path — env-only flip, no source edit. The empty-tools bypass only fires when `buildAgenticTools` returns `{}` (kill-switch or missing credential); it already emits `agentic-fallback`.
- **Loud telemetry (`run-section.ts`):** added `appendEvent({type:"agentic-fallback"})` at the 3 previously console.warn-ONLY fallback exits inside `runAgenticGLMSection` — non-projectable (`~:13016`, reason `non_projectable_section`), generation-failure (`~:13247`, reason `generation_failed`), no-committable-artifact (`~:13457`, reason `no_committable_artifact`), each mirroring the existing empty-tools block. Added a positive machine-greppable `console.info("[lab-section] agentic_glm_section_start", {sectionId, runId})` right after `section-started`/before `markSectionRunning`. (The honest-gap build-failure helper `tryBuildAgenticHonestArtifact` is synchronous and returns `undefined` into the no-committable exit, which now emits — so it's covered without an async ripple.)
- **`activity-event.ts:231-238`:** extended the `agentic-fallback` `reason` enum with `non_projectable_section`, `generation_failed`, `no_committable_artifact` (was `no_tools`/`live_tools_disabled`/`missing_credential`/`agentic_error`).
- **Quote-at-URL per-record bugfix (`provenance-detect.ts`):** Check 2 grounds a quote against the WHOLE transcript blob, so a real quote retrieved from URL-A but attributed in the body to a DIFFERENT fetched URL-B passes invisibly (the laundering hole on the agentic path). Added `import { isQuoteContainedInLiveText } from "./source-liveness"` (reuses commit `7afc84fc`'s containment primitive — extends it, no dup). New helpers `buildPerUrlText(records): Map<normUrl,normText>` (each record's full serialized text bound to every URL it mentions — conservative), `lookupPerUrlText` (sub-path/query drift tolerant, same policy as `urlGrounded`), `extractAttributedQuotePairs(body)` (quotes whose line carries a cited URL). New **Check 2b** inside `detectProvenanceViolations`: for each `{quote, attributedUrl}`, if the attributed URL WAS fetched (has per-URL text) AND `!isQuoteContainedInLiveText(urlText, quote)` → `quote_not_in_transcript` (laundered). Carve-out preserved: an attributed URL never fetched abstains (left to Check 1 / network-unavailable). De-duped against Check 2's `ungroundedQuotes` so no double-count.

### Tests added (TDD red→green)
- `provenance-detect.test.ts` — new `describe("Check 2b — quote-at-URL laundering")` with 3 cases: (1) **RED first** then green — real quote attributed to the WRONG fetched URL is flagged `quote_not_in_transcript`; (2) same-URL whose page contains it clears; (3) unfetched attributed URL abstains (carve-out). 45 tests total in file.
- `run-section-agentic-unbypass.test.ts` — added a `buildAgenticTools` call recorder; new test "Market: flag ON + live tools on resolves a NON-EMPTY tool set and reaches the agentic GLM path (no answer-tool fallback)" (asserts generation runner reached, `runAnswerTool` NOT called, no `agentic-fallback`, Market `allowedOverride.length>0`); new test "emits agentic-fallback reason=generation_failed when the agentic generation throws" (**RED first** — was console.warn-only). 5 tests total in file.

### tsc vs baseline
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **0** (baseline 0; NO new errors).

### Test pass/fail
- `provenance-detect.test.ts` (45), `run-section-agentic-unbypass.test.ts` (5), `activity-event.test.ts` (3) — **53/53 green**.
- Regression sweeps: `src/lib/lab-engine/agents/verification` + `events` → **307/307 green**; `src/lib/lab-engine/agents` → **1083 passed / 1 skipped** (the live ollama-corpus test, correctly skipped — no live calls).

### Deferred (out of scope for P2, per task)
- "Section actually calls live GLM" end-to-end proof → E2E phase (P9). No live paid/GLM calls in this workflow.
- Deterministic competitor ad-prepass on the agentic path (P7) — untouched.

---

## P2 VERDICT — Adversarial Verify (2026-06-24 17:26 PKT)

Status: **PASS**. Independent re-read (all anchors via `sed`/`grep`, hook-safe), tried-to-break pass over (a)-(e). NO commit; HEAD still `7afc84fc`; `git diff --cached` empty. Plan line anchors had drifted (~15.7k-line file) — re-grepped every anchor before judging.

- **(a) Market flag ON → NON-EMPTY tool set + GLM model, NOT DeepSeek — PASS.** Traced the live decision branch end-to-end:
  - `positioningMarketCategory` ∈ `answerToolSectionIds` (`run-section.ts:6048`) → reaches the agentic branch in `runSection` (`:15285-15287`: `if (answerToolSectionIds.has(...)) { if (shouldUseAgenticGLM(input.sectionId, deps.env ?? process.env)) return runAgenticGLMSection(...) }`).
  - `shouldUseAgenticGLM` (`:6086-6098`) reads `env["LAB_AGENTIC_GLM_SECTIONS"]`, comma-splits, matches the exact sectionId → true when Market is listed.
  - Market ∈ `PROJECTABLE_SECTION_IDS` (`:12768-12775`) → `isProjectableSectionId` true → no `non_projectable_section` fallback.
  - Live path: `lab-section-job.ts:155-156` `getLabEngineAllowedTools()` returns `undefined` when `LAB_ENGINE_LIVE_TOOLS !== 'false'`, so `deps.allowedTools` is undefined → `agenticAllowedTools = deps.allowedTools ?? definition.allowedTools` (`run-section.ts:13100`) resolves to Market's `definition.allowedTools = ["web_search","firecrawl","keyword_volume","perplexity_research"]` (`section-registry.ts:159`).
  - `buildAgenticTools(sectionId, env, agenticAllowedTools)` (`agentic-glm-runner.ts:101-124`) credential-filters that list; at least `web_search` (Brave) survives → `externalToolNames.length > 0` → NO empty-tools fallback.
  - Model: `runAgenticGLMSection` → `generateOnce` → `generateAgenticGLMSection({tools, model: getAgenticGLMModel(env)})` (`agentic-glm-runner.ts:218-233`, `model` at `:226`). NOT DeepSeek; DeepSeek (`runSectionViaAnswerTool`) is only reached on the 4 explicit fallback exits.
  - Pinned by unit test `run-section-agentic-unbypass.test.ts` "Market: flag ON + live tools on resolves a NON-EMPTY tool set and reaches the agentic GLM path (no answer-tool fallback)" (asserts generation runner reached, `runAnswerTool` NOT called, no `agentic-fallback`, Market `allowedOverride.length>0`) — GREEN.
- **(b) `agentic-fallback` fires on ANY fallback-to-DeepSeek — PASS.** Enumerated every exit of `runAgenticGLMSection` (function body `:13006-13533`): exactly 4 `return runSectionViaAnswerTool(input, deps)` (`:13034`, `:13133`, `:13290`, `:13516`), each immediately preceded (9 lines prior) by an `appendEvent(... type:"agentic-fallback")` with a distinct `reason` (`non_projectable_section`, `live_tools_disabled`/`missing_credential`, `generation_failed`, `no_committable_artifact`). The other 3 returns are `saveCompletedArtifact` (`:13462`, `:13483`, `:13526`) — those COMMIT the GLM artifact (success), not fallbacks. No silent `return runSectionViaAnswerTool` exists. The `generation_failed` event was console.warn-ONLY before P2 — proven newly-firing by the RED-first test "emits agentic-fallback reason=generation_failed when the agentic generation throws" (GREEN). The `activity-event.ts:231-238` reason enum was extended with the 3 new reasons (so the events typecheck; tsc clean).
- **(c) quote-at-URL is PER-RECORD against the attributed URL's text, reuses `isQuoteContainedInLiveText` — PASS.** New Check 2b in `provenance-detect.ts:1221-1247`: `buildPerUrlText(records)` (`:1103`) binds each non-error record's full serialized text to every URL it mentions → `Map<normUrl,text>`; for each `{quote,url}` from `extractAttributedQuotePairs(body)` (`:1145`), `lookupPerUrlText(perUrlText, url)` (`:1124`) fetches ONLY the attributed URL's text (sub-path/query drift tolerant), then `if (!isQuoteContainedInLiveText(urlText, quote))` (`:1232`, imported from `./source-liveness:26` — commit `7afc84fc`'s primitive, no dup) → flags `quote_not_in_transcript` (laundered). Carve-out: `urlText === null` (attributed URL never fetched) → `continue` (left to Check 1). De-duped: `if (ungroundedQuotes.includes(quote)) continue` skips only quotes Check 2 already flagged — it does NOT skip blob-grounded quotes, so a laundered-onto-wrong-URL quote (blob-present, Check-2-clean) still reaches Check 2b. Proven by RED-first test "flags a real quote attributed to the WRONG fetched URL (blob has it, attributed page does not)" — quote carried by capterra (URL-A) but body-attributed to g2 (URL-B, page lacks it) → flagged. Companion tests: same-URL-contains-it clears; unfetched-URL abstains. All 3 GREEN.
- **(d) `agentic-glm-projector.ts` NOT deleted — PASS.** File present (38046 bytes, mtime Jun 23), `git status`/`git diff --name-status HEAD` show NO change/delete. Still imported and load-bearing: `run-section.ts:142 } from "./agentic-glm-projector";`.
- **(e) tsc no new errors + suite green + no commit + minimal diff — PASS.** `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **0** (baseline 0). Targeted: `provenance-detect.test.ts` (45) + `run-section-agentic-unbypass.test.ts` (5) + `activity-event.test.ts` (3) → **53/53 GREEN**. Regression sweep `verification`+`events` → **307/307 GREEN**. HEAD `7afc84fc` unchanged, nothing staged. P2-attributable diff is surgical: `run-section.ts` adds only 3 `agentic-fallback` events + 1 `agentic_glm_section_start` log (the +302 line count is dominated by P1's async-ripple already recorded, NOT P2 scope creep — confirmed by grepping the P2-added lines); `provenance-detect.ts` +107 (Check 2b + 3 helpers, reuses existing primitive); `activity-event.ts` +3 (enum); 2 test files. No `p-limit`/lease/pool primitive added (cross-checked).

**Note (not a P2 failure):** the working tree carries many unrelated prior-phase files (schemas, session-state, state-machine, commit-patch, corpus-to-research-input, etc.) — expected; the owner reviews ONE accumulated diff at the end. P2's own edits are scoped to the 5 files above.

**VERDICT: P2 PASS — no blocking issues.** The agentic flip is env-only (no source edit needed; the live path was already correct after the keystone wiring), fallback telemetry is loud on all 4 exits, and the quote-at-URL laundering hole is closed per-record.

---

## P3 — Drop the deck OUTPUT cage on the composer (tolerant decoder) (2026-06-24 17:38 PKT)

Status: **DONE**. tsc 0 (baseline 0, no new). All targeted suites green. NO commit (working tree only; composer-glm.ts + its test are UNTRACKED prior-phase files — edits live in the working tree the owner reviews).

### What changed (file:line)
- `src/lib/lab-engine/agents/composer-glm.ts`
  - Imports (~:30): dropped `paidMediaPlanBodySchema` (no longer safeParse'd here), added `normalizePaidMediaPlanBody` + `type NormalizePaidMediaPlanBodyOptions` from `../artifacts/schemas/paid-media-plan` (REUSE the proven section-path decoder — not reimplemented).
  - `ComposePaidMediaPlanArgs` (~:54): added optional `normalizeOptions?: NormalizePaidMediaPlanBodyOptions` so P5's compose-route can thread structured onboarding economics (targetCac / cvrChain / creativeCapacity / channelHint) the way `withNormalizedPaidMediaPlanOutput` (run-section.ts:8104) does. Absent it, the decoder still produces a valid deck (no economics bridge).
  - `ComposePaidMediaPlanResult` (~:75): `deck` tightened `PaidMediaPlanBody | null` → **`PaidMediaPlanBody`** (never content-losing null); added `deckSource: "decoded" | "honest_gap"` (new exported type `ComposerDeckSource`) so a parse-miss is VISIBLE, not silent.
  - `composePaidMediaPlan` (~:130): replaced `parsePaidMediaPlanFromText(result.text)` with `decodePaidMediaPlanFromText(result.text, args.normalizeOptions)`; `deckMarkdown = stripPaidMediaPlanFence(result.text)` preserved verbatim (incl. any `[grounded]/[inferred]/[gap]` markers) regardless of decode outcome; returns `deckSource`.
  - **NEW `extractPaidMediaPlanJson` (~:146):** the fence-pull half of the old parser (```paid-media-plan, fallback ```json), returns raw JSON string or null.
  - **NEW `decodePaidMediaPlanFromText` (~:160) — the tolerant decoder:** extract fenced JSON → `JSON.parse` → `try normalizePaidMediaPlanBody(parsed, options)` (snaps `{audiences:[...]}`/`{angles:[...]}`/`{insights:[...]}` wrappers, synthesizes honest gap rows for undershot floors, clamps overshoots, adds the brief as a 2nd leg to a 1-leg crossSectionInsight) → `{deck, deckSource:"decoded"}`. On ANY miss (no fence / unparseable JSON / normalize throws on an unsatisfiable hard floor) → `{deck: buildHonestGapDeckBody(options), deckSource:"honest_gap"}` — **never null**.
  - **`parsePaidMediaPlanFromText` (~:200) — back-compat strict view:** now delegates to the tolerant decoder and returns `deckSource==="decoded" ? deck : null`. **Deviation stated loudly:** unlike the pre-P3 strict parser it now DECODES drift (only returns null when NO usable deck could be produced at all). Kept exported for callers/tests wanting a null-on-miss signal.
  - **NEW `buildHonestGapDeckBody` (~:212):** schema-valid gap shell built THROUGH `normalizePaidMediaPlanBody` (same total decoder) with a seed live-probed to clear every hard floor (campaignPhases / funnelIdeation / channelSuggestions / crossSectionInsight / projectedResults all `.min(1)`). Every load-bearing string prefixed `"Evidence gap:"` so the reader renders amber-probe cards, not confident grounded blocks. The human reviews the preserved `deckMarkdown` alongside.

### Why a tolerant decoder, not the prompt's literal "normalize then safeParse" (deviation, stated loudly)
`normalizePaidMediaPlanBody` ALREADY calls `paidMediaPlanBodySchema.parse(...)` internally and returns a `PaidMediaPlanBody` (or throws) — a separate post-`safeParse` is redundant. Live probe (`scratchpad/probe-*.mjs`) PROVED it is **not total**: it throws on `{}`, on wrapper-only input lacking budgets, and on a complete-looking body with empty `projectedResults` (campaignPhases / projectedResults `.min(1)` are not gap-synthesized for the empty case). So the correct tolerant path wraps `normalizePaidMediaPlanBody` in try/catch (the projector's replacement for this non-projectable section) and falls back to a proven honest-gap seed — exactly what the cheatsheet recommends ("prefer fenced-JSON + a tolerant decoder").

### Projector NOT deleted
`agentic-glm-projector.ts` untouched (load-bearing for the 6 positioning sections on the agentic path; paid-media is non-projectable and flows through `normalizePaidMediaPlanBody` instead). Confirmed no edit/delete.

### Tests added (TDD red→green)
- `src/lib/lab-engine/agents/__tests__/composer-glm.test.ts` — rewrote with a `DRIFTED_DECK_JSON` fixture (wrapper objects, 1-leg cross-section insight, salesProcess empty). New `describe("decodePaidMediaPlanFromText (tolerant decoder)")`: (1) **RED-first** drifted deck decodes (`deckSource==="decoded"`, wrapper keys snapped, cri=3, 1-leg insight survives with 2nd leg added, passes `composerStripFloor`); (2) unparseable JSON → `honest_gap` body (cri=3, angles>=2, kpis>=2, tension text contains "gap") **never null**; (3) no-fence → `honest_gap`; (4) empty `{}` (valid JSON, un-normalizable) → `honest_gap`. Updated the back-compat strict `parsePaidMediaPlanFromText` describe: kept empty/no-fence/bad-JSON null cases, **changed** the old "valid JSON that fails deck schema → null" test to "DECODES drifted JSON the old strict parser nulled (cage removed)" (this is the cage being dropped). Added a `stripPaidMediaPlanFence` test asserting `[grounded]/[inferred]/[gap]` markers survive. `buildValidDeckBody` now `structuredClone`s the fixture (the mutating strip-floor tests previously aliased the shared fixture body).

### tsc vs baseline
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **0** (baseline 0; NO new errors).

### Test pass/fail
- `composer-glm.test.ts` → **19/19 GREEN** (RED-confirmed first: 5 failing pre-impl). Regression with the schema suite `paid-media-plan.test.ts` → **96/96 GREEN**.

### Deferred / findings for later phases
- Threading the ACTUAL onboarding economics into `normalizeOptions` is **P5's** job (the compose-route producer) — P3 only adds the surface (`ComposePaidMediaPlanArgs.normalizeOptions`) and proves it flows to `normalizePaidMediaPlanBody`.
- `composerStripFloor` ADMITS the honest-gap body (cri=3 / angles=2 / kpis=2 are structurally satisfied). That is acceptable per the task — the body content is visibly "Evidence gap:" and the human reviews the deckMarkdown; the strip floor is structural, not a fabrication oracle. P5/anti-fab (P8) may choose to surface `deckSource==="honest_gap"` to the operator UI so a gap shell is never mistaken for a composed deck.
- `decodePaidMediaPlanFromText` has **zero non-test callers today** (composer is unwired) — P5's compose-route is the first live consumer.

---

## P3 VERDICT — Adversarial Verify (2026-06-24 17:43 PKT)

Status: **PASS**. Independent re-read of `composer-glm.ts` via `cat` (hook-safe), tried-to-break pass over criteria (a)-(e) including 2 throwaway adversarial probe suites run inside `src/` then DELETED (vitest only globs `src/**`; scratchpad cleaned). NO commit; HEAD still `7afc84fc`; `git diff --cached` empty.

- **(a) drifted-key deck JSON decodes; snap + `normalizePaidMediaPlanBody` REUSED, not reimplemented — PASS.** `decodePaidMediaPlanFromText` (`composer-glm.ts:197-215`) → `extractPaidMediaPlanJson` (`:171`) pulls the ```paid-media-plan fence (falls back to ```json) → `JSON.parse` → `normalizePaidMediaPlanBody(parsed, options)` (`:208`). No re-implementation: the snap of wrapper/aliased keys (`{audiences:[...]}`/`{angles:[...]}`/`{insights:[...]}`/`{competitors:[...]}`/`{suggestions:[...]}`/`{recommendations:[...]}`) is done by `getNestedArray` INSIDE `normalizePaidMediaPlanBody` (`paid-media-plan.ts:1994+`), which itself ends in `paidMediaPlanBodySchema.parse(...)`. The only import from the schema is `normalizePaidMediaPlanBody` + the two types (`paidMediaPlanBodySchema` is NO LONGER imported here — confirmed at `:30-34`). The repo unit test "decodes a schema-DRIFTED GLM deck (wrapper keys, 1-leg insight) into a non-null deck" is GREEN: wrapper keys snap to real arrays, the 1-leg `crossSectionInsight` survives with `gtmBrief` added as the 2nd leg (`sourceSections.length>=2`), `competitorReviewInsights` lands at exactly 3, and the result passes `composerStripFloor`.
- **(b) a parse MISS keeps `deckMarkdown` + returns an honest-gap body, NEVER a content-losing null — PASS.** Three miss paths all route to `buildHonestGapDeckBody(options)` (`:214`): no fence (`extractPaidMediaPlanJson` → null), unparseable JSON (`JSON.parse` throw → catch), and un-normalizable valid JSON (`normalizePaidMediaPlanBody` throw → catch). `ComposePaidMediaPlanResult.deck` is typed `PaidMediaPlanBody` (NOT `| null`) (`:81`) and `deckSource:"honest_gap"` makes the miss VISIBLE. `deckMarkdown = stripPaidMediaPlanFence(result.text)` (`:155`) is computed independently of decode outcome, so the GLM prose (incl. `[grounded]/[inferred]/[gap]` markers — proven by the strip test) survives a miss. The honest-gap seed is built THROUGH `normalizePaidMediaPlanBody` with every load-bearing string prefixed "Evidence gap:". Repo tests prove honest_gap for unparseable JSON, no-fence, and `{}`. **Adversarial probes (DELETED after run):** honest-gap with VALID typed economics options (`creativeCapacity:"high"`, full `cvrChain`, `targetCac`, `voiceOfCustomerEvidenceGap:true`) does NOT throw and is non-null; a full valid body + the same options through `normalizePaidMediaPlanBody` does NOT throw; a JSON array / `null` literal / bare number all fall to honest_gap, never throwing. A `TypeError(staticCount)` surfaced ONLY when I passed a malformed `creativeCapacity` OBJECT via `as any` — `PaidMediaCreativeCapacity` is the string union `"lean"|"standard"|"high"` (`paid-media-plan.ts:38`), so TypeScript forbids that shape at the real P5 call site; NOT a reachable bug. (Architectural note recorded below, not a P3 failure.) A "two fences" probe failure was a defect in MY probe — it asserted `campaignOverview.objective`, but the normalized schema field is `prose` (`objective` is input-only); `deckSource` was correctly `"decoded"` and the ```paid-media-plan fence correctly won over a competing empty ```json fence regardless of order.
- **(c) projector NOT deleted — PASS.** `agentic-glm-projector.ts` present (38046 bytes, mtime Jun 23), `git status --porcelain` + `git diff --name-status HEAD` show NO change/delete, still imported at `run-section.ts:142`. composer-glm.ts does NOT touch it.
- **(d) tsc no new errors vs baseline 0 — PASS.** `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **0**.
- **(e) targeted composer/paid-media-plan tests pass incl new ones; no commit; minimal diff — PASS.** `npm run test:run -- composer-glm.test.ts paid-media-plan.test.ts` → **96/96 GREEN** (19 composer incl. the 4 new tolerant-decoder tests + the "DECODES drifted JSON the old strict parser nulled" cage-removed test + the `[grounded]/[inferred]/[gap]`-survives strip test; 77 schema). HEAD `7afc84fc` unchanged, nothing staged. Diff is surgical & scoped to `composer-glm.ts` (+ its untracked test): imports swapped (`paidMediaPlanBodySchema` out, `normalizePaidMediaPlanBody`+option type in), `deck` type tightened to non-null + `deckSource` added, `composePaidMediaPlan` calls the tolerant decoder, 3 new helpers (`extractPaidMediaPlanJson`, `decodePaidMediaPlanFromText`, `buildHonestGapDeckBody`), `parsePaidMediaPlanFromText` delegates to the decoder (back-compat null-on-miss). No `p-limit`/lease/pool primitive; no projector edit.

**Architectural observation carried forward (NOT a P3 failure):** `buildHonestGapDeckBody(options)` RE-APPLIES `options` to the honest-gap seed. If `normalizePaidMediaPlanBody` ever threw *because of the options themselves* (not the parsed body), the honest-gap fallback would throw too (no outer catch) and crash `composePaidMediaPlan`. Verified UNREACHABLE for the typed `NormalizePaidMediaPlanBodyOptions` surface P5 can pass (string-union `creativeCapacity`, optional money strings, structured `cvrChain`) — a full valid body + realistic options does not throw. Flagged only because P5 is the first live consumer: when P5 wires real onboarding economics, keep options TYPED (no `as any`) and this stays safe. No fix needed in P3.

**VERDICT: P3 PASS — no blocking issues.** Tolerant decoder reuses the proven section-path normalizer, a parse miss yields a visible honest-gap body (never content-losing null) with the GLM markdown preserved, the projector is intact, tsc clean at baseline 0, 96/96 targeted tests green, no commit, minimal scoped diff.

---

## P4a — Wire GLM orchestrator into live flow as a CHAINED lambda (2026-06-24 17:54 PKT)

Status: **DONE** (plumbing only). tsc 0 (baseline 0, no new). All targeted + adjacent suites green. NO commit (working tree only).

### Design note (override of plan P4, owner-ratified chained design)
Plan P4 line 62 had the orchestrator INLINE inside /orchestrate before fan-out. The task overrides this to a CHAINED lambda — /orchestrate must not block ~161-340s. So: /orchestrate seeds + freezes + returns the 200 seeded response immediately, then kicks ONE fast POST to a new /run-orchestrator route; the GLM orchestrator + the six-section fan-out moved INTO /run-orchestrator's after() (maxDuration=800).

### Auth scheme (verified at source, NOT memory)
run-lab-section uses Clerk `auth()` + `requireApiUser()` + actor-match, NOT x-internal-key inbound (the `RAILWAY_API_KEY` there is only for the OUTBOUND review-section kickoff). The kickoff forwards `Cookie`/`Authorization` (orchestrate `buildForwardedLabSectionHeaders`). run-orchestrator MIRRORS that exactly: own Clerk auth + cookie-forwarded fan-out. Added to middleware `isPublicRoute` per the load-bearing learned-pattern (route still self-protects; mirrors the existing "does its own auth" entries).

### What changed (file:line)
- **NEW** `src/app/api/research-v2/run-orchestrator/route.ts` — `runtime='nodejs'`, `maxDuration=800`. Clerk `auth()`+`requireApiUser()`+actor-match → 401; Zod `{run_id:uuid, parent_audit_run_id:string}` → 400; `loadOwnedResearchSession` → 404. ACKs **202** fast, then in `after()`: `generateAgenticGLMOrchestrator({websiteUrl: onboarding_data.websiteUrl ?? website_url, onboardingBrief: JSON.stringify(onboarding_data), env: process.env, signal})` under an AbortController bounded **700_000ms** (under the 800s lambda); `promoteOrchestratorFactsToLedger(createResearchArtifactsResearchFactStore(createAdminClient() as ResearchFactsSupabaseClient, parent_audit_run_id), result.transcript, {runId, createdAt, parentAuditRunId})`; THEN fan out the six `POSITIONING_SECTION_IDS` to `/run-lab-section` (same forwarded-cookie kickoff + 30s timeout as orchestrate had). Orchestrator failure is best-effort — sections STILL fan out (run never stuck cold).
- `src/middleware.ts:17` — added `"/api/research-v2/run-orchestrator"` to `isPublicRoute`.
- `src/app/api/research-v2/orchestrate/route.ts` — REPLACED `dispatchLabSectionJobs(...)` (the in-route 6-way `dispatchBounded` fan-out + `parseConcurrencyLimit`/`kickoffLabSectionJob` helpers) with `kickoffOrchestrator({request, runId, seeded})`: a single fast POST to `/run-orchestrator` carrying `{run_id, parent_audit_run_id}`, gated on `seeded` still reporting queued sections (preserves layer-1 idempotency — a re-POST whose sections are running/complete becomes a no-op, so two competing POSTs never double the orchestrator run). `freezeReviewedBriefSnapshot` + seeded 200 contract UNCHANGED. Removed now-dead `parseConcurrencyLimit`/`dispatchBounded`/`kickoffLabSectionJob`/`getLabSectionUrl` + `LAB_SECTION_POOL_CONCURRENCY` read (concurrency knob is gone with the in-route pool — pilot-pragmatic, no real pool anyway per P1 Cluster B). Header comment updated.

### Tests added (TDD red→green)
- **NEW** `run-orchestrator/__tests__/route.test.ts` (6) — 401 no Clerk user; 400 bad body; 404 not-owned; **202 ACK + work DEFERRED to after()** (orchestrator NOT called during the request, `after` called once); **runs orchestrator → promotes facts → fans out 6** (asserts websiteUrl + parsed onboardingBrief + AbortSignal passed; promote ctx carries runId+parentAuditRunId; 6 run-lab-section kickoffs in order, cookie forwarded); **orchestrator throws → sections STILL fan out** (promote NOT called, 6 kickoffs). Mocks `generateAgenticGLMOrchestrator`/`promoteOrchestratorFactsToLedger` (NO live GLM), `next/server.after` (capture+drain), Clerk, supabase, fact store.
- `orchestrate/__tests__/route.test.ts` — UPDATED to the new contract (the fan-out MOVED to run-orchestrator): the 5 fan-out assertions now expect exactly **one** kickoff to `/run-orchestrator` carrying `{run_id, parent_audit_run_id}` (not six to `/run-lab-section`); idempotency/race tests assert one kickoff when queued, zero when running. Auth/Zod/404/preflight/seed/freeze/200-shape invariants UNCHANGED. (Contract change mandated by the chained override — not a regression.)

### tsc vs baseline
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **0** (baseline 0; NO new errors). [Fixed one test-only TS error mid-phase: the hoisted `createResearchArtifactsResearchFactStore` mock had to be typed `(client, parentAuditRunId?)` — a `() =>` vi.fn() inferred 0-arity.]

### Test pass/fail
- `orchestrate` + `run-orchestrator` → **22/22 GREEN** (16 + 6). Adjacent sweep `run-lab-section` + `src/lib/research-v2` + `src/lib/lab-engine/evidence` → **40 files / 310 GREEN**. Full `src/app/api/research-v2` + `src/lib/research-v2` + evidence → **51 files / 397 GREEN**. eslint clean on the 3 touched route/middleware files.

### Deferred to P4b (per task scope — P4a is PLUMBING ONLY)
- **factMatchesPreparedSection relax** (P1 deferred FINDING, line 71/85): orchestrator facts carry `sectionId="orchestrator"`, which `factMatchesPreparedSection` (`run-section.ts:613`) currently DROPS — so even though the ledger SELECT now returns them, sections won't see them until that filter is relaxed (or facts promoted under a real section id). The ledger plumbing + promotion is wired; the read filter is NOT yet. **P4b must do this or the seeded orchestrator facts still won't reach sections.**
- **onStepFinish progress streaming** (plan P4 edit-5) — broadcast orchestrator step progress over `section-partials:${runId}` Realtime + a UI consumer. NOT in P4a.
- **gtm-fields delivery** (plan P4 edit-3) — merge `result.gtmFields.topCompetitors`/`marketProblem` + `researchDigest` into the frozen snapshot so `buildCompetitorSeeds` gets agent-discovered competitors (fixes blank-topCompetitors → empty-ad-seeds). NOT in P4a (would require reordering orchestrator BEFORE freeze, which the chained design separates — P4b should persist gtmFields from run-orchestrator into the session/snapshot).
- **Enrichment delivery + factMatch relax + onStepFinish are P4b** (explicit task scope line).
- **No live GLM proof** — E2E phase (P9/P10). generateAgenticGLMOrchestrator mocked here.

---

## P4a VERDICT — Adversarial Verify (2026-06-24 18:00 PKT)

Status: **PASS**. Independent re-read of the new route + middleware + orchestrate route via `cat -n`/`sed` (hook-safe), tried-to-break pass over criteria (a)-(e). NO commit; HEAD still `7afc84fc`; `git diff --cached` empty; new route file UNTRACKED, orchestrate/route.ts + middleware.ts MODIFIED only.

- **(a) run-orchestrator route — PASS.** `src/app/api/research-v2/run-orchestrator/route.ts` exists. `export const runtime = 'nodejs'` (`:41`), `export const maxDuration = 800` (`:44`). ACKs fast: the `POST` runs auth/Zod/`loadOwnedResearchSession` synchronously, schedules `after(async () => {...})` (`:208`), and `return NextResponse.json({ ok: true, run_id }, { status: 202 })` (`:253`) — the orchestrator is NOT awaited in the request path (proven by test "ACKs 202 immediately and defers the orchestrator to after()": generateAgenticGLMOrchestrator NOT called during the request, `after` called once). Inside `after()`: `generateAgenticGLMOrchestrator({websiteUrl, onboardingBrief: JSON.stringify(onboardingData), env: process.env, signal})` under an AbortController bounded 700_000ms (`:48/:210`); on success `promoteOrchestratorFactsToLedger(createResearchArtifactsResearchFactStore(createAdminClient() as unknown as ResearchFactsSupabaseClient, parentAuditRunId), result.transcript, {runId, createdAt, parentAuditRunId})` (`:219-227`); THEN `fanOutLabSections({request, runId})` (`:243`) POSTs the six `POSITIONING_SECTION_IDS` to `/run-lab-section`. All three imported symbols verified at source with matching signatures: `generateAgenticGLMOrchestrator(args: {websiteUrl,onboardingBrief,signal?,env?})` returns `{transcript: TranscriptRecord[], ...}` (orchestrator-glm.ts:122-147); `promoteOrchestratorFactsToLedger(store, transcript, ctx{runId,createdAt,parentAuditRunId?})` (:307); `createResearchArtifactsResearchFactStore(client: ResearchFactsSupabaseClient, parentAuditRunId?)` (research-fact.ts:368). Auth mirrors run-lab-section exactly (Clerk `auth()` 401 → `requireApiUser()` Response-or-user → actor-match 401). `after` imported from `next/server` — identical to the run-lab-section exemplar (Next 16 correct). `getWebsiteUrl` reads `onboardingData.websiteUrl ?? onboardingData.website_url` off the onboarding_data object (NOT a nonexistent top-level session column — the PROGRESS note said `?? website_url` but the CODE is correct: JourneySessionRow selects only id,user_id,run_id,research_results,onboarding_data,metadata, so a bare `website_url` would not exist; the code does not reference one).
- **(b) middleware isPublicRoute includes /api/research-v2/run-orchestrator — PASS.** `src/middleware.ts:17` `"/api/research-v2/run-orchestrator"` is in the `createRouteMatcher` array (grep-confirmed). NOT a silent-404 (the load-bearing learned-pattern). Route still self-protects (Clerk auth inside POST), mirroring the sibling `review-section`/`executive-brief` "does its own auth" entries.
- **(c) sections start ONLY after orchestrator writes facts; /orchestrate NO LONGER fans out directly — PASS.** `/orchestrate` `POST` (`orchestrate/route.ts:160-243`) calls `seedOrchestration` → `freezeReviewedBriefSnapshot` → `kickoffOrchestrator({request,runId,seeded})` → returns seeded 200. `kickoffOrchestrator` (`:96-158`) makes EXACTLY ONE `fetch` to `/api/research-v2/run-orchestrator` carrying `{run_id, parent_audit_run_id}`, gated on `seeded.section_run_ids.some(status==='queued' && positioning)`. Grep of orchestrate/route.ts for `run-lab-section|dispatchLabSectionJobs|dispatchBounded|kickoffLabSectionJob|parseConcurrencyLimit|LAB_SECTION_POOL_CONCURRENCY` finds ONLY the explanatory comment (`:85`) — no direct section dispatch, no in-route pool. The six-section fan-out lives solely in run-orchestrator's `after()`, AFTER the orchestrator+ledger write (sequenced: orchestrator/promote in try-1, fan-out in try-2 of the same after callback). Repo-wide grep for the removed helpers (`dispatchLabSectionJobs|parseConcurrencyLimit|LAB_SECTION_POOL_CONCURRENCY`) over `src/` = NONE (clean removal, no dangling refs). Orchestrate test "kicks the chained orchestrator without running sections inline" asserts exactly one kickoff to `/run-orchestrator` (NOT six to `/run-lab-section`). Frontend trigger intact: `research-v3/page.tsx` + `audit-reader-shell.tsx` still POST `/orchestrate` and receive the unchanged seeded 200 — the chaining is server-internal/transparent.
- **(d) /orchestrate seeded 200 + idempotent + route.test.ts GREEN — PASS.** `orchestrate/route.ts:230` `return NextResponse.json(seeded, {status:200})`. Tests assert status 200, `parent_audit_run_id===PARENT_ID`, `section_run_ids` length 6 with the exact 6 section ids; idempotency (two POSTs both 200, same body); freeze called once on the happy path, NOT called on the 409/preflight path; race test fires exactly one `/run-orchestrator` kickoff across two racing POSTs (gated on queued). `orchestrate/__tests__/route.test.ts` (16) + `run-orchestrator/__tests__/route.test.ts` (6) → **22/22 GREEN**. The run-orchestrator suite proves the after() drain: 401/400/404 gates, 202-deferred (orchestrator not called during request), happy path (orchestrator websiteUrl + parsed onboardingBrief + AbortSignal instance, promote ctx runId+parentAuditRunId, six run-lab-section kickoffs in POSITIONING_SECTION_IDS order with Cookie forwarded), and orchestrator-throws→promote-NOT-called-but-6-sections-STILL-fan-out (run never stuck cold).
- **(e) tsc no new errors + targeted+adjacent suites green + no commit + minimal diff — PASS.** `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **0** (baseline 0; NO new errors). Targeted `orchestrate`+`run-orchestrator` → 22/22; wider regression `src/app/api/research-v2` + `src/lib/research-v2` + `src/lib/lab-engine/evidence` → **51 files / 397 tests GREEN, 0 failed** (matches the P4a-claimed sweep). Diff is surgical: 1 NEW route file (`run-orchestrator/route.ts` + its test), middleware.ts +1 line, orchestrate/route.ts swaps the in-route 6-way fan-out for a single chained kickoff (removed `parseConcurrencyLimit`/`dispatchBounded`/`kickoffLabSectionJob`/`getLabSectionUrl` + `LAB_SECTION_POOL_CONCURRENCY` read — no real pool anyway, pilot-pragmatic). No `p-limit`/lease/pool primitive added. `agentic-glm-projector.ts` untouched. HEAD `7afc84fc` unchanged, nothing staged.

**Carried-forward deferrals (NOT P4a failures — explicit P4b scope):** (1) `factMatchesPreparedSection` (`run-section.ts:613`) still DROPS `sectionId="orchestrator"` facts, so the seeded orchestrator facts reach the ledger SELECT but NOT the section context until P4b relaxes that filter (or promotes facts under a real section id); (2) `onStepFinish` orchestrator-progress Realtime streaming; (3) gtm-fields/researchDigest delivery into the frozen snapshot for `buildCompetitorSeeds`; (4) no live GLM proof (E2E phase). The ledger plumbing + promotion + chained kickoff are fully wired and tested with mocks; P4a is plumbing-only by design.

**Minor note (not a defect):** the PROGRESS P4a "What changed" line cited the fact-store cast as `as ResearchFactsSupabaseClient`; the actual code uses the safer `as unknown as ResearchFactsSupabaseClient` double cast. Both compile (tsc 0); cosmetic doc/code drift only.

**VERDICT: P4a PASS — no blocking issues.** The chained-lambda orchestrator is correctly wired: run-orchestrator exists with nodejs/maxDuration=800, ACKs 202 fast and defers the GLM orchestrator + ledger promote + six-section fan-out to after(); middleware whitelists it (no silent-404); /orchestrate kicks exactly one chained orchestrator and no longer fans out sections directly (sections start only after the orchestrator writes facts) while preserving the seeded 200 + idempotency; tsc clean at baseline 0; 22 targeted + 397 regression tests green; no commit; minimal scoped diff.

---

## P4b — Orchestrator research REACHES sections + progress streaming (2026-06-24 18:13 PKT)

Builds on P4a's chained-lambda. The three deferred P4a/P1 findings, all closed.

### What changed (file:line)
- **Enrichment delivery** — NEW `src/lib/research-v2/orchestrator-enrichment.ts`: `mergeOrchestratorEnrichment(onboardingData, {gtmFields, researchDigest})` (pure, GAP-FILL only — never overwrites a non-empty user field; joins `gtmFields.topCompetitors[]` into the comma free-text `buildCompetitorSeeds` parses; sets `marketProblem`; stashes `researchDigest` under `orchestratorResearchDigest`) + `persistOrchestratorEnrichment({supabase,userId,runId,onboardingData,gtmFields,researchDigest})` (merges + writes `journey_sessions.onboarding_data`; best-effort, never throws; no-op when `gtmFields===null`). Wired in `run-orchestrator/route.ts` after promote, BEFORE fan-out. Seam choice: persist into `onboarding_data` (NOT the frozen snapshot — P4a froze it in /orchestrate before the orchestrator ran). Sections reload `session.onboarding_data` → `corpusToResearchInput` reads `topCompetitors` (→ competitorSeeds) + `marketProblem` (→ onboarding.voiceOfClient).
- **factMatchesPreparedSection relax** — `run-section.ts:~613` (`factMatchesPreparedSection`): facts with `sectionId === "orchestrator"` (new const `ORCHESTRATOR_SEED_SECTION_ID`) now match EVERY section (parent-run gate still enforced upstream by `factMatchesPreparedRun`, so only the seed of THIS parent is admitted, not foreign runs). `buildPreparedFactRows` (`run-section.ts:~660`) presents the seed under the CONSUMING `sectionId` (avoids the `SECTION_REGISTRY["orchestrator"]` crash — orchestrator is not a SupportedSectionId); id/sourceId still slug "orchestrator" for traceability. Real per-section matching unchanged.
- **onStepFinish progress** — `orchestrator-glm.ts`: `GenerateAgenticGLMOrchestratorArgs` gains optional `onStepFinish?: (step)=>void|Promise<void>` + `generateTextImpl?` (DI seam for tests); threaded into `generateText` (omitted from the call when unset; return shape unchanged). `run-orchestrator/route.ts`: `makeOrchestratorProgressEmitter(runId)` broadcasts each step over the EXISTING `section-partials:<runId>` Realtime channel (`broadcastSectionPartial`, `sectionId/zone="orchestrator"`, monotonic seq) — best-effort, swallows broadcast errors, never stalls the loop. Passed as `onStepFinish` into the orchestrator call.

### Tests added (TDD — red first, then green)
- `prepared-section-context.test.ts` +1: an `"orchestrator"` fact reaches BOTH `positioningMarketCategory` and `positioningVoiceOfCustomer` factRows under the consuming sectionId.
- NEW `research-v2/__tests__/orchestrator-enrichment.test.ts` (7): gap-fill, no-overwrite, null no-op, end-to-end delivery into a non-empty `competitorSeeds` + `onboarding.voiceOfClient.marketProblem` via `corpusToResearchInput`, persist write shape, best-effort on null + DB error.
- `orchestrator-glm.test.ts` +2: `onStepFinish` threaded + fired per step via `generateTextImpl` fake; omitted from the call when not supplied.
- `run-orchestrator/__tests__/route.test.ts` +3: enrichment persisted (userId/runId/gtmFields/digest/onboardingData) before fan-out; progress broadcast fired with `sectionId="orchestrator"`; broadcast-throws → still fans out 6.

### Gates
- **tsc:** 0 errors (baseline 0; 3 NEW caught mid-impl — SupabaseClient→narrow-interface assignability + 2 optional-`competitorSeeds` — both fixed: route uses the same `as unknown as Parameters<...>[0]['supabase']` cast pattern as P4a's fact-store cast; test guards `?? []`). NO new errors.
- **Targeted:** run-orchestrator + orchestrate + orchestrator-glm + prepared-section-context + orchestrator-enrichment + corpus-to-research-input = **71/71 GREEN**.
- **Regression sweep:** `src/app/api/research-v2 src/lib/research-v2 src/lib/lab-engine/evidence src/lib/lab-engine/agents` = **1498 passed / 1 skipped (live Ollama) / 0 failed** (147 files).
- NO commit. Working tree accumulates the single review diff.

### Notes / carried-forward
- **researchDigest** is persisted (`orchestratorResearchDigest`) but NOT yet read by `corpusToResearchInput` — no live consumer today; available for the composer (P5) / future seam. The two LOAD-BEARING fields the task named (topCompetitors, marketProblem) DO reach the sections.
- **Section→section LIVE fact sharing still deferred** (P1 finding, unchanged): the dispatch-time SELECT captures orchestrator facts (written before fan-out) but misses sibling-section writes. Orchestrator→section (the pilot goal) works; section→section does not.
- **No live GLM proof** — E2E phase (Task 10). The onStepFinish path + enrichment + factMatch relax are mock-tested only.

---

## P9 (partial) — LIVE E2E value proof on Clay, full OpenRouter AI-SDK path (2026-06-24 ~19:40 PKT)

Status: **RUN COMPLETE — verdict captured. NO commit.** First real end-to-end GLM run of the agentic chain on the prod transport (`z-ai/glm-5.2` via `@ai-sdk/openai-compatible`, `GLM_BASE_URL=openrouter.ai/api/v1`). Closes the "0/5 live, all mock-validated" gap for the section tier; surfaces a composer blocker + a reproducible, gateable fabrication class.

### What ran (all OpenRouter, NO Ollama)
- **Orchestrator:** reused today's `tmp/zz-orchestrator-glm/clay` (digest 16k chars, 142k facts) — emitted fine.
- **6 sections:** re-run LIVE via the APP resolver. `scripts/zz-agentic-section.ts` re-pointed from its localhost-Ollama client to `getAgenticGLMModel(process.env)` (3 edits → now exercises the exact app path `getAgenticGLMModel → createGLMSelection → @ai-sdk/openai-compatible → OpenRouter`; setup log confirmed `model=z-ai/glm-5.2 baseURL=https://openrouter.ai/api/v1`). All 6 rc=0, bodies 14–19k chars, ~3.5 min each (~21 min total), 0 errors.
- **Composer:** `scripts/zz-composer-glm.ts` edited to read the 6 REAL section bodies (was hand-written canned summaries). Ran `composePaidMediaPlan` on OpenRouter, ~251s, stepCount=1.
- Working-tree script edits (uncommitted, part of the review diff): `scripts/zz-agentic-section.ts`, `scripts/zz-composer-glm.ts`.

### Section verdict — offline Claude judge (no GLM/API; deterministic transcript-presence laundering check done by hand, because the app value-bar judge returns an empty `transcriptUrlSet` and is unreliable)
avg **6.5/10**, **2/6 clean-billable**, **24 laundered URLs, 33 fabrications**:

| section | score | verdict | laundered URLs | numeric traced |
|---|---|---|---|---|
| demand | 8 | billable | 1 | 51/52 |
| competitor | 8 | billable | 2 | 19/19 |
| market | 6 | borderline | 7 | 28/32 |
| voc | 6 | borderline | 7 | 7/11 |
| offer | 6 | borderline | 2 | 16/22 |
| buyer | 5 | borderline | 5 | 11/22 |

**Two-layer pattern (reproducible — matches the earlier Ollama value-bar run):**
- **GROUNDED SPINE (billable):** funding chain (verbatim from Perplexity), SpyFu keyword tables (volume+CPC+difficulty exact), competitor pricing/complaints + LIVE ad-library evidence, Reddit switching/displacement quotes, GTM-Engineer category bet, falsifiable confirm/break tests. Non-generic, media-buyer-actionable.
- **FABRICATED PROOF LAYER (client liability):** named-customer outcome quotes cited to `clay.com/customers/{figma,vanta,intercom,openai}` + `clay.com/blog/{anthropic,verkada}-case-study` URLs **never fetched (0 transcript hits)**; invented metrics ("Anthropic 3x'd enrichment", "Intercom +140% pipeline", "Verkada tripled reply rates"); a fabricated **"$5B NYT tender offer, Jan 2026"** (future-dated) labeled *Defensible* in market + offer.

**KEYSTONE FINDING:** every fabrication falls cleanly along the **"present in the transcript?"** line — grounded spine is in tool results, fabrications are not. → **mechanically gateable** by a deterministic numeric-provenance + quote-at-URL gate (NO LLM oracle). This VALIDATES the LOCKED §0.5 items (1)(2) anti-fab thesis with live data, and promotes **Task 08 (anti-fab gate) from "later phase" to the billability keystone.**

### Composer blocker (live-proven)
`composePaidMediaPlan` returned an **empty completion** (`deckMarkdownLen=0`) → tolerant decoder found no fence → `buildHonestGapDeckBody` → every cell reads `"Evidence gap:…"` → and it **passed `composerStripFloor` (admitted=true)**. So an empty gap deck is presentable as composed (the P3 deferred risk, now live). Root cause: `COMPOSER_MAX_OUTPUT_TOKENS=12000` + `stepCountIs(4)` + no reasoning guard over ~25–30k input tokens — GLM (reasoning model) burned the pass and emitted no tail. The section runner survives the identical model via 16 steps + a generous ceiling (its own comment: "without a generous output ceiling the final markdown is empty"). Fix: raise ceiling / add a top-up step / guard `finishReason==='length'`+retry; surface `deckSource==='honest_gap'` so a gap shell never reads as composed.

### Net
**Premise GO with eyes open.** The research engine works on the real OpenRouter AI-SDK path; the failure mode is a reproducible, deterministically-gateable fabricated-proof layer; the composer needs a config fix before the deck tier works at all. Build priorities reordered by this evidence: **(1) anti-fab gate (Task 08 — now the keystone), (2) composer empty-completion fix, (3) human-review-before-Share (Leg 3).**
