# Buyer Eval Report — df18dd1f

Run id: `df18dd1f-90c9-43c2-b0fa-d49893a25ddb`
Artifact id: `bfac2db8-ac1b-48f0-8a39-235133a7de0c`
Generated at: `2026-06-19T07:09:45.421Z`
Command: `node scripts/zz-buyer-eval.mjs df18dd1f-90c9-43c2-b0fa-d49893a25ddb`

## Verdict

> **Liar-catcher floor.** This gate only proves no hard fabrication or coherence
> defect was *detected*. It is **not** a quality score — a `CLEAN` result still
> requires an honest human/judge value read before shipping.

Gate: `HARD-FAIL`
Final score (diagnostic only): `2/10`
Failing checks: `PROJECTIONS, MEMO, VOC-EMPTY-DESPITE-EVIDENCE, PRICING`
Cap reasons: `cap 6: Buyer-Test core fail(s): PROJECTIONS`
Never-ship penalties: `4`

## Full Scorecard Output

```text
=== Buyer eval: run df18dd1f-90c9-43c2-b0fa-d49893a25ddb (artifact bfac2db8-ac1b-48f0-8a39-235133a7de0c) ===

| Check | Status | Evidence |
| --- | --- | --- |
| CASCADE | PASS | monthlyBudgetValue=$10,000; dailySpend=$333; dailySpend*30_delta=$10; audienceDailyBudgets=4/4; audienceDailySum=$333; audienceDailyDelta=$0; phaseBudgets=3/3; phaseOverMonthly=0 |
| PROJECTIONS | FAIL | rows=3; rowsWithPhaseBudget=3; missingKpiCostValue=0; missingProjectedCount=0; badKpiCostProvenance=1 (1:model-estimated) |
| BUDGET-PARTITION | PASS | monthlyBudgetValue=$10,000; phaseBudgetRows=3/3; phaseBudgetSum=$30,000; sumVsMonthlyDelta=$20,000; windows=3; maxWindowSum=$10,000; overAllocatedWindows=0; rowsCarryingFullMonthly=3; duplicateFullSpend=false |
| CAC-UNIT | PASS | rows=3; funnelStageKpiRows=3; rowsWithTrialToPaidBridge=3; unitMismatchOffenders=0 |
| CHANNELS | PASS | rows=3; substantiveRecommendations=3; gapStringRecommendations=0 |
| ANGLES | PASS | rows=4; completeShortNameAndDescription=4 |
| CREATIVE | PASS | creativeFrameworkCount=4; numericCreativeStrategyCounts=3/3 |
| MEMO | FAIL | status=generating; stringLeaves=2; blockedOrStubHits=0; rankedMoves=0; duplicateRankedMoves=0 |
| DENY-LIST | PASS | hits=0; scannedZones=7; thesisScanned=true |
| QUOTES | PASS | quoteRecords=6; permalinkedQuotes=6; retrievalSummary=present |
| PERSONA-CONTAINMENT | PASS | personaRecords=0; namedHumanPersonas=0; vendorSourcedNamedHumans=0; live-page name containment enforced by engine source-liveness gate + cold judge noFabrication (not verifiable offline) |
| COMPETITOR-COUNT | PASS | capturedCreatives=43; advertiserGroups=6; attributedClaims=2; inflatedPerAdvertiser=0 |
| VOC-LAUNDERING | PASS | vocUsableQuoteRecords=6; vocSourcedPaidRows=0 |
| VOC-EMPTY-DESPITE-EVIDENCE | FAIL | acquired=70; usableQuotes=6; shipsEmpty=true; promotableRejectedForCountSelection=50 |
| PRICING | FAIL | pricingRows=0; vendorDomainRows=0; thirdPartyRows=0; unknownRows=0; competitorDomains=6 |
| SECTION-EMPTINESS | PASS | clientSections=7; hollowWithoutHonestGap=0 |
| TIERS | PASS | clientSections=7; insufficient=6, needs_review=1 |
| SHARE | N-A | not requested; use --share with BASE_URL to POST localhost share route |

LIAR-CATCHER FLOOR — this gate only proves no hard fabrication/coherence
defect was DETECTED. It is NOT a quality score: a CLEAN result still needs
an honest human/judge value read before shipping.

Final score: 2/10 (diagnostic only — not a quality grade)
Score cap: 6/10
Cap reasons: cap 6: Buyer-Test core fail(s): PROJECTIONS
Never-ship penalties: 4 — PROJECTIONS: projected-results table lacks trusted projected counts/cost provenance; MEMO: thesis status is not complete; VOC-EMPTY-DESPITE-EVIDENCE: VoC shipped empty despite 70 successfully scraped+parsed candidate(s); VOC-EMPTY-DESPITE-EVIDENCE: 50 promotable candidate(s) rejected for count/selection reasons (not quality)
Report: docs/reports/buyer-eval-df18dd1f.md
JSON: docs/reports/buyer-eval-df18dd1f.json
Gate: HARD-FAIL
```

## Evidence Notes

- The script reads `research_artifacts` and `research_artifact_sections` with SELECT-only Supabase calls.
- The deny-list scan is limited to client-surface positioning section bodies plus `research_artifacts.thesis`; internal metadata fields named `verifierSummary`, `decodeRepairs`, `verification`, `review`, and `blockGap*` are skipped.
- `SHARE` is skipped unless `--share` is explicitly passed with `BASE_URL`.
