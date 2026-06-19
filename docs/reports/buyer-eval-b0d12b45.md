# Buyer Eval Report — b0d12b45

Run id: `b0d12b45-c4a5-4c1d-9e3a-1fb11668bc44`
Artifact id: `b569389b-b66f-4d94-b029-d1756a3435db`
Generated at: `2026-06-18T09:33:53.901Z`
Command: `node scripts/zz-buyer-eval.mjs b0d12b45-c4a5-4c1d-9e3a-1fb11668bc44`

## Verdict

> **Liar-catcher floor.** This gate only proves no hard fabrication or coherence
> defect was *detected*. It is **not** a quality score — a `CLEAN` result still
> requires an honest human/judge value read before shipping.

Gate: `HARD-FAIL`
Final score (diagnostic only): `8/10`
Failing checks: `VOC-EMPTY-DESPITE-EVIDENCE, PRICING`
Cap reasons: `none`
Never-ship penalties: `2`

## Full Scorecard Output

```text
=== Buyer eval: run b0d12b45-c4a5-4c1d-9e3a-1fb11668bc44 (artifact b569389b-b66f-4d94-b029-d1756a3435db) ===

| Check | Status | Evidence |
| --- | --- | --- |
| CASCADE | PASS | monthlyBudgetValue=$25,000; dailySpend=$833; dailySpend*30_delta=$10; audienceDailyBudgets=4/4; audienceDailySum=$830; audienceDailyDelta=$3; phaseBudgets=3/3; phaseOverMonthly=0 |
| PROJECTIONS | PASS | rows=3; rowsWithPhaseBudget=3; missingKpiCostValue=0; missingProjectedCount=0; badKpiCostProvenance=0 |
| BUDGET-PARTITION | PASS | monthlyBudgetValue=$25,000; phaseBudgetRows=3/3; phaseBudgetSum=$50,000; sumVsMonthlyDelta=$25,000; windows=3; maxWindowSum=$25,000; overAllocatedWindows=0; rowsCarryingFullMonthly=1; duplicateFullSpend=false |
| CAC-UNIT | PASS | rows=3; funnelStageKpiRows=3; rowsWithTrialToPaidBridge=3; unitMismatchOffenders=0 |
| CHANNELS | PASS | rows=3; substantiveRecommendations=3; gapStringRecommendations=0 |
| ANGLES | PASS | rows=4; completeShortNameAndDescription=4 |
| CREATIVE | PASS | creativeFrameworkCount=3; numericCreativeStrategyCounts=3/3 |
| MEMO | PASS | status=complete; stringLeaves=2137; blockedOrStubHits=0; rankedMoves=3; duplicateRankedMoves=0 |
| DENY-LIST | PASS | hits=0; scannedZones=7; thesisScanned=true |
| QUOTES | PASS | quoteRecords=9; permalinkedQuotes=9; retrievalSummary=present |
| PERSONA-CONTAINMENT | PASS | personaRecords=0; namedHumanPersonas=0; vendorSourcedNamedHumans=0; live-page name containment enforced by engine source-liveness gate + cold judge noFabrication (not verifiable offline) |
| COMPETITOR-COUNT | PASS | capturedCreatives=13; advertiserGroups=3; attributedClaims=0; inflatedPerAdvertiser=0 |
| VOC-LAUNDERING | PASS | vocUsableQuoteRecords=9; vocSourcedPaidRows=0 |
| VOC-EMPTY-DESPITE-EVIDENCE | FAIL | acquired=66; usableQuotes=9; shipsEmpty=true; promotableRejectedForCountSelection=48 |
| PRICING | FAIL | pricingRows=0; vendorDomainRows=0; thirdPartyRows=0; unknownRows=0; competitorDomains=3 |
| SECTION-EMPTINESS | PASS | clientSections=7; hollowWithoutHonestGap=0 |
| TIERS | PASS | clientSections=7; insufficient=6, needs_review=1 |
| SHARE | N-A | not requested; use --share with BASE_URL to POST localhost share route |

LIAR-CATCHER FLOOR — this gate only proves no hard fabrication/coherence
defect was DETECTED. It is NOT a quality score: a CLEAN result still needs
an honest human/judge value read before shipping.

Final score: 8/10 (diagnostic only — not a quality grade)
Score cap: 10/10
Cap reasons: none
Never-ship penalties: 2 — VOC-EMPTY-DESPITE-EVIDENCE: VoC shipped empty despite 66 successfully scraped+parsed candidate(s); VOC-EMPTY-DESPITE-EVIDENCE: 48 promotable candidate(s) rejected for count/selection reasons (not quality)
Report: docs/reports/buyer-eval-b0d12b45.md
Gate: HARD-FAIL
```

## Evidence Notes

- The script reads `research_artifacts` and `research_artifact_sections` with SELECT-only Supabase calls.
- The deny-list scan is limited to client-surface positioning section bodies plus `research_artifacts.thesis`; internal metadata fields named `verifierSummary`, `decodeRepairs`, `verification`, `review`, and `blockGap*` are skipped.
- `SHARE` is skipped unless `--share` is explicitly passed with `BASE_URL`.
