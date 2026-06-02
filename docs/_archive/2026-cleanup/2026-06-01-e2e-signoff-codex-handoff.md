# Codex Handoff — Consolidated E2E live sign-off (research-v3)

**Author:** Claude (HQ) · **Date:** 2026-06-01 · **For:** Codex (`-c model_reasoning_effort=xhigh`)
**Branch:** `feat/v2-lab-section-wire` · **Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
**HEAD:** `9d291734` (B2 streaming + both QA-fix rounds; gates green: tsc 0 · lint 0 · 1248 tests · build pass)

## Goal
ONE real audit run that behaviorally proves all the recent fixes work together, using the connected browser. This is the sign-off for B1, B2, B3, B4, and T2 — closes tasks #7 and #5.

## What this run is proving (commits under test)
- `5395cf9b` — B1 per-zone event feed + index, T2 telemetry-clobber guard, B4 ad-probe concurrency
- `5032eb7f` — B1 "Queued" relabel + skeleton kill
- `b05e406b` — B3 advertiser-name normalization, B4 repair-storm fix
- `f2764f7b` + `245c91a` + `9d291734` — B2 gate-safe artifact streaming (+ QA fixes)

## PRECONDITION — gates green before the paid run (capture output)
```
npx tsc --noEmit            # expect 0
npm run lint                # expect 0 errors (~66 baseline warnings OK)
npm run test:run            # expect 1248 passed, 1 skipped
npm run build               # expect pass
cd research-worker && npm run build   # capture ITS OWN baseline; worker has pre-existing @types gaps
```
If anything regressed vs those baselines, STOP and report — do not run the paid audit.

## THE RUN — ~$2, ONE run only, NO loop, NO retry. Do NOT edit source while it's live.
1. `npm run dev` (the lab engine runs in-process in Next — no separate worker needed for the 6 sections).
2. Open the connected browser at `http://localhost:3000/research-v2`. Log in with Clerk (`ammarv67@gmail.com`) — it's a **code-based login, so ASK the user for the code** at that moment (you can't pre-fill it).
3. Enter a real company URL — use **`ramp.com`** — and follow the form-driven flow:
   URL → corpus/deepResearchProgram → GTM Brief review → submit → 6-section fan-out.
4. Watch the whole run to completion. Screenshot each checkpoint below.

## PASS/FAIL CRITERIA — report each explicitly with a screenshot + DB evidence
| Bottleneck | PASS condition |
|---|---|
| **B1 feed** | Every RUNNING zone shows live activity in its feed; no zone sits silent while siblings are active. |
| **B2 stream** | For ≥1 section, a "Drafting…" view fills in progressively, **sub-sections at the top level (not collapsed under one "Body" group)**, then the committed typed card REPLACES it. No white-screen on partial JSON. Bonus: confirm a section that **repairs** still streams (seq-monotonic fix). |
| **B3 ads** | CompetitorLandscape renders REAL ad creatives (not a "no ads" gap). |
| **B4 latency** | CompetitorLandscape completes without the old 186s/4-repair storm — notably lower latency, low repair count. |
| **T2 telemetry** | NO section whose status is `complete` displays a "Needs review"/"failed" phase. |

## DB CROSS-CHECK — Supabase MCP, project **AIGOS**, ref `sidrtuxpqftyzwdusdha`
- `research_section_runs`: status, telemetry, timings, repair count per zone (B4, T2).
- `research_artifact_sections`: committed bodies carry `data.verification` (gate ran); the committed `verdict` ≠ `statusSummary` and both read as authored text, not a truncated prose dump (B2 FIX-1); CompetitorLandscape body has non-empty `adEvidence` groups (B3).
- `research_section_events`: NOT flooded with partial rows (B2 partials are ephemeral broadcast, not DB writes).

## CONSTRAINTS
- No push, no deploy. Do NOT apply the T1 index migration (`20260601_research_section_events_zone_index.sql`) — user-gated.
- One paid run maximum — if a criterion fails, capture the evidence (DB row + screenshot) and STOP rather than re-running or attempting a fix in this run.
- Don't read `.env`.

## REPORT
Pass/fail per the 5 criteria, with screenshots + DB query results, plus the `run_id` so HQ can inspect. If a criterion fails, give the root-cause signal you saw (DB row + screenshot) — don't fix it in this run; hand it back to HQ.
