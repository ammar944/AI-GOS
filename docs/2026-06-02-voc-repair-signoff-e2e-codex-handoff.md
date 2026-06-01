# Codex Handoff (v2) — E2E re-sign-off after VoC/repair-storm/stale-card fixes

**Author:** Claude (HQ, ultracode) · **Date:** 2026-06-02 · **For:** Codex (`-c model_reasoning_effort=xhigh`)
**Branch:** `feat/v2-lab-section-wire` · **Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
**HEAD under test:** `304a35a1`. Code under test = the 3 fix commits `83a9798f` (lab repair-storm/VoC/abort) + `f1efecf8` (terminal-write) + `3f5a3973` (vitest timeout), base `8243ac52`; commits above `451062d8` (`b8520866`, `304a35a1`) are docs-only. **48 ahead of `origin/main`, unpushed.**

> Supersedes `docs/2026-06-01-voc-repair-signoff-e2e-codex-handoff.md`. The only material change: the `_capabilities`/`orchestrate_supported` preflight that stopped the 2026-06-02 attempt is a **phantom gate** — waive it (§3). Everything else (the fixes, gates, pass/fail criteria) is unchanged.

---

## 0. Why the last attempt stopped (and why it was a false alarm)

The 2026-06-02 attempt cleared Clerk (the real `/research-v2` form rendered) but then halted on a **self-added `_capabilities` preflight that is not a real precondition**. Root-caused by a code trace + adversarial review (high confidence). The capabilities signal is **diagnostic-only and has zero runtime consumers**:

- **`GET /api/research-v2/_capabilities` returning 404/HTML = the caller was UNAUTHENTICATED**, not a broken route. The route always returns HTTP 200 by its own logic (worker failures fold into the JSON body as `worker_reachable:false` + `lastError`). It's Clerk-protected (`/api/research-v2/*` isn't in the middleware public allowlist; the matcher covers `/(api)(.*)`), so an unauthenticated curl gets sign-in HTML. Hit it from the authenticated browser if you want the JSON — but you don't need to.
- **`orchestrate_supported: false` is the correct, intended steady state.** The worker hardcodes it `false` (`research-worker/src/index.ts:134` → `capabilities.ts:72`) because the 6 positioning sections now run **in-process in Next.js**, not on the worker. The worker exposes only `/health`, `/capabilities`, `/run`, `/abort` — **no `/orchestrate` route and no lab/positioning runner**.
- **Nothing reads `orchestrate_supported` as a gate.** Zero runtime consumers in `src/` outside the producer file. The submit path (`research-v2/page.tsx:431` → `POST /api/research-v2/orchestrate`) fires unconditionally; the orchestrate route gates ONLY on Clerk auth (401), session ownership (404), and `corpusReady()` (409).

**→ Do NOT curl `/_capabilities` unauthenticated, and do NOT require `orchestrate_supported: true` before dispatching. Drive the run through the authenticated UI (§4).**

---

## 1. What changed (the fixes under test)

Root-caused by a 14-agent diagnostic workflow + adversarial verification (all 4 load-bearing claims CONFIRMED). One spine (a wasted-repair storm) fed the VoC timeout and B4 latency; one independent state bug froze the card on failure.

1. **Repair-trigger re-tied to the evidence gate** (`run-section.ts`). The repair loop fired on the raw *presence* of any unsupported claim while the gate (`maxUnsupportedAllowed`, **Infinity by default**) never rejected — so every section burned up to 2 full tool-heavy re-runs grounding claims it would accept anyway. Now `shouldRepairAttempt()` only repairs on a null artifact (real schema/Zod fail) or an unsupported count that *exceeds* the gate. Under the default gate, unsupported-claim repairs are a no-op (provably no-worse: those artifacts already committed today).
2. **Failure path now writes BOTH tables** (`supabase-webhook-adapter.ts`). `markSectionError` updated only `research_section_runs`; the committed artifact row (`research_artifact_sections`) was left frozen at `running, error=null` (the stale-card / sourceCount=0 symptom). It now cascades a guarded terminal error to the projector row (only when the run row actually transitioned; `.neq('status','complete')` so it can't clobber a committed sibling).
3. **VoC candidate prepass bounded** (`run-section.ts`, `voiceOfCustomerPrepassDeadlineMs = 45_000`). The prepass ran 3 serial live tool calls with no deadline; now it's wrapped in a timeout signal and **degrades to partial candidates** on abort instead of orphaning at the 270s job timeout.
4. **Repair loops yield to the 270s abort** (`input.signal?.aborted` guard) so an aborted section commits its best attempt / fails cleanly rather than racing the controller into an orphaned `running` row.

Tests updated to the corrected gate-tied contract (`run-section-corpus-only.test.ts`, `supabase-run-store.test.ts`).

## 2. NOT done (deliberate, documented)

- **No ad-probe deadline trim** (30s kept). B3 ad creatives currently PASS; trimming risks regressing working ad yield for latency that fix #1 already addresses.
- **No cumulative cross-path section budget** (#3c/#4a). With the repair storm gone, urgency drops; flagged `needsLiveE2E`. Calibrate from this run's data, then decide.
- No migration applied. Terminal-write fix is TS-only. `20260601_research_section_events_zone_index.sql` stays unapplied (user-gated). No push/deploy.

## 3. PRECONDITION A — build gates (re-confirm before the paid run)

```
npx tsc --noEmit            # expect 0 errors  (HQ: 0 ✓)
npm run lint                # expect 0 errors (~66 baseline warnings ok)  (HQ: 0/66 ✓)
npm run test:run            # expect 1287 passed, 1 skipped  (HQ: 1287/1 ✓)
npm run build               # expect compiled successfully  (HQ: ✓)
cd research-worker && npm run build   # expect clean  (HQ: clean ✓)
```

**Read the ACTUAL tsc/test/build error count, not a piped exit code** (`| tail` masks the real exit). The 2026-06-02 preflight already confirmed all five green at this HEAD.

**Vitest flakiness is fixed:** `testTimeout`/`hookTimeout` raised to 20s in `vitest.config.ts`. The suite is reliably **1287 passed / 1 skipped**. If you see failures, capture whether they are timeouts before calling it a regression.

## 3b. PRECONDITION B — the REAL run preconditions (gate on THESE, not on capabilities)

1. **Authenticated Clerk browser session.** Orchestrate 401s on actor mismatch / 404s on session-not-owned. Drive via the UI, not raw API curls.
2. **Worker reachable for the CORPUS stage only.** `deepResearchProgram` (the corpus) dispatches to the Railway worker `${RAILWAY_WORKER_URL}/run` (`src/lib/ai/tools/research/dispatch.ts:109-138`). So `RAILWAY_WORKER_URL` + `RAILWAY_API_KEY` must be set and worker `/health` must be 200 **before** you submit the GTM brief, or corpus never completes and orchestrate stays `409 corpus_not_ready` (correct behavior — wait it out). The local `:3001` worker satisfies this. **The worker is irrelevant to the 6-section fan-out itself.**
3. **Provider + search keys in the APP's env** (the in-process sections read them, not the worker): `ANTHROPIC_API_KEY` (default `claude-sonnet-4-5`; or `DEEPSEEK_API_KEY` if `LAB_ENGINE_PROVIDER=deepseek-direct`, which hard-throws if absent), plus `SEARCHAPI_KEY` / `BRAVE_SEARCH_API_KEY` for live tools (missing → graceful `credentialGap`, thin run, not a crash). Local `npm run dev` reads these from `.env.local`.
4. **Click "Start fresh", not "Resume."** The stale "Resuming research on ramp.com — last updated 6/1" banner reuses a possibly-stale corpus. Start fresh re-dispatches a clean corpus + new session.

## 4. THE RUN — ~$2, ONE run only, NO loop, NO retry. Do NOT edit source while it's live.

1. `npm run dev` (app `:3000`; lab engine runs in-process in Next). Worker reachable on `:3001` (or point at the deployed Railway worker).
2. Authenticated browser → `http://localhost:3000/research-v2` → **Start fresh**. Clerk login (`ammarv67@gmail.com`) is **code-based — ASK the user for the code** at that moment.
3. Enter `ramp.com` → let corpus/deepResearchProgram complete (the only worker-dependent step; expect `409` on orchestrate until it's done — that's correct, wait for it) → GTM Brief review → submit.
4. Submit fires a single `POST /api/research-v2/orchestrate {executionMode:'lab'}` → 6-section fan-out in-process → capstones (Synthesis + Paid Media).
5. Watch to completion via the Audit Reader (polls in-process `/api/research-v2/audit-state`). Screenshot each checkpoint.

## 5. PASS/FAIL CRITERIA — report each with screenshot + DB evidence (Supabase MCP, project AIGOS, ref `sidrtuxpqftyzwdusdha`)

| # | PASS condition |
|---|---|
| **VoC completes (P0)** | `positioningVoiceOfCustomer` reaches `complete` with sources > 0. If it still fails, it must fail **cleanly**: `research_section_runs.status='error'` AND `research_artifact_sections.status='error'` (NOT a frozen `running, error=null`). |
| **No stale cards** | For EVERY section: `research_section_runs.status` and `research_artifact_sections.status` agree on a terminal state. No row with run=`error`/`complete` but artifact=`running`. |
| **Repair storm gone** | `research_section_events` repair-event count per section drops from 5-6 toward ~0-1. Near-zero `repair-started` under the default Infinity gate. |
| **B4 latency** | CompetitorLandscape elapsed drops sharply from 273.9s (projected ~50-90s once the repair multiplier is gone). |
| **B2 commit** | Each section commits a typed card; partial JSON streams then is replaced. Note any schema/Zod repair (e.g. PaidMedia `creativeStrategy.angleTypesInMix[]` enum drift) — those are `artifact===null` repairs and are EXPECTED to still fire (fix #1 keeps them). |
| **B3 ads** | CompetitorLandscape still renders real ad creatives (regression check — we did NOT trim the ad probe). |

## 6. CALIBRATION DATA TO CAPTURE (decides the deferred #3c/#4a)

From `research_section_runs.telemetry` + `research_section_events` timeline, per section (esp. VoC):

1. **VoC prepass wall-clock** — how long the candidate prepass took, and whether the 45s deadline fired (degraded to partial).
2. **Per-section repair count** — confirm the storm is gone; note any section that still repairs (and why: null-artifact vs gate-exceeded).
3. **VoC total elapsed** — did it fit under 270s? If it still times out, the cumulative cross-path section budget (#3c/#4a) becomes load-bearing — report the breakdown.
4. **Dominant validation failure** (if any) — strict Zod parse (enum/url/8192-token truncation) vs `validateMinimums` cardinality. If token-truncation on high-cardinality sections, a `structuredOutputMaxTokens` raise is the next lever.

## 7. REPORT

Pass/fail per criterion with screenshots + DB query results + the `run_id`. If a criterion fails, give the root-cause signal (DB row + screenshot) — do NOT fix it in this run; hand it back to HQ with the calibration data above.

## 8. Known deploy-time follow-up (does NOT affect this local run)

`next.config.ts` `outputFileTracingIncludes` traces `SKILL.md` into the `/api/research-v2/orchestrate` lambda, but the code that `readFile`s it (`loadLabSkill`, `lab-section-job.ts:114-130`) actually executes in the **`/api/research-v2/run-lab-section`** lambda's `after()` callback. On **Vercel** that mis-target could `ENOENT` → all sections fail with zero data. Under local `next dev` (single process, full repo on disk at `process.cwd()`) it's a non-issue. Flag for the eventual deploy; do not fix during this run.
