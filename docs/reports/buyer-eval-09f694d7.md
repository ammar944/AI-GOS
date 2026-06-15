# Buyer Eval Report — 09f694d7

Run id: `09f694d7-8424-4cd5-87c4-8c855a3a763d`
Artifact id: `de01341d-dc95-4422-ae7c-67bc5430cb91`
Generated at: `2026-06-15T09:26:20.421Z`
Command: `node scripts/zz-buyer-eval.mjs 09f694d7-8424-4cd5-87c4-8c855a3a763d`

## Verdict

Final score: `3/10`
Gate: `FAIL`
Failing checks: `CASCADE, PROJECTIONS, CHANNELS, ANGLES, CREATIVE, MEMO, DENY-LIST, QUOTES, TIERS`
Cap reasons: `cap 6: Buyer-Test core fail(s): CASCADE, PROJECTIONS, CHANNELS, ANGLES; cap 7: internal vocabulary deny-list hit on client-surface JSON leaves`
Never-ship penalties: `3`

## Full Scorecard Output

```text
=== Buyer eval: run 09f694d7-8424-4cd5-87c4-8c855a3a763d (artifact de01341d-dc95-4422-ae7c-67bc5430cb91) ===

| Check | Status | Evidence |
| --- | --- | --- |
| CASCADE | FAIL | monthlyBudgetValue=n/a; dailySpend=n/a; dailySpend*30_delta=n/a; audienceDailyBudgets=0/0; audienceDailySum=n/a; audienceDailyDelta=n/a; phaseBudgets=0/0; phaseOverMonthly=0 |
| PROJECTIONS | FAIL | rows=0; rowsWithPhaseBudget=0; missingKpiCostValue=0; missingProjectedCount=0; badKpiCostProvenance=0 |
| CHANNELS | FAIL | rows=0; substantiveRecommendations=0; gapStringRecommendations=0 |
| ANGLES | FAIL | rows=0; completeShortNameAndDescription=0 |
| CREATIVE | FAIL | creativeFrameworkCount=0; numericCreativeStrategyCounts=0/3 |
| MEMO | FAIL | status=missing; stringLeaves=395; blockedOrStubHits=0; rankedMoves=0; duplicateRankedMoves=0 |
| DENY-LIST | FAIL | hits=34; firstHits=positioningBuyerICP.body.clusters.prose -> blockGap \| positioningBuyerICP.body.awarenessDistribution.levels[4].evidence -> corpus \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[0].dataGaps[2].internalDetail -> displayable \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[1].dataGaps[3].internalDetail -> displayable \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[1].dataGaps[4].internalDetail -> verifiedCount \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[2].dataGaps[2].internalDetail -> displayable \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[3].dataGaps[1].internalDetail -> displayable \| positioningCompetitorLandscape.body.adPresence.signals[2].evidence -> verifiedCount |
| QUOTES | FAIL | VoC section body missing; quoteRecords=0; permalinkedQuotes=0 |
| PRICING | PASS | pricingRows=5; vendorDomainRows=2; thirdPartyRows=3; unknownRows=0; competitorDomains=5 |
| TIERS | FAIL | clientSections=6; insufficient=3, missing=2, needs_review=1 |
| SHARE | N-A | not requested; use --share with BASE_URL to POST localhost share route |

Final score: 3/10
Score cap: 6/10
Cap reasons: cap 6: Buyer-Test core fail(s): CASCADE, PROJECTIONS, CHANNELS, ANGLES; cap 7: internal vocabulary deny-list hit on client-surface JSON leaves
Never-ship penalties: 3 — CASCADE: non-reconciling or incomplete budget cascade; PROJECTIONS: projected-results table lacks trusted projected counts/cost provenance; MEMO: thesis status is not complete
Report: docs/reports/buyer-eval-09f694d7.md
Gate: FAIL
```

## Evidence Notes

- The script reads `research_artifacts` and `research_artifact_sections` with SELECT-only Supabase calls.
- The deny-list scan is limited to client-surface positioning section bodies plus `research_artifacts.thesis`; internal metadata fields named `verifierSummary`, `decodeRepairs`, `verification`, `review`, and `blockGap*` are skipped.
- `SHARE` is skipped unless `--share` is explicitly passed with `BASE_URL`.
