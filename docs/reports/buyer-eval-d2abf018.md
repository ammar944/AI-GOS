# Buyer Eval Report — d2abf018

Run id: `d2abf018-529c-4582-822e-585fecc53808`
Artifact id: `a017459c-c743-402b-a286-064aebd2c477`
Generated at: `2026-06-17T12:32:36.837Z`
Command: `node scripts/zz-buyer-eval.mjs d2abf018-529c-4582-822e-585fecc53808`

## Verdict

> **Liar-catcher floor.** This gate only proves no hard fabrication or coherence
> defect was *detected*. It is **not** a quality score — a `CLEAN` result still
> requires an honest human/judge value read before shipping.

Gate: `HARD-FAIL`
Final score (diagnostic only): `8/10`
Failing checks: `VOC-EMPTY-DESPITE-EVIDENCE`
Cap reasons: `none`
Never-ship penalties: `2`

## Full Scorecard Output

```text
=== Buyer eval: run d2abf018-529c-4582-822e-585fecc53808 (artifact a017459c-c743-402b-a286-064aebd2c477) ===

| Check | Status | Evidence |
| --- | --- | --- |
| CASCADE | PASS | monthlyBudgetValue=$25,000; dailySpend=$833; dailySpend*30_delta=$10; audienceDailyBudgets=4/4; audienceDailySum=$833; audienceDailyDelta=$0; phaseBudgets=2/2; phaseOverMonthly=0 |
| PROJECTIONS | PASS | rows=2; rowsWithPhaseBudget=2; missingKpiCostValue=0; missingProjectedCount=0; badKpiCostProvenance=0 |
| BUDGET-PARTITION | PASS | monthlyBudgetValue=$25,000; phaseBudgetRows=2/2; phaseBudgetSum=$50,000; sumVsMonthlyDelta=$25,000; windows=2; maxWindowSum=$25,000; overAllocatedWindows=0; rowsCarryingFullMonthly=2; duplicateFullSpend=false |
| CAC-UNIT | PASS | rows=2; funnelStageKpiRows=2; rowsWithTrialToPaidBridge=2; unitMismatchOffenders=0 |
| CHANNELS | PASS | rows=6; substantiveRecommendations=6; gapStringRecommendations=0 |
| ANGLES | PASS | rows=5; completeShortNameAndDescription=5 |
| CREATIVE | PASS | creativeFrameworkCount=4; numericCreativeStrategyCounts=3/3 |
| MEMO | PASS | status=complete; stringLeaves=2044; blockedOrStubHits=0; rankedMoves=3; duplicateRankedMoves=0 |
| DENY-LIST | PASS | hits=0; scannedZones=7; thesisScanned=true |
| QUOTES | PASS | quoteRecords=2; permalinkedQuotes=2; retrievalSummary=present |
| PERSONA-CONTAINMENT | PASS | personaRecords=0; namedHumanPersonas=0; vendorSourcedNamedHumans=0; live-page name containment enforced by engine source-liveness gate + cold judge noFabrication (not verifiable offline) |
| COMPETITOR-COUNT | PASS | capturedCreatives=36; advertiserGroups=6; attributedClaims=2; inflatedPerAdvertiser=0 |
| VOC-LAUNDERING | PASS | vocUsableQuoteRecords=2; vocSourcedPaidRows=1 (creativeFramework[3]) |
| VOC-EMPTY-DESPITE-EVIDENCE | FAIL | acquired=71; usableQuotes=2; shipsEmpty=true; promotableRejectedForCountSelection=51 |
| PRICING | PASS | pricingRows=6; vendorDomainRows=2; thirdPartyRows=4; unknownRows=0; competitorDomains=8 |
| SECTION-EMPTINESS | PASS | clientSections=7; hollowWithoutHonestGap=0 |
| TIERS | PASS | clientSections=7; insufficient=6, needs_review=1 |
| SHARE | N-A | not requested; use --share with BASE_URL to POST localhost share route |

LIAR-CATCHER FLOOR — this gate only proves no hard fabrication/coherence
defect was DETECTED. It is NOT a quality score: a CLEAN result still needs
an honest human/judge value read before shipping.

Final score: 8/10 (diagnostic only — not a quality grade)
Score cap: 10/10
Cap reasons: none
Never-ship penalties: 2 — VOC-EMPTY-DESPITE-EVIDENCE: VoC shipped empty despite 71 successfully scraped+parsed candidate(s); VOC-EMPTY-DESPITE-EVIDENCE: 51 promotable candidate(s) rejected for count/selection reasons (not quality)
Report: docs/reports/buyer-eval-d2abf018.md
JSON: docs/reports/buyer-eval-d2abf018.json
Gate: HARD-FAIL
```

## Evidence Notes

- The script reads `research_artifacts` and `research_artifact_sections` with SELECT-only Supabase calls.
- The deny-list scan is limited to client-surface positioning section bodies plus `research_artifacts.thesis`; internal metadata fields named `verifierSummary`, `decodeRepairs`, `verification`, `review`, and `blockGap*` are skipped.
- `SHARE` is skipped unless `--share` is explicitly passed with `BASE_URL`.
