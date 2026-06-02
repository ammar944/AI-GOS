# Codex Handoff — remaining research-v3 tasks (post-fix-wave)

**Author:** Claude (HQ) · **Date:** 2026-06-01 · **For:** Codex (`-c model_reasoning_effort=xhigh`)
**Branch:** `feat/v2-lab-section-wire` · **Worktree:** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`
**HEAD:** `738558f8` · **Remote:** not pushed (everything below is local until the user authorizes push/deploy)

This is the master handoff for what's LEFT. The hard engineering (B1/B2 streaming, B3/B4/T2 fixes) is committed and gate-verified; the remaining work is one decision-gating live run plus a few conditional follow-ups and user-gated steps.

---

## Where things stand (committed + verified)

| Area | Status | Commits |
|---|---|---|
| B1 feed silence + index | done, QA-clean | `5395cf9b`, `5032eb7f` |
| B2 gate-safe artifact streaming | done, 3 QA rounds, **PASSED live** | `f2764f7b`, `245c91a`, `9d291734` |
| B3 ads (primary) + B4 repair-storm (primary) | done | `b05e406b`, `5395cf9b` |
| T2 telemetry-clobber guard | done, QA-clean | `5395cf9b` |
| **Sign-off fix wave** (FIX-1 sources channel · FIX-2 competitor seeds · FIX-3 commit error-clear · FIX-4 B4 prompt) | done, QA-clean (caught+fixed a digit-brand P2) | `d28da121` |
| Onboarding wizard simplification | landed | `738558f8` |

Gates at HEAD: `tsc` 0 · `lint` 0 errors · `test:run` 1254 passed / 1 skipped · `build` pass.

The first E2E sign-off (run `403002a8`, ramp.com) **passed B1 + B2** and failed B3/B4/T2/VoC — all four of those root causes are fixed in `d28da121`. **What remains is to behaviorally confirm those fixes on a fresh run, then close out.**

Detailed context docs (read as needed): `docs/2026-06-01-e2e-signoff-codex-handoff.md` (the run spec), `docs/2026-06-01-signoff-fixes-codex-handoff.md` (what the fixes were + why), `docs/2026-06-01-b2-streaming-codex-buildspec.md`, `docs/2026-06-01-next-tasks-codex-handoff.md`.

---

## Operating constraints (unchanged, non-negotiable)
- Never read/print `.env`. Paid APIs never loop (a full run is ~$2; **one run at a time**).
- Don't edit source while a live run is active (hot-reload corrupts it).
- Commit atomically; **NO push, NO deploy, NO migration apply** unless the step says it's the user's explicit go.
- The fabrication/provenance gate and the `SUPABASE_SERVICE_ROLE_KEY` server-only boundary are sacred — don't weaken either.
- Lab engine runs in-process in Next (`npm run dev`) — no separate worker needed for the 6 sections.

---

## TASK 1 (P0, DO FIRST — this gates everything else): Re-sign-off live run

**Goal:** behaviorally confirm the fix wave on a fresh ~$2 run. This is the pivot — Tasks 2 & 3 only fire based on its result.

**Spec:** follow `docs/2026-06-01-e2e-signoff-codex-handoff.md` exactly, but **HEAD is now `738558f8`** and the focus is the previously-failing criteria.

**Steps:** gates green first (`tsc`/`lint`/`test:run`/`build` + worker build) → `npm run dev` → log in at `/research-v2` (Clerk `ammarv67@gmail.com`, ask the user for the code) → ONE run on **ramp.com** → watch to completion.

**Re-check criteria (the four that failed before):**
| Was | Now must show | DB cross-check (Supabase MCP, ref `sidrtuxpqftyzwdusdha`) |
|---|---|---|
| VoC `status=error` (sources<5) | VoC commits `status=complete` with **≥5 sources** | `research_section_runs` VoC status; `research_artifact_sections` VoC `source_count >= 5` |
| OfferDiagnostic complete-with-error | `status=complete` AND `error=null` | `research_section_runs` OfferDiagnostic `error IS NULL` |
| B3 `ad_creative_count=0` | CompetitorLandscape renders **real ad creatives** | CompetitorLandscape body `adEvidence` groups have creatives > 0 |
| B4 169s / 4 repairs | CompetitorLandscape **repair_count drops** (ideally ≤1) | `research_section_runs` CompetitorLandscape telemetry/timings |
Plus B1 (every running zone's feed live) and B2 (drafting streams → committed card, no white-screen) must still PASS.

**Report:** pass/fail per criterion + `run_id` + screenshots. One run, no loop, no fixes mid-run.

**Decision tree from the result:**
- All green → sign-off PASSES → go to Task 4 (migration) + Task 5 (push/deploy), both user-gated.
- B3 still 0 creatives → Task 2.
- B4 still high repairs/latency → Task 3.
- VoC still <5 / any structural fail → STOP, capture DB evidence, hand back to HQ (likely a prompt/skill tune, not a code bug).

---

## TASK 2 (conditional — only if Task 1 shows B3 still 0 creatives): widen ad yield

**Goal:** real ad creatives in CompetitorLandscape. FIX-2 cleaned the competitor names; if creatives are still 0, the issue is yield/source-coverage, not names.

**Steps:**
1. Confirm the cleaned seeds reached the probe: check the live run's CompetitorLandscape `adEvidence` advertiserGroups — are the advertiser names now real brands (Brex/BILL/Amex), and are the groups "gap" rows (no creatives found) vs creatives-dropped-in-normalization?
2. If advertisers resolve but SearchAPI returns no creatives → likely the lab path is **Google+Meta only**. The full engine (LinkedIn+Meta+Google+Foreplay, ~1429 lines) is orphaned in `research-worker/src/tools/adlibrary.ts`. Port the LinkedIn + Foreplay adapters into the lab ad path. **Must rewrite** `competitor-ad-adapter.test.ts` + `adlibrary.test.ts`. Mind the lookup budget (`maxExternalLookups`/`adReservedLookups`).
3. If budget exhaustion → rebalance the budget constants for the competitor zone.

**This is the larger optional lift — confirm with the user before the LinkedIn/Foreplay port** (it touches paid-API surface + budget). Verify with a follow-up single run.

---

## TASK 3 (conditional — only if Task 1 shows B4 still storms): competitor-URL grounding

**Goal:** cut CompetitorLandscape's evidence-gate repairs. FIX-4 did the prompt-only part (cite only fetched URLs). The deeper fix is grounding.

**Steps:** seed the evidence transcript with the resolved competitor official URLs (from the now-clean `competitorSeeds`/onboarding `topCompetitors`) + at most one fetch per competitor pricing page, so cited `bill.com/concur.com/navan.com` URLs verify instead of being flagged unsupported. **Stay within** `definition.maxExternalLookups`/`adReservedLookups` so it doesn't starve the ad probe — if it can't fit the budget, propose a budget rebalance rather than silently over-spending. Verify repair_count drops on a follow-up run.

---

## TASK 4 (USER-GATED): Apply the T1 zone-index migration

`supabase/migrations/20260601_research_section_events_zone_index.sql` — additive, reversible index `(artifact_id, zone, created_at desc)` on `research_section_events`. Authored, **not applied**. When the user authorizes: apply to AIGOS DB (ref `sidrtuxpqftyzwdusdha`) via Supabase MCP `apply_migration`. Plain `CREATE INDEX` (table is small; `CONCURRENTLY` was intentionally not used to stay txn-compatible with the apply path — revisit only if the table grows large).

---

## TASK 5 (USER-GATED): Push + deploy

When the user explicitly says go: push `feat/v2-lab-section-wire`, deploy (Vercel + Railway worker). Until then, everything stays local. The branch is well ahead of `main` and unpushed by standing policy.

---

## TASK 6 (optional housekeeping — only if the user asks)

The worktree has accumulated non-source dirt, left untouched:
- **`package-lock.json` modified** (unexplained — possibly a stray `npm install`). Inspect `git diff package-lock.json`; commit if intentional, else `git checkout` it.
- **~30 untracked `docs/`** (this session's handoff/spec docs — real artifacts worth a `docs:` commit) + a modified `.html` doc.
- **`tmp/`** screenshots + scratch — should be gitignored, not committed.

Suggested: one `docs:` commit for the handoff docs, resolve the lockfile, add `tmp/` to `.gitignore`. Don't bundle these with code commits.

---

## Task-tracker mapping
Task 1 = tracker #7 · Task 2 = tracker #5 · Task 4 = tracker #8 · Task 5 = tracker #9. Tasks 3 & 6 are new follow-ups surfaced by the sign-off + worktree state.

**Bottom line for whoever drives this:** run Task 1, read the result, and the decision tree tells you whether you're done (→ user-gated 4/5) or have a targeted follow-up (2 and/or 3). Don't run 2/3 speculatively — they're gated on Task 1's evidence.
