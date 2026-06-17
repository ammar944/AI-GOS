# Buyer Eval Report — 3b568ea0

Run id: `3b568ea0-b734-46ec-9618-e91b50405107`
Artifact id: `16e5b751-df88-46f6-8cd9-dd766a39210f`
Generated at: `2026-06-16T07:57:48.235Z`
Command: `node scripts/zz-buyer-eval.mjs 3b568ea0-b734-46ec-9618-e91b50405107`

## Verdict

Final score: `3/10`
Gate: `FAIL`
Failing checks: `PROJECTIONS, COMPETITOR-COUNT, VOC-LAUNDERING`
Cap reasons: `cap 6: Buyer-Test core fail(s): PROJECTIONS`
Never-ship penalties: `3`

## Full Scorecard Output

```text
=== Buyer eval: run 3b568ea0-b734-46ec-9618-e91b50405107 (artifact 16e5b751-df88-46f6-8cd9-dd766a39210f) ===

| Check | Status | Evidence |
| --- | --- | --- |
| CASCADE | PASS | monthlyBudgetValue=$25,000; dailySpend=$833; dailySpend*30_delta=$10; audienceDailyBudgets=4/4; audienceDailySum=$833; audienceDailyDelta=$0; phaseBudgets=2/2; phaseOverMonthly=0 |
| PROJECTIONS | FAIL | rows=2; rowsWithPhaseBudget=2; missingKpiCostValue=0; missingProjectedCount=2; badKpiCostProvenance=0 |
| BUDGET-PARTITION | PASS | monthlyBudgetValue=$25,000; phaseBudgetRows=2/2; phaseBudgetSum=$50,000; sumVsMonthlyDelta=$25,000; windows=2; maxWindowSum=$25,000; overAllocatedWindows=0; rowsCarryingFullMonthly=2; duplicateFullSpend=false |
| CAC-UNIT | PASS | rows=2; funnelStageKpiRows=2; rowsWithTrialToPaidBridge=0; unitMismatchOffenders=0 |
| CHANNELS | PASS | rows=3; substantiveRecommendations=3; gapStringRecommendations=0 |
| ANGLES | PASS | rows=4; completeShortNameAndDescription=4 |
| CREATIVE | PASS | creativeFrameworkCount=6; numericCreativeStrategyCounts=3/3 |
| MEMO | PASS | status=complete; stringLeaves=1929; blockedOrStubHits=0; rankedMoves=3; duplicateRankedMoves=0 |
| DENY-LIST | PASS | hits=0; scannedZones=7; thesisScanned=true |
| QUOTES | N-A | quoteRecords=0; permalinkedQuotes=0; retrievalSummary=present ($.retrievalSummary); honest gap noted |
| PERSONA-CONTAINMENT | PASS | personaRecords=7; namedHumanPersonas=7; vendorSourcedNamedHumans=0; live-page name containment enforced by engine source-liveness gate + cold judge noFabrication (not verifiable offline) |
| COMPETITOR-COUNT | FAIL | capturedCreatives=40; advertiserGroups=6; attributedClaims=3; inflatedPerAdvertiser=3 (Notion and SmartSuite — each with 15 verified Google ads: claimed 15 verified vs 12 captured; Notion — 15 verified Meta creatives: claimed 15 verified vs 12 captured; Airtable and SmartSuite — each with 15 verified LinkedIn creatives: claimed 15 verified vs 12 captured) |
| VOC-LAUNDERING | FAIL | vocUsableQuoteRecords=0; vocSourcedPaidRows=2 (competitorReviewInsights[1], competitorReviewInsights[2]) |
| PRICING | PASS | pricingRows=4; vendorDomainRows=3; thirdPartyRows=1; unknownRows=0; competitorDomains=5 |
| TIERS | PASS | clientSections=7; insufficient=5, needs_review=2 |
| SHARE | N-A | not requested; use --share with BASE_URL to POST localhost share route |

Final score: 3/10
Score cap: 6/10
Cap reasons: cap 6: Buyer-Test core fail(s): PROJECTIONS
Never-ship penalties: 3 — PROJECTIONS: projected-results table lacks trusted projected counts/cost provenance; COMPETITOR-COUNT: 3 competitor(s) claim more verified ads than captured creatives — padded ad-evidence counts (Notion and SmartSuite — each with 15 verified Google ads: claimed 15 verified vs 12 captured); VOC-LAUNDERING: 2 paid-media row(s) source customer-voice proof from a VoC that produced zero usable quotes
Report: docs/reports/buyer-eval-3b568ea0.md
Gate: FAIL
```

## Evidence Notes

- The script reads `research_artifacts` and `research_artifact_sections` with SELECT-only Supabase calls.
- The deny-list scan is limited to client-surface positioning section bodies plus `research_artifacts.thesis`; internal metadata fields named `verifierSummary`, `decodeRepairs`, `verification`, `review`, and `blockGap*` are skipped.
- `SHARE` is skipped unless `--share` is explicitly passed with `BASE_URL`.
