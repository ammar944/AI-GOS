# Buyer Eval Report — 09f694d7

Run id: `09f694d7-8424-4cd5-87c4-8c855a3a763d`
Artifact id: `de01341d-dc95-4422-ae7c-67bc5430cb91`
Generated at: `2026-06-15T15:05:23.966Z`
Command: `node scripts/zz-buyer-eval.mjs 09f694d7-8424-4cd5-87c4-8c855a3a763d`

## Verdict

Final score: `6/10`
Gate: `FAIL`
Failing checks: `MEMO, DENY-LIST`
Cap reasons: `cap 7: internal vocabulary deny-list hit on client-surface JSON leaves`
Never-ship penalties: `1`

## Full Scorecard Output

```text
=== Buyer eval: run 09f694d7-8424-4cd5-87c4-8c855a3a763d (artifact de01341d-dc95-4422-ae7c-67bc5430cb91) ===

| Check | Status | Evidence |
| --- | --- | --- |
| CASCADE | PASS | monthlyBudgetValue=$25,000; dailySpend=$833; dailySpend*30_delta=$10; audienceDailyBudgets=4/4; audienceDailySum=$833; audienceDailyDelta=$0; phaseBudgets=2/2; phaseOverMonthly=0 |
| PROJECTIONS | PASS | rows=2; rowsWithPhaseBudget=2; missingKpiCostValue=0; missingProjectedCount=0; badKpiCostProvenance=0 |
| CHANNELS | PASS | rows=3; substantiveRecommendations=3; gapStringRecommendations=0 |
| ANGLES | PASS | rows=4; completeShortNameAndDescription=4 |
| CREATIVE | PASS | creativeFrameworkCount=6; numericCreativeStrategyCounts=3/3 |
| MEMO | FAIL | status=error; stringLeaves=3; blockedOrStubHits=0; rankedMoves=0; duplicateRankedMoves=0 |
| DENY-LIST | FAIL | hits=56; firstHits=positioningBuyerICP.body.clusters.prose -> blockGap \| positioningBuyerICP.body.awarenessDistribution.levels[4].evidence -> corpus \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[0].dataGaps[2].internalDetail -> displayable \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[1].dataGaps[3].internalDetail -> displayable \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[1].dataGaps[4].internalDetail -> verifiedCount \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[2].dataGaps[2].internalDetail -> displayable \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[3].dataGaps[1].internalDetail -> displayable \| positioningCompetitorLandscape.body.adPresence.signals[2].evidence -> verifiedCount |
| QUOTES | N-A | quoteRecords=0; permalinkedQuotes=0; retrievalSummary=present ($.retrievalSummary); honest gap noted |
| PRICING | PASS | pricingRows=5; vendorDomainRows=2; thirdPartyRows=3; unknownRows=0; competitorDomains=5 |
| TIERS | PASS | clientSections=7; insufficient=5, needs_review=2 |
| SHARE | N-A | not requested; use --share with BASE_URL to POST localhost share route |

Final score: 6/10
Score cap: 7/10
Cap reasons: cap 7: internal vocabulary deny-list hit on client-surface JSON leaves
Never-ship penalties: 1 — MEMO: thesis status is not complete
Report: docs/reports/buyer-eval-09f694d7.md
Gate: FAIL
```

## Evidence Notes

- The script reads `research_artifacts` and `research_artifact_sections` with SELECT-only Supabase calls.
- The deny-list scan is limited to client-surface positioning section bodies plus `research_artifacts.thesis`; internal metadata fields named `verifierSummary`, `decodeRepairs`, `verification`, `review`, and `blockGap*` are skipped.
- `SHARE` is skipped unless `--share` is explicitly passed with `BASE_URL`.
