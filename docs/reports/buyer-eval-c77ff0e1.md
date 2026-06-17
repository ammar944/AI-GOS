# Buyer Eval Report — c77ff0e1

Run id: `c77ff0e1-f866-4b6a-bbc5-23a218f23ba2`
Artifact id: `04323e7d-e548-4bad-b771-b10f4fc0deb7`
Generated at: `2026-06-15T21:18:44.818Z`
Command: `node scripts/zz-buyer-eval.mjs c77ff0e1-f866-4b6a-bbc5-23a218f23ba2`

## Verdict

Final score: `1/10`
Gate: `FAIL`
Failing checks: `BUDGET-PARTITION, CAC-UNIT, COMPETITOR-COUNT, VOC-LAUNDERING`
Cap reasons: `cap 6: Buyer-Test core fail(s): BUDGET-PARTITION, CAC-UNIT`
Never-ship penalties: `5`

## Full Scorecard Output

```text
=== Buyer eval: run c77ff0e1-f866-4b6a-bbc5-23a218f23ba2 (artifact 04323e7d-e548-4bad-b771-b10f4fc0deb7) ===

| Check | Status | Evidence |
| --- | --- | --- |
| CASCADE | PASS | monthlyBudgetValue=$25,000; dailySpend=$833; dailySpend*30_delta=$10; audienceDailyBudgets=4/4; audienceDailySum=$833; audienceDailyDelta=$0; phaseBudgets=2/2; phaseOverMonthly=0 |
| PROJECTIONS | PASS | rows=3; rowsWithPhaseBudget=3; missingKpiCostValue=0; missingProjectedCount=0; badKpiCostProvenance=0 |
| BUDGET-PARTITION | FAIL | monthlyBudgetValue=$25,000; phaseBudgetRows=3/3; phaseBudgetSum=$35,000; sumVsMonthlyDelta=$10,000; rowsCarryingFullMonthly=1; duplicateFullSpend=true |
| CAC-UNIT | FAIL | rows=3; funnelStageKpiRows=3; rowsWithTrialToPaidBridge=0; unitMismatchOffenders=3 (0:Qualified Business-plan trial impliedCac=$133.69 beats target=$3,000 by 22.4x (no customer-CAC bridge or band) \| 1:Qualified trial impliedCac=$135.14 beats target=$3,000 by 22.2x (no customer-CAC bridge or band) \| 2:Qualified trial impliedCac=$135.14 beats target=$3,000 by 22.2x (no customer-CAC bridge or band)) |
| CHANNELS | PASS | rows=4; substantiveRecommendations=4; gapStringRecommendations=0 |
| ANGLES | PASS | rows=4; completeShortNameAndDescription=4 |
| CREATIVE | PASS | creativeFrameworkCount=4; numericCreativeStrategyCounts=3/3 |
| MEMO | PASS | status=complete; stringLeaves=1960; blockedOrStubHits=0; rankedMoves=3; duplicateRankedMoves=0 |
| DENY-LIST | PASS | hits=0; scannedZones=7; thesisScanned=true |
| QUOTES | N-A | quoteRecords=0; permalinkedQuotes=0; retrievalSummary=present ($.retrievalSummary); honest gap noted |
| PERSONA-CONTAINMENT | ADVISORY | personaRecords=5; namedHumanPersonas=5; vendorSourcedNamedHumans=5 (Rachel Pleasants McLean, Bridget McMullan, Adam Silverman, Ryan Martinez, Cortney Rhoades); live-page name containment enforced by engine source-liveness gate + cold judge noFabrication (not verifiable offline) |
| COMPETITOR-COUNT | FAIL | capturedCreatives=41; advertiserGroups=6; attributedClaims=8; inflatedPerAdvertiser=6 (Airtable: claimed 15 verified vs 12 captured; Smartsheet: claimed 29 verified vs 12 captured; ClickUp: claimed 35 verified vs 6 captured; Zapier Tables: claimed 14 verified vs 7 captured; Smartsheet (15 verified) / Airtable (15 verified) — tied on volume: claimed 15 verified vs 12 captured; ClickUp (20 verified): claimed 20 verified vs 6 captured) |
| VOC-LAUNDERING | FAIL | vocUsableQuoteRecords=0; vocSourcedPaidRows=4 (competitorReviewInsights[0], competitorReviewInsights[1], competitorReviewInsights[2], creativeFramework[1]) |
| PRICING | PASS | pricingRows=5; vendorDomainRows=4; thirdPartyRows=1; unknownRows=0; competitorDomains=8 |
| TIERS | PASS | clientSections=7; insufficient=5, needs_review=2 |
| SHARE | N-A | not requested; use --share with BASE_URL to POST localhost share route |

Final score: 1/10
Score cap: 6/10
Cap reasons: cap 6: Buyer-Test core fail(s): BUDGET-PARTITION, CAC-UNIT
Never-ship penalties: 5 — BUDGET-PARTITION: move budgets sum to $35,000 but the plan states $25,000 (phantom spend); BUDGET-PARTITION: a move carries the FULL monthly budget while sibling moves add more (double-counted spend); CAC-UNIT: funnel-stage cost-per-signup compared to a paid-customer CAC target with no trial->paid bridge (self-falsifying funnel math); COMPETITOR-COUNT: 6 competitor(s) claim more verified ads than captured creatives — padded ad-evidence counts (Airtable: claimed 15 verified vs 12 captured); VOC-LAUNDERING: 4 paid-media row(s) source customer-voice proof from a VoC that produced zero usable quotes
Report: docs/reports/buyer-eval-c77ff0e1.md
Gate: FAIL
```

## Evidence Notes

- The script reads `research_artifacts` and `research_artifact_sections` with SELECT-only Supabase calls.
- The deny-list scan is limited to client-surface positioning section bodies plus `research_artifacts.thesis`; internal metadata fields named `verifierSummary`, `decodeRepairs`, `verification`, `review`, and `blockGap*` are skipped.
- `SHARE` is skipped unless `--share` is explicitly passed with `BASE_URL`.
