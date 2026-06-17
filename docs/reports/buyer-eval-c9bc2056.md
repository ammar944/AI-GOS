# Buyer Eval Report — c9bc2056

Run id: `c9bc2056-627c-471d-b98b-98ed224085c2`
Artifact id: `a9afca37-25a5-497b-9dca-15a2b67c2b52`
Generated at: `2026-06-16T12:03:53.554Z`
Command: `node scripts/zz-buyer-eval.mjs c9bc2056-627c-471d-b98b-98ed224085c2`

## Verdict

Final score: `9/10`
Gate: `PASS`
Failing checks: `QUOTES`
Cap reasons: `none`
Never-ship penalties: `1`

## Full Scorecard Output

```text
=== Buyer eval: run c9bc2056-627c-471d-b98b-98ed224085c2 (artifact a9afca37-25a5-497b-9dca-15a2b67c2b52) ===

| Check | Status | Evidence |
| --- | --- | --- |
| CASCADE | PASS | monthlyBudgetValue=$25,000; dailySpend=$833; dailySpend*30_delta=$10; audienceDailyBudgets=4/4; audienceDailySum=$833; audienceDailyDelta=$0; phaseBudgets=2/2; phaseOverMonthly=0 |
| PROJECTIONS | PASS | rows=2; rowsWithPhaseBudget=2; missingKpiCostValue=0; missingProjectedCount=0; badKpiCostProvenance=0 |
| BUDGET-PARTITION | PASS | monthlyBudgetValue=$25,000; phaseBudgetRows=2/2; phaseBudgetSum=$50,000; sumVsMonthlyDelta=$25,000; windows=2; maxWindowSum=$25,000; overAllocatedWindows=0; rowsCarryingFullMonthly=2; duplicateFullSpend=false |
| CAC-UNIT | PASS | rows=2; funnelStageKpiRows=2; rowsWithTrialToPaidBridge=0; unitMismatchOffenders=0 |
| CHANNELS | PASS | rows=6; substantiveRecommendations=6; gapStringRecommendations=0 |
| ANGLES | PASS | rows=4; completeShortNameAndDescription=4 |
| CREATIVE | PASS | creativeFrameworkCount=4; numericCreativeStrategyCounts=3/3 |
| MEMO | PASS | status=complete; stringLeaves=10; blockedOrStubHits=0; rankedMoves=3; duplicateRankedMoves=0 |
| DENY-LIST | PASS | hits=0; scannedZones=7; thesisScanned=true |
| QUOTES | FAIL | quoteRecords=0; permalinkedQuotes=0; retrievalSummary=missing |
| PERSONA-CONTAINMENT | ADVISORY | personaRecords=2; namedHumanPersonas=2; vendorSourcedNamedHumans=2 (Sarah Koo, Michelle Bandler); live-page name containment enforced by engine source-liveness gate + cold judge noFabrication (not verifiable offline) |
| COMPETITOR-COUNT | PASS | capturedCreatives=43; advertiserGroups=6; attributedClaims=3; inflatedPerAdvertiser=0 |
| VOC-LAUNDERING | PASS | vocUsableQuoteRecords=0; vocSourcedPaidRows=0 |
| PRICING | PASS | pricingRows=3; vendorDomainRows=1; thirdPartyRows=2; unknownRows=0; competitorDomains=6 |
| TIERS | PASS | clientSections=7; insufficient=3, needs_review=4 |
| SHARE | N-A | not requested; use --share with BASE_URL to POST localhost share route |

Final score: 9/10
Score cap: 10/10
Cap reasons: none
Never-ship penalties: 1 — QUOTES: VoC quote records lack item-level permalinks
Report: docs/reports/buyer-eval-c9bc2056.md
Gate: PASS
```

## Evidence Notes

- The script reads `research_artifacts` and `research_artifact_sections` with SELECT-only Supabase calls.
- The deny-list scan is limited to client-surface positioning section bodies plus `research_artifacts.thesis`; internal metadata fields named `verifierSummary`, `decodeRepairs`, `verification`, `review`, and `blockGap*` are skipped.
- `SHARE` is skipped unless `--share` is explicitly passed with `BASE_URL`.
