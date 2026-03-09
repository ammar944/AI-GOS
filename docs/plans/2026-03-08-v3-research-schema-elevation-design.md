# V3 Research Schema Elevation — Design Document

**Date**: 2026-03-08
**Branch**: aigos-v2
**Status**: Approved

---

## Context

AI-GOS V2 has a working research pipeline: 7 sections fire progressively as users answer onboarding questions, with research cards streaming inline and a right-panel progress tracker. The architecture works. The output quality does not.

V2 schemas are severely regressed from V1:

| Section | V1 Fields | V2 Fields | Coverage |
|---------|-----------|-----------|----------|
| ICP Validation | ~200+ | 11 flat | **15%** |
| Media Plan | ~200+ (10 sections) | 9 flat | **5%** |
| Competitor Intel | ~150+ | 14 | **30%** |
| Keyword Intelligence | ~100+ | 12 | **30%** |
| Strategic Synthesis | ~100+ | 21 | **50%** |
| Industry & Market | ~60 | 16 | **60%** |
| Offer Analysis | ~25 | 31 | **105%** (improved) |

V2 has MORE tools than V1 (8 betaZodTool wrappers, web search, chart generation, live ad platform data) but produces LESS structured output. Runners underutilize available tools — e.g., ICP runner has 9 tools available but only uses `web_search`.

---

## Architecture Decisions

### 1. Hybrid Output: Text Streaming + Structured Extraction

**Problem**: Current runners stream plain text via `streamText()`, then extract embedded JSON blocks via regex. No schema enforcement at generation time. V3 needs ~800+ fields of guaranteed structured output.

**Decision**: Hybrid approach.

```
Section Runner (Sonnet 4.6, streamText + tools)
  → Streams text chunks to frontend (UX unchanged)
  → On completion, full text captured
      ↓
Extraction Post-Pass (Haiku 4.5, generateObject)
  → Input: section prose + V3 Zod schema
  → Output: guaranteed schema-compliant structured data
  → Persisted to Supabase research_results JSONB
  → Sent to frontend as data-research-structured event
      ↓
Frontend card re-renders with structured data
  → Streaming text view → Structured card view transition
```

**New file**: `src/lib/ai/sections/extract.ts`

**Rationale**: Preserves progressive reveal UX (users see prose building) while guaranteeing V1-depth structured output. Extra cost: ~$0.05-0.10 per section on Haiku.

### 2. Tool Strategy: Extend Custom Tools

**Problem**: Two parallel tool implementations exist — 5 custom Anthropic SDK tools in `sections/tools.ts` and 8 betaZodTool wrappers in `tools/mcp/`. The betaZodTools are completely unused by section runners.

**Decision**: Keep custom tools, extend as needed. No betaZodTool migration in this effort. Add missing tool capabilities (chart generation, page speed for keywords) as custom tools following the existing pattern in `sections/tools.ts`.

### 3. Model Selection: Sonnet 4.6 Everywhere

**Problem**: Offer analysis runs on Haiku 4.5 with only 4096 tokens. ICP and keywords also limited to 4096. These budgets are insufficient for V3 depth.

**Decision**:
- All 7 section runners: **Sonnet 4.6**
- Extraction post-pass: **Haiku 4.5** (prose → JSON is a perfect Haiku task)

### 4. Frontend Cards: Progressive Disclosure

**Problem**: V3 schemas will have 5-10x more fields than current cards render. Cards can't show everything at once.

**Decision**: Collapsible "Full Analysis" sections within existing cards. Default view shows streaming base fields (what cards show now). Expanded view shows restored V1-depth content (psychographics, sensitivity analysis, segment sizing, etc.). No tabs redesign in Sprint 1.

---

## Token Budget Targets

| Section | Runner Model | Runner Tokens | Extraction Model | Extraction Tokens | Total |
|---------|-------------|---------------|-----------------|-------------------|-------|
| Industry | Sonnet 4.6 | 12K | Haiku 4.5 | ~2K | 14K |
| Competitor | Sonnet 4.6 | 16K | Haiku 4.5 | ~3K | 19K |
| ICP | Sonnet 4.6 | 16K | Haiku 4.5 | ~4K | 20K |
| Offer | Sonnet 4.6 | 10K | Haiku 4.5 | ~2K | 12K |
| Synthesis | Sonnet 4.6 | 16K | Haiku 4.5 | ~3K | 19K |
| Keywords | Sonnet 4.6 | 10K | Haiku 4.5 | ~2K | 12K |
| Media Plan | Sonnet 4.6 | 20K | Haiku 4.5 | ~4K | 24K |
| **Total** | | **100K** | | **~20K** | **~120K** |

Cost impact: ~$0.20-0.35 more per full research run vs current.

---

## Sprint 1: Schema Restoration & Elevation

### Execution Waves

**Wave 1** — CRITICAL regressions (parallel):
1. ICP Validation (15% → 95%)
2. Media Plan (5% → 90%)
3. Competitor Intel (30% → 90%)
4. Strategic Synthesis (50% → 95%)

**Wave 2** — Moderate regressions (parallel):
5. Keyword Intelligence (30% → 85%)
6. Industry & Market (60% → 90%)

**Wave 3** — Minor + infrastructure:
7. Offer Analysis (105% → 110%)
8. Extraction layer (`extract.ts`)
9. Tests

### Per-Section Deliverables

Each section gets exactly 4 changes:

| Deliverable | File Pattern |
|-------------|-------------|
| Schema | `src/lib/journey/schemas/{section}.ts` |
| SKILL.md | `src/lib/ai/skills/{section}/SKILL.md` |
| Runner config | `src/lib/ai/sections/configs.ts` |
| Frontend card | `src/components/journey/research-cards/{card}.tsx` |

---

### Section 1: ICP Validation (15% → 95%)

**The biggest regression.** V1 had 12 structured objects with ~200 fields. V2 has 11 flat fields.

#### Schema Restores from V1

```typescript
coherenceCheck: {
  clearlyDefined: boolean
  reachableThroughPaidChannels: boolean
  adequateScale: boolean
  hasPainOfferSolves: boolean
  hasBudgetAndAuthority: boolean
}

painSolutionFit: {
  primaryPain: string
  offerComponentSolvingIt: string
  fitAssessment: 'strong' | 'moderate' | 'weak'
  notes: string
}

marketReachability: {
  metaVolume: boolean
  linkedInVolume: boolean
  googleSearchDemand: boolean
  contradictingSignals: string[]
}

economicFeasibility: {
  hasBudget: boolean
  purchasesSimilar: boolean
  tamAlignedWithCac: boolean
  notes: string
}

customerPsychographics: {
  goalsAndDreams: string[]
  fearsAndInsecurities: string[]
  embarrassingSituations: string[]
  perceivedEnemy: string
  failedSolutions: string[]
  dayInTheLife: string  // 1st-person narrative
}

triggerEvents: Array<{
  event: string
  annualFrequencyEstimate: string
  urgencyLevel: 'immediate' | 'near-term' | 'planning-cycle'
  detectionMethod: string
  recommendedHook: string
}>

segmentSizing: Array<{
  totalAddressableAccounts: number
  totalAddressableContacts: number
  segmentSharePercent: number
  priorityTier: number
  recommendedBudgetWeight: number
  priorityFactors: {
    painSeverity: number      // 1-10
    budgetAuthority: number   // 1-10
    reachability: number      // 1-10
    triggerFrequency: number  // 1-10
  }
}>

samEstimate: {
  totalMatchingCompanies: number
  filteringFunnel: Array<{ stage: string, count: number, dropOffReason: string }>
  estimatedSAMCompanies: number
  estimatedAnnualContractValue: number
  confidence: 'high' | 'medium' | 'low'
  dataSources: string[]
}

sensitivityAnalysis: {
  bestCase: { assumedCPL: number, leadToSqlRate: number, sqlToCustomerRate: number, conditions: string }
  baseCase: { assumedCPL: number, leadToSqlRate: number, sqlToCustomerRate: number, conditions: string, confidencePercent: number }
  worstCase: { assumedCPL: number, leadToSqlRate: number, sqlToCustomerRate: number, conditions: string }
  breakEven: { maxCPLFor3xLTV: number, maxCAC: number, minLeadToSqlRate: number, budgetFloorForTesting: number }
}

riskScores: Array<{
  risk: string
  category: 'audience_reachability' | 'budget_adequacy' | 'pain_strength' | 'competitive_intensity' | 'proof_credibility' | 'platform_policy' | 'seasonality' | 'data_quality'
  probability: number  // 1-5
  impact: number       // 1-5
  earlyWarningIndicator?: string
  mitigation?: string
  contingency?: string
  budgetImpactEstimate?: string
}>

finalVerdict: {
  status: 'validated' | 'workable' | 'invalid'
  reasoning: string
  recommendations: string[]
}
```

#### New V3 Additions

```typescript
buyingCommittee: Array<{
  role: string
  influence: 'decision-maker' | 'influencer' | 'gatekeeper'
  messagingAngle: string
}>

platformAudienceSize: {
  meta?: number
  linkedin?: number
  google?: number
}
```

#### Runner Changes
- Model: Sonnet 4.5 → Sonnet 4.6
- Tokens: 4096 → 16K
- Add tool: `scrape_website` (for ICP validation data from LinkedIn pages, case studies)

#### Card Changes
- Keep current: persona summary, demographics, confidence score, channels, triggers, objections
- Add collapsible "Full Analysis" with: psychographics, sensitivity analysis, segment sizing, risk matrix, market reachability, economic feasibility

---

### Section 2: Media Plan (5% → 90%)

**Most severe regression.** V1 was a 10-section structured pipeline. V2 collapsed to 5 flat fields.

#### Schema: Restore Full V1 Structure

```typescript
executiveSummary: {
  overview: string
  primaryObjective: string
  recommendedMonthlyBudget: number
  timelineToResults: string
  topPriorities: string[]
}

platformStrategy: Array<{
  platform: string
  rationale: string
  budgetPercentage: number  // 0-100
  monthlySpend: number
  campaignTypes: string[]
  targetingApproach: string
  expectedCplRange: { min: number, max: number }
  priority: 'primary' | 'secondary' | 'testing'
  adFormats: string[]
  placements: string[]
  synergiesWithOtherPlatforms: string
  competitiveDensity?: number  // 1-10
  audienceSaturation?: 'low' | 'medium' | 'high'
  platformRiskFactors?: string[]
  qvcScore?: number  // 0-10
  qvcBreakdown?: {
    targetingPrecision: number  // 1-10
    leadQuality: number
    costEfficiency: number
    competitorPresence: number
    creativeFormatFit: number
  }
}>

icpTargeting: {
  segments: Array<{
    name: string
    description: string
    targetingParameters: string[]
    estimatedReach: string
    funnelPosition: 'cold' | 'warm' | 'hot'
  }>
  platformTargeting: Array<{
    platform: string
    interests: string[]
    jobTitles: string[]
    customAudiences: string[]
    exclusions: string[]
  }>
  demographics: string
  psychographics: string
  geographicTargeting: string
}

campaignStructure: {
  campaigns: Array<{
    name: string
    objective: string
    platform: string
    funnelStage: 'cold' | 'warm' | 'hot'
    dailyBudget: number
    adSets: Array<{
      name: string
      targeting: string
      adsToTest: number
      bidStrategy: string
    }>
  }>
  namingConvention: {
    campaignPattern: string
    adSetPattern: string
    adPattern: string
    utmStructure: { source: string, medium: string, campaign: string, content: string }
  }
  retargetingSegments: Array<{
    name: string
    source: string
    lookbackDays: number
    messagingApproach: string
  }>
  negativeKeywords: Array<{
    keyword: string
    matchType: 'exact' | 'phrase' | 'broad'
    reason: string
  }>
}

creativeStrategy: {
  angles: Array<{
    name: string
    description: string
    exampleHook: string
    bestForFunnelStages: string[]
    platforms: string[]
  }>
  formatSpecs: Array<{
    format: string
    dimensions: string
    platform: string
    copyGuideline: string
  }>
  testingPlan: Array<{
    phase: string
    variantsToTest: number
    methodology: string
    testingBudget: number
    durationDays: number
    successCriteria: string
  }>
  refreshCadence: Array<{
    platform: string
    refreshIntervalDays: number
    fatigueSignals: string[]
  }>
}

budgetAllocation: {
  totalMonthlyBudget: number
  platformBreakdown: Array<{ platform: string, monthlyBudget: number, percentage: number }>
  dailyCeiling: number
  rampUpStrategy: string
  funnelSplit: Array<{
    stage: 'cold' | 'warm' | 'hot'
    percentage: number
    rationale: string
  }>
  monthlyRoadmap: Array<{
    month: number
    budget: number
    focus: string
    scalingTriggers: string[]
  }>
}

campaignPhases: Array<{
  name: string
  phase: number
  durationWeeks: number
  objective: string
  activities: string[]
  successCriteria: string[]
  estimatedBudget: number
  goNoGoDecision?: string
}>

kpiTargets: Array<{
  metric: string
  target: string
  timeframe: string
  measurementMethod: string
  type: 'primary' | 'secondary'
  benchmark: string
  scenarioThresholds?: { best: string, base: string, worst: string }
}>

performanceModel: {
  cacModel: {
    targetCAC: number
    targetCPL: number
    leadToSqlRate: number
    sqlToCustomerRate: number
    expectedMonthlyLeads: number
    expectedMonthlySQLs: number
    expectedMonthlyCustomers: number
    estimatedLTV: number
    ltvToCacRatio: string
  }
  monitoringSchedule: {
    daily: string[]
    weekly: string[]
    monthly: string[]
  }
}

riskMonitoring: {
  risks: Array<{
    risk: string
    category: 'budget' | 'creative' | 'audience' | 'platform' | 'compliance' | 'market'
    severity: 'low' | 'medium' | 'high'
    likelihood: 'low' | 'medium' | 'high'
    mitigation: string
    contingency: string
    earlyWarningIndicator?: string
  }>
  assumptions: string[]
}
```

#### Keep V2 Fields (streaming base)
- `allocations[]` (channel, percentage, spend, rationale)
- `totalBudget`

#### Runner Changes
- Tokens: 8192 → 20K
- Add tool: `check_page_speed` (landing page performance for media plan recommendations)

#### Card Changes
- Keep current: budget allocation bar, channel cards
- Add collapsible sections for each of the 10 sub-structures (executive summary, platform strategy, campaign structure, etc.)

---

### Section 3: Competitor Intel (30% → 90%)

#### Schema Restores

```typescript
// Per competitor (additions to existing record)
competitors: Array<{
  // Keep V2
  name: string
  positioning?: string
  price?: string
  adCount?: number
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]

  // Restore from V1
  offer?: string
  funnels?: string
  adPlatforms?: string[]
  threatAssessment?: {
    threatFactors: {
      marketShareRecognition: number  // 1-10
      adSpendIntensity: number
      productOverlap: number
      priceCompetitiveness: number
      growthTrajectory: number
    }
    topAdHooks?: string[]
    likelyResponse?: string
    counterPositioning?: string
  }
  pricingTiers?: Array<{ tier: string, price: string, features?: string[] }>
}>

// Restore structured formats
creativeLibrary: {
  creativeFormats: {
    ugc: boolean
    carousels: boolean
    statics: boolean
    testimonial: boolean
    productDemo: boolean
  }
}

funnelBreakdown: {
  landingPagePatterns: string[]
  headlineStructure: string[]
  ctaHierarchy: string[]
  socialProofPatterns: string[]
  leadCaptureMethods: string[]
  formFriction: 'low' | 'medium' | 'high'
}

whiteSpaceGaps: Array<{
  gap: string
  type: 'messaging' | 'feature' | 'audience' | 'channel'
  evidence: string
  exploitability: number  // 1-10
  impact: number          // 1-10
  recommendedAction: string
}>
```

#### New V3 Additions

```typescript
// Per competitor
estimatedMonthlyAdSpend?: number
websitePerformance?: { performanceScore: number, lcp: number, cls: number }

// Top-level
adCreativeThemes?: Array<{ theme: string, count: number, platforms: string[], exampleHook: string }>
```

#### Keep V2: `keywordOverlap` (0-100)

#### Runner Changes
- Tokens: 8192 → 16K
- Add tool: `scrape_website` (pricing page scraping for `pricingTiers`)

---

### Section 4: Strategic Synthesis (50% → 95%)

#### Schema Restores

```typescript
keyInsights: Array<{
  insight: string
  source: 'industryResearch' | 'icpValidation' | 'offerAnalysis' | 'competitorIntel'  // RESTORED
  implication: string
  priority: 'high' | 'medium' | 'low'
}>

// messagingFramework becomes REQUIRED (was optional)
messagingFramework: {
  coreMessage: string       // REQUIRED (was optional)
  supportingMessages: string[]
  proofPoints: string[]
  tonalGuidelines: string[]

  // Restore from V1
  adHooks: Array<{
    hook: string
    technique: 'controversial' | 'revelation' | 'myth-bust' | 'status-quo-challenge' | 'curiosity-gap' | 'story' | 'fear' | 'social-proof' | 'urgency' | 'authority' | 'comparison'
    targetAwareness: 'unaware' | 'problem-aware' | 'solution-aware' | 'product-aware' | 'most-aware'
    source?: {
      type: 'extracted' | 'inspired' | 'generated'
      competitors?: string[]
      platform?: 'linkedin' | 'meta' | 'google'
    }
  }>

  angles: Array<{
    name: string
    description: string
    targetEmotion: string
    exampleHeadline: string
  }>

  proofPointsDetailed: Array<{
    claim: string
    evidence: string
    source?: string
  }>

  objectionHandlers: Array<{
    objection: string
    response: string
    reframe: string
  }>
}

recommendedPlatforms: Array<{
  platform: 'Meta' | 'LinkedIn' | 'Google' | 'YouTube' | 'TikTok'  // RESTORED enum
  reasoning: string
  priority: 'primary' | 'secondary' | 'testing'
}>
```

#### New V3 Additions

```typescript
budgetAllocationRecommendation: Array<{
  platform: string
  percentage: number
  reasoning: string
}>
```

#### Runner Changes
- Tokens: 8192 → 16K
- Force chart tool usage for competitive positioning visualization

---

### Section 5: Keyword Intelligence (30% → 85%)

#### Schema Restores

```typescript
clientDomain?: {
  domain: string
  organicKeywords: number
  paidKeywords: number
  monthlyOrganicClicks: number
  monthlyPaidClicks: number
  organicClicksValue: number
  paidClicksValue: number
}

competitorDomains?: Array<{
  domain: string
  organicKeywords: number
  paidKeywords: number
  monthlyOrganicClicks: number
}>

// Typed keyword opportunity (replaces string|number loose typing)
type KeywordOpportunity = {
  keyword: string
  searchVolume: number
  cpc: number
  difficulty: number  // 1-100
  source?: 'gap_organic' | 'gap_paid' | 'competitor_top' | 'related' | 'shared'
}

organicGaps: KeywordOpportunity[]
paidGaps: KeywordOpportunity[]
longTermPlays: KeywordOpportunity[]

// Restore structured recommendations
strategicRecommendations: {
  organicStrategy: string[]
  paidSearchStrategy: string[]
  competitivePositioning: string[]
  quickWinActions: string[]
}

// Restore format recommendation
contentTopicClusters: Array<{
  theme: string
  keywords: string[]
  searchVolumeTotal: number  // strict number, not string|number
  recommendedFormat: string
}>

// Restore full metadata
metadata: {
  clientDomain: string
  competitorDomainsAnalyzed: string[]
  totalKeywordsAnalyzed: number
  collectedAt: string
}
```

#### New V3 Additions

```typescript
negativeKeywords: Array<{ keyword: string, reason: string }>

seoAudit?: {
  technical: {
    overallScore: number
    sitemapFound: boolean
    robotsTxtFound: boolean
  }
  performance?: {
    mobile?: { performanceScore: number, lcp: number, cls: number }
    desktop?: { performanceScore: number, lcp: number, cls: number }
  }
  overallScore: number
}
```

#### Runner Changes
- Tokens: 4096 → 10K
- Add tools: `check_page_speed` (SEO audit), `search_market_data` (keyword context)

---

### Section 6: Industry & Market (60% → 90%)

#### Schema Restores

```typescript
categorySnapshot: {
  category: string                                          // REQUIRED (was optional)
  marketSize?: string                                       // Keep V2 addition
  marketMaturity: 'early' | 'growing' | 'saturated'        // REQUIRED + enum restored
  awarenessLevel: 'low' | 'medium' | 'high'                // REQUIRED + enum restored
  buyingBehavior: 'impulsive' | 'committee_driven' | 'roi_based' | 'mixed'  // RESTORED
  averageSalesCycle?: string
  seasonality?: string
}

marketDynamics: {
  demandDrivers: string[]
  buyingTriggers: string[]
  barriersToPurchase: string[]
  macroRisks: {                                             // RESTORED
    regulatoryConcerns: string
    marketDownturnRisks: string
    industryConsolidation: string
  }
}

psychologicalDrivers: {
  drivers: Array<{
    driver: string
    description: string                                     // RESTORED
  }>
}

audienceObjections: {
  objections: Array<{
    objection: string
    howToAddress: string                                     // RESTORED
  }>
}
```

#### New V3 Additions

```typescript
trendSignals: Array<{
  trend: string
  direction: 'rising' | 'declining' | 'stable'
  evidence: string
}>

seasonalityCalendar?: Array<{
  month: number  // 1-12
  intensity: number  // 1-10
  notes: string
}>
```

#### Runner Changes
- Tokens: 8192 → 12K
- No new tools needed

---

### Section 7: Offer Analysis (105% → 110%)

**Already at V1 parity.** Minor additions only.

#### New V3 Additions

```typescript
competitivePricing?: Array<{
  competitor: string
  lowestTier: string
  highestTier: string
  comparison: 'cheaper' | 'similar' | 'premium'
}>

conversionPotential?: {
  landingPageScore: number  // 1-10
  urgencyFactors: string[]
  frictionPoints: string[]
}
```

#### Runner Changes
- Model: Haiku 4.5 → Sonnet 4.6
- Tokens: 4096 → 10K

---

### Shared Infrastructure

#### Extraction Layer (`src/lib/ai/sections/extract.ts`)

```typescript
export async function extractStructuredData<T>(
  sectionId: ResearchSectionId,
  prose: string,
  schema: z.ZodSchema<T>,
): Promise<T> {
  // Uses Haiku 4.5 with generateObject()
  // Input: section prose text
  // Output: schema-compliant structured data
  // Retries once on validation failure
}
```

Called after each section runner completes, before Supabase persistence.

#### Runner Config Updates (`src/lib/ai/sections/configs.ts`)

All sections updated:
- Model → `claude-sonnet-4-6-20250514`
- Max tokens → per-section targets above
- Tools → per-section additions above

---

## Sprint 2: Onboarding UX Refinements

### 1. Move Budget to Phase 1

**Files**: `src/lib/ai/prompts/lead-agent-system.ts`, `src/lib/ai/journey-state.ts`

Current Phase 1 (Discovery): companyName, websiteUrl, businessModel
New Phase 1 (Discovery): companyName, websiteUrl, businessModel, **monthlyAdBudget**

Budget becomes a chip question early: `<$2K/mo | $2-5K | $5-10K | $10-25K | $25K+`

Impact: `mediaPlan` can fire as soon as synthesis + keywords complete instead of waiting for Phase 6.

### 2. Faster First Research Trigger

Current trigger for `industryResearch`: `businessModel` + `primaryIcpDescription` confirmed.

This is already optimal. The fix is prompt engineering: add explicit instruction to confirm `businessModel` within the first 2 exchanges. Don't ask clarifying sub-questions about business model before confirming.

Also ensure `icpValidation` fires immediately after `industryResearch` starts (it only needs `primaryIcpDescription` which triggers industry anyway).

### 3. Progressive Prefill Injection

Current: User reviews ALL prefilled fields in a card before chat starts.
New: Prefilled fields inject as "pre-confirmed" context as the agent asks each question.

When agent asks about competitors and prefill found 3: "I found these from your site: [X, Y, Z] — are these your main competitors?"

**Files**:
- `src/lib/ai/prompts/lead-agent-system.ts` — prefill-aware instructions
- `src/components/journey/journey-prefill-review.tsx` — simplify to per-field inline confirmation

### 4. Time Estimate

Show "~10 min to complete strategy" in welcome state.

**File**: `src/components/journey/welcome-state.tsx`

### 5. Detect Volunteered Information

When user says "We're a B2B SaaS targeting CTOs at mid-market companies with a $5K/mo budget" — extract ALL fields without re-asking.

**File**: `src/lib/ai/prompts/lead-agent-system.ts` — add instruction: "If the user volunteers multiple fields in a single message, confirm them all and advance."

Primarily a prompt engineering fix.

---

## Sprint 3: New SDK Feature Integration

### 1. Citations API

**Where**: All 7 section runners
**How**: Enable citations in Anthropic SDK calls where `search_market_data` (Perplexity) is used
**Impact**: Auto-cite web sources with exact URLs — replaces current regex-based citation extraction in `generate-research.ts`
**Files**: `src/lib/ai/sections/runner.ts`, `src/lib/ai/sections/extract.ts`, `citation-list.tsx`

### 2. Extended Thinking

**Where**: ICP + Synthesis runners only (deepest analytical sections)
**How**: Add `thinking: { type: "enabled", budgetTokens: 8000 }` to section configs
**Why**: Sensitivity analysis, segment sizing, and messaging framework need multi-step reasoning
**Files**: `src/lib/ai/sections/configs.ts`
**Cost**: ~$0.03-0.05 more per section (thinking tokens cheaper)

### 3. Batch API — "Refresh Research"

**Feature**: User re-runs all 7 sections at 50% cost via Anthropic Batch API.

**New files**:
- `src/app/api/journey/refresh-research/route.ts` — submits batch, polls completion
- Frontend: "Refresh all research" button in progress tracker

**UX**: Not real-time. User warned it takes 5-15 minutes but costs 50% less. Results update Supabase when batch completes. Frontend shows "Refreshing..." state.

### 4. Token Counting — Smart Model Routing

**Where**: Pre-dispatch validation in runner
**How**: Use `countTokens()` to measure context size before sending to runner
**Logic**: If context + schema + skill < 8K tokens, route to Haiku instead of Sonnet (saves ~60% per call)
**Files**: `src/lib/ai/sections/runner.ts`

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| V3 schemas too large for Haiku extraction | Medium | Test with representative prose; fall back to Sonnet for extraction if Haiku can't fill complex schemas |
| Token budgets still insufficient | Low | Monitor output truncation; each section can be individually tuned |
| Frontend cards break with new field shapes | Medium | Backwards-compatible fallback chains already in all cards; add fields incrementally |
| Extraction post-pass adds latency | Low | Haiku is fast (~1-2s); runs after streaming complete so user already sees prose |
| SKILL.md prompt changes degrade output | Medium | A/B test old vs new prompts; keep old prompts as fallback |

---

## Files Changed (Complete List)

### Sprint 1
- `src/lib/journey/schemas/icp-validation.ts`
- `src/lib/journey/schemas/media-plan.ts`
- `src/lib/journey/schemas/competitor-intel.ts`
- `src/lib/journey/schemas/strategic-synthesis.ts`
- `src/lib/journey/schemas/keyword-intel.ts`
- `src/lib/journey/schemas/industry-research.ts`
- `src/lib/journey/schemas/offer-analysis.ts`
- `src/lib/journey/schemas/base.ts` (new shared types like KeywordOpportunity)
- `src/lib/ai/skills/icp-validation/SKILL.md`
- `src/lib/ai/skills/media-plan/SKILL.md`
- `src/lib/ai/skills/competitor-intel/SKILL.md`
- `src/lib/ai/skills/strategic-synthesis/SKILL.md`
- `src/lib/ai/skills/keyword-intel/SKILL.md`
- `src/lib/ai/skills/industry-research/SKILL.md`
- `src/lib/ai/skills/offer-analysis/SKILL.md`
- `src/lib/ai/sections/configs.ts`
- `src/lib/ai/sections/tools.ts` (new tools)
- `src/lib/ai/sections/extract.ts` (NEW)
- `src/lib/ai/tools/generate-research.ts` (wire extraction)
- `src/components/journey/research-cards/icp-card.tsx`
- `src/components/journey/research-cards/media-plan-card.tsx`
- `src/components/journey/research-cards/competitor-card.tsx`
- `src/components/journey/research-cards/strategy-summary-card.tsx`
- `src/components/journey/research-cards/keyword-intel-card.tsx`
- `src/components/journey/research-cards/market-overview-card.tsx`
- `src/components/journey/research-cards/offer-analysis-card.tsx`

### Sprint 2
- `src/lib/ai/prompts/lead-agent-system.ts`
- `src/lib/ai/journey-state.ts`
- `src/components/journey/journey-prefill-review.tsx`
- `src/components/journey/welcome-state.tsx`

### Sprint 3
- `src/lib/ai/sections/runner.ts`
- `src/lib/ai/sections/configs.ts`
- `src/lib/ai/sections/extract.ts`
- `src/app/api/journey/refresh-research/route.ts` (NEW)
- `src/components/journey/research-progress.tsx`
- `src/components/journey/research-cards/citation-list.tsx`
