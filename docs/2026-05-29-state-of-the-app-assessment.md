# AIGOS State-of-the-App — Senior Staff Engineering Audit

**System of record:** worktree `v2-lab-section-wire` @ `25618cf8` (== `origin/main` == `origin/feat/v2-lab-section-wire`).
**Audit launched from (stale):** `codex/claude-managed-agents-work` @ `f9abec6f` — **129 commits behind main**. All findings below were re-verified against `origin/main`, not the checkout.
**Date:** 2026-05-29. **Read-only assessment.** Live streaming/latency QA was NOT run (the app was not started) — see Open Items.

---

## 1. Blunt Executive Verdict

**Where are we?** The thing that ships — the in-process DeepSeek "lab engine" (`src/lib/lab-engine/`, ~18.9k LOC) — is real, coherent, and NOT slop at its core: an orchestrator-workers fan-out of single augmented-LLM `ToolLoopAgent`s with an evaluator-optimizer answer tool. It typechecks at 0, has 1118 FE + 391 worker tests green, and builds clean.

**Are we building up to slop?** Yes — at the edges, not the core. **Three** agent architectures physically coexist on main (live lab engine + an orphaned Anthropic-hosted managed-agents runtime with a still-live HMAC webhook + a complete dead 6-agent worker topology). ~3,675 LOC of good tests run in CI against dead code; the repo carries 199 branches and 73 worktrees. This is a sound pivot followed by an **un-run teardown** (ADR-0006 Phase F) — recoverable in one deletion sprint, but decaying right now.

**On track for Manus-for-GTM grounded in Anthropic?** Half-true, and you must state it precisely. The agent design is Anthropic-doctrine-correct and the code provider **default** is Anthropic Sonnet — but production sections are intended to run **DeepSeek** (a reversible env switch). "Grounded in Anthropic" is true in idiom + code-default, false as the deployed section model.

**Is the technical wow there?** **No** — the weakest axis. The headline six-section audit is a 2.5s poll that POPS fully-formed cards in on commit; the per-section "phase" is hardcoded to "Reading sources" for the whole multi-minute run; the documented "Wave X of Y" telemetry is dead UI. A complete AI SDK v6 streaming path exists but is **wired to nothing**.

---

## 2. The Central Architecture Tension — Resolved

**Claude Managed Agents (Anthropic-hosted coordinator)** vs **DeepSeek in-process lab engine.**

### Verdict: SOUND PRAGMATIC PIVOT, not thrash — with un-executed cleanup.

The team already resolved this on paper (**ADR-0006, accepted 2026-05-26**) and mostly in code:

- The hosted Managed Agents coordinator **never passed its 7-day live canary** (migration plan `docs/architecture/2026-05-19-...`: P1 code-complete, P2 ⛔ BLOCKED on the observation window, P3/P4 blocked).
- It is **129 commits behind main** — abandoned, not a competing live effort.
- On main, `orchestrate/route.ts:40` accepts **only** `executionMode: z.literal('lab')`; `startManagedAudit` has **zero** src callers (`git grep` on main → definition only).

By Anthropic's own *Building Effective Agents*, hosted multi-agent coordinators "add real cost: latency, debuggability, vendor lock-in, beta risk" and must earn their place. The hosted path didn't earn it. **Killing it was correct.** The lab engine cleanly hits the named patterns:

| Anthropic pattern | Lab-engine locus |
|---|---|
| Augmented LLM | `ToolLoopAgent` + tool catalog + `ResearchInput` memory (`section-agent.ts:374-409`) |
| Orchestrator-Workers | 6-way parallel fan-out (`orchestrate/route.ts:97` `Promise.allSettled(POSITIONING_SECTION_IDS.map(...))`) |
| Evaluator-Optimizer | `answer` tool returns `{__answerRejected, issues[]}` for self-repair (`answer-tool.ts:65-86`) |

This is good agent design **regardless of provider**.

### The remaining sin is not deleting the loser.
`src/lib/managed-agents/` (~5,639 LOC) sits orphaned, with a **live** HMAC webhook (`webhooks/managed-agents/route.ts:41` still `new ManagedAgentsClient()`, 500s if secret unset) for a flow nothing initiates. The worker compiles a **complete second 6-agent architecture** (`research-worker/src/agents/` 5,882 LOC + `agent-tools/` 1,121 LOC) self-labeled *"Retired positioning subagent prototype"* with zero live callers — still importing the Anthropic provider-native `web_search` the lab engine deliberately dropped.

### Founder's decision (recommendation + rationale)
1. **Ship the DeepSeek lab engine** as the section path. Provider is a reversible `LAB_ENGINE_PROVIDER` switch (code default = Sonnet) → healthy provider-agnosticism, not lock-in.
2. **Confirm prod env truth:** is Vercel `deepseek-direct` or the code-default Sonnet? MEMORY says a "no deploy" flag is active, so prod may not reflect intent. Decide deliberately: **DeepSeek** (~$0.10/run, 1M ctx, proven on live Ramp/Vanta/Webflow runs) vs **Sonnet** (better synthesis, the "Anthropic" story, ~10-20x cost).
3. **Execute ADR-0006 Phase F now** — finish burying the hosted path so the "two architectures" confusion stops being literally true.
4. **Correct the framing** to *"Anthropic-grounded agent design; provider-agnostic; currently running DeepSeek for cost."*

---

## 3. QA + Correctness — Green gates, soft verifier

**All six gates independently VERIFIED on the SOR:** FE tsc 0 · lint 0 errors/64 warnings · FE 1118 pass/1 skip · worker tsc 0 · worker 391 pass · `npm run build` exit 0 (**not** env-blocked; real `.env.local` present). Handoff numbers are accurate.

The persistence/idempotency core is genuinely well-engineered SQL (`seed_orchestration` reuse, `commit_artifact_section` revision-CAS with `for update nowait`, monotonic roll-up via `greatest()`, abort-guard, orphan reaper) and survives the 7×-seed-per-orchestrate fan-out.

**But green gates are necessary-not-sufficient.** Three correctness gaps they cannot catch:

1. **The "structural verifier gate" doesn't gate.** `unsupportedCount`/`verifiedCount` are computed and stored but **never compared to any threshold** (`git grep` for threshold comparisons on main → empty). The team's own fixture proves it: `synthetic-fabricated-price.json` → `unsupportedCount: 1, requiredClassesSatisfied: true`. **A fabricated price commits to the reader.** The only real gate, `checkRequiredEvidenceClasses`, is satisfiable by self-declaring one data-gap anywhere in the body.
2. **Card sourceUrls are shape-checked, never cross-bound.** Enforcement is only `/^https?:\/\/\S+\.\S+/` — nothing verifies the URL was fetched or appears in the artifact's own `sources[]`. Open fabrication vector for a source-grounded product. (The verifier *detects* a mismatch and marks it `unsupported`, but per #1 nothing acts on that.)
3. **Abort/stop is non-functional** on the in-process lab runtime: `abort-section` forwards to a worker `AbortController` map that has no controller for a Vercel in-process run; it can even stamp `aborted_at` in the DB while compute keeps burning. Zero tests, no UI caller.

**Ship-readiness:** GREEN for build/type/test; **YELLOW** for correctness. Verifier teeth + sourceUrl cross-binding are the gating items before charging money. No production soak (deploy not done); live streaming/latency QA not run.

---

## 4. The Technical Wow Gap (the Manus feel)

The "watch the agent think live, zero dead-air" experience **does not exist** on the headline surface. Verified on the SOR:

- **Cards POP IN on commit** — `audit-reader-shell.tsx:6-9` own comment: *"Poll-based, commit-on-complete... (no token streaming here)"*; body gated at `:1167` on `activeStatus === 'complete' && activeTyped`.
- **Poll, not stream/realtime** — `use-audit-state.ts:15` `POLL_MS = 2500`; zero `.channel(`/`postgres_changes`/`.subscribe(` on the audit path.
- **Phase is a static lie** — `buildLabSectionTelemetry` phase is type-locked to `'Reading sources' | 'Committed' | 'Needs review'`; the richer 8-value enum (`audit-state/route.ts:29-37`) is never emitted. "Reading sources" shows for the entire 2-9 min run.
- **"Wave X of Y" telemetry is DEAD** — `wave`/`totalWaves` exist only as always-null `pickNumber(telemetry.wave)` passthrough; fan-out fires all 6 at once, no waves, no concurrency limit. CLAUDE.md presents the waved model as shipping.
- **THE KICKER:** a complete idiomatic AI SDK v6 stream (`streamRunSection` @ `run-section.ts:3282`, `writeArtifactPartial` → `data-artifact-partial`, `consumePartialsUntilAbort`) exists with **ZERO callers on main** — dead code, not even mis-wired to chat. *The wow was built and disconnected.*

What the user DOES see live: a real but coarse per-tool event feed (web_search queries, source URLs), refreshed every 2.5s, capped at 12 events/zone.

**Fix needs no Anthropic revival** — wire the existing streaming writer, or persist partial prose to the DB and let the poll render growing text. **Top follow-up: run live streaming/latency QA — the app was never started in this audit.**

---

## 5. What's REAL (credit where due)

- **Live lab engine is disciplined:** 0 tsc errors; 9 TODO/FIXME in src + 1 in worker; of 183 test files, **zero** assert-nothing and **zero** `.skip/.todo`.
- **McKinsey-grade STRUCTURE:** typed schemas with real minimums (personas≥5, all 5 Schwartz awareness levels, firmographic cuts with source+sourceUrl+dateObserved), forces/competitors requiring `implication`/`whyItMatters`. Not generic-AI-summary territory.
- **Autonomy is more real than feared** — verification **REFUTED** the "corpus-only, live path stalls" finding: the cited s25/s26 quotes don't exist in the doc, live tools (Brave `web_search`) are the **code default**, and there's an accepted authenticated 3-URL proof (Ramp `749f38ff` / Vanta `1a0c4e2b` / Webflow `7d2b96e0`, each parent-complete + 6 children, p95 ~107-139s, 0 synthetic/0 example.com).
- **Single artifact writer + idempotent seeding** keeps the orchestrator-workers pattern honest (one `commitArtifactSection`; `seed_orchestration` RPC).

---

## 6. The Cut List (ranked slop inventory)

| # | Item | Severity | Action |
|---|---|---|---|
| 1 | Orphaned managed-agents runtime + **live HMAC webhook** (~5,639 LOC; `start-audit.ts:107` zero callers; `webhooks/managed-agents/route.ts:41`) | **HIGH** | Extract `buildCommitPatch` + `createSupabaseWebhookAdapter` (live deps via `supabase-run-store.ts:6-7`) into `research-v2/`, then delete runtime + route + `MANAGED_AGENTS_*` flags |
| 2 | Complete dead 6-agent worker topology (`research-worker/src/agents/` 5,882 + `agent-tools/` 1,121 LOC) + Anthropic `webSearch_20250305`; 9 duplicate tool files | **HIGH** | Delete both dirs + tests wholesale (worker TOOL_RUNNERS = corpus/identity/meeting only) |
| 3 | ~3,675 LOC of tests in CI against dead code | MED | Delete with their targets (#1, #2) |
| 4 | Duplicate section schemas (managed-agents vs lab-engine), renderer types against the orphan via `as unknown as` casts. *Down-graded by verification: tested `normalizePickedArtifact` is the real bridge — maintainability smell, not a live bug.* | MED | Make lab-engine schemas single source; keep normalizer as documented view-model boundary |
| 5 | Dead "Wave X of Y" telemetry (always-null fields; CLAUDE.md claims it ships) | MED | Implement bounded concurrency + emit fields, OR delete fields + UI copy + doc |
| 6 | Doc rot: CLAUDE.md `executionMode:'managed'`; CONTEXT.md + SKILL.md describe deleted worker `streamObject` path | MED | Rewrite to lab-engine reality |
| 7 | Repo entropy: 199 branches, 73 worktrees (nested, locked, prunable) | MED | `git worktree prune`; delete scratch branches; document canonical worktree |
| 8 | Stranded `MANAGED_AGENTS_*` flags | LOW | Kill with engine (#1) |
| 9 | Orphaned worker `streamObject` schemas; stale `orchestrate` route doc-comment | LOW | Sweep with #2; fix header to `{run_id, executionMode:'lab'}` |

*(Dropped per verification: Dimension E "critical — corpus-only / live path stalls" was **REFUTED**. Dimension C "managed-agents entire subsystem is dead" and "schema drift = live bug" were **PARTIAL** and down-weighted as shown above.)*

---

## 7. Ranked Recommendations

1. **(M) Wire the Manus wow.** Connect the built-but-dead `streamRunSection`/`writeArtifactPartial` to the audit, OR persist partial prose to `research_section_runs.telemetry` and let the poll render it. Then run live latency QA. *First resolve: can one SSE survive the ~13-min Vercel `after()` fan-out, or must it be per-section / DB-persisted-partials?*
2. **(M) Give the verifier teeth.** Make `unsupportedCount` a real commit gate (fail/force-repair below a verified/total threshold); cross-bind every card `sourceUrl` to `sources[]`/tool results. This is the core "are we building slop" risk, locus-specific.
3. **(M) Execute ADR-0006 Phase F + delete the worker dead-agent tree.** Removes ~12.6k LOC dead/dup code + ~3.7k LOC dead tests, closes the live webhook, ends the "two architectures" reality.
4. **(S) Confirm + decide the production provider** and fix the public framing to honest provider-agnostic wording.
5. **(S) Fix the frozen phase indicator; implement-or-delete "Wave X of Y."** Cheap honesty fixes that improve live-progress feel before full streaming lands.
6. **(S) Remove/re-point abort off the dead worker map; add a scheduled orphan reaper** (no `vercel.json` cron exists).
7. **(S) Sweep doc rot + prune repo entropy** to stop pointing the next engineer at a dead architecture.

---

## 8. Open Decisions for the Founder

1. **PROVIDER:** Confirm Vercel's `LAB_ENGINE_PROVIDER`, then choose DeepSeek (cost, proven live) vs Sonnet (synthesis quality, the Anthropic story, ~10-20x cost). Recommend DeepSeek + reversible switch + honest framing.
2. **TEARDOWN:** Approve Phase F execution now — the line between "sound pivot" and "accumulating slop."
3. **WOW vs CORRECTNESS sequencing:** Recommend verifier teeth before any paid use; streaming before any demo.
4. **VERIFIER ENFORCEMENT:** Set the verified/total threshold and the date the gate flips from observability to enforcement (confirm 5c6e82f2's "apply structural verifier gate" title isn't an overclaim).
5. **SOAK + LIVE QA:** No 48h prod soak; app never started this audit. Approve a soak + live latency pass before any "no dead-air / wow is done" claim.

---

## 9. Dimension Grades

| Dim | Title | Grade |
|---|---|---|
| A | Agent Architecture Coherence + Anthropic Grounding | **B / Pragmatic-but-cluttered** |
| B | Streaming + Technical "Wow" | **C- / Poll-and-Pop** |
| C | Anti-Slop (code + repo health) | **C / Thrash-Then-Settle** |
| D | QA + Correctness | **B- / Green gates, soft verifier** |
| E | Product Trajectory vs Vision | **B- / Real spine, unproven autonomy** |

**Bottom line:** Real spine, defensible pivot, missing teardown, and the Manus "watch it think" wow is unbuilt despite sitting in the repo as dead code. Not slop at the core; actively accumulating slop at the edges. One deletion sprint + one streaming wire-up + verifier teeth turns "good report generator" into the transparent, evidence-grade Manus-for-GTM you're aiming for.