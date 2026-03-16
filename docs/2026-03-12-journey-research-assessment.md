# AI-GOS Journey Research Assessment

Date: 2026-03-12
Scope: Journey research sections, current subsection coverage, current architecture, competitor intelligence quality, ad-library gaps, and the role of Meta Ads code.

## Executive Summary

The Journey flow currently runs a 7-section research model on paper, but only 6 sections are active in the live chat flow. `mediaPlan` still exists in schemas, state, and UI plumbing, but `researchMediaPlan` is explicitly disabled in the lead-agent prompt and omitted from the `/api/journey/stream` tool list.

The competitor issue is not caused by the Meta Ads API. The real problem is tool divergence. The repo contains a richer multi-platform ad-intel stack in `src/lib/ad-library/service.ts`, but the Journey competitor section does not use it. Journey competitor research dispatches to the Railway worker, and the worker uses a separate, summary-only `adLibrary` tool in `research-worker/src/tools/adlibrary.ts`. That worker tool does not run the richer LinkedIn/Meta/Google lookup flow, does not return click-through ad records, and does not expose Meta or LinkedIn ad-library links.

There is also a UI/data-model gap. The current Journey competitor schema and artifact panel only surface summary ad activity, themes, and threat hooks. The older strategic research experience still contains richer competitor UX patterns like platform search links, ad creative carousel support, pricing tiers, and extra competitor detail. That richer path did not survive the move to the Journey worker pipeline.

## Current Research Section Inventory

| Boundary Label | Canonical Section ID | Journey Status Now | Notes |
|---|---|---|---|
| Market Overview | `industryResearch` | Active | Runs after confirmed business model + ICP description |
| Competitor Intel | `competitorIntel` | Active | Runs after market overview + product + competitors |
| ICP Validation | `icpValidation` | Active | Runs after market overview + detailed ICP |
| Offer Analysis | `offerAnalysis` | Active | Runs after market overview + product/pricing context |
| Strategic Synthesis | `strategicSynthesis` | Active | Runs after the 4 core sections complete |
| Keywords | `keywordIntel` | Active | Runs after synthesis |
| Media Plan | `mediaPlan` | Dormant in Journey | Schema and plumbing exist, but `researchMediaPlan` is disabled in Journey |

## Section And Subsection Map

### 1. Market Overview

Schema groups now:
- `categorySnapshot`
- `marketDynamics`
- `painPoints`
- `messagingOpportunities`
- `psychologicalDrivers`
- `psychologicalDriversDetailed`
- `audienceObjections`
- `audienceObjectionsDetailed`
- `trendSignals`
- `seasonalityCalendar`

Rendered now in Journey artifact panel:
- Category Snapshot
- Pain Points
- Demand Drivers
- Buying Triggers
- Barriers to Purchase
- Trend Signals
- Messaging Opportunities

Not surfaced now:
- `macroRisks` inside `marketDynamics`
- detailed psychological drivers
- detailed objection handling
- seasonality calendar

### 2. Competitor Intel

Schema groups now:
- `competitors[]`
- `marketPatterns`
- `marketStrengths`
- `marketWeaknesses`
- `whiteSpaceGaps`
- `overallLandscape`

Per-competitor fields now:
- `name`
- `website`
- `positioning`
- `price`
- `pricingConfidence`
- `strengths`
- `weaknesses`
- `opportunities`
- `ourAdvantage`
- `adActivity`
- `adPlatforms`
- `offer`
- `funnels`
- `threatAssessment`

Rendered now in Journey artifact panel:
- competitor header with website, price, pricing confidence
- Strengths
- Weaknesses
- Opportunities
- Top Ad Hooks
- Our Advantage
- Ad Activity summary
- Counter Positioning
- Market Patterns
- White-Space Gaps

Not surfaced now:
- click-through ad records
- Meta ad-library link
- LinkedIn ad-library link
- Google advertiser/ad-transparency link
- ad creative gallery
- `marketStrengths`
- `marketWeaknesses`
- `overallLandscape`
- `offer`
- `funnels`
- `adPlatforms`

### 3. ICP Validation

Schema groups now:
- streaming summary fields
- `coherenceCheck`
- `painSolutionFit`
- `marketReachability`
- `economicFeasibility`
- `customerPsychographics`
- `triggerEvents`
- `segmentSizing`
- `samEstimate`
- `sensitivityAnalysis`
- `riskScores`
- `finalVerdict`
- `buyingCommittee`
- `platformAudienceSize`

Rendered now in Journey artifact panel:
- Validated Persona
- Audience Size
- Confidence
- Demographics
- Final Verdict
- Decision Process
- Best Channels
- Buying Triggers
- Core Objections
- Recommendations

Not surfaced now:
- coherence checks
- reachability and feasibility blocks
- psychographics
- trigger-event detail
- segment sizing
- SAM estimate
- sensitivity analysis
- risk matrix
- buying committee
- platform audience size

### 4. Offer Analysis

Schema groups now:
- `offerStrength`
- `recommendation`
- `redFlags`
- `pricingAnalysis`
- `marketFitAssessment`
- `messagingRecommendations`
- `offerClarity`
- `marketOfferFit`
- `strengths`
- `weaknesses`

Rendered now in Journey artifact panel:
- Overall Score
- Recommendation
- Recommendation Rationale
- Pricing Analysis
- Strengths
- Weaknesses
- Recommended Actions
- Messaging Recommendations
- Market Fit Assessment
- Red Flags

Not surfaced now:
- `offerClarity`
- `marketOfferFit`

### 5. Strategic Synthesis

Schema groups now:
- `keyInsights`
- `positioningStrategy`
- `platformRecommendations`
- `messagingAngles`
- `planningContext`
- `criticalSuccessFactors`
- `nextSteps`
- `strategicNarrative`
- `charts`

Rendered now in Journey artifact panel:
- Positioning Strategy
- Planning Context
- Charts
- Strategic Narrative
- Key Insights
- Platform Recommendations
- Messaging Angles
- Critical Success Factors
- Next Steps

Gap note:
- This section is the closest match between schema and UI.

### 6. Keyword Intel

Schema groups now:
- `totalKeywordsFound`
- `competitorGapCount`
- `campaignGroups`
- `topOpportunities`
- `recommendedStartingSet`
- `competitorGaps`
- `negativeKeywords`
- `confidenceNotes`
- `quickWins`

Rendered now in Journey artifact panel:
- delegated to `JourneyKeywordIntelDetail`

Gap note:
- Keyword detail is isolated in a dedicated component instead of being summarized inline in `artifact-panel.tsx`.

### 7. Media Plan

Schema groups now:
- current worker output: `dataSourced`, `channelPlan`, `launchSequence`, `creativeCalendar`, `kpiFramework`, `budgetSummary`
- legacy fields: `allocations`, `totalBudget`, `timeline`, `kpis`, `testingPlan`
- richer optional V3 fields: `executiveSummary`, `platformStrategy`, `icpTargeting`, `campaignStructure`, `creativeStrategy`, and more

Rendered now in Journey artifact panel:
- Monthly Budget
- North Star
- Budget Allocation
- Launch Sequence
- Weekly Review

Reality check:
- This section has the largest architecture mismatch.
- The UI can render it.
- The schemas support it.
- The worker tool exists.
- The Journey chat flow does not expose it.

## Architecture Running Today

Current Journey flow:

1. `/api/journey/stream` runs the lead chat agent with `askUser`, `competitorFastHits`, `scrapeClientSite`, and research dispatch tools.
2. Research tools like `researchCompetitors` do not execute the analysis in-process. They dispatch a job to the Railway worker through `dispatchResearch()`.
3. The Railway worker runs the section-specific runner, emits progress, validates JSON, and writes the result to Supabase.
4. The Journey UI listens for the streamed/persisted result and renders it in `ArtifactPanel`.

Important architecture facts:

- `researchMediaPlan` exists in the tool barrel but is not exposed in `/api/journey/stream`.
- The lead-agent system prompt explicitly says `researchMediaPlan` is temporarily disabled in Journey.
- `competitorFastHits` is a separate lead-agent shortcut path and does use the richer local `adLibraryTool`.
- The full competitor section does not use that richer path. It uses the worker runner instead.

## Competitor Intelligence Assessment

### What The Journey Competitor Section Actually Uses

Live Journey competitor flow:

`researchCompetitors`
-> `src/lib/ai/tools/research/research-competitors.ts`
-> `dispatchResearch('researchCompetitors', 'competitors', ...)`
-> Railway worker
-> `research-worker/src/runners/competitors.ts`
-> worker `adLibraryTool` + `spyfuTool` + native web search

The important detail is the worker `adLibraryTool`. That tool is not the same as the richer local ad-library stack.

### Why Competitor Results Feel Weak

#### Root Cause 1: Two different ad-library implementations drifted apart

Richer local path:
- `src/lib/ai/tools/mcp/ad-library-tool.ts`
- `src/lib/ad-library/service.ts`

What that richer path does:
- LinkedIn advertiser lookup
- Meta page-search -> page-id -> ad fetch
- Google advertiser lookup -> ad fetch
- multi-platform normalization
- creative-level records
- `detailsUrl` support
- relevance scoring

Worker path actually used by Journey competitor research:
- `research-worker/src/tools/adlibrary.ts`

What the worker path does:
- SearchAPI `google_ads_transparency` query by company name
- optional Foreplay fetch when Google results are sparse
- summary-only output: count, platforms, themes, evidence, sample messages

What it does not do:
- LinkedIn ad-library fetch
- Meta ad-library fetch
- Meta page-id lookup
- Google advertiser-id lookup
- creative-level result return
- `detailsUrl`
- click-through library URLs

Assessment:
- The repo contains the better implementation.
- The Journey competitor section is not using it.

#### Root Cause 2: The current Journey competitor schema is summary-oriented

The current Journey competitor schema supports:
- `adActivity.activeAdCount`
- `adActivity.platforms`
- `adActivity.themes`
- `adActivity.evidence`
- `adActivity.sourceConfidence`
- `threatAssessment.topAdHooks`

It does not currently support:
- `adCreatives[]`
- per-ad `detailsUrl`
- platform search links
- ad screenshots or carousel data

That means even if the worker were upgraded, the Journey payload and UI still would not expose:
- "click to see all ads"
- Meta Ad Library
- LinkedIn Ad Library
- Google advertiser/ad-transparency detail

#### Root Cause 3: The Journey UI only renders ad summaries

`src/components/journey/artifact-panel.tsx` renders:
- observed/active ad count
- coverage
- platforms
- themes
- evidence

It does not render:
- external platform links
- ad previews
- ad-level detail pages
- stored creative artifacts

The older strategic research UI still contains those richer patterns:
- platform search links in `src/components/strategic-research/sections/shared-helpers.ts`
- competitor platform link row in `src/components/strategic-research/sections/competitor-analysis-content.tsx`
- ad creative carousel support in `src/components/strategic-research/sections/competitor-analysis-content.tsx`

#### Root Cause 4: The result normalizer intentionally downgrades weak evidence

`research-worker/src/contracts.ts` can normalize sparse/low-confidence ad evidence to:
- `platforms: ['Not verified']`
- `Limited coverage: ...`

This is defensible because it avoids hallucinating live ad presence.
It also makes the Journey competitor section feel even thinner when the upstream tool only returned weak evidence in the first place.

#### Root Cause 5: Documentation drift is hiding the real behavior

Examples of drift:
- `docs/research-section-audit.md` says competitor runner uses `pagespeed`, but the current worker competitor runner imports only `adLibraryTool` and `spyfuTool`.
- The same audit describes an older simplified competitor schema, but the current Journey schema has already re-added fields like `threatAssessment`, `adActivity`, `offer`, and `funnels`.

Assessment:
- The docs are no longer a reliable source of truth for the current competitor implementation.
- The code paths need to be treated as authoritative.

## Meta Ads API Assessment

### Is Meta Ads polluting the competitor section?

Short answer:
- No, not directly.

Why:
- The Journey competitor runner uses `adLibraryTool` and `spyfuTool`.
- It does not import or invoke `metaAdsTool`.
- `src/lib/meta-ads/client.ts` is a first-party Meta Ads Manager client for account performance data.
- `research-worker/src/tools/meta-ads.ts` is wired into the media planner runner, not the competitor runner.

What Meta Ads is actually for:
- live spend, impressions, CTR, CPC, conversions from the advertiser's own Meta Ads account
- media planning and benchmark grounding

Why it still feels noisy:
- `metaAds` capability exists in the worker tool inventory
- Journey media plan is currently disabled
- sandbox and architecture surface more capability than the Journey user can actually use today

Assessment:
- The Meta Ads code is not degrading competitor output.
- It is adding conceptual clutter because it belongs to the media-planning path, not the current Journey competitor path.

## What Changed Versus The Older Richer Competitor Experience

Older strategic research experience still supports:
- competitor platform links
- ad creative carousel
- richer competitor cards
- pricing tiers
- ad messaging themes
- more detailed competitor presentation

Current Journey competitor experience supports:
- competitor summary cards
- price and pricing confidence
- strengths / weaknesses / opportunities
- top ad hooks
- summarized ad activity
- white-space gaps

Net result:
- the old flow was richer for creative/ad inspection
- the new Journey flow is faster and cleaner, but it dropped the inspection layer that made competitor ad intelligence actionable

## Recommendations

### 1. Use one ad-intel implementation everywhere

Recommended direction:
- make `src/lib/ad-library/service.ts` the only ad-intel implementation
- call it from the worker competitor tool
- retire or rewrite `research-worker/src/tools/adlibrary.ts`

Why:
- the current duplication is the core reason ad intelligence quality diverged

### 2. Add explicit competitor ad artifacts to the Journey payload

Needed additions:
- `adCreatives[]`
- `libraryLinks[]`
- `detailsUrl`
- platform source metadata

Without this, the user still cannot inspect competitor ads even if the upstream fetch improves.

### 3. Restore click-through UX in Journey competitor artifacts

Needed in the Journey panel:
- Meta Ad Library link
- LinkedIn Ad Library link
- Google advertiser/ad-transparency link
- optional ad carousel or screenshot strip

This is the exact gap the current competitor section is missing for practical research.

### 4. Clarify the role of Meta Ads code

Recommended cleanup:
- keep Meta Ads Manager code under media-plan ownership only
- rename or relocate it so it is clearly "first-party account performance", not "competitor research"
- do not surface Meta Ads capability in Journey UX if media plan remains disabled

### 5. Resolve the media-plan architecture mismatch

Choose one of these:
- re-enable `researchMediaPlan` in Journey and make section 7 real
- or remove/demote `mediaPlan` from the active Journey section model until it is ready

Current state is halfway:
- schema exists
- UI exists
- worker exists
- lead flow intentionally blocks it

### 6. Update the audit docs after the code path is fixed

Specifically:
- refresh `docs/research-section-audit.md`
- document which tool implementation powers Journey competitor research
- document that `mediaPlan` is disabled in Journey unless and until it is re-enabled

## Evidence Index

Primary files used for this assessment:

- `src/lib/journey/research-sections.ts`
- `src/lib/journey/schemas/industry-research.ts`
- `src/lib/journey/schemas/competitor-intel.ts`
- `src/lib/journey/schemas/icp-validation.ts`
- `src/lib/journey/schemas/offer-analysis.ts`
- `src/lib/journey/schemas/strategic-synthesis.ts`
- `src/lib/journey/schemas/keyword-intel.ts`
- `src/lib/journey/schemas/media-plan.ts`
- `src/app/api/journey/stream/route.ts`
- `src/lib/ai/prompts/lead-agent-system.ts`
- `src/lib/ai/journey-downstream-research.ts`
- `src/lib/ai/tools/research/research-competitors.ts`
- `src/lib/ai/tools/mcp/ad-library-tool.ts`
- `src/lib/ad-library/service.ts`
- `src/lib/meta-ads/client.ts`
- `research-worker/src/runners/competitors.ts`
- `research-worker/src/tools/adlibrary.ts`
- `research-worker/src/tools/meta-ads.ts`
- `research-worker/src/contracts.ts`
- `src/components/journey/artifact-panel.tsx`
- `src/components/strategic-research/sections/shared-helpers.ts`
- `src/components/strategic-research/sections/competitor-analysis-content.tsx`
- `docs/research-section-audit.md`
- `docs/ad-library-research-findings.md`
- `.planning/phases/23-ad-library-service/SUMMARY.md`
- `.planning/phases/24-competitor-ad-research/24-01-SUMMARY.md`
- `.planning/phases/26-competitor-intel-enhancement/26-01-SUMMARY.md`
