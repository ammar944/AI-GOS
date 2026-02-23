# Media Plan Pipeline — Technical Reference

Complete documentation of the media plan generation pipeline: all 10 sections, inputs, AI prompts, deterministic math, and validation rules.

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [All Inputs](#2-all-inputs)
3. [Section 1: Executive Summary](#3-section-1-executive-summary)
4. [Section 2: Platform Strategy](#4-section-2-platform-strategy)
5. [Section 3: ICP Targeting](#5-section-3-icp-targeting)
6. [Section 4: Campaign Structure](#6-section-4-campaign-structure)
7. [Section 5: Creative Strategy](#7-section-5-creative-strategy)
8. [Section 6: Budget Allocation](#8-section-6-budget-allocation)
9. [Section 7: Campaign Phases](#9-section-7-campaign-phases)
10. [Section 8: KPI Targets](#10-section-8-kpi-targets)
11. [Section 9: Performance Model](#11-section-9-performance-model)
12. [Section 10: Risk Monitoring](#12-section-10-risk-monitoring)
13. [Deterministic Validation Layer](#13-deterministic-validation-layer)
14. [Ad Copy Generator (Bonus)](#14-ad-copy-generator-bonus)
15. [Cost Estimation](#15-cost-estimation)
16. [SSE Streaming Protocol](#16-sse-streaming-protocol)

---

## 1. Pipeline Overview

**Orchestrator:** `src/lib/media-plan/pipeline.ts`
**API Route:** `src/app/api/media-plan/generate/route.ts` (POST, `maxDuration=300`)

### Three-Phase Architecture

```
Phase 1: Research (Parallel)          ─── Perplexity Sonar Pro ───
  ├── Platform Strategy Research
  ├── ICP Targeting Research
  └── KPI Benchmarks Research
          │
          ▼
Phase 2: Synthesis + Validation       ─── Claude Sonnet ───
  Wave 1 (5s stagger):
    ├── Campaign Structure (8K tokens)
    └── Creative Strategy (5K tokens)
  Wave 2 (3s stagger):
    ├── Campaign Phases (4K tokens)
    └── Budget + Monitoring (4.5K tokens)
  Validation (deterministic, no AI):
    ├── 2A: Budget math validation
    ├── 2B: CAC model computation
    ├── 2C: KPI reconciliation
    ├── 2D: Cross-section consistency
    ├── 2D.5: Per-platform daily budget validation
    ├── 2E: ACV + platform minimum compliance
    ├── 2F: Campaign naming conventions
    ├── 2G: Phase budget reconciliation
    ├── 2G.5: Monthly roadmap ↔ phase reconciliation
    └── 2H: Retargeting pool realism
          │
          ▼
Phase 3: Final Synthesis (Parallel)   ─── Claude Sonnet ───
  ├── Executive Summary (2K tokens)
  └── Risk Monitoring (3.5K tokens)
          │
          ▼
Post-Assembly:
  ├── Timeline consistency check
  ├── Risk P×I scoring
  └── Stale reference sweep (deep walk-and-replace)
```

### Retry & Error Handling

- **Schema retry:** Up to 2 retries on `NoObjectGeneratedError`
- **Rate limit retry:** Up to 3 retries with exponential backoff (15s × attempt)
- Rate limit retries do NOT count against schema retries

---

## 2. All Inputs

### From Onboarding Form (`OnboardingFormData`)

| Field | Used By | Purpose |
|-------|---------|---------|
| `budgetTargets.monthlyAdBudget` | Budget validation, CAC model, all contexts | Total monthly ad spend |
| `budgetTargets.targetCpl` | CAC model, KPI research | Client's target CPL (default $75) |
| `budgetTargets.targetCac` | KPI context | Client's target CAC |
| `budgetTargets.dailyBudgetCeiling` | Budget context | Max daily spend |
| `budgetTargets.campaignDuration` | Campaign phases context | Campaign timeline |
| `budgetTargets.targetSqlsPerMonth` | KPI context | Target SQL volume |
| `budgetTargets.targetDemosPerMonth` | KPI context | Target demo volume |
| `productOffer.offerPrice` | CAC model, LTV calculation, ACV check | Primary pricing |
| `productOffer.pricingModel` | Retention multiplier, ACV calculation | Subscription/annual/one-time |
| `productOffer.pricingTiers` | Client brief context | Multi-tier pricing |
| `productOffer.currentFunnelType` | Platform strategy context | Funnel types |
| `icp.geography` | All contexts | Geographic targeting |
| `icp.industryVertical` | All contexts | Industry vertical |
| `icp.primaryIcpDescription` | All contexts | ICP description |
| `icp.jobTitles` | ICP context | Target job titles |
| `icp.companySize` | Platform compliance, all contexts | Company size ranges |
| `customerJourney.*` | ICP targeting context | Pain points, objections, sales cycle |
| `brandPositioning.*` | Creative strategy context | Brand voice, positioning |
| `compliance.*` | Campaign structure, risk contexts | Topics to avoid, claim restrictions |
| `businessBasics.*` | Client brief | Business name, website URL |

### From Strategic Blueprint (`StrategicBlueprintOutput`)

| Field | Used By | Purpose |
|-------|---------|---------|
| `crossAnalysisSynthesis.recommendedPlatforms` | Platform strategy context | Platform recommendations |
| `crossAnalysisSynthesis.messagingFramework.adHooks` | Creative strategy context | Ad hooks with techniques |
| `competitorAnalysis.competitors` | Campaign structure, creative strategy | Competitor names, ad platforms, weaknesses |
| `competitorAnalysis.whiteSpaceGaps` | Creative strategy, campaign structure | Scored messaging/channel gaps |
| `competitorAnalysis.creativeLibrary` | Creative strategy context | Competitor creative intel |
| `icpAnalysisValidation.coherenceCheck` | Platform strategy context | ICP reachability |
| `icpAnalysisValidation.painSolutionFit` | ICP targeting context | Pain-solution analysis |
| `icpAnalysisValidation.sensitivityAnalysis` | Campaign phases, budget, 3-scenario CAC | Best/base/worst case scenarios |
| `icpAnalysisValidation.segmentSizing` | Budget context | Segment budget weights |
| `icpAnalysisValidation.riskScores` | Risk monitoring context | Inherited ICP risks |
| `icpAnalysisValidation.samEstimate` | Executive summary context | Market sizing |
| `icpAnalysisValidation.triggerEvents` | Campaign structure context | Trigger-based targeting |
| `industryMarketOverview.categorySnapshot` | KPI benchmarks context | Market maturity, buying behavior |
| `offerAnalysisViability.offerStrength` | Creative strategy, KPI context | Offer score, proof level |
| `offerAnalysisViability.redFlags` | Risk monitoring context | Offer risks |
| `keywordIntelligence.highIntentKeywords` | Campaign structure, KPI contexts | CPC data, keyword targeting |
| `keywordIntelligence.paidGaps` | Campaign structure context | Competitor keyword gaps |
| `keywordIntelligence.clientDomain.paidKeywords` | Retargeting validation | Existing paid traffic check |
| `keywordIntelligence.clientDomain.organicKeywords` | Retargeting validation | Existing organic traffic check |

### Context Builders

Each AI call receives a focused context string (~1,500 tokens) built by dedicated functions in `src/lib/media-plan/phase-context-builders.ts`:

| Builder | Sections Included |
|---------|-------------------|
| `buildPlatformStrategyContext` | Client brief, blueprint platform recs, competitor ad platforms, ICP reachability, funnel types |
| `buildICPTargetingContext` | Client brief, ICP validation verdict, pain-solution fit, customer journey |
| `buildKPIBenchmarksContext` | Client brief, industry context, offer score, keyword CPC data, client targets |
| `buildCampaignStructureContext` | Client brief, validated platforms, ICP segments, competitors, high-intent keywords, paid gaps, trigger events, white space gaps, compliance |
| `buildCreativeStrategyContext` | Client brief, competitor creative intel, white space gaps, primary threats, active platforms, ad hooks, competitor weaknesses, offer proof score, brand positioning |
| `buildCampaignPhasesContext` | Client brief, platforms with monthly spend, primary KPIs, campaign duration, sensitivity analysis |
| `buildBudgetMonitoringContext` | Client brief, validated platforms, campaigns with daily budgets, primary KPIs, segment budget weights, sensitivity analysis |
| `buildExecutiveSummaryContext` | Client brief, SAM estimate, platform strategy, budget, CAC model, campaign phases, KPIs, validated performance targets |
| `buildRiskMonitoringContext` | Client brief, platforms + budget, CAC model, creative approach, ICP risk scores, offer red flags, compliance, validated performance targets |

Every context includes a **shared Client Brief** block:
```
## Client Brief
- Business: [name]
- Website: [url]
- Monthly Ad Budget: $X,XXX
- Offer Price: $X / Pricing Model: [model]
- Geography: [geo]
- Industry: [vertical]
- ICP: [description]
- Job Titles: [titles]
- Company Sizes: [sizes]
```

---

## 3. Section 1: Executive Summary

**Phase:** 3 (Final Synthesis)
**Model:** Claude Sonnet
**Max Output Tokens:** 2,048
**Temperature:** 0.4

### Schema

```typescript
interface MediaPlanExecutiveSummary {
  overview: string;                    // 2-3 sentence strategy overview
  primaryObjective: string;            // e.g., "40 SQLs/month at <$75 CPL"
  recommendedMonthlyBudget: number;    // Must match actual budget exactly
  timelineToResults: string;           // e.g., "4-6 weeks"
  topPriorities: string[];             // 3 specific, actionable priorities
}
```

### Full System Prompt

```
You are a media strategy director writing an executive summary of a completed media plan.

TASK: Write a concise executive summary that accurately reflects the actual plan data provided below.

RULES:
- The overview must reference specific platforms, budget amounts, and expected outcomes from the plan
- recommendedMonthlyBudget MUST match the actual budget from the plan
- topPriorities must be specific and actionable, not generic advice
- timelineToResults must be realistic given the phased rollout plan
- primaryObjective should cite specific numbers (leads, SQLs, CAC) from the performance model
- You MUST use the exact validated performance targets provided in the "Validated Performance
  Targets" section of the context. Do not substitute industry benchmarks, round numbers, or
  estimate different values.
- The primaryObjective MUST state the exact CPL, SQL volume, customer count, and CAC from the
  validated targets.
- recommendedMonthlyBudget MUST exactly match the validated monthly budget — not a rounded or
  estimated version.
- Do not mention a CAC target that differs from the computed CAC in the performance model.
- If a number appears in the "Validated Performance Targets" section, use that exact number.
- When SAM data is available in context, include the serviceable addressable market size and
  annual contract value to frame the opportunity.
- When sensitivity analysis scenarios are available, reference the base case for primary targets
  and acknowledge worst case as the contingency floor.
- When referencing benchmarks or industry data, use ONLY data provided in the context. Do NOT
  fabricate source names, report titles, or citations.
```

### Post-Processing

- **Timeline reconciliation:** Warns if executive summary timeline differs from Phase 1 duration by >2 weeks

---

## 4. Section 2: Platform Strategy

**Phase:** 1 (Research)
**Model:** Perplexity Sonar Pro
**Post-Processing:** Deterministic (high-density flagging)

### Schema

```typescript
interface PlatformStrategy {
  platform: string;                           // "Meta", "LinkedIn", "Google"
  rationale: string;
  budgetPercentage: number;                   // 0-100, all must sum to 100
  monthlySpend: number;                       // totalBudget × percentage / 100
  campaignTypes: string[];
  targetingApproach: string;
  expectedCplRange: { min: number; max: number };
  priority: 'primary' | 'secondary' | 'testing';
  adFormats: string[];
  placements: string[];
  synergiesWithOtherPlatforms: string;
  competitiveDensity?: number;                // 1-10 (10=saturated)
  audienceSaturation?: 'low' | 'medium' | 'high';
  platformRiskFactors?: string[];             // 1-3 specific risks
  qvcScore?: number;                          // Quality-vs-Cost weighted (0-10)
  qvcBreakdown?: {
    targetingPrecision: number;               // 30% weight
    leadQuality: number;                      // 25% weight
    costEfficiency: number;                   // 20% weight
    competitorPresence: number;               // 15% weight
    creativeFormatFit: number;                // 10% weight
  };
  belowMinimum?: boolean;
}
```

### Full System Prompt — Platform Selection Decision Framework

**7-step framework applied in order:**

#### Step 1: ACV-Based Exclusions
| ACV Range | Rule |
|-----------|------|
| < $3,000/yr | EXCLUDE LinkedIn (CPL too high) |
| > $5,000/yr | EXCLUDE Meta cold traffic (retargeting only) |
| < $1,000/yr | CONSIDER TikTok/Reddit for volume |

#### Step 2: Company Size Routing
| ICP Size | Primary Platforms |
|----------|-------------------|
| < 50 employees | Meta + Google (LinkedIn underperforms for SMB) |
| 50-500 employees | LinkedIn + Google |
| 500+ employees | LinkedIn primary + ABM, Google secondary, EXCLUDE Meta |

#### Step 3: Budget-to-Platform Count Gating
| Monthly Budget | Max Platforms |
|----------------|---------------|
| < $5,000 | 1 platform only |
| $5,000-$15,000 | Max 2 |
| $15,000-$30,000 | Max 2-3 |
| > $30,000 | 3+ viable |

#### Step 4: Platform Minimum Budget Check
| Platform | Minimum | Flag if Below |
|----------|---------|---------------|
| Meta | $3,000/mo | `belowMinimum: true` |
| Google | $5,000/mo | `belowMinimum: true` |
| LinkedIn | $5,000/mo | `belowMinimum: true` |

#### Step 5: QvC Scoring Formula

```
QvC = (Targeting × 0.30) + (Quality × 0.25) + (Cost × 0.20) + (Competitor × 0.15) + (Format × 0.10)
```

| Factor | Weight | Description |
|--------|--------|-------------|
| ICP Targeting Precision | 30% | How precisely can platform reach exact ICP (10=exact job title + company) |
| Lead Quality Signal | 25% | How qualified are leads from this platform for this vertical |
| Cost Efficiency | 20% | Inverse of expected CPL relative to budget |
| Competitor Presence | 15% | Are competitors actively advertising here (presence = validated) |
| Creative Format Fit | 10% | Do available ad formats match client's content strengths |

#### Step 6: Budget Allocation from QvC
| Tier | Budget Share |
|------|-------------|
| Primary (highest QvC) | 50-65% |
| Secondary | 25-35% |
| Testing/tertiary | 10-20% |

#### Step 7: Platform Synergy
Describe cross-platform funnel: awareness → intent capture → conversion

### Deterministic Post-Processing

```typescript
// If competitiveDensity >= 8, prepend warning to rationale:
"⚠ HIGH COMPETITIVE DENSITY (X/10) — expect elevated CPMs and aggressive bid competition."
```

---

## 5. Section 3: ICP Targeting

**Phase:** 1 (Research)
**Model:** Perplexity Sonar Pro
**Post-Processing:** Sort segments by priorityScore descending

### Schema

```typescript
interface ICPTargeting {
  segments: AudienceSegment[];               // 2-4 ordered by priority
  platformTargeting: PlatformTargeting[];    // One per platform
  demographics: string;
  psychographics: string;
  geographicTargeting: string;
  reachabilityAssessment: string;
  overlapWarnings?: string[];                // Segment overlaps >30%
}

interface AudienceSegment {
  name: string;
  description: string;
  targetingParameters: string[];             // 2-8 platform-specific options
  estimatedReach: string;                    // e.g., "120K-250K on Meta"
  funnelPosition: 'cold' | 'warm' | 'hot';
  priorityScore?: number;                    // 1-10 (reachability × relevance)
  targetingDifficulty?: 'easy' | 'moderate' | 'hard';
}

interface PlatformTargeting {
  platform: string;
  interests: string[];                       // Max 10
  jobTitles: string[];
  customAudiences: string[];
  lookalikeAudiences: string[];
  exclusions: string[];                      // Mandatory
}
```

### Full System Prompt

```
You are a paid advertising targeting specialist with access to real-time web data.

TASK: Research and define audience segments and targeting strategies for paid advertising platforms.

RESEARCH FOCUS:
- Real audience sizes per segment per platform (from platform audience insights or industry reports)
- Current targeting options actually available on each platform (Meta taxonomy changes frequently)
- Job title and interest targeting that currently works for this vertical
- Custom and lookalike audience strategies with realistic seed sizes
- Exclusion lists based on current best practices
- Segment priority scoring: Score each segment 1-10 based on reachability × ICP relevance
- Targeting difficulty: easy (broad interest match) / moderate (job title + company size) /
  hard (requires custom audiences or lookalikes only)
- Audience overlap analysis: Identify >30% overlaps with exclusion recommendations

QUALITY STANDARDS:
- Audience reach estimates MUST cite platform-specific ranges, not guesses
- Targeting parameters must be real options currently available on the platform
- Include at least one cold prospecting and one warm retargeting segment
- Exclusions are mandatory: existing customers, job seekers, irrelevant demographics
```

---

## 6. Section 4: Campaign Structure

**Phase:** 2A (Wave 1 Synthesis)
**Model:** Claude Sonnet
**Max Output Tokens:** 8,000

### Schema

```typescript
interface CampaignStructure {
  campaigns: CampaignTemplate[];              // 3-6 campaigns (2-10 max)
  namingConvention: NamingConvention;
  retargetingSegments: RetargetingSegment[];  // 2-4 segments
  negativeKeywords: NegativeKeyword[];        // 5-10 (empty if no search)
}

interface CampaignTemplate {
  name: string;                               // Must follow naming convention
  objective: string;
  platform: string;                           // Must match platformStrategy
  funnelStage: 'cold' | 'warm' | 'hot';
  dailyBudget: number;
  adSets: AdSetTemplate[];                    // 1-3 per campaign
  notes?: string;
}

interface AdSetTemplate {
  name: string;
  targeting: string;                          // From ICP targeting data
  adsToTest: number;                          // 1-10 (recommend 3-5)
  bidStrategy: string;
}

interface NamingConvention {
  campaignPattern: string;
  adSetPattern: string;
  adPattern: string;
  utmStructure: { source: string; medium: string; campaign: string; content: string };
}

interface RetargetingSegment {
  name: string;
  source: string;
  lookbackDays: number;
  messagingApproach: string;
}

interface NegativeKeyword {
  keyword: string;
  matchType: 'exact' | 'phrase' | 'broad';
  reason: string;
}
```

### Full System Prompt

The campaign structure prompt includes the Meta ACV gate and all three platform-specific templates. Key rules:

**Meta ACV Gate:**
```
Calculate ACV: if monthly pricing → offerPrice × 12, if annual → offerPrice

If ACV > $5,000:
  - Meta COLD campaigns NOT recommended
  - ONLY warm/hot campaigns (website visitors, video viewers, lead form engagers, lookalikes)
  - No interest-based or job-title cold targeting on Meta
  - Override requires explicit note: "ACV override: [reason]"
```

**Funnel Split:** Cold 50-70%, Warm 20-30%, Hot 10-20%

### Platform-Specific Campaign Templates

#### LinkedIn Campaigns (3-4 depending on budget)

| # | Campaign | Budget Share | Activation | Key Details |
|---|----------|-------------|------------|-------------|
| 1 | CTV/Awareness | 10-15% | Immediate | Video ads 15-60s, ICP job titles. **Skip if budget < $6K/mo** |
| 2 | Prospecting Lead Gen | 50-60% | Immediate | Lead Gen Forms, 2-3 ad sets (primary + secondary segment + ABM optional) |
| 3 | MoFu Thought Leadership | 15-20% | Week 2-3 | Case studies, website visitors 30d + video viewers 50%+ |
| 4 | Retargeting | 10-15% | Week 3-4 | Conversation Ads (2 paths: objection → demo, alt → nurture) + Image |

#### Google Campaigns (3-4)

| # | Campaign | Budget Share | Key Details |
|---|----------|-------------|-------------|
| 1 | Brand | 10-15% | Client brand terms, RSA + sitelinks, Target Impression Share |
| 2 | Competitor Branded **MANDATORY** | 25-35% | Each competitor: [name], [name] alternative/vs/pricing/reviews |
| 3 | Non-Branded High-Intent | 35-45% | Solution + problem-aware keywords from research. Negatives include competitor names |
| 4 | Display/YouTube Remarketing | 10-15% | Website visitors 90d + YouTube viewers. Activates Week 3-4 |

#### Meta Campaigns (2-3)

| # | Campaign | Budget Share | Key Details |
|---|----------|-------------|-------------|
| 1 | Lead Gen Form | 50-60% | Interest + Job Title + 1% Lookalike. 3x UGC + 3x Static + 2x Demo |
| 2 | Website Conversions | 30-40% | Interest + retargeting (30d visitors, video 50%+, lead form openers) |
| 3 | Brand Awareness/Video | 10% | **Only if budget > $5K/mo.** Broad ICP interests |

### Standard Retargeting Windows

| Segment | Lookback | Messaging |
|---------|----------|-----------|
| Website visitors all pages | 7 days | Urgency, limited offer |
| Website visitors all pages | 30 days | Social proof, case studies |
| Website visitors pricing/demo | 14 days | Objection handling |
| Video viewers 50%+ | 30 days | Deeper product education |
| Lead form openers not submitted | 14 days | Reduce friction, alternative CTA |

### Naming Convention
```
Pattern: [Client]_[Platform]_[Objective]_[Audience]_[Year]
Platform codes: LI, GG, META, TT, YT
Year: Current year (dynamic)
Prohibited terms: "financing", "credit", "loan", "insurance"
```

---

## 7. Section 5: Creative Strategy

**Phase:** 2A (Wave 1 Synthesis)
**Model:** Claude Sonnet
**Max Output Tokens:** 5,000

### Schema

```typescript
interface CreativeStrategy {
  angles: CreativeAngle[];                    // 3-5 ordered by priority
  formatSpecs: FormatSpec[];                  // 2-4 per platform
  testingPlan: CreativeTestingPlan[];         // 2-3 phases
  refreshCadence: CreativeRefreshCadence[];   // One per platform
  brandGuidelines: BrandGuideline[];          // 3-5 guidelines
}

interface CreativeAngle {
  name: string;
  description: string;
  exampleHook: string;                        // SPECIFIC, not template
  bestForFunnelStages: ('cold' | 'warm' | 'hot')[];
  platforms: string[];
}

interface FormatSpec {
  format: string;
  dimensions: string;
  platform: string;
  copyGuideline: string;
}

interface CreativeTestingPlan {
  phase: string;
  variantsToTest: number;
  methodology: string;
  testingBudget: number;
  durationDays: number;
  successCriteria: string;
}

interface CreativeRefreshCadence {
  platform: string;
  refreshIntervalDays: number;
  fatigueSignals: string[];
}
```

### Full System Prompt

```
You are a creative strategist for performance advertising with 10+ years of experience.

TASK: Develop a creative strategy with angles, format specs, testing plan, refresh cadence,
and brand guidelines.

RULES:
- Minimum 3 creative angles, each with a SPECIFIC example hook using the client's actual data
- Do NOT use generic hooks like "Struggling with X?" — use specific statistics, competitor
  gaps, or ICP pain points
- Reference competitor creative formats from the data. If competitors overuse static images,
  recommend UGC video
- Testing plan must be phased:
    Phase 1: tests hooks/messages
    Phase 2: tests formats/visuals
    Phase 3: scales winners
- Refresh cadence: Meta 14-21d, LinkedIn 30-45d, Google 30-60d, TikTok 7-14d
- Every hook must be immediately usable by a copywriter — not a template, but a real headline
- If offer proof score < 7/10: NO specific customer counts, revenue claims, or outcome stats
  unless documented in context. Use "typically" language, focus on process benefits.
- Flag angles requiring proof assets not documented in context
- Highest-scored white space gap MUST inform at least one creative angle
- At least one angle must counter-position against the primary competitor threat
```

---

## 8. Section 6: Budget Allocation

**Phase:** 2B (Wave 2 Synthesis) + deterministic validation
**Model:** Claude Sonnet
**Max Output Tokens:** 4,500

### Schema

```typescript
interface BudgetAllocation {
  totalMonthlyBudget: number;
  platformBreakdown: {
    platform: string;
    monthlyBudget: number;
    percentage: number;
  }[];
  dailyCeiling: number;
  rampUpStrategy: string;
  funnelSplit: {
    stage: 'cold' | 'warm' | 'hot';
    percentage: number;
    rationale: string;
  }[];
  monthlyRoadmap: {
    month: number;
    budget: number;
    focus: string;
    scalingTriggers: string[];
  }[];
}
```

### Full System Prompt

```
You are a media buying operations manager responsible for budget allocation and campaign monitoring.

BUDGET RULES:
- totalMonthlyBudget MUST match the client's stated monthly ad budget exactly
- Platform percentages MUST sum to 100%
- monthlyBudget per platform = totalMonthlyBudget × percentage / 100 (exact math)
- dailyCeiling MUST NOT exceed totalMonthlyBudget / 30
- Funnel split: cold 50-70%, warm 20-30%, hot 10-20% — percentages must sum to 100%

PLATFORM MINIMUM BUDGET FLAGS:
- Meta < $3,000/mo: "Below recommended minimum ($3,000/mo) — experimental test only..."
- Google < $5,000/mo: "Below recommended minimum ($5,000/mo) — experimental test only..."
- LinkedIn < $5,000/mo: "Below recommended minimum ($5,000/mo) — experimental test only..."

RAMP-UP STRATEGY CONSTRAINT:
- Daily spend progression must sum to ~Phase 1 budget (40-50% of monthly over 3-4 weeks)
- Example at $12K Phase 1 / 4 weeks:
  Week 1: ~$285/day × 7 = ~$2,000
  Week 2: ~$428/day × 7 = ~$3,000
  Week 3: ~$428/day × 7 = ~$3,000
  Week 4: ~$571/day × 7 = ~$4,000

MONTHLY ROADMAP:
- Month 1 = Phase 1 spend (40-50% of full monthly)
- No month exceeds totalMonthlyBudget unless scaling strategy justifies it
- Must include contingency triggers from sensitivity analysis
- Spans same duration as campaign phases

MONITORING RULES:
- Daily: spend pacing, ad disapprovals, CPL by campaign
- Weekly: creative performance analysis, search term reports, frequency caps
- Monthly: full funnel analysis (CPL → CAC → LTV), budget reallocation, creative refresh
- Include early warning thresholds for each cadence
```

---

## 9. Section 7: Campaign Phases

**Phase:** 2A (Wave 2 Synthesis)
**Model:** Claude Sonnet
**Max Output Tokens:** 4,000

### Schema

```typescript
interface CampaignPhase {
  name: string;
  phase: number;                              // 1-based (max 6)
  durationWeeks: number;                      // 1-12
  objective: string;
  activities: string[];                       // 2-8 concrete actions
  successCriteria: string[];                  // 1-5 measurable
  estimatedBudget: number;                    // Total $ for entire phase
  goNoGoDecision?: string;                    // Specific action if criteria NOT met
  scenarioAdjustment?: string;                // How phase changes under worst-case
}
```

### Full System Prompt

```
You are a paid media strategist designing a phased campaign rollout.

RULES:
- Phase 1: Testing/Foundation (40-50% of steady-state budget). Low daily caps. Data collection.
- Phase 2: Scale (75-100% of budget). Double down on winning audiences and creatives.
- Phase 3+: Optimization (100% budget). Full deployment with 15-20% continuous testing.
- Each phase needs specific success criteria for advancing to next phase.
- Activities must be concrete actions a media buyer can execute.
- estimatedBudget = implied daily spending × durationWeeks × 7
- Phase daily spending ≤ daily budget ceiling
- Sum of all phase budgets ≈ monthlyBudget × total months
- SQL and CPL targets MUST match KPI targets provided in context
- Every phase MUST include goNoGoDecision: what specific action to take if criteria NOT met
  (e.g., "Reduce daily budget by 30% and extend testing 2 weeks")
- Include scenarioAdjustment per phase for worst-case sensitivity conditions
  (e.g., "If worst-case CPL ($120) materializes, reduce to 2 platforms and extend Phase 1")
- Success criteria reference base-case as primary threshold, worst-case as minimum floor
- No citation markers [1], [5], etc.
- No fabricated source names
```

---

## 10. Section 8: KPI Targets

**Phase:** 1 (Research) + Phase 2C (Deterministic Reconciliation)
**Model:** Perplexity Sonar Pro (research), then deterministic validation

### Schema

```typescript
interface KPITarget {
  metric: string;
  target: string;                             // With units: "<$75", "15%", "3.5x"
  timeframe: string;
  measurementMethod: string;
  type: 'primary' | 'secondary';
  benchmark: string;
  benchmarkRange?: { low: string; mid: string; high: string };
  sourceConfidence?: number;                  // 1=anecdotal → 5=verified
  scenarioThresholds?: { best: string; base: string; worst: string };
}
```

### Full System Prompt — Critical Metric Definitions

```
ROAS (Return on Ad Spend):
  Formula: (new_customers_this_month × monthly_offer_price) / monthly_ad_spend
  This is MONTHLY. Month 1 ROAS is almost always < 1.0x for subscriptions.
  DO NOT use LTV in ROAS formula.

LTV:CAC Ratio:
  Formula: customer_LTV / CAC
  This is LIFETIME. Healthy: ≥ 3:1. Below ideal: 1:1-2.9:1. Unsustainable: < 1:1.

These are DIFFERENT metrics. Never mix them.

BENCHMARK SOURCE RULES:
1. NEVER fabricate source names, report titles, or citations
2. Prefer real data from research: "Research Doc §4" or "Client Research Data"
3. Acceptable: "LinkedIn Ad Benchmarks 2025", "Industry standard estimate", "SpyFu keyword data"
4. NOT acceptable: Specific author names you can't verify, fake report titles

Source Confidence Scale:
  1 = anecdotal/blog
  2 = industry survey
  3 = industry report from known firm
  4 = platform-published data
  5 = verified first-party data
```

### KPI Reconciliation (Deterministic — `reconcileKPITargets()`)

6 checks applied after AI generates KPIs:

| Check | Metric | Tolerance | Action |
|-------|--------|-----------|--------|
| 1 | CAC Target | >20% drift from computed | Override with `budget / customers` |
| 2 | SQL Volume | >20% drift from computed | Override with `leads × SQL rate`; fix stale lead counts |
| 3 | CPL Target | >15% drift from computed | Override with computed CPL |
| 4 | Lead Volume | >25% drift or missing 20% margin | Override with `(budget × 0.80) / CPL` |
| 5 | ROAS | Detects LTV:CAC disguised as ROAS | Override with `(customers × price) / budget` |
| 5b | LTV:CAC | Dollar format or >20% drift | Override with computed ratio "X.X:1" |
| 6 | Benchmark | "Nx" in benchmark contradicts target | Replace benchmark value with target |

---

## 11. Section 9: Performance Model

**Phase:** 2B-2C (Deterministic computation — NO AI)
**Model:** None (pure arithmetic)

### Schema

```typescript
interface PerformanceModel {
  cacModel: CACModel;
  monitoringSchedule: MonitoringSchedule;     // From AI (budget synthesis call)
}

interface CACModel {
  targetCAC: number;
  targetCPL: number;
  leadToSqlRate: number;
  sqlToCustomerRate: number;
  expectedMonthlyLeads: number;
  expectedMonthlySQLs: number;
  expectedMonthlyCustomers: number;
  estimatedLTV: number;
  ltvToCacRatio: string;
}

interface MonitoringSchedule {
  daily: string[];
  weekly: string[];
  monthly: string[];
}
```

### CAC Model Computation (`computeCACModel()`)

```
effectiveBudget = monthlyBudget × 0.80
  (20% reserved for overhead/platform testing)

expectedMonthlyLeads = round(effectiveBudget / targetCPL)

expectedMonthlySQLs = round(expectedMonthlyLeads × leadToSqlRate / 100)

expectedMonthlyCustomers = max(1, round(expectedMonthlySQLs × sqlToCustomerRate / 100))

targetCAC = round(monthlyBudget / expectedMonthlyCustomers)
  (uses FULL budget — you still spent it all)

estimatedLTV = round(offerPrice × retentionMultiplier)

ltvToCacRatio = estimatedLTV / targetCAC
  ≥ 3.0 → "X:1 — Healthy"
  1.0-2.9 → "X:1 — Below ideal (target >3:1)"
  < 1.0 → "X:1 — Unsustainable"
```

### Retention Multiplier (`estimateRetentionMultiplier()`)

| Pricing Model | Multiplier |
|---------------|------------|
| Monthly / Subscription | 12 |
| Annual | 2.5 |
| Seat / Usage-based | 10 |
| One-time | 1 |
| Default (recurring-ish) | 8 |

### 3-Scenario CAC Model (`computeThreeScenarioCAC()`)

When sensitivity analysis is available from the blueprint ICP analysis:

| Scenario | CPL | Conversion Rates | Computed Outputs |
|----------|-----|-------------------|------------------|
| Best | Lower | Higher SQL/customer rates | Lower CAC, higher LTV:CAC |
| Base | Realistic | Plan targets | Plan CAC |
| Worst | Higher | Lower rates | Higher CAC, lower LTV:CAC |

Each uses the same formula with 20% safety margin on budget.

### Input Sources

| Input | Source | Fallback |
|-------|--------|----------|
| `monthlyBudget` | Validated budget allocation | Onboarding budget |
| `targetCPL` | KPI research CPL target | Onboarding `targetCpl` or $75 |
| `leadToSqlRate` | KPI research SQL rate | 15% |
| `sqlToCustomerRate` | — | 25% |
| `offerPrice` | Onboarding `productOffer.offerPrice` | — |
| `retentionMultiplier` | Computed from `pricingModel` | 8 |

---

## 12. Section 10: Risk Monitoring

**Phase:** 3 (Final Synthesis) + deterministic P×I scoring
**Model:** Claude Sonnet
**Max Output Tokens:** 3,500

### Schema

```typescript
interface RiskMonitoring {
  risks: Risk[];                              // 5-8 from 4+ categories
  assumptions: string[];                      // 3-5 key assumptions
}

interface Risk {
  risk: string;
  category: 'budget' | 'creative' | 'audience' | 'platform' | 'compliance' | 'market';
  severity: 'low' | 'medium' | 'high';
  likelihood: 'low' | 'medium' | 'high';
  probability?: number;                       // 1-5
  impact?: number;                            // 1-5
  score?: number;                             // Computed: probability × impact
  classification?: 'low' | 'medium' | 'high' | 'critical';
  mitigation: string;
  contingency: string;
  earlyWarningIndicator?: string;
  monitoringFrequency?: 'daily' | 'weekly' | 'monthly';
}
```

### Full System Prompt

```
You are a risk management specialist for paid advertising campaigns.

TASK: Identify specific risks and assumptions for this media plan based on the actual plan data.

RULES:
- Must cover at least 4 of 6 categories: budget, creative, audience, platform, compliance, market
- Every risk MUST be specific to this client — no generic risks like "ad costs may increase"
- Reference concrete plan elements: actual platform names, budget amounts, CAC targets, audience sizes
- Each risk needs both mitigation (proactive) AND contingency (reactive)
- Provide numerical probability (1-5) AND impact (1-5) — system computes P×I scores
- Include earlyWarningIndicator + monitoringFrequency for every risk

Monitoring Frequency:
  Budget/audience risks → daily
  Creative risks → weekly
  Market/compliance risks → monthly

ICP Risk Inheritance:
- Any ICP risk scored ≥13 (high/critical) MUST appear in media plan risks
- Add campaign-specific risks ON TOP (creative fatigue, platform algorithm, budget pacing)
- Use numerical severity scoring — reference probability × impact framework
```

### Risk Score Classification (deterministic)

```
score = probability × impact

score ≤ 6   → 'low'
score 7-12  → 'medium'
score 13-19 → 'high'
score ≥ 20  → 'critical'
```

Risks sorted by score descending (critical first).

---

## 13. Deterministic Validation Layer

All validation runs between Phase 2 synthesis and Phase 3 final synthesis. **No AI is involved — pure arithmetic and rule checks.**

### Complete Validation Sequence

```
1.  validateAndFixBudget()                 — Budget math (5 rules)
2.  computeCACModel()                      — Performance model (pure arithmetic)
3.  reconcileKPITargets()                  — KPI override (6 checks)
4.  validateCrossSection()                 — Cross-section consistency (5 rules)
5.  validateWithinPlatformBudgets()        — Within-platform splits (template ranges)
6.  validatePerPlatformDailyBudgets()      — Per-platform daily ↔ monthly reconciliation
7.  validatePlatformCompliance()           — ACV rules + platform minimums
8.  validateCampaignNaming()               — Name pattern + year fix
9.  validatePhaseBudgets()                 — Phase budget reconciliation (4 rules)
10. reconcileMonthlyRoadmapWithPhases()    — Roadmap ↔ phase budget alignment
11. validateRetargetingPoolRealism()       — Traffic existence check
12. reconcileTimeline()                    — Exec summary ↔ Phase 1 duration
13. validateRiskMonitoring()               — P×I scoring + classification
14. sweepStaleReferences()                 — Deep walk-and-replace across all text
```

### Budget Validation (`validateAndFixBudget`)

| Rule | Check | Fix |
|------|-------|-----|
| 1 | Platform % sum = 100 | Proportional scale + largest platform rounding adjustment |
| 2 | monthlyBudget = total × % / 100 | Recalculate if drift > $1 |
| 3 | Funnel split % sum = 100 | Same proportional fix as Rule 1 |
| 4 | dailyCeiling ≤ total / 30 | Cap if exceeded |
| 5 | totalMonthlyBudget matches onboarding | Override if drift > 10% |

### Cross-Section Validation (`validateCrossSection`)

| Rule | Check | Action |
|------|-------|--------|
| 1 | Campaign daily budgets sum ≤ daily ceiling | Proportional scale if >10% over |
| 2 | Campaign platforms ⊆ platform strategy | Warning |
| 3 | ICP targeting platforms match platform strategy | Warning |
| 4 | KPI CPL matches model CPL | Warning if >20% diff |
| 5 | KPI CAC matches model CAC | Warning if >20% diff |

### Within-Platform Budget Split Ranges

**LinkedIn:**
| Campaign Type | Min | Max |
|---------------|-----|-----|
| CTV/Awareness | 8% | 18% |
| Prospecting Lead Gen | 45% | 65% |
| MoFu Thought Leadership | 12% | 25% |
| Retargeting | 8% | 18% |

**Google:**
| Campaign Type | Min | Max |
|---------------|-----|-----|
| Brand | 8% | 18% |
| Competitor Branded | 20% | 40% |
| Non-Branded Search | 30% | 50% |
| Display/Remarketing | 8% | 18% |

**Meta:**
| Campaign Type | Min | Max |
|---------------|-----|-----|
| Lead Gen Form | 45% | 65% |
| Website Conversions | 25% | 45% |
| Awareness | 5% | 15% |

### Phase Budget Validation (`validatePhaseBudgets`)

| Rule | Check | Fix |
|------|-------|-----|
| 1 | Phase daily spend ≤ ceiling | Cap budget |
| 2 | Phase budget ≈ campaign daily × duration (±10%) | Adjust to match campaign rates |
| 3 | Total phases ≈ budget × months (multi-month ±15%, single ±2%) | Proportional scale |
| 4 | Daily spend progression increases testing → scale → optimize | Warning only |

### ACV + Platform Compliance (`validatePlatformCompliance`)

| Rule | Condition | Auto-Fix |
|------|-----------|----------|
| ACV > $5,000 | Meta cold campaigns | Relabel cold→warm, rename campaigns, update ad sets, add ACV override note |
| ACV < $3,000 | LinkedIn present | Warning only |
| 1000+ employees | Meta present | Warning only |
| Below minimums | Platform under threshold | Flag `belowMinimum: true`, prepend warning to rationale |

### Stale Reference Sweep (`sweepStaleReferences`)

Deep walk-and-replace across the entire assembled media plan. Catches AI text referencing values from BEFORE validation.

| Pattern | Context | Correction |
|---------|---------|------------|
| `$X CAC` | Any | Replace with computed CAC if >20% drift |
| `CAC of/target/: $X` | Any | Replace with computed CAC |
| `<$X` | CAC context | Replace with computed CAC |
| `below/under $X` | CAC context | Replace with computed CAC |
| `>$X` | CAC context | Replace with computed CAC |
| `<$X` (CAC-range, no CPL context) | Any | Replace if in CAC magnitude range |
| `ROAS >X.Xx` | Any | Replace with computed monthly ROAS if >30% drift |
| `>X.Xx at target CAC` | Any | Replace with computed ROAS |
| `NNN leads` | Any | Replace with computed leads if ≥20% drift |
| `LTV:CAC $X` | LTV context | Replace with ratio "X.X:1" |
| `Target CPA $X` | Google campaigns | Replace with CPL (not CAC) |
| `$X/day budget` | Any | Cap to daily ceiling |

**Skips:** `performanceModel.cacModel` (source of truth) and `metadata` (not AI-generated).

### Monthly Roadmap Reconciliation (`reconcileMonthlyRoadmapWithPhases`)

- Builds month-by-month budget expectation from phase budgets and durations
- If roadmap month budget differs >15% from phase-derived expectation, adjusts to match
- Also fixes "Total Phase N: ~$X" text in ramp-up strategy when >15% stale

### Retargeting Pool Realism (`validateRetargetingPoolRealism`)

Only activates when **both** `hasExistingPaidTraffic === false` AND `hasOrganicKeywords === false`.

- Annotates warm/retargeting campaigns: "Activates once cold campaigns generate sufficient traffic pool (estimated Week 3-4)"
- Warning: "Retargeting/warm campaigns will need 2-4 weeks of cold campaign traffic before they can effectively scale"

---

## 14. Ad Copy Generator (Bonus)

**File:** `src/lib/media-plan/ad-copy-generator.ts`
**Model:** Claude Sonnet
**Max Output Tokens:** 8,192
**Runs:** Separately after media plan generation

### Platform-Specific Copy Rules

#### Meta
- Primary text: Hook in first 125 chars (before "See More"). Max 300 total.
- Headline: 40 chars max. Benefit-first.
- Link description: 25 chars max. Max 2 emojis per ad.

#### Google RSA
- Headlines (3-15): Each 30 chars max. Must be diverse:
  - 2-3 keyword, 2-3 benefit, 2-3 CTA, 1-2 brand, 1-2 social proof
  - Each must make sense standalone
- Descriptions (2-4): Each 90 chars max
- Display paths: relevant URL segments

#### LinkedIn
- Hook in first 150 chars. Max 600 chars total.
- Lead with data, industry insights, or provocative questions
- Professional, no consumer-style hype

#### TikTok
- Ad text: 100 chars max. Casual, native tone.
- Video script: Hook (0-3s) → Body (3-15s) → CTA (15-20s)

#### YouTube
- Headline overlay: 15 chars max
- CTA text: 10 chars max
- Script: Hook (0-3s) → Problem/Solution (3-15s) → Proof (15-18s) → CTA (18-22s)

### CTA by Funnel Stage

| Stage | CTAs |
|-------|------|
| Cold | "Learn More", "Download" |
| Warm | "Get Quote", "Request Demo", "Register" |
| Hot | "Sign Up", "Book Now", "Shop Now" |

---

## 15. Cost Estimation

| Phase | Call | Model | Est. Cost |
|-------|------|-------|-----------|
| Phase 1 | Platform Strategy | Sonar Pro | ~$0.01-0.02 |
| Phase 1 | ICP Targeting | Sonar Pro | ~$0.01-0.02 |
| Phase 1 | KPI Benchmarks | Sonar Pro | ~$0.01-0.02 |
| Wave 1 | Campaign Structure (8K) | Claude Sonnet | ~$0.03-0.05 |
| Wave 1 | Creative Strategy (5K) | Claude Sonnet | ~$0.02-0.03 |
| Wave 2 | Campaign Phases (4K) | Claude Sonnet | ~$0.02-0.03 |
| Wave 2 | Budget + Monitoring (4.5K) | Claude Sonnet | ~$0.02-0.03 |
| Phase 3 | Executive Summary (2K) | Claude Sonnet | ~$0.01-0.02 |
| Phase 3 | Risk Monitoring (3.5K) | Claude Sonnet | ~$0.02-0.03 |
| **Total** | **9 AI calls** | | **~$0.15-0.23** |
| Bonus | Ad Copy (8K) | Claude Sonnet | ~$0.02-0.04 |

---

## 16. SSE Streaming Protocol

**Route:** `POST /api/media-plan/generate` (`maxDuration=300`)

### Event Types

```typescript
type MediaPlanSSEEvent =
  | { type: 'progress'; percentage: number; message: string }
  | { type: 'section-start'; section: MediaPlanSectionKey; phase: string; label: string }
  | { type: 'section-complete'; section: MediaPlanSectionKey; phase: string; label: string }
  | { type: 'section-data'; section: MediaPlanSectionKey; data: unknown; phase: string }
  | { type: 'done'; success: true; mediaPlan: MediaPlanOutput; metadata: {...} }
  | { type: 'error'; message: string; code?: string }
```

### Section Keys

```
executiveSummary | platformStrategy | icpTargeting | campaignStructure
creativeStrategy | budgetAllocation | campaignPhases | kpiTargets
performanceModel | riskMonitoring
```

### Progress Timeline

| % | Event |
|---|-------|
| 5% | Phase 1: Researching platforms, ICP, KPIs |
| 30% | Phase 1 complete |
| 32% | Wave 1: Campaign structure + creative strategy |
| 50% | Wave 1 complete |
| 52% | Wave 2: Campaign phases + budget |
| 65% | Synthesis complete, validating |
| 68-75% | Validation passes |
| 78% | Phase 3: Executive summary + risk analysis |
| 100% | Complete |

---

## File Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/lib/media-plan/pipeline.ts` | Wave-based orchestrator | 545 |
| `src/lib/media-plan/research.ts` | Phase 1 Sonar Pro calls | 410 |
| `src/lib/media-plan/synthesis.ts` | Phase 2/3 Claude Sonnet calls | 643 |
| `src/lib/media-plan/validation.ts` | Deterministic math + validation | 2,026 |
| `src/lib/media-plan/phase-context-builders.ts` | Context strings per section | 641 |
| `src/lib/media-plan/phase-schemas.ts` | Zod schemas for each phase | — |
| `src/lib/media-plan/types.ts` | Canonical TypeScript types | 583 |
| `src/lib/media-plan/section-constants.ts` | Section keys + labels | — |
| `src/lib/media-plan/wave-executor.ts` | Staggered parallel execution | — |
| `src/lib/media-plan/ad-copy-generator.ts` | Bonus ad copy pipeline | 135 |
| `src/lib/media-plan/ad-copy-schemas.ts` | Ad copy Zod schemas | — |
| `src/lib/media-plan/ad-copy-types.ts` | Ad copy TypeScript types | — |
| `src/app/api/media-plan/generate/route.ts` | SSE streaming API route | — |
