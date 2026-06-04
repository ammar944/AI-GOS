# Truthgate v2 E2E Live Report

**Date:** 2026-06-04
**CWD:** `/Users/ammar/Dev-Projects/AI-GOS`
**Branch:** `feat/research-quality-truthgate`
**HEAD:** `e4b02d9476c497b5992ec4c3ea3b455e99782275`
**Run ID:** `cdfe8d6e-94b4-4c08-968b-b9aaf67aa8f4`
**Parent audit artifact:** `fa6878bc-bd0e-4cb3-bc59-99390dee26bc`
**Verdict class:** `LIVE_FAIL`

## 1. Verdict

This was the required single live Ramp run. It failed signoff.

The corpus completed, onboarding used the baseline economics payload verbatim, and five of six positioning sections committed. `positioningVoiceOfCustomer` ended in terminal `error` at 244.8s, leaving the parent at `children_complete=5`, `children_total=6`, `parent_status=queued`. Synthesis and paid-media capstones were not dispatched because the handoff required both only after 6/6.

No retry was run.

Primary failure: A2 did not unblock VoC live. The final VoC error was:

`body.painLanguage.quotes: source g2.com supplies 9 of 10 pain quotes (a single-source majority); draw pain language from multiple independent sources.`

Evidence:
- `10-audit-state-final.json`
- `11-db-rows.json`
- `RUN-ERROR.json`
- `next-dev.log`

## 2. Preflight

Preflight passed before spend:

| Check | Result |
|---|---|
| Branch / HEAD | `feat/research-quality-truthgate` / `e4b02d9476c497b5992ec4c3ea3b455e99782275` |
| Expected dirty tree | `M .gitignore`, `?? docs/2026-06-03-supabase-to-railway-migration-plan.md` |
| Dev server | `:3010` 200, started with `LAB_ENGINE_PROVIDER=deepseek-direct` |
| Worker | `:3001 /health` 200, `/capabilities` 200 |
| Env keys | Required run keys present; values not printed |
| `LAB_VERIFIER_MAX_UNSUPPORTED` | unset |
| Migration | verification columns selectable; `commit_artifact_section` RPC present |
| Auth sanity | baseline `audit-state` returned 200 for owner `user_38cLJEcQD4FBbI3Rni00d8N3lHD` |

Browser note: the Codex Browser plugin successfully signed into `/research-v3` and rendered the share page. Its screenshot command timed out repeatedly, so `screens/share-badge-dom.txt` captures the rendered DOM badge text instead of a PNG. `journey_sessions.profile_id` was null after the failed run, so a profile screenshot was not applicable.

## 3. Before/After Table

| Metric | Baseline (`74039a8f`) | v2 observed | Target / measure after |
|---|---|---|---|
| Full flow | 5/6, VoC errored, no capstones, parent `queued` | **FAIL: 5/6, VoC errored, no capstones, parent `queued`** | 6/6 + synthesis + paid-media complete |
| Offer confidence | 0.707 (29v/12u) - 12/12 unsupported were user economics | **0.55, 22v/18u, tier `needs_review`; 12 economics claims credited as `user_asserted`, but confidence missed bar** | >=0.85 and no false user-fact needs_review |
| Market | 0.456 (26v/31u) needsReview | **0.681, 32v/15u, tier `needs_review`** | meaningfully higher OR honestly labeled estimate-heavy |
| Demand | 0.583 (28v/20u) needsReview | **0.211, 12v/45u, tier `insufficient`** | numeric claims sourced or labeled model-estimate |
| Buyer | 0.617 (37v/23u) | **0.64, 32v/18u, tier `needs_review`** | personas sourced or marked hypothesis |
| Competitor | 0.906 (96v/10u), 53 sources, trance ad present | **0.889, 96v/12u, 54 sources, tier `verified`; trance-class Airbase ad still present** | trance ad gone; sourceCount >=40 |
| VoC | ERROR / failed | **ERROR at 244.8s; no committed artifact; DB row status `error`** | honest gap-report that completes; capstones unblocked |
| Aggregate | 216v/96u = 69.2% (substring noise) | **5 committed positioning sections: 196v/108u = 64.5%; stricter scoring exposed weakness** | entailment-based, meaningful |
| Trust surfacing | live reader only | **Partial: DB tiers non-null for 5 completed positioning sections; share DOM renders `Needs review ... 68% grounded`; profile not created** | needs_review on share + profile + insights |
| Latency/cost | n/a | **Completed sections 78.6s-120.1s; VoC errored at 244.8s; no section exceeded 255s but run failed** | all 6 complete within 255s/270s/300s; total about $2 |

## 4. Insight Results

| Insight | Result | Evidence |
|---|---|---|
| I1 - User economics credited | **PARTIAL / FAIL**. Offer credited 12 economics claims as `user_asserted` with `source.kind='userProvided'`, including `$12,000`, `$8,000`, `$120K`, `$75K/mo`, `20%`, and budget split percentages. But Offer confidence was only 0.55, below the >=0.85 pass bar. | `11-section-artifacts.json`, `12-verification-table.json` |
| I2 - Not a rubber stamp | **PASS**. Scores did not inflate: Demand dropped to 0.211 / `insufficient`, Offer dropped to 0.55, Market stayed `needs_review`. | `12-verification-table.json` |
| I3 - Latency/cost | **FAIL** because the run did not complete. Latency itself stayed below 255s for all observed sections; VoC failed at 244.8s. | `10-audit-state-final.json` |
| I4 - Fallback clean | **PARTIAL PASS**. The fallback warning fired multiple times. It did not hard-crash the completed sections, but the overall run still failed later on VoC validation. | `judge-fallback-grep.txt`, `next-dev.log` |
| I5 - VoC/capstones unblock | **FAIL**. VoC terminal `error`; parent remained 5/6; no synthesis or paid-media capstone dispatch. | `10-audit-state-final.json`, `11-db-rows.json`, `RUN-ERROR.json` |
| I6 - Tier persistence + surfaces | **PARTIAL / FAIL**. Tiers persisted for five completed positioning sections, but VoC/capstones failed and no profile was created. Share rendered a badge in DOM; Browser screenshot transport timed out. | `11-db-rows.json`, `screens/share-badge-dom.txt`, `screens/profile-badge-not-applicable.txt` |
| I7 - A4 quarantine | **FAIL**. Competitor sourceCount did not crater (54), but the off-topic Airbase trance ad remained in committed artifact. | `11-section-artifacts.json`, `13-term-hits.json` |
| I8 - Next round observations | **OPEN / OBSERVED**. Demand and Market still emit naked numerics (`$1B`, CPC-like dollar values, market-size and CAGR claims). Synthesis did not run, so synthesis-as-auditor remains unobserved. | `11-section-artifacts.json`, `13-term-hits.json` |

## 5. Key Runtime Findings

VoC failed for schema/minimum validation, not timeout. Firecrawl had exhausted the section budget after seven lookups; then VoC repair attempts kept returning invalid or single-source-majority quote sets. Final failure came from `g2.com` supplying 9 of 10 pain quotes.

A1 does credit user facts at claim level. The verifier marked 12 economics claims `user_asserted` and backed them with `userProvided` fields such as `economics.currentCac`, `economics.targetCac`, `economics.avgLtv`, `economics.monthlyAdBudget`, `economics.demoToClose`, and `economics.budgetSplit`. The remaining Offer output still had enough unsupported/refuted claims to leave confidence at 0.55.

The entailment fallback path did fire. `next-dev.log` contains multiple `[lab-section] entailment judge failed; using deterministic verifier` warnings. Completed sections still committed, so the fallback itself did not block the run; VoC failed later because its repaired quote set still violated schema/minimum evidence constraints.

A4 did not quarantine the known bad Airbase creative. The committed competitor artifact still contains: `NEW TRACK ALERT! Airbase - Everything Else Could Wait is out now!... Progressive trance... #TranceMusic #trancefamily`. This is a direct FAIL despite sourceCount staying healthy at 54.

A3 persistence works for completed sections. DB rows show:

| Zone | Status | Tier |
|---|---|---|
| `positioningBuyerICP` | complete | `needs_review` |
| `positioningCompetitorLandscape` | complete | `verified` |
| `positioningDemandIntent` | complete | `insufficient` |
| `positioningMarketCategory` | complete | `needs_review` |
| `positioningOfferDiagnostic` | complete | `needs_review` |
| `positioningVoiceOfCustomer` | error | null |

## 6. Artifact Manifest

Captured:

- `00-preflight.json`
- `01-session-and-corpus-dispatch.json`
- `02-corpus-poll-1.json` through `02-corpus-poll-3.json`
- `03-onboarding-and-orchestrate.json`
- `04-audit-poll-1.json` (full final captured error state)
- `04-audit-poll-2.json` through `04-audit-poll-6.json` (labeled milestone summaries reconstructed from live monitor stdout)
- `10-audit-state-final.json`
- `11-db-rows.json`
- `11-section-artifacts.json`
- `12-verification-table.json`
- `13-term-hits.json`
- `judge-fallback-grep.txt`
- `share-create.json`
- `screens/share-badge-dom.txt`
- `screens/profile-badge-not-applicable.txt`
- `RUN-ERROR.json`
- `next-dev.log`
- `worker-health.json`
- `worker-capabilities.json`

Missing by design after failure:

- `screens/profile-badge.png` - no profile was created (`profile_id=null`).
- capstone evidence - capstones were not dispatched because 6/6 did not complete.

Missing due Browser plugin screenshot transport failure:

- `screens/share-badge.png` - DOM evidence saved instead.

## 7. Next-Tier Scope

1. **P0 - VoC repair/gap fallback still broken.** When VoC cannot satisfy multi-source quote minimums after repair, commit an honest `evidenceGap` artifact instead of terminal `error`. This is the blocker for capstones.
2. **P0 - A4 over-prune/identity quarantine is incomplete.** The off-topic Airbase trance creative still commits. The same-name ad filter needs to reject `name_only` creatives even when sourceCount remains healthy.
3. **P1 - Offer confidence math after user assertions.** A1 credits user economics correctly, but Offer still misses the confidence bar. Separate user-fact credit from unsupported derived estimates like `$30K/mo`, `$26K/mo`, and benchmark comparisons.
4. **P2 - Demand/Market naked numerics.** Demand emitted CPC-like dollar values and Market emitted market-size/CAGR claims. Suppress or label model-estimate numerics unless returned by a tool/source.
5. **P2 - Synthesis-as-auditor remains unobserved.** Re-run only after VoC can complete, then check whether synthesis flags weak upstream sections instead of summarizing them.
6. **P3 - Browser screenshot transport.** The Browser plugin rendered the share page and DOM badge but `Page.captureScreenshot` timed out. Use a smaller deterministic screenshot path or a browser-visible fallback in future evidence runs.

## 8. Final

This branch is not signoff-ready. The live run proved some A1/A3 behavior but failed the main A2 unblock, failed A4 quarantine, and left capstones unobserved.
