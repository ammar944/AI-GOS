# Journey Competitor And Research Architecture Assessment

Date: 2026-03-12
Repo: AI-GOS-main
Scope: current journey research sections, subsection structure, live architecture, competitor/ad intelligence gaps, and the role of Meta Ads API

## Executive Summary

- The codebase currently tells three overlapping stories:
  - a canonical 7-section journey research model,
  - a live 6-tool journey stream that stops at keyword intelligence,
  - and a separate 10-section media-plan system that still exists elsewhere in the repo.
- The competitor section is weak for ad intelligence because the live worker path does not use the richer multi-platform ad library service that already exists in the app layer.
- The live journey competitor artifact only stores and renders summary ad activity. It does not preserve raw ad creatives, per-ad links, or platform library URLs, so there is nothing clickable in the current UI.
- The Meta Ads API is not powering competitor intelligence. In the current code it is scoped to media-planner account-performance work. Treating it as a missing competitor feature is mixing two different concerns.
- The biggest structural issue is duplication: there are two `adLibrary` implementations with different behavior, plus older strategic-research UI that already solved the clickable-ad problem but was not carried into the journey artifact.

## What Is Different Right Now

### 1. Research model differences

- Canonical journey research map: 7 sections
  - `industryResearch`
  - `competitorIntel`
  - `icpValidation`
  - `offerAnalysis`
  - `strategicSynthesis`
  - `keywordIntel`
  - `mediaPlan`
- Live `/api/journey/stream` tool registration: only 6 research tools are exposed to the lead agent
  - `researchIndustry`
  - `researchCompetitors`
  - `researchICP`
  - `researchOffer`
  - `synthesizeResearch`
  - `researchKeywords`
- `researchMediaPlan` exists in the tool barrel, but it is not wired into the live journey stream route.
- Separate 10-section media-plan architecture still exists in `src/lib/media-plan/section-constants.ts`, which means the repo still carries a richer downstream planning system outside the main journey route.

### 2. Flow differences

- Canonical dependency map suggests:
  - three early sections can exist before synthesis,
  - then synthesis,
  - then keywords,
  - then media plan.
- Live journey route is more sequential and approval-gated:
  1. Market Overview
  2. Competitor Intel
  3. ICP Validation
  4. Offer Analysis
  5. Strategic Synthesis
  6. Keyword Intelligence
  7. Strategist mode
- Result: the code behaves like a staged artifact review loop, not a broadly parallel research pipeline.

### 3. Architecture differences

- Some docs describe in-process research execution as the current path.
- Live code shows the main journey research tools are thin dispatchers that send jobs to the Railway worker and return `queued`.
- That means the real runtime architecture is:
  1. Lead agent in `/api/journey/stream`
  2. research tool dispatch
  3. Railway worker runner
  4. Supabase persistence
  5. UI artifact display and review

## Current Research Sections And Subsections

### 1. Industry Research

Current section key: `industryResearch`

Subsections and structured groups:
- `categorySnapshot`
  - category
  - marketSize
  - marketMaturity
  - awarenessLevel
  - buyingBehavior
  - averageSalesCycle
  - seasonality
- `marketDynamics`
  - demandDrivers
  - buyingTriggers
  - barriersToPurchase
  - optional `macroRisks`
- `painPoints`
  - primary
  - secondary
- `messagingOpportunities`
  - summaryRecommendations
- optional enrichment groups
  - `psychologicalDrivers`
  - `psychologicalDriversDetailed`
  - `audienceObjections`
  - `audienceObjectionsDetailed`
  - `trendSignals`
  - `seasonalityCalendar`

### 2. Competitor Intel

Current section key: `competitorIntel`

Per-competitor subsections:
- identity and commercial basics
  - name
  - website
  - positioning
  - price
  - pricingConfidence
- competitor narrative
  - strengths
  - weaknesses
  - opportunities
  - ourAdvantage
- ad summary only
  - `adActivity.activeAdCount`
  - `adActivity.platforms`
  - `adActivity.themes`
  - `adActivity.evidence`
  - `adActivity.sourceConfidence`
- optional strategy depth
  - `adPlatforms`
  - `offer`
  - `funnels`
  - `threatAssessment`

Section-level subsections:
- `marketPatterns`
- `marketStrengths`
- `marketWeaknesses`
- `whiteSpaceGaps`
  - gap
  - type
  - evidence
  - exploitability
  - impact
  - recommendedAction
- `overallLandscape`

Important limitation:
- there is no `adCreatives[]`
- there is no `detailsUrl`
- there is no `libraryLinks`
- there is no platform-specific advertiser/library navigation object

### 3. ICP Validation

Current section key: `icpValidation`

Core subsections:
- validatedPersona
- demographics
- channels
- triggers
- objections
- decisionFactors
- audienceSize
- confidenceScore
- decisionProcess

Optional V3-style subsections already present:
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

### 4. Offer Analysis

Current section key: `offerAnalysis`

Subsections:
- `offerStrength`
- `recommendation`
- `redFlags`
- `pricingAnalysis`
- `marketFitAssessment`
- `messagingRecommendations`
- optional
  - `offerClarity`
  - `marketOfferFit`
  - `strengths`
  - `weaknesses`

### 5. Strategic Synthesis

Current section key: `strategicSynthesis`

Subsections:
- `keyInsights`
- `positioningStrategy`
- `platformRecommendations`
- `messagingAngles`
- `planningContext`
- `criticalSuccessFactors`
- `nextSteps`
- `strategicNarrative`
- optional `charts`

### 6. Keyword Intelligence

Current section key: `keywordIntel`

Subsections:
- `totalKeywordsFound`
- `competitorGapCount`
- `campaignGroups`
  - campaign
  - intent
  - recommendedMonthlyBudget
  - adGroups
- `topOpportunities`
- `recommendedStartingSet`
- `competitorGaps`
- `negativeKeywords`
- `confidenceNotes`
- `quickWins`

### 7. Media Plan

Canonical section key: `mediaPlan`

Current schema is richer than some older docs claim. It includes:
- `dataSourced`
- `channelPlan`
- `launchSequence`
- `creativeCalendar`
- `kpiFramework`
- `budgetSummary`
- legacy optional fields
  - `allocations`
  - `totalBudget`
  - `timeline`
  - `kpis`
  - `testingPlan`
- larger optional planning blocks
  - `executiveSummary`
  - `platformStrategy`
  - `icpTargeting`
  - `campaignStructure`
  - `creativeStrategy`

Important caveat:
- this section exists in schema and worker land, but not in the live journey stream tool registration.

## Current Architecture

### Live runtime path

1. `/api/journey/stream` runs the lead agent with tool calling.
2. The route persists field collection and completed research outputs to Supabase.
3. Journey research tools dispatch jobs to the Railway worker.
4. Worker runners execute per-section research with Anthropic tool runners.
5. Results persist back to Supabase and are shown in the artifact panel.
6. The user approves each artifact before the route advances to the next section.

### Why the architecture feels inconsistent

- Canonical section mapping is centralized and mirrored correctly.
- But tool exposure, docs, and UI capabilities are not aligned.
- Resulting drift:
  - schemas imply one capability level,
  - worker tools provide a narrower capability level,
  - old strategic-research UI shows a richer capability level,
  - live journey artifact renders only a summary level.

## Competitor Section Assessment

### What the current journey competitor section actually does well

- It preserves a clean structured artifact for:
  - competitor positioning,
  - pricing confidence,
  - strengths and weaknesses,
  - whitespace gaps,
  - basic ad activity summary,
  - optional threat scoring.

### What it is missing relative to the older strategic-research experience

- no ad carousel
- no per-ad creative cards
- no `detailsUrl` buttons
- no "Meta Library" / "LinkedIn Ads" / "Google Ads" navigation buttons
- no full creative list for each competitor
- no direct platform library links generated from competitor name/domain
- no visible separation between raw ad evidence and summarized interpretation

### Strongest root causes for weak ad results

#### Root cause 1. The live worker competitor tool is a different and weaker implementation

- The app-layer `adLibraryTool` uses `createAdLibraryService()` and calls `fetchAllPlatforms()` across LinkedIn, Meta, and Google.
- The worker competitor runner does not use that implementation.
- The worker-side `adLibraryTool` performs a simplified lookup:
  - SearchAPI `google_ads_transparency`
  - query by company name
  - optional Foreplay fallback
  - output only a summary object
- That means the current journey competitor artifact is not actually backed by the richer multi-platform ad library path.

Assessment:
- This is the single biggest reason the competitor ad output feels weaker than expected.

#### Root cause 2. The worker intentionally compresses ad intelligence into summary fields

- The competitor runner output format only asks for:
  - ad count
  - platforms
  - themes
  - evidence
  - source confidence
- It never asks for raw ads, ad URLs, or platform library links.
- Even a perfect ad lookup cannot survive into the final artifact with clickable detail because the schema does not preserve it.

Assessment:
- This is a schema-and-output-contract limitation, not just a retrieval limitation.

#### Root cause 3. The competitor runner explicitly deprioritizes deep ad coverage

- The system prompt says:
  - use web search first,
  - use ad library for at most 2 finalist competitor domains,
  - continue with web evidence if ad tools are slow or sparse.
- This keeps the section fast, but it guarantees partial ad coverage for many runs.

Assessment:
- Good for latency.
- Bad for a competitor artifact that is supposed to feel ad-forward and inspectable.

#### Root cause 4. The journey UI only renders summary ad activity

- The current journey artifact panel shows:
  - count
  - coverage
  - platforms
  - themes
  - evidence text
- There is no component path that renders actual creatives or outbound ad/library links for this journey artifact.

Assessment:
- Even if the backend were richer, the current journey UI would still hide most of it.

### Existing repo proof that the richer experience already existed

Older strategic-research components already support:
- `adCreatives[]`
- ad carousel display
- clickable `detailsUrl` buttons
- smart labels for Meta Library, LinkedIn Ads, and Google Ads
- generated platform search links for Meta Ad Library, LinkedIn Ad Library, and Google Ads Transparency

Assessment:
- This is a porting gap, not a greenfield problem.

## Meta Ads API Assessment

### What Meta Ads API is in this repo

- The worker `metaAdsTool` calls the Meta Marketing API for an authenticated ad account.
- It returns campaign performance data such as spend, impressions, clicks, CTR, CPM, CPC, conversions, and objective.
- The media planner runner uses `googleAdsTool`, `metaAdsTool`, and `ga4Tool` together to build account-aware media plans.

### What it is not

- It is not the competitor ad library.
- It does not fetch competitor creatives from Meta's public ad library.
- It is not used by the current journey competitor runner.

### Why it feels polluting

- The name is close to ad-library work, so it is easy to mentally mix them together.
- A repo audit doc recommends adding `metaAds` to lead-agent wrappers for parity, which encourages the wrong mental model.
- In reality, `metaAds` belongs to account-performance and activation planning, not competitor intelligence.

### Recommendation on Meta Ads API

- Keep `metaAds` scoped to media planning and account-data features.
- Do not position it as a missing capability in competitor intelligence.
- Remove or rewrite stale docs that imply `metaAds` should be part of the competitor research toolset.

## Recommended Direction

### Decision 1. Separate competitor ad intelligence from account-performance data

- Competitor intelligence:
  - public ad libraries
  - competitor creatives
  - library links
  - platform presence
- Account-performance intelligence:
  - Meta Ads Manager
  - Google Ads
  - GA4
  - live campaign benchmarks

### Decision 2. Consolidate to one ad-library implementation

- Preferred direction:
  - make the worker use the same multi-platform service or equivalent behavior as `src/lib/ad-library/service.ts`
- Avoid:
  - keeping one rich app-layer tool and one thin worker-layer tool with the same name

### Decision 3. Restore raw ad evidence in the competitor contract

Minimum additions:
- `adCreatives[]`
  - platform
  - headline
  - body
  - imageUrl
  - videoUrl
  - detailsUrl
  - firstSeen
  - lastSeen
- `libraryLinks`
  - metaLibraryUrl
  - linkedInLibraryUrl
  - googleAdvertiserUrl

### Decision 4. Restore the missing UI affordances

Bring back from the older strategic-research path:
- ad carousel
- clickable detail buttons
- platform library buttons
- clear separation between summary and evidence

### Decision 5. Clean up architecture drift

- Decide whether the live journey is:
  - a 6-step strategist-prep flow, or
  - a full 7-step flow including media plan
- Then align:
  - canonical section map
  - live tool registration
  - docs
  - UI labels

## Priority Assessment

### Highest priority

1. Replace or upgrade the worker competitor `adLibraryTool`.
2. Expand competitor output schema to preserve raw ad evidence.
3. Restore clickable ad/library UI in the journey competitor artifact.

### Medium priority

4. Remove stale documentation that suggests `metaAds` belongs in competitor research.
5. Resolve the 7-section versus 6-tool live journey mismatch.

### Lower priority

6. Unify the old strategic-research ad UX and the journey artifact system into a single reusable pattern.

## Key Evidence References

- Canonical 7-section map: `src/lib/journey/research-sections.ts:12-68`
- Worker mirror of section map: `research-worker/src/section-map.ts:6-16`
- Live sequential approval gating: `src/app/api/journey/stream/route.ts:383-561`
- Research tool barrel still exporting media plan: `src/lib/ai/tools/research/index.ts:4-10`
- Industry schema: `src/lib/journey/schemas/industry-research.ts:4-77`
- Competitor schema: `src/lib/journey/schemas/competitor-intel.ts:19-60`
- ICP schema: `src/lib/journey/schemas/icp-validation.ts:8-198`
- Media-plan schema: `src/lib/journey/schemas/media-plan.ts:4-260`
- Current journey competitor UI summary rendering: `src/components/journey/artifact-panel.tsx:431-560`
- Rich app-layer ad library wrapper: `src/lib/ai/tools/mcp/ad-library-tool.ts:1-45`
- Rich shared ad library service: `src/lib/ad-library/service.ts:1-260`
- Fast-hits tool using app-layer ad library: `src/lib/ai/tools/competitor-fast-hits.ts:1-119`
- Worker competitor runner using thin ad tool and compression rules: `research-worker/src/runners/competitors.ts:34-180`
- Worker ad-library summary implementation: `research-worker/src/tools/adlibrary.ts:107-303`
- Meta Ads worker tool: `research-worker/src/tools/meta-ads.ts:34-91`
- Media planner using Meta Ads account data: `research-worker/src/runners/media-planner.ts:17-156`
- Old strategic-research ad carousel buttons: `src/components/strategic-research/ad-carousel/ad-creative-card.tsx:400-423`
- Old strategic-research ad carousel usage in competitor section: `src/components/strategic-research/sections/competitor-analysis-content.tsx:980-998`
- Old platform search links: `src/components/strategic-research/sections/shared-helpers.ts:119-149`
- Old strategic blueprint competitor output carrying `adCreatives[]`: `src/lib/strategic-blueprint/output-types.ts:539-558`
- Stale audit recommendation to add `metaAds` to lead-agent wrappers: `docs/research-section-audit.md:565-570`

## Bottom Line

The competitor section is underpowered because the live journey path compresses ad intelligence too early and uses the wrong ad-library implementation for the richer experience you want.

The missing clickable ads, full ad lists, and Meta/LinkedIn library navigation are not caused by the absence of Meta Ads API. They are missing because the current competitor contract and UI were simplified, while the richer ad experience stayed behind in the older strategic-research stack.
