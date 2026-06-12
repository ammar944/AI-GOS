# Buyer Eval Report — f3993043

Run id: `f3993043-b6ce-4b27-a547-7ef02929f3fa`
Artifact id: `a80cf27a-3018-42d1-a393-63fd536ad3ed`
Generated at: `2026-06-12T11:51:41.531Z`
Command: `node scripts/zz-buyer-eval.mjs f3993043-b6ce-4b27-a547-7ef02929f3fa`

## Verdict

Final score: `3/10`
Gate: `FAIL`
Failing checks: `CASCADE, PROJECTIONS, MEMO, DENY-LIST`
Cap reasons: `cap 6: Buyer-Test core fail(s): CASCADE, PROJECTIONS; cap 7: internal vocabulary deny-list hit on client-surface JSON leaves`
Never-ship penalties: `3`

## Full Scorecard Output

```text
=== Buyer eval: run f3993043-b6ce-4b27-a547-7ef02929f3fa (artifact a80cf27a-3018-42d1-a393-63fd536ad3ed) ===

| Check | Status | Evidence |
| --- | --- | --- |
| CASCADE | FAIL | monthlyBudgetValue=$25,000; dailySpend=$833; dailySpend*30_delta=$10; audienceDailyBudgets=4/4; audienceDailySum=$1,033; audienceDailyDelta=$200; phaseBudgets=3/3; phaseOverMonthly=0 |
| PROJECTIONS | FAIL | rows=3; rowsWithPhaseBudget=3; missingKpiCostValue=3; missingProjectedCount=3; badKpiCostProvenance=3 (0:unknown, 1:unknown, 2:unknown) |
| CHANNELS | PASS | rows=3; substantiveRecommendations=3; gapStringRecommendations=0 |
| ANGLES | PASS | rows=4; completeShortNameAndDescription=4 |
| CREATIVE | PASS | creativeFrameworkCount=7; numericCreativeStrategyCounts=3/3 |
| MEMO | FAIL | status=complete; stringLeaves=3256; blockedOrStubHits=10 ($.thesis:blocked, $.decisions[0].decision:resolve contradiction, $.decisions[1].decision:resolve contradiction, $.decisions[2].decision:resolve contradiction, $.decisions[3].decision:resolve contradiction); rankedMoves=3; duplicateRankedMoves=0 |
| DENY-LIST | FAIL | hits=65; firstHits=positioningCompetitorLandscape.body.adEvidence.prose -> quarantine \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[0].dataGaps[2].reason -> displayable \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[1].dataGaps[3].reason -> displayable \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[1].dataGaps[4].reason -> verifiedCount \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[2].dataGaps[1].reason -> displayable \| positioningCompetitorLandscape.body.adEvidence.advertiserGroups[4].dataGaps[1].reason -> displayable \| positioningCompetitorLandscape.body.adPresence.prose -> quarantine \| positioningCompetitorLandscape.body.adPresence.signals[2].evidence -> displayable |
| QUOTES | N-A | quoteRecords=0; permalinkedQuotes=0; retrievalSummary=present ($.retrievalSummary); honest gap noted |
| PRICING | PASS | pricingRows=9; vendorDomainRows=3; thirdPartyRows=6; unknownRows=0; competitorDomains=8 |
| TIERS | PASS | clientSections=7; insufficient=5, needs_review=2 |
| SHARE | N-A | not requested; use --share with BASE_URL to POST localhost share route |

Final score: 3/10
Score cap: 6/10
Cap reasons: cap 6: Buyer-Test core fail(s): CASCADE, PROJECTIONS; cap 7: internal vocabulary deny-list hit on client-surface JSON leaves
Never-ship penalties: 3 — CASCADE: non-reconciling or incomplete budget cascade; PROJECTIONS: projected-results table lacks trusted projected counts/cost provenance; MEMO: blocked/internal instruction text reached the decision memo
Report: docs/reports/buyer-eval-f3993043.md
Gate: FAIL
```

## Evidence Notes

- The script reads `research_artifacts` and `research_artifact_sections` with SELECT-only Supabase calls.
- The deny-list scan is limited to client-surface positioning section bodies plus `research_artifacts.thesis`; internal metadata fields named `verifierSummary`, `decodeRepairs`, `verification`, `review`, and `blockGap*` are skipped.
- `SHARE` is skipped unless `--share` is explicitly passed with `BASE_URL`.
