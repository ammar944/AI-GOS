# Buyer Eval Report — d838ed4e

Run id: `d838ed4e-7cc7-43ef-ad94-dea30abdb1c2`
Artifact id: `f3d650c3-c15f-4837-89bb-7ea8be3fc412`
Generated at: `2026-06-15T09:23:07.508Z`
Command: `node scripts/zz-buyer-eval.mjs d838ed4e-7cc7-43ef-ad94-dea30abdb1c2`

## Verdict

Final score: `1/10`
Gate: `FAIL`
Failing checks: `CASCADE, PROJECTIONS, CHANNELS, MEMO, DENY-LIST, QUOTES`
Cap reasons: `cap 6: Buyer-Test core fail(s): CASCADE, PROJECTIONS, CHANNELS; cap 7: internal vocabulary deny-list hit on client-surface JSON leaves`
Never-ship penalties: `5`

## Full Scorecard Output

```text
=== Buyer eval: run d838ed4e-7cc7-43ef-ad94-dea30abdb1c2 (artifact f3d650c3-c15f-4837-89bb-7ea8be3fc412) ===

| Check | Status | Evidence |
| --- | --- | --- |
| CASCADE | FAIL | monthlyBudgetValue=$25,000; dailySpend=$833; dailySpend*30_delta=$10; audienceDailyBudgets=3/3; audienceDailySum=$634; audienceDailyDelta=$199; phaseBudgets=3/3; phaseOverMonthly=0 |
| PROJECTIONS | FAIL | rows=2; rowsWithPhaseBudget=2; missingKpiCostValue=2; missingProjectedCount=2; badKpiCostProvenance=2 (0:unknown, 1:unknown) |
| CHANNELS | FAIL | rows=4; substantiveRecommendations=0; gapStringRecommendations=4 |
| ANGLES | PASS | rows=5; completeShortNameAndDescription=5 |
| CREATIVE | PASS | creativeFrameworkCount=6; numericCreativeStrategyCounts=3/3 |
| MEMO | FAIL | status=complete; stringLeaves=3769; blockedOrStubHits=10 ($.thesis:blocked, $.decisions[0].decision:resolve contradiction, $.decisions[1].decision:resolve contradiction, $.decisions[2].decision:resolve contradiction, $.decisions[3].decision:resolve contradiction); rankedMoves=3; duplicateRankedMoves=0 |
| DENY-LIST | FAIL | hits=198; firstHits=positioningBuyerICP.body.keyFindings[0].finding -> [unverified] \| positioningBuyerICP.body.keyFindings[1].finding -> section badge \| positioningBuyerICP.body.keyFindings[3].finding -> [unverified] \| positioningBuyerICP.body.buyingContext.triggers[0].evidence -> corpus \| positioningBuyerICP.body.strategicInsight.keyTension.side -> [unverified] \| positioningBuyerICP.body.strategicInsight.keyTension.tension -> [unverified] \| positioningBuyerICP.body.strategicInsight.strategicVerdict -> [unverified] \| positioningBuyerICP.body.strategicInsight.secondOrderImplication -> [unverified] |
| QUOTES | FAIL | quoteRecords=0; permalinkedQuotes=0; retrievalSummary=missing |
| PRICING | PASS | pricingRows=6; vendorDomainRows=6; thirdPartyRows=0; unknownRows=0; competitorDomains=5 |
| TIERS | PASS | clientSections=7; insufficient=2, needs_review=5 |
| SHARE | N-A | not requested; use --share with BASE_URL to POST localhost share route |

Final score: 1/10
Score cap: 6/10
Cap reasons: cap 6: Buyer-Test core fail(s): CASCADE, PROJECTIONS, CHANNELS; cap 7: internal vocabulary deny-list hit on client-surface JSON leaves
Never-ship penalties: 5 — CASCADE: non-reconciling or incomplete budget cascade; PROJECTIONS: projected-results table lacks trusted projected counts/cost provenance; CHANNELS: gap-string recommendations persisted as data values; MEMO: blocked/internal instruction text reached the decision memo; QUOTES: VoC quote records lack item-level permalinks
Report: docs/reports/buyer-eval-d838ed4e.md
Gate: FAIL
```

## Evidence Notes

- The script reads `research_artifacts` and `research_artifact_sections` with SELECT-only Supabase calls.
- The deny-list scan is limited to client-surface positioning section bodies plus `research_artifacts.thesis`; internal metadata fields named `verifierSummary`, `decodeRepairs`, `verification`, `review`, and `blockGap*` are skipped.
- `SHARE` is skipped unless `--share` is explicitly passed with `BASE_URL`.
