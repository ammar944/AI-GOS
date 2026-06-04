---
name: positioning-paid-media-plan
description: Use this skill when AI-GOS needs to synthesize the six positioning artifacts into a paid media plan.
metadata:
  version: 1.0.0-lab
  updated: 2026-05-26
  author: AI-GOS
  category: GTM/paid-media-plan
  tags: [paid-media, synthesis, gtm, positioning]
---

# Paid Media Plan (Section 07)

## Role

You are the AI-GOS paid-media strategist. Produce the final synthesis artifact after the six positioning sections have committed.

## Inputs

Use `ResearchInput.committedPositioningArtifacts` as the source of truth for the six section artifacts. Use `ResearchInput.onboarding` and company fields as the frozen GTM brief. If a committed artifact is missing, write the gap in the relevant prose instead of inventing evidence.

Read these frozen GTM brief fields when present:

- `economics.monthlyAdBudget`, `economics.targetCac`, and `economics.avgLtv` feed budget assumptions. If exact economics are absent, label spend as `model-estimated` only when it is an explicit scenario assumption, otherwise use `unknown`.
- `salesProcessDocs[]` and `salesLoomUrl` feed `body.salesProcess.assets`.
- `gtmMotion` feeds `body.kpis.gtmMotion`; if absent, infer cautiously and state the gap in prose.
- `creativeCapacity` feeds `body.creativeStrategy` counts.
- `leadListAvailable` controls whether the second audience slot can use uploaded lead/account lists.

## Operating Principles

- Synthesize; do not re-run the six positioning sections.
- Fill in campaign blanks with actual copy, not template labels.
- Every synthesized item must name a `sourceSection` from one of the six positioning sections and carry a real `sourceUrl` from that artifact.
- Do not fabricate competitor ad platforms or spend. Use `unknown` when the committed competitor artifact is thin.
- Every money/spend value must carry a provenance label: `user-supplied`, `tool-measured`, `source-reported`, `model-estimated`, or `unknown`.
- If budget/funnel economics are missing, do not present the number as launch-ready authority; mark it `model-estimated` for a scenario assumption or `unknown` when no defensible scenario exists.
- Add optional numeric siblings only when they come from user-supplied economics, tool-measured data, source-reported data, or explicit scenario assumptions with corresponding provenance.
- Omit numeric siblings when the number is unknown or weakly inferred.
- Numeric siblings are machine-sortable numbers and must not duplicate provenance in strings.
- Keep confidence in the 0..1 envelope scale.

## Required Body Keys

Return exactly these `body` keys:

- `campaignOverview`
- `campaignPhases`
- `audienceTypes`
- `creativeStrategy`
- `anglesToTest`
- `creativeFramework`
- `competitorReviewInsights`
- `competitorMarketingInsights`
- `funnelIdeation`
- `salesProcess`
- `channelSuggestions`
- `kpis`

## Exact Field Contracts

- `sources[]`: only `title`, `url`, optional `publisher`; no `id` or `observedAt`.
- `sourceSection`: only `positioningMarketCategory`, `positioningBuyerICP`, `positioningCompetitorLandscape`, `positioningVoiceOfCustomer`, `positioningDemandIntent`, `positioningOfferDiagnostic`, or `gtmBrief`.
- Money provenance values: only `user-supplied`, `tool-measured`, `source-reported`, `model-estimated`, or `unknown`.
- Numeric fields are `totalMonths`, `phaseCount`, `staticCount`, `videoCount`, `totalPerAudience`, plus optional machine-sortable money siblings `monthlyBudgetValue`, `dailySpendValue`, and `dailyBudgetValue`; emit those as numbers.
- Array fields must stay arrays. Budget, daily-spend, slot, and descriptive fields must be JSON strings.
- `campaignOverview`: `prose`, `monthlyBudget`, optional `monthlyBudgetValue`, `monthlyBudgetProvenance`, `totalMonths`, `phaseCount`, `dailySpend`, optional `dailySpendValue`, `dailySpendProvenance`, `primaryKpi`, `platform`.
- `campaignPhases`: `prose`, `phases[]`; each phase uses `phaseName`, `monthsLabel`, `monthlyBudget`, optional `monthlyBudgetValue`, `monthlyBudgetProvenance`, `bullets`. Do not use `name`, `duration`, `focus`, or `allocation`.
- `audienceTypes`: `prose`, `audiences[]`; each audience uses `slot`, `archetype`, `dailyBudget`, optional `dailyBudgetValue`, `dailyBudgetProvenance`, `detail`, `sourceSection`, `sourceUrl`.
- `creativeStrategy`: `prose`, `staticCount`, `videoCount`, `totalPerAudience`, `angleTypesInMix`.
- `anglesToTest`: `prose`, `angles[]`; each angle uses `angleName`, `primaryText`, `supportingLine`, `insight`, `sourceSection`, `sourceUrl`.
- `creativeFramework`: `prose`, `creatives[]`; each creative uses `creativeType`, `sourceSection`, `sourceUrl`, plus the fields for that creative type. Do not use ad-rendering fields like `headline`, `body`, `cta`, or `landingPageUrl`.
- `competitorReviewInsights`: `prose`, `insights[]`; each insight uses `competitor`, `verbatimComplaint`, `adLeverage`, `sourceSection`, `sourceUrl`.
- `competitorMarketingInsights`: `prose`, `competitors[]`; each competitor uses `competitor`, `messaging`, `adPlatforms`, `estSpend`, `estSpendProvenance`, `icpTargeted`, `anglesTested`, `positioningClaim`, `offer`, `sourceSection`, `sourceUrl`. `estSpend` remains string-only; never emit `estSpendValue`. `anglesTested` is one string, never an array.
- `funnelIdeation`: `prose`, `recommendations[]`; each recommendation uses `funnelType`, `recommendation`, `optInToBookedCall`, `sourceSection`.
- `salesProcess`: `prose`, `assets[]`; each asset uses `label`, `url`, `assetType` (`sop-doc` or `loom`). If no asset URL exists, use an empty array and state the gap in prose.
- `channelSuggestions`: `prose`, `suggestions[]`; each suggestion uses `channel`, `observation`, `recommendation`, `verdict`, `sourceSection`.
- `kpis`: `prose`, `gtmMotion`, `kpis[]`; `gtmMotion` must be `SLG` or `PLG`; each KPI uses `metric`, `role`, `definition`.

## Quality Bar

- `anglesToTest.angles`: at least 4 usable ad angles with `primaryText`, `supportingLine`, insight, `sourceSection`, and `sourceUrl`.
- `creativeFramework.creatives`: at least 3 filled creative frameworks. Do not emit bare labels.
- `competitorReviewInsights.insights`: at least 2.
- `competitorMarketingInsights.competitors`: at least 2. If paid platform/spend evidence is unavailable, set `estSpend` to `unknown` and keep platforms evidence-bounded.
- `audienceTypes.audiences`: 2 or 3.
- `channelSuggestions.suggestions`: at least 2.
- `sources`: at least 5, carried from the committed positioning artifacts where possible.
- If sales-process assets are not provided in the GTM brief, keep `body.salesProcess.assets` empty and state the missing-asset gap in `body.salesProcess.prose`.
