# Codex Handoff — E2E re-sign-off after VoC/repair-storm/stale-card fixes

**Author:** Claude (HQ, ultracode) · **Date:** 2026-06-01 · **For:** Codex (`-c model_reasoning_effort=xhigh`)
**Branch:** `feat/v2-lab-section-wire` · **Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
**Base tested in the failing run:** `8243ac52` (run `210ee90b`). This handoff is for the run that proves the new fixes on top of it.

> **⚠️ SUPERSEDED 2026-06-02 →** read `docs/2026-06-02-voc-repair-signoff-e2e-codex-handoff.md` instead. The `_capabilities`/`orchestrate_supported` preflight that blocked the 2026-06-02 attempt is a **phantom gate** (auth-gated diagnostic endpoint + the worker deliberately hardcodes `orchestrate_supported:false` because the 6 sections run in-process). Waive it. The consolidated handoff carries the corrected preconditions and run sequence; the fixes/gates/criteria below are unchanged.

## What changed (the fixes under test)
Root-caused by a 14-agent diagnostic workflow + adversarial verification (all 4 load-bearing claims CONFIRMED). One spine (a wasted-repair storm) fed the VoC timeout and B4 latency; one independent state bug froze the card on failure.

1. **Repair-trigger re-tied to the evidence gate** (`run-section.ts`). The repair loop fired on the raw *presence* of any unsupported claim while the gate (`maxUnsupportedAllowed`, **Infinity by default**) never rejected — so every section burned up to 2 full tool-heavy re-runs grounding claims it would accept anyway. Now `shouldRepairAttempt()` only repairs on a null artifact (real schema/Zod fail) or an unsupported count that *exceeds* the gate. Under the default gate, unsupported-claim repairs are a no-op (provably no-worse: those artifacts already committed today).
2. **Failure path now writes BOTH tables** (`supabase-webhook-adapter.ts`). `markSectionError` updated only `research_section_runs`; the committed artifact row (`research_artifact_sections`) was left frozen at `running, error=null` (the stale-card / sourceCount=0 symptom). It now cascades a guarded terminal error to the projector row (only when the run row actually transitioned; `.neq('status','complete')` so it can't clobber a committed sibling).
3. **VoC candidate prepass bounded** (`run-section.ts`, `voiceOfCustomerPrepassDeadlineMs = 45_000`). The prepass ran 3 serial live tool calls with no deadline; now it's wrapped in a timeout signal and **degrades to partial candidates** on abort instead of orphaning at the 270s job timeout.
4. **Repair loops yield to the 270s abort** (`input.signal?.aborted` guard) so an aborted section commits its best attempt / fails cleanly rather than racing the controller into an orphaned `running` row.

Tests updated to the corrected gate-tied contract (`run-section-corpus-only.test.ts`, `supabase-run-store.test.ts`).

## NOT done (deliberate, documented)
- **No ad-probe deadline trim** (30s kept). B3 ad creatives currently PASS (5 real creatives); trimming risks regressing working ad yield for latency that fix #1 already addresses.
- **No cumulative cross-path section budget** (#3c/#4a). With the repair storm gone, its urgency drops; the synthesis flagged it `needsLiveE2E`. The comment block at `answerToolTimeoutMs` documents the per-attempt-not-cumulative caveat. Calibrate from this run's data, then decide.
- No migration applied. Terminal-write fix is TS-only (no schema change). `20260601_research_section_events_zone_index.sql` stays unapplied (user-gated). No push/deploy.

## PRECONDITION — gates (HQ already ran these; re-confirm before the paid run)
```
npx tsc --noEmit            # expect 0 errors  (HQ: 0 ✓)
npm run lint                # expect 0 errors (~66 baseline warnings ok)  (HQ: 0/66 ✓)
npm run test:run            # expect 1287 passed, 1 skipped  (HQ: 1287/1 ✓)
npm run build               # expect compiled successfully  (HQ: Compiled successfully ✓)
cd research-worker && npm run build   # expect clean (untouched by these fixes)  (HQ: clean ✓)
```
IMPORTANT lesson for the verifier: read the ACTUAL tsc/build error count, not a piped exit code (`| tail` masks the real exit). If anything regressed vs these baselines, STOP and report — do not run the paid audit.

GATE FLAKINESS FIXED (2026-06-02): the 2026-06-02 Codex preflight saw 8 "failures" that were all vitest 5s-default TIMEOUTS on heavy jsdom integration/UI + Supabase-mock tests under load (proven: all 66 of those tests pass with `--testTimeout=20000`; a timed-out test cascades into 2 sibling assertion fails via shared mock state). NONE were from the lab fixes (the lab-engine test runs in 241ms here). Fixed by raising `testTimeout`/`hookTimeout` to 20s in `vitest.config.ts`. The full suite is now reliably **1287 passed / 1 skipped**. If you still see >0 failures, capture which tests and whether they are timeouts before treating it as a real regression.

## THE RUN — ~$2, ONE run only, NO loop, NO retry. Do NOT edit source while it's live.
1. `npm run dev` (lab engine runs in-process in Next — no separate worker needed for the 6 sections).
2. Connected browser → `http://localhost:3000/research-v2`. Clerk login (`ammarv67@gmail.com`) is **code-based — ASK the user for the code** at that moment.
3. Enter `ramp.com` → corpus/deepResearchProgram → GTM Brief review → submit → 6-section fan-out → capstones (Synthesis + Paid Media).
4. Watch to completion. Screenshot each checkpoint.

## PASS/FAIL CRITERIA — report each with screenshot + DB evidence (Supabase MCP, project AIGOS, ref `sidrtuxpqftyzwdusdha`)
| # | PASS condition |
|---|---|
| **VoC completes (P0)** | `positioningVoiceOfCustomer` reaches `complete` with sources > 0. If it still fails, it must fail **cleanly**: `research_section_runs.status='error'` AND `research_artifact_sections.status='error'` (NOT a frozen `running, error=null`). |
| **No stale cards** | For EVERY section: `research_section_runs.status` and `research_artifact_sections.status` agree on a terminal state. No row with run=`error`/`complete` but artifact=`running`. |
| **Repair storm gone** | `research_section_events` repair-event count per section drops from 5-6 toward ~0-1. Expect near-zero `repair-started` events under the default Infinity gate. |
| **B4 latency** | CompetitorLandscape elapsed drops sharply from 273.9s (synthesis projects ~50-90s once the repair multiplier is gone). |
| **B2 commit** | Each section commits a typed card; partial JSON streams then is replaced. Note any schema/Zod repair (e.g. PaidMedia `creativeStrategy.angleTypesInMix[]` enum drift) — those are `artifact===null` repairs and are EXPECTED to still fire (fix #1 keeps them). |
| **B3 ads** | CompetitorLandscape still renders real ad creatives (regression check — we did NOT trim the ad probe). |

## CALIBRATION DATA TO CAPTURE (decides the deferred #3c/#4a)
From `research_section_runs.telemetry` + `research_section_events` timeline, capture per section (esp. VoC):
1. **VoC prepass wall-clock** — how long the candidate prepass took, and whether the 45s deadline fired (degraded to partial).
2. **Per-section repair count** — confirm the storm is gone; note any section that still repairs (and why: null-artifact vs gate-exceeded).
3. **VoC total elapsed** — did it fit under 270s? If it still times out, the cumulative cross-path section budget (#3c/#4a) becomes load-bearing — report the breakdown so HQ can size it.
4. **Dominant validation failure** (if any) — strict Zod parse (enum/url/8192-token truncation) vs `validateMinimums` cardinality. If token-truncation on high-cardinality sections, a `structuredOutputMaxTokens` raise is the next lever (not covered by these fixes).

## REPORT
Pass/fail per criterion with screenshots + DB query results + the `run_id`. If a criterion fails, give the root-cause signal (DB row + screenshot) — do NOT fix it in this run; hand it back to HQ with the calibration data above.
