# Handoff — Mainstream-grade research run: visibility, streaming, ads, latency

> **For:** a fresh Claude Code session with dynamic-workflow orchestration + Codex (xhigh) + a live browser + the user's API keys + sandbox.
> **Authored by:** HQ (Claude) on 2026-06-01, grounded in a 7-agent read-only investigation of the real code + git history (every claim below carries `file:line` evidence; unproven items are explicitly marked "needs live/sandbox").
> **Worktree (system of record):** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire` · branch `feat/v2-lab-section-wire` · base `7a979417`.
> **Baseline gates (do not regress):** build 0 · lint 0 err / 67 warn · **1228 tests** pass. **19 commits ahead of main, NOT pushed, NOT deployed** (push/deploy is user-gated).

---

## 0. Operating doctrine (read first — this is the bar)

The user's words, made binding:

1. **No slop, no BS, stay aligned.** Every fix traces to a confirmed root cause with `file:line` evidence. If you can't prove a cause read-only, you run a live/sandbox probe to settle it — you do **not** guess and ship.
2. **You take the lead.** You are the PM + product head + 100x engineer. Prioritize, sequence, decide. Surface tradeoffs; don't silently pick the easy path.
3. **All these issues are yours to solve.** If Codex dies / doesn't report back, you **retry, re-dispatch, or do it yourself** — you never say "Codex didn't respond, skipping." A dead subagent is a transient failure, not a reason to drop scope.
4. **Don't cheap out — on execution or on tokens.** Boil the ocean. Ultracode posture: exhaustive and correct over fast and cheap. Use dynamic workflows (fan out 7–14 agents), adversarially verify findings, run the real gates.
5. **Verify behaviorally, not just by unit test.** The recurring failure of this project is shipping "code-complete, behavior-pending" and calling it done. A fix for ads/streaming/latency is **not done** until a live E2E or sandbox probe proves it on real data.

### How to use your muscle
- **Dynamic workflows** for investigation fan-out and parallel/sequential implementation (same pattern that produced the 4 blocker fixes: `diagnose ∥` → `implement sequential` → HQ gate + commit). Serialize writes to shared files (`run-section.ts` is edited by almost everything — never let two agents touch it in parallel).
- **Codex (xhigh)** via `codex:codex-rescue` or the `codex` skills for bulk execution once you have a reviewed spec. Codex types; you think + review + gate.
- **Live E2E:** drive the app in the user's authenticated browser (their Clerk session + their API keys). Produce a **second-by-second flow report** — what the user sees each moment, where it stalls, what's confusing. This is the single highest-value artifact for the visibility + latency work.
- **Sandbox:** standalone `tsx` scripts that call the real API clients (`adLibraryAgentTool.execute`, raw SearchAPI, Foreplay) with the user's keys, *outside* Next/Clerk, to isolate why ads are empty — then port the proven call back into production.

---

## 1. Three hard truths (the honest reframe — internalize before touching code)

### Truth 1 — "Stream the artifact like Claude.ai" is an architectural FORK, not a TODO.
The 6 positioning sections use the **answer-tool atomic-output path** (`runSection` → `runSectionViaAnswerTool`, `run-section.ts:4144/4152`). The fabrication/provenance gate — `structuralVerifier`, `validateMinimums`, `checkRequiredEvidenceClasses`, `checkVoiceOfCustomerSelfSourcing`, the new `checkDemandIntentKeywordProvenance`, and `deriveGroundedConfidence` — is wired to the **complete** artifact + the **complete** tool-step transcript inside `buildAnswerToolAttempt` (`run-section.ts:2915-3030`). It cannot run on a half-arrived object.

- **Naive token-streaming (`streamObject`) deletes that gate** and surfaces ungated content — the exact fabrication class (VoC self-sourcing loss, fabricated pricing, dishonest SpyFu provenance) the whole research-quality arc + this morning's T3/T4 work exists to prevent. Claude.ai's stream is *ungated answer text*; that is precisely what we must not do for evidence-bearing artifacts.
- **All partial-streaming infra is already DEAD**: `streamRunSection`/`writeArtifactPartial`/`data-artifact-partial` channel have **zero consumers** (grep-confirmed). Even `defaultAnswerToolStreamer` drains `result.textStream` into a discarded string (`section-agent.ts:446-448`); the answer args arrive atomically post-loop via `getAnswerInput(steps)`.
- **There is no live transport.** The job is detached (`after()`), the browser **polls** `/api/research-v2/audit-state` every **2500ms** (`use-audit-state.ts:16`). Any token stream would have no socket to ride. So "stream it" is honestly **two** projects: a server-side partial source **and** a new transport (SSE/Supabase Realtime), plus a gate-preservation design.

**→ Recommendation (present this to the user as a product decision, don't silently pick): deliver the "watch it work" feeling via richer live *activity + reasoning* (Truth-safe, see §B2 Option 1), not literal prose token-streaming.** If the user insists on literal streaming, scope it honestly as draft-then-gate with an "unverified draft" affordance + new transport (§B2 Option 2/3) and warn that it shows pre-gate content.

### Truth 2 — The "complete ad engine" you remember is REAL and INTACT. It's orphaned, not deleted. Resurrect it.
`research-worker/src/tools/adlibrary.ts` (**1,429 lines**, dated May 25) is the real engine:
- `searchGoogleAds` + **`searchLinkedInAds`** (`:737`, SearchAPI `engine: 'linkedin_ad_library'` `:746`) + `searchMetaAds`, run in `Promise.all` (`:1387`), **plus `searchForeplayAds(domain)`** (`:969`, hits `public.api.foreplay.co/api/brand/getBrandsByDomain` → `getAdsByBrandId`, gated by `FOREPLAY_API_KEY && ENABLE_FOREPLAY==='true'`) as a fallback when SearchAPI yields <3 ads (`:1396`). Merge + dedup by id and content fingerprint in `buildAdInsight` (`:1274`).

The v3 in-process migration (commit `ccdc4235`, May 25) wrote a **leaner Google+Meta-only reimplementation** at `src/lib/lab-engine/agents/tools/adlibrary.ts` (`adLibraryPlatformSchema = z.enum(["meta","google"])`, `:18`) and pointed the orchestrator at it. The worker is **off** the live research path (no RAILWAY fetch in `orchestrate`/`run-lab-section` — the lab runs in-process on Vercel). So **LinkedIn + Foreplay were dropped by the fork, not removed by any cleanup.** The user is right: we built it; we just stopped calling it.

### Truth 3 — My T4 commit (this morning) encoded a FALSE premise. Correct it.
`src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:457-465` says *"SearchAPI exposes no LinkedIn engine … LinkedIn counts are structurally 0 and were not probed."* **The first clause is false** — the worker proves SearchAPI has `linkedin_ad_library` (`research-worker/.../adlibrary.ts:746`). The honest part of T4 stands (LinkedIn was never queried *in the lab path*, and the 0-count needs a live run), but the "no LinkedIn engine" claim must be **removed/corrected** when LinkedIn is ported in (§B3). Flagging my own error up front — that's the standard.

---

## 2. Bottleneck dossiers (prioritized)

Priority order = felt-pain × leverage. **B1 (visibility)** and **B3 (ads)** are the headline asks; **B2 (streaming)** is the product-decision that shapes B1; **B4 (latency)** is the slowest-section fix.

---

### B1 — The run is illegible: activity goes silent + the UI lies about state  ⟵ **start here**

**Symptom (user, live):** "Initially I just saw logs and then no more logs." · "it says the worker will begin once it starts — no, it's running now." · "weird lines under the searching, I don't get the point." · "you can't tell what's going on."

**Confirmed root causes (all read-only-provable; no live run needed to fix):**

1. **Activity feed starves mid-run — a global `LIMIT` masquerading as a per-zone budget.** `audit-state/route.ts:524-535` fetches events with a single `created_at DESC LIMIT (12 × N)` across **all 6 concurrently-running zones**, then buckets per zone (`buildEventsByZone:221-245`, cap <12 each). Chatty sections (CompetitorLandscape: ad probe + repairs → 25-40 events) consume the newest slots; the **first/quiet section's events fall out of the window entirely** → its feed empties. Commit `f22ebc3b` is *titled* "per-zone event budget so chatty sections don't starve others" but only swapped `LIMIT 60`→`LIMIT 12*N` on the **same global query** — no `PARTITION BY zone`. **The bug is a mis-implemented fix that was never validated against a real 6-section run.**
   - **Fix (recommended, S):** replace the global query with a genuine per-zone bounded fetch — either 6 parallel `.eq('zone', id).order(created_at desc).limit(12)` queries (no migration) or a `ROW_NUMBER() OVER (PARTITION BY zone …)` RPC (needs a migration + the existing SECURITY DEFINER pattern; note: **add an index on `(artifact_id, zone, created_at)`** — `migration 20260514` only indexes `(section_run_id, created_at)`).
2. **The active section is frozen on the first one.** `audit-reader-shell.tsx:1183-1195`: `autoActive` latches once to the first-running section and never follows the run. When that section commits, `LiveActivity` is replaced by the artifact view and the user is **blind to the 5 sections still working** unless they manually click a tab.
   - **Fix (recommended, S):** make `active` follow the current first-running section while `userActive===null` (manual click still wins; debounce to avoid jumpiness). Ship **with** fix 1, or the followed section is still starved.
3. **A running section is labeled "Queued."** `derive-section-phase.ts:40` returns `'Queued'` for a `status==='running'` worker that hasn't emitted its first event yet → `LiveActivity` shows a **spinner next to the word "Queued"** for the first ~2.5s+ poll window. `QueuedPlaceholder` copy (`audit-reader-shell.tsx:634`) "this section will begin once a worker is free" reads as *idle* during an active run.
   - **Fix (recommended, S):** `derive-section-phase.ts` → return `'Compiling context'` for running-no-events; drop the `label !== 'Queued'` filter at `audit-reader-shell.tsx:1245`; rewrite the placeholder copy to "Waiting for an open lane — your audit is already running other sections."
4. **The "weird lines" = a decorative skeleton that never resolves.** `audit-reader-shell.tsx:616-625`: four `animate-pulse` bars at hard-coded widths, `aria-hidden`, rendered **unconditionally** as a sibling of the real activity rows. Pure noise.
   - **Fix (recommended, M):** replace it with a **real phase ladder** (the 7 `ProductPhases` already in `section-activity.ts:19-26` rendered as a stepper: preparing→searching→drafting→checking→refining→committing→done), current phase highlighted, and **surface the live search-query chips** (`SearchQueryChips`, currently buried). Conform to DESIGN.md (JetBrains Mono 11px uppercase status, semantic color only).
5. **Legibility over-collapsed by the 2026-05-29 leak fix.** `section-activity.ts` merges every tool call into one "Searching source evidence" row and scrubs every repair reason. The security allowlist is correct but it threw out the signal with the jargon.
   - **Fix (M, do carefully):** keep the allowlist, but stop collapsing distinct queries into one row, and let validation/repair show honest counts ("Strengthening 3 claims with sources"). **Re-verify the `JSON_HINT`/customer-safe guard on every newly-surfaced field** (this is the leak vector — don't reopen it).

**Files:** `audit-state/route.ts` (524-535, 221-245), `audit-reader-shell.tsx` (616-625, 630-638, 1183-1195, 1240-1248, 1538-1543), `derive-section-phase.ts` (35-42), `section-activity.ts` (19-26, 121-134, 149-160, 201-314, 332-352, 388-423), `use-audit-state.ts:16`.

**Verification:** unit/snapshot tests for the relabel + per-zone query; **live E2E** to confirm the feed stays populated across all 6 sections through the full run and that no running section ever reads "Queued."

---

### B2 — Streaming: deliver "watch it work" without orphaning the gate

**Symptom (user):** "We talked about streaming out the artifact it's writing — that's not done."

**Why it's not done:** Truth 1. The atomic-output↔gate coupling + the absence of any live transport. This is real, not an excuse — but the *felt* need ("see it working, like Claude") is satisfiable safely.

**Options (present to user; recommend Option 1):**
- **Option 1 (recommended, M) — Rich live activity + reasoning, artifact still atomic.** Surface the model's between-step reasoning (`step.text`, captured in `summarizeStep` `section-agent.ts:147`, currently discarded) plus tool-started/finished as a Claude-like "thinking/working" feed. Add one `reasoning-progress` activity event type (`activity-event.ts:9-20`), emit from the existing `onStep` callback, render in the polled feed, drop poll to ~1000ms during a running section. **Gate fully preserved.** Pairs with B1 to make the run genuinely legible. *Caveat:* reasoning text must pass the `JSON_HINT`/customer-safe filter (leak vector); confirm `step.text` is non-empty on DeepSeek/Sonnet via a live run.
- **Option 2 (L, only if user demands literal streaming) — Partial answer-arg streaming → read-only DRAFT → gate on FINAL → swap to committed.** Requires a new live transport (Supabase Realtime on the events/section_run table is cheaper than SSE given the serverless `after()` job has no inbound socket) AND likely a parallel `streamObject` draft (a 2nd model call — cost/latency against the 270s ceiling). **Shows pre-gate content** — must be labeled "unverified draft" and superseded by the gated final. Validate whether AI SDK v6 `agent.stream()` exposes incremental answer-tool *input* deltas on the provider (currently unproven — the streamer discards `textStream`).
- **Option 3 (L) — Two-pass thin draft (streamObject) + verified final supersede.** Doubles model calls/cost; draft is ungrounded by construction.

**Files:** `run-section.ts` (2915-3030 gate, 3032 `runSectionViaAnswerTool`, 729-736 `answerToolSectionIds`, 3768+ dead stream path), `section-agent.ts` (147, 407, 411-455), `lab-section-dispatch.ts` (45-64, detached job), `use-audit-state.ts:16`, `section-activity.ts`, `activity-event.ts`, ADRs `0002` (original streamObject intent) + `0006` (the live-tools reversal + 270s/180s latency budget).

**Verification:** live run confirming the reasoning feed is populated + gate still fires (T3/T4 invariants intact). For Option 2/3: latency re-measure against the 270s hard ceiling.

---

### B3 — Zero ads: resurrect the real engine + prove it on real data  ⟵ **headline feature**

**Symptom (user):** zero ads for notion / clickup / asana / google sheets, despite a "complete ad engine" and SearchAPI + Foreplay.

**Confirmed (read-only):** the lab path **is** wired and fires (the 2026-05-27 "always empty" finding is stale). Engine names match the proven worker engines. But it's **Google+Meta only** (Truth 2), and **every failure mode degrades to a SILENT typed gap** (`credentialGap` / `NoMatchedAdvertiserError→gap` / `ads:[]`), so the artifact alone can't tell you *which* cause produced 0. Ranked candidate causes for the user's brands:
1. **`SEARCHAPI_KEY` missing/empty in the VERCEL runtime** (the lab runs in-process on Vercel, **not** the worker — `env.ts` even comments "must be set in Vercel Production+Preview"). Highest-probability infra cause; classic Step-Zero miss. → resolvable in minutes by a `Boolean(process.env.SEARCHAPI_KEY)` debug echo or the Vercel dashboard (never print the value).
2. **True-empty yield / identity miss.** Competitor seed domains are usually `undefined` (corpus sources are about the *subject*, not competitors — `corpus-to-research-input.ts:695-699`), so `resolveBestCandidate` runs name-only (`isDomainVerified=false`); short B2B names (Asana=5, Notion=6 chars) can resolve "ambiguous" or "rejected", and B2B SaaS often has thin Meta presence. → SANDBOX probe distinguishes "no candidate" from "candidate but no ads."
3. **Over-filtering.** Ads fetched but dropped by `isAdvertiserMatch`/`hasUsableCreativeText` (`adlibrary.ts:444-461`), recently tightened for the Ramp wrong-entity finding (`aafce0c4`) — may now over-reject.

**THE PLAN (do in this order):**
1. **Settle env first (S, free):** debug-echo `Boolean(process.env.SEARCHAPI_KEY)` in the Vercel runtime. If false → that's the bug; fix env, re-run.
2. **Sandbox probe (S/M, ~12 SearchAPI requests):** standalone `tsx` script (outside Next/Clerk) that calls `adLibraryAgentTool.execute({advertiser, platform, max_results:4, domain})` for {Notion→notion.so, ClickUp→clickup.com, Asana→asana.com} × {google, meta}, **and** replicates the two raw SearchAPI fetches itself, logging: (a) raw candidate list, (b) `resolveBestCandidate` verdict+reason, (c) raw ad rows pre-filter, (d) rows surviving the filters. This **definitively** assigns the 0-count to key / matcher / filter / true-empty. (Exact engine names + script spec in Appendix.)
3. **Resurrect the engine (M):** port `searchLinkedInAds` (SearchAPI `linkedin_ad_library`, incl. the worker's link-redirect false-positive guard) **and** `searchForeplayAds` (the <3-ad fallback) from `research-worker/src/tools/adlibrary.ts` into `src/lib/lab-engine/agents/tools/adlibrary.ts`; extend `adLibraryPlatformSchema` to include `linkedin`; add `linkedin` to `competitor-ad-adapter.ts:49` and **delete/correct the false "no LinkedIn engine" comment at :457-465** (Truth 3). Confirm `SEARCHAPI_KEY` + `FOREPLAY_API_KEY` are in the **Vercel** env, and re-confirm the Foreplay API contract live (memory flagged Foreplay as a possibly-dead key — probe `getBrandsByDomain` once before trusting it).
4. **Optionally seed competitor domains** (`buildCompetitorSeeds`) from a known-brand map / a cheap pre-probe `web_search` so `resolveBestCandidate` runs domain-verified (better recall for the exact brands the user tests).
5. **Behavioral proof:** live E2E run; assert `displayableTotal > 0` real creatives for known-advertising brands.

**Files:** `src/lib/lab-engine/agents/tools/adlibrary.ts` (18, 444-461, 464-580, 648), `competitor-ad-adapter.ts` (49, 457-465), `advertiser-match.ts` (resolveBestCandidate 481-715, isAdvertiserMatch 329-459), `run-section.ts` (2393-2527 probe, 2129-2187 advertiser build, 3092-3113 budget), `corpus-to-research-input.ts` (654-709, 841), `research-worker/src/tools/adlibrary.ts` (**port source**: 737-793 LinkedIn, 969-1035 Foreplay, 1274 merge, 1387 orchestrator), `env.ts` (46-47), `integrations/registry.ts` (138-142). **Do NOT port from** the oldest orphaned `src/lib/foreplay/*` / `src/lib/ad-library/*` cluster — lower quality; the worker version is the source of truth.

---

### B4 — CompetitorLandscape is the latency outlier (~3min17s vs ~1min)

**Symptom (user):** competitor section takes 3+ min; others ~1 min; sections start "10-20s apart."

**Confirmed root causes:**
1. **Ad-probe prepass blocks the LLM (0–30s of dead wall-clock).** `run-section.ts:3114` awaits `runCompetitorAdProbeSteps` **before** the answer-tool loop; advertisers loop **sequentially** (`for…of` `:2476`, the 2 lookups/advertiser *are* concurrent), capped at 30s (`competitorAdProbeDeadlineMs` `:724`).
2. **Largest schema in the suite** (`competitor-landscape.ts`, 641 lines, `structuredOutputMaxTokens:8192`) → longest generation across up to 12 ToolLoopAgent steps.
3. **Repair loop is the multiplier.** `run-section.ts:3275-3350` re-runs the **entire** multi-step agent up to `answerToolMaxRepairAttempts=2` more times on validation/evidence shortfall. Its strict minimums (5 sub-sections + `adEvidence_or_gap`) make it the most repair-prone section. **This is what turns 1min into 3min.**
- **"10-20s apart" is NOT a concurrency limiter.** There is **no** `ORCHESTRATOR_CONCURRENCY`/wave gating in the in-process engine — `orchestrate/route.ts:112-121` fires all 6 concurrently; the stagger is serverless cold-start + `after()` scheduling. (CLAUDE.md's "Wave X of Y / waves of 3" describes a *worker* design this code doesn't implement.)

**Fix options (ranked):**
- **(S, recommended) Move the ad probe off the critical path:** start it at section entry, await only when assembling the answer-tool prompt — overlaps ≤30s with the first model step. Zero quality risk if the await still completes before `buildMergedAnswerToolAdEvidenceGroups` consumes the groups.
- **(S, recommended) Parallelize the advertiser loop:** swap the sequential `for…of` for one outer `Promise.all` over advertisers (cuts probe worst-case ~30s→~15s; watch SearchAPI 429s — `fetchWithRetry` already backs off).
- **(M, recommended after telemetry) Cut repair blast radius:** feed the prior partial forward so repair **edits** rather than regenerates, or make repairs answer-only (skip re-doing tool calls), or lower `answerToolMaxRepairAttempts` for this section. **Validate on a live run** that pass-rate on the strict minimums doesn't drop.
- **(L, NOT recommended first) Sub-agent orchestration within the section** (the user's idea): evaluated — the latency is dominated by serial *repair re-runs* + one large atomic generation, neither helped by fan-out unless you also break the atomic-output/verifier contract. Sub-agents add cost + failure points + a verifier rewrite. Capture the cheap wins (probe off-path + parallelize + repair cost) first; revisit only if telemetry shows generation itself is the bottleneck.
- **Also:** fix the **stale comment** at `run-section.ts:3100` ("adReservedLookups=2 => one advertiser" — registry actually sets 6 ⇒ 3 advertisers).

**Critical unknown — needs live telemetry:** the **primary-vs-repair time split**. Run a live CompetitorLandscape with AI SDK telemetry (`AI_SDK_DEVTOOLS=true`) to measure how many repairs actually fire and what fraction of 3min is repair vs base generation vs probe. The fix priority depends on this: if repairs rarely fire, attack the probe/schema; if they fire often, attack the repair loop.

**Files:** `run-section.ts` (3114, 2476-2521, 3275-3350, 705/724/725/726, 3100), `section-registry.ts:140-175`, `competitor-landscape.ts`, `lab-section-dispatch.ts:14`, `section-agent.ts:370-395`, `adlibrary.ts:117` + `_shared.ts:124-149`, `ai/models.ts:7,100`.

---

## 3. Execution plan (workflow-driven, phased — you orchestrate)

Run these as **sequential phases**, each gated by HQ review + the real test/build gate before the next. Within a phase, fan out agents; serialize any writes to `run-section.ts`/`audit-reader-shell.tsx`.

**Phase 0 — Live E2E baseline + ad-API sandbox (the "see for yourself" pass).**
- Drive one live audit in the user's authenticated browser (their keys). Capture a **second-by-second flow report**: corpus → brief → fan-out → each section's phase timing → where the feed goes silent → what's confusing on screen → which sections show ads. Screenshot the offending states (the "Queued" spinner, the "weird lines"). This is the ground-truth artifact every fix references.
- In parallel, run the **ad-API sandbox** (§B3 step 2 + Appendix) with the user's `SEARCHAPI_KEY`/`FOREPLAY_API_KEY` to assign the 0-ads cause. Also do the `Boolean(process.env.SEARCHAPI_KEY)` Vercel-env check.
- **Output:** a findings doc that turns every "needs live/sandbox" item in this handoff into a resolved fact.

**Phase 1 — Visibility (B1) + gate-safe streaming (B2 Option 1).** Highest felt-pain, lowest risk, mostly UI + one query fix. Ship the per-zone query, the follow-active-section, the "Queued"→"Compiling context" relabel, the phase-ladder replacing the skeleton, and the reasoning-progress activity feed. Re-verify the customer-safe leak guard on anything newly surfaced.

**Phase 2 — Ad engine resurrection (B3).** Port LinkedIn + Foreplay from the worker, correct the T4 comment, confirm Vercel env, optionally domain-seed. Behavioral proof = live run with real creatives > 0.

**Phase 3 — CompetitorLandscape latency (B4).** Probe off-path + parallelize advertisers (cheap, ship first), then — guided by Phase-0 telemetry — the repair-cost fix.

**Phase 4 — Live E2E re-run = the real sign-off.** Full audit on a fresh URL: feed stays legible across all 6 sections, ads render for known advertisers, CompetitorLandscape under budget, no "Queued"-while-running, no "weird lines." Only then is any of this "done."

**Codex usage + resilience:** hand Codex (xhigh) reviewed specs for the mechanical ports (esp. the worker→lab LinkedIn/Foreplay lift) and bulk edits. If a Codex dispatch dies or doesn't report: re-dispatch, switch to a workflow implementer agent, or do it inline — **never drop the item.** Track every task to closed.

---

## 4. Guardrails & definition of done

**Do NOT break (these are load-bearing and recently hardened):**
- The fabrication/provenance gate: `structuralVerifier`, `evaluateEvidenceSupport`, `checkVoiceOfCustomerSelfSourcing`, `checkDemandIntentKeywordProvenance` (T3, today), `deriveGroundedConfidence`. Streaming work must not surface ungated content as committed.
- T1 enum-snap (`snapCreativeType`), T2 status CAS guard, T4 LinkedIn provenance (correct it, don't delete the honest part).
- The customer-safe activity allowlist (`section-activity.ts`) — the 2026-05-29 leak fix. Re-verify on every newly surfaced field.

**Gates (every phase):** `npm run build` 0, `npm run lint` 0 errors (≤67 warns), `npm run test:run` ≥1228 pass. **Run the gate in a way that doesn't clobber a live dev server's `.next`** (today's lesson: a prod `npm run build` while `next dev` shares `.next` corrupts dev route resolution — build in isolation or clear `.next` + restart dev after).

**Definition of done (per the doctrine):** behaviorally proven on a live E2E, not just unit-green. Push/deploy stays **user-gated**.

---

## 5. Appendix

### 5a. Ad-API sandbox script spec (Phase 0)
Standalone `tsx` (no Next, no Clerk), `SEARCHAPI_KEY` in env. For advertiser ∈ {Notion/notion.so, ClickUp/clickup.com, Asana/asana.com}:
- Call `adLibraryAgentTool.execute({advertiser, platform, max_results:4, domain}, {abortSignal, messages:[]})` for platform ∈ {google, meta}.
- ALSO replicate the raw 2-step SearchAPI fetches and log candidates + verdict + raw rows + filtered rows:
  - **Google:** `engine=google_ads_transparency_center_advertiser_search&q=<brand>&region=US` → pick `advertisers[].id` → `engine=google_ads_transparency_center&advertiser_id=<id>&region=US` → `ad_creatives[]`.
  - **Meta:** `engine=meta_ad_library_page_search&q=<brand>` → pick `page_results[].page_id` → `engine=meta_ad_library&page_id=<id>&active_status=all` → `ads[]`.
  - **LinkedIn (after port / to validate the engine exists on the plan):** `engine=linkedin_ad_library` (see worker `adlibrary.ts:746` for params).
- **Interpretation:** ads pre-filter > 0 but artifact 0 ⇒ over-filter (#3). Candidates present, ads empty ⇒ true-empty (#2). 401/403 ⇒ key invalid. Empty for a brand you KNOW advertises + key valid ⇒ Vercel-env-missing (#1). Bounded cost ~12 requests; **no loops without an abort condition** (paid API rule).

### 5b. SpyFu / keyword path (if Demand Intent is also suspect)
`keyword-volume.ts:47` reads `SPYFU_API_KEY`; `keyword-ad-probe.ts:45` reads `SEARCHAPI_KEY`. Same sandbox technique.

### 5c. Out of scope for this handoff (per user)
- **Onboarding "Next field" button — NOT a bug; the user confirmed it works.** Onboarding UI is a **separate, later conversation** the user will direct. (Investigation noted a latent radio-field focus gap in `onboarding-wizard.tsx:193-206` for group fields like `acv` — record it for that future conversation; do **not** touch it now.)

### 5d. Source investigation
Full 7-agent findings (raw): this session's workflow `wf_27f1202e-54a`. Prior context: `docs/2026-06-01-live-run-verdict-ramp.md`, `docs/2026-06-01-codex-live-run-handoff.md`, `docs/audit/2026-05-27-tool-layer-ad-engine-kinks.md` (H2/H3 now stale), ADRs `0002`/`0006`.
