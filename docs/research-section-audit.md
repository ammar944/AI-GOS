# AI-GOS Research Pipeline Audit
## Complete Section Mapping: Schemas, Tools, MCPs & Output Structures

**Date**: 2026-03-08 | **Branch**: aigos-v2

---

## Architecture Overview

```
Lead Agent (Claude Opus 4.6 + Vercel AI SDK)
  |
  ├── askUser tool (chip/pill UI questions)
  ├── competitorFastHits (Stage 2, <10s)
  ├── scrapeClientSite (homepage + /pricing)
  ├── confirmJourneyFields (field validation)
  └── generateResearch (dispatches 7 research sections)
        |
        ├── In-process execution (current path)
        │     └── Anthropic SDK agentic loop + betaZodTools
        │
        └── Railway Worker dispatch (legacy path)
              └── Express :3001 → Supabase polling
```

**Dispatch pattern**: Lead agent calls `generateResearch({ sectionId, context })` → tool runs agentic loop inline → streams chunks to frontend via SSE → persists to Supabase `research_results` JSONB → returns structured result to agent.

---

## Research Dependency Graph

```
Phase 1 (parallel):
  ├── industryResearch      (no deps)
  ├── competitorIntel        (no deps)
  └── icpValidation          (no deps)

Phase 2:
  └── offerAnalysis          (depends: competitorIntel)

Phase 3:
  └── strategicSynthesis     (depends: all 4 above)

Phase 4 (sequential):
  ├── keywordIntel           (depends: strategicSynthesis)
  └── mediaPlan              (depends: strategicSynthesis + keywordIntel)
```

---

## Section 1: Industry Research

| Attribute | Value |
|-----------|-------|
| **Key** | `industryResearch` |
| **Trigger** | `businessModel` confirmed + `primaryIcpDescription` collected |
| **Model** | Claude Sonnet 4.6 |
| **Max Tokens** | 8,000 |
| **Timeout** | 180s |
| **Dependencies** | None |
| **Tools** | `web_search_20250305` (native) |
| **MCPs/betaZodTools** | None |
| **Skill** | `src/lib/ai/skills/industry-research/SKILL.md` |
| **Runner** | `research-worker/src/runners/industry.ts` |
| **Frontend Card** | `market-overview-card.tsx` |

### Output Schema (`src/lib/journey/schemas/industry-research.ts`)

```typescript
{
  categorySnapshot: {
    category?: string
    marketSize?: string
    marketMaturity?: string
    awarenessLevel?: string
    averageSalesCycle?: string
    seasonality?: string
  }
  marketDynamics: {
    demandDrivers: string[]
    buyingTriggers: string[]
    barriersToPurchase: string[]
  }
  painPoints: {
    primary: string[]
    secondary?: string[]
  }
  messagingOpportunities: {
    summaryRecommendations: string[]
  }
  psychologicalDrivers?: { drivers: string[] }
  audienceObjections?: string[]
}
```

### Audit Notes
- Uses web search only — no external API enrichment
- Schema is well-structured with clear field names
- `categorySnapshot` fields are all optional — could produce sparse output
- No citation tracking in schema (citations parsed at card level)

---

## Section 2: Competitor Intelligence

| Attribute | Value |
|-----------|-------|
| **Key** | `competitorIntel` |
| **Trigger** | `industryResearch` complete + `topCompetitors` + `websiteUrl` collected |
| **Model** | Claude Sonnet 4.6 |
| **Max Tokens** | 8,000+ |
| **Timeout** | 180s |
| **Dependencies** | None (but `offerAnalysis` depends on this) |
| **Tools** | `web_search_20250305` (native) |
| **MCPs/betaZodTools** | `adLibrary`, `spyfu`, `pagespeed` |
| **Skill** | `src/lib/ai/skills/competitor-intel/SKILL.md` |
| **Runner** | `research-worker/src/runners/competitors.ts` |
| **Frontend Card** | `competitor-card.tsx` |

### betaZodTool Details

| Tool | Provider | Input | Output |
|------|----------|-------|--------|
| `adLibrary` | SearchAPI.io (`google_ads_transparency`) | `companyName`, `domain?` | Competitor ad creatives, spend estimates |
| `spyfu` | SpyFu API | `domain` | Keyword intel, domain organic/paid stats |
| `pagespeed` | Google PageSpeed Insights (public) | `url` (URL) | Performance score, Core Web Vitals |

### Output Schema (`src/lib/journey/schemas/competitor-intel.ts`)

```typescript
{
  competitors: Array<{
    name: string
    positioning?: string
    price?: string
    adCount?: number
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]
  }>
  marketStrengths: string[]
  marketWeaknesses: string[]
  whiteSpaceGaps: string[]
  creativeLibrary?: Array<{ summary: string }>
  funnelBreakdown?: Array<{ stage: string, summary: string }>
  keywordOverlap?: number  // 0-100
}
```

### Audit Notes
- Richest tool set of all sections — 3 external enrichments
- `adLibrary` depends on `SEARCHAPI_KEY` env var
- `spyfu` depends on `SPYFU_API_KEY` env var
- `pagespeed` uses public API (no key needed)
- `adCount` field could be null if ad library returns no data
- `keywordOverlap` (0-100) is a useful but potentially unreliable metric

---

## Section 3: ICP Validation

| Attribute | Value |
|-----------|-------|
| **Key** | `icpValidation` |
| **Trigger** | `industryResearch` complete + `primaryIcpDescription` collected |
| **Model** | Claude Sonnet 4.6 |
| **Max Tokens** | 8,000 |
| **Timeout** | 180s |
| **Dependencies** | None |
| **Tools** | `web_search_20250305` (native) |
| **MCPs/betaZodTools** | None |
| **Skill** | `src/lib/ai/skills/icp-validation/SKILL.md` |
| **Runner** | `research-worker/src/runners/icp.ts` |
| **Frontend Card** | `icp-card.tsx` |

### Output Schema (`src/lib/journey/schemas/icp-validation.ts`)

```typescript
{
  validatedPersona: string
  demographics: string
  channels: string[]
  triggers: string[]
  objections: string[]
  decisionFactors: Array<{
    factor: string
    relevance?: string
  }>  // min 1 item
  audienceSize: string
  confidenceScore: number  // 0-100
  decisionProcess: string
  coherenceCheck?: string
  painSolutionFit?: string
  riskScores?: Array<{
    factor: string
    relevance?: string
  }>
}
```

### Audit Notes
- Web search only — no external API enrichment
- `confidenceScore` (0-100) is model-generated, not empirically validated
- `audienceSize` is a string (e.g., "50,000-100,000") — consider numeric for sorting/filtering
- `riskScores` uses same `{ factor, relevance }` shape as `decisionFactors` — potential naming confusion
- No segment sizing data from external APIs (e.g., LinkedIn audience insights)

---

## Section 4: Offer Analysis

| Attribute | Value |
|-----------|-------|
| **Key** | `offerAnalysis` |
| **Trigger** | `competitorIntel` complete + `productDescription` collected |
| **Model** | Claude Sonnet 4.6 |
| **Max Tokens** | 8,000 |
| **Timeout** | 180s |
| **Dependencies** | `competitorIntel` |
| **Tools** | `web_search_20250305` (native) |
| **MCPs/betaZodTools** | `firecrawl` |
| **Skill** | `src/lib/ai/skills/offer-analysis/SKILL.md` |
| **Runner** | `research-worker/src/runners/offer.ts` |
| **Frontend Card** | `offer-analysis-card.tsx` |

### betaZodTool Details

| Tool | Provider | Input | Output |
|------|----------|-------|--------|
| `firecrawl` | Firecrawl API | `url` (URL) | Scraped page content as markdown |

### Output Schema (`src/lib/journey/schemas/offer-analysis.ts`)

```typescript
{
  offerClarity: {
    clearlyArticulated: boolean
    solvesRealPain: boolean
    benefitsEasyToUnderstand: boolean
    transformationMeasurable: boolean
    valuePropositionObvious: boolean
  }
  offerStrength: {
    painRelevance: number      // 1-10
    urgency: number            // 1-10
    differentiation: number    // 1-10
    tangibility: number        // 1-10
    proof: number              // 1-10
    pricingLogic: number       // 1-10
    overallScore: number       // 1-10
  }
  marketOfferFit: {
    marketWantsNow: boolean
    competitorsOfferSimilar: boolean
    priceMatchesExpectations: boolean
    proofStrongForColdTraffic: boolean
    transformationBelievable: boolean
  }
  redFlags: Array<
    'offer_too_vague' | 'overcrowded_market' | 'price_mismatch' |
    'weak_or_no_proof' | 'no_funnel_built' | 'transformation_unclear'
  >
  recommendation: {
    status: 'proceed' | 'adjust_messaging' | 'adjust_pricing' |
            'icp_refinement_needed' | 'major_offer_rebuild'
    reasoning: string
    actionItems: string[]
  }
  strengths?: string[]
  weaknesses?: string[]
  pricingComparison?: Array<{ competitor: string, price: string }>
}
```

### Audit Notes
- `firecrawl` tool scrapes competitor pricing pages — depends on `FIRECRAWL_API_KEY`
- Enum-based `redFlags` is excellent for UI rendering (chips/badges)
- `recommendation.status` enum covers the full decision space well
- `offerStrength` scores are all 1-10 — great for radar charts
- `pricingComparison` is optional — may not populate if Firecrawl fails

---

## Section 5: Strategic Synthesis

| Attribute | Value |
|-----------|-------|
| **Key** | `strategicSynthesis` |
| **Trigger** | All 4 prior sections complete |
| **Model** | Claude Sonnet 4.6 |
| **Max Tokens** | 10,000 |
| **Timeout** | 180s |
| **Dependencies** | `industryResearch`, `competitorIntel`, `icpValidation`, `offerAnalysis` |
| **Tools** | `chartTool` (AntV MCP) |
| **MCPs/betaZodTools** | `generateChart` |
| **Skill** | `src/lib/ai/skills/strategic-synthesis/SKILL.md` |
| **Runner** | `research-worker/src/runners/synthesize.ts` |
| **Frontend Card** | `strategy-summary-card.tsx` |

### betaZodTool Details

| Tool | Provider | Input | Output |
|------|----------|-------|--------|
| `generateChart` | AntV MCP Server Chart SDK | `chartType`, `title`, `data[]`, `xField?`, `yField?`, `colorField?`, `valueField?` | Hosted chart image URL |

Chart types: `bar`, `pie`, `radar`, `funnel`, `word_cloud`, `dual_axes`, `line`, `sankey`

### Output Schema (`src/lib/journey/schemas/strategic-synthesis.ts`)

```typescript
{
  keyInsights: Array<{
    insight: string
    implication: string
    priority: 'high' | 'medium' | 'low'
  }>  // min 1 item
  recommendedPositioning: string
  positioningStrategy: {
    primary: string
    alternatives: string[]
    differentiators: string[]
    avoidPositions: string[]
  }
  recommendedPlatforms: Array<{
    platform: string
    reasoning: string
    priority: 'primary' | 'secondary' | 'testing'
  }>  // min 1 item
  potentialBlockers: string[]
  nextSteps: string[]
  criticalSuccessFactors?: string[]
  messagingFramework?: {
    coreMessage?: string
    supportingMessages?: string[]
    proofPoints?: string[]
    tonalGuidelines?: string[]
  }
}
```

### Audit Notes
- **Bottleneck section** — blocks both `keywordIntel` and `mediaPlan`
- 10,000 max tokens (highest of all sections) — long generation time
- Chart generation adds latency but visual output is high-value
- `messagingFramework` is optional — should be strongly encouraged in skill prompt
- Budget tier rules embedded in system prompt (not configurable)

---

## Section 6: Keyword Intelligence

| Attribute | Value |
|-----------|-------|
| **Key** | `keywordIntel` |
| **Trigger** | `strategicSynthesis` complete |
| **Model** | Claude Sonnet 4.6 |
| **Max Tokens** | 4,000 |
| **Timeout** | 180s |
| **Dependencies** | `strategicSynthesis` |
| **Tools** | None (native) |
| **MCPs/betaZodTools** | `spyfu` |
| **Skill** | `src/lib/ai/skills/keyword-intel/SKILL.md` |
| **Runner** | `research-worker/src/runners/keywords.ts` |
| **Frontend Card** | `keyword-intel-card.tsx` |

### betaZodTool Details

| Tool | Provider | Input | Output |
|------|----------|-------|--------|
| `spyfu` | SpyFu API | `domain` | Keyword rankings, CPC, volume, difficulty |

### Output Schema (`src/lib/journey/schemas/keyword-intel.ts`)

```typescript
{
  keywords: Array<{
    keyword: string
    cpc?: string
    volume?: string | number
    difficulty?: string | number
    opportunity?: number
  }>  // min 1 item
  quickWins: Array<keyword_entry>  // min 1 item
  highIntentKeywords: Array<keyword_entry>  // min 1 item
  clientStrengths: Array<keyword_entry>  // min 1 item
  contentTopicClusters: Array<{
    theme: string
    keywords: string[]  // min 1 item
    searchVolumeTotal?: string | number
  }>  // min 1 item
  metadata: {
    totalKeywordsAnalyzed: number
  }
}
```

### Audit Notes
- Lowest max tokens (4,000) — appropriate for structured keyword lists
- SpyFu is the sole data enrichment — single point of failure for keyword data
- `volume` and `difficulty` accept both `string | number` — normalize before frontend rendering
- `quickWins` vs `highIntentKeywords` vs `clientStrengths` — could overlap; skill prompt should clarify distinction
- No Google Ads Keyword Planner integration (would require OAuth)

---

## Section 7: Media Plan

| Attribute | Value |
|-----------|-------|
| **Key** | `mediaPlan` |
| **Trigger** | `strategicSynthesis` + `keywordIntel` complete + `monthlyAdBudget` collected |
| **Model** | Claude Sonnet 4.6 |
| **Max Tokens** | 10,000 |
| **Timeout** | 180s |
| **Dependencies** | `strategicSynthesis`, `keywordIntel` |
| **Tools** | None (native) |
| **MCPs/betaZodTools** | `googleAds`, `metaAds`, `ga4`, `generateChart` |
| **Skill** | `src/lib/ai/skills/media-plan/SKILL.md` |
| **Runner** | `research-worker/src/runners/media-planner.ts` |
| **Frontend Card** | `media-plan-card.tsx` |

### betaZodTool Details

| Tool | Provider | Input | Output |
|------|----------|-------|--------|
| `googleAds` | Google Ads API v18 (OAuth2 + GAQL) | `customerId`, `query?`, `dateRange` | Campaign performance, CPC, CTR, conversions |
| `metaAds` | Meta Graph API v21.0 | `dateRange` | Campaign spend, impressions, conversions |
| `ga4` | GA4 Data API (JWT service account) | `dateRange`, `focus` | Sessions, audience, channel breakdown |
| `generateChart` | AntV MCP Server Chart SDK | `chartType`, `title`, `data[]` | Hosted chart image URL |

**Graceful degradation**: All 3 platform tools check credential availability. If unavailable, return `{ available: false, error: '...' }` — agent continues without live data.

### Output Schema (`src/lib/journey/schemas/media-plan.ts`)

```typescript
{
  allocations: Array<{
    channel: string
    percentage: number     // 0-100
    spend?: string
    rationale?: string
  }>  // min 1 item
  totalBudget: string
  timeline: string[]
  kpis: Array<{
    channel?: string
    metric?: string
    target?: string
    value?: string
  }>  // min 1 item
  testingPlan: string[]
}
```

### Audit Notes
- Richest tool set (4 betaZodTools) but all 3 platform tools require OAuth credentials
- **Most users won't have Google Ads / Meta / GA4 connected** — graceful degradation is critical
- Schema is the leanest of all sections — `timeline` and `testingPlan` are just string arrays
- `allocations.percentage` should sum to 100 — no validation enforced in schema
- `kpis` fields are all optional strings — very loose typing for a critical deliverable
- `totalBudget` is string (e.g., "$5,000/mo") — not machine-parseable

---

## Tool Inventory Summary

### betaZodTool Wrappers (8 total)

| Tool | Location (Lead) | Location (Worker) | Used By Sections |
|------|------|------|------|
| `firecrawl` | `src/lib/ai/tools/mcp/firecrawl-tool.ts` | `research-worker/src/tools/firecrawl.ts` | offerAnalysis |
| `adLibrary` | `src/lib/ai/tools/mcp/ad-library-tool.ts` | `research-worker/src/tools/adlibrary.ts` | competitorIntel |
| `spyfu` | `src/lib/ai/tools/mcp/spyfu-tool.ts` | `research-worker/src/tools/spyfu.ts` | competitorIntel, keywordIntel |
| `pagespeed` | `src/lib/ai/tools/mcp/pagespeed-tool.ts` | `research-worker/src/tools/pagespeed.ts` | competitorIntel |
| `generateChart` | `src/lib/ai/tools/mcp/chart-tool.ts` | `research-worker/src/tools/chart.ts` | strategicSynthesis, mediaPlan |
| `googleAds` | `src/lib/ai/tools/mcp/google-ads-tool.ts` | `research-worker/src/tools/google-ads.ts` | mediaPlan |
| `metaAds` | *None (worker only)* | `research-worker/src/tools/meta-ads.ts` | mediaPlan |
| `ga4` | `src/lib/ai/tools/mcp/ga4-tool.ts` | `research-worker/src/tools/ga4.ts` | mediaPlan |

### Environment Variables Required

| Variable | Tool(s) | Required? |
|----------|---------|-----------|
| `SEARCHAPI_KEY` | adLibrary | Yes (competitor section) |
| `SPYFU_API_KEY` | spyfu | Yes (competitor + keyword sections) |
| `FIRECRAWL_API_KEY` | firecrawl | Yes (offer section) |
| `ANTHROPIC_API_KEY` | All runners | Yes (all sections) |
| `RAILWAY_WORKER_URL` | Dispatch | Yes (research pipeline) |
| `RAILWAY_API_KEY` | Worker auth | Yes (research pipeline) |
| Google Ads OAuth | googleAds | Optional (graceful degradation) |
| Meta Ads OAuth | metaAds | Optional (graceful degradation) |
| GA4 Service Account | ga4 | Optional (graceful degradation) |

---

## Frontend Card Components

| Section | Card Component | Key UI Elements |
|---------|---------------|-----------------|
| `industryResearch` | `market-overview-card.tsx` | Category snapshot, pain points, demand drivers |
| `competitorIntel` | `competitor-card.tsx` | Competitor table, strengths/weaknesses, threat levels |
| `icpValidation` | `icp-card.tsx` | Persona summary, confidence score, triggers, decision factors |
| `offerAnalysis` | `offer-analysis-card.tsx` | Clarity booleans, strength radar (1-10), red flag badges |
| `strategicSynthesis` | `strategy-summary-card.tsx` | Insights priority list, platform recs, positioning |
| `keywordIntel` | `keyword-intel-card.tsx` | Keyword table, quick wins, topic clusters |
| `mediaPlan` | `media-plan-card.tsx` | Budget allocation, platform breakdown, KPI targets |

### Common Card Props (`types.ts`)

```typescript
ResearchCardCommonProps<TData> = {
  status: 'streaming' | 'complete' | 'error'
  streamingText?: string
  data?: ResearchCardData<TData>
  citations?: Array<{ number: number, url: string, title?: string }>
  error?: string
  reviewStatus?: 'pending' | 'approved' | 'needs-revision'
  onApprove?: () => void
  onRequestRevision?: (note: string) => void
}
```

---

## Readiness Audit

### PASS

| Check | Status | Notes |
|-------|--------|-------|
| All 7 schemas defined | PASS | Zod schemas in `src/lib/journey/schemas/` |
| All 7 runners exist | PASS | `research-worker/src/runners/` |
| All 7 frontend cards | PASS | `src/components/journey/research-cards/` |
| Dependency graph enforced | PASS | System prompt trigger rules + `previousSections` |
| Dispatch with retry | PASS | 3x retry with exponential backoff |
| Job status tracking | PASS | `job_status` JSONB column in Supabase |
| Error states handled | PASS | `data-research-status` with `status: 'error'` |
| Graceful degradation | PASS | Google/Meta/GA4 tools return `available: false` |
| Section-to-key mapping | PASS | `research-worker/src/section-map.ts` |
| Citation parsing | PASS | `research-output.ts` handles `[n]: url` format |

### WARNINGS

| Check | Status | Notes |
|-------|--------|-------|
| metaAds missing from lead agent | WARN | Only exists in worker — lead agent `competitorFastHits` can't use it |
| Schema type inconsistencies | WARN | `volume`/`difficulty` accept `string \| number` in keyword schema |
| mediaPlan kpis loosely typed | WARN | All fields optional strings — could produce empty KPI objects |
| `allocations.percentage` no sum validation | WARN | Could produce allocations that don't sum to 100% |
| `totalBudget` not machine-parseable | WARN | String format ("$5,000/mo") blocks programmatic use |
| `categorySnapshot` all-optional | WARN | Could produce empty snapshot if model doesn't populate |
| Dual implementations | WARN | Both lead agent and worker have tool wrappers — maintenance burden |

### BLOCKERS (must fix before production)

| Check | Status | Notes |
|-------|--------|-------|
| `RAILWAY_WORKER_URL` required | BLOCKER | Without it, all research dispatches silently fail |
| `ANTHROPIC_API_KEY` required | BLOCKER | All runners need this |
| Supabase connectivity | BLOCKER | Worker writes + lead agent reads from same table |
| Worker health endpoint | CHECK | Verify `/health` returns 200 before dispatch |

---

## Recommendations

1. **Tighten mediaPlan schema**: Make `kpis` fields required, add `percentage` sum constraint
2. **Normalize keyword types**: Convert `string | number` to `number` with parser
3. **Add metaAds to lead agent MCP wrappers**: Parity with worker toolset
4. **Add schema version field**: Allow backward-compatible schema evolution
5. **Monitor tool timeout rates**: 180s timeout could be tight for multi-tool runners
6. **Add Supabase health check**: Verify connectivity before starting research pipeline

---

# Part 2: V1 → V2 Schema Comparison & Elevation Plan

## V1 Section Names → V2 Section Names

| V1 Key | V2 Key | Status |
|--------|--------|--------|
| `industryMarketOverview` | `industryResearch` | Renamed + simplified |
| `competitorAnalysis` | `competitorIntel` | Renamed + heavily simplified |
| `icpAnalysisValidation` | `icpValidation` | Renamed + heavily simplified |
| `offerAnalysisViability` | `offerAnalysis` | Renamed + slightly simplified |
| `crossAnalysisSynthesis` | `strategicSynthesis` | Renamed + simplified |
| `keywordIntelligence` | `keywordIntel` | Renamed + heavily simplified |
| *(separate 10-section pipeline)* | `mediaPlan` | New — collapsed from 10 sections to 1 |

---

## Section-by-Section Comparison

### 1. Industry & Market

**V1 (`industryMarketOverview`)** — 6 top-level objects, deeply structured:

```typescript
{
  categorySnapshot: {
    category: string                    // REQUIRED
    marketMaturity: 'early' | 'growing' | 'saturated'  // ENUM
    awarenessLevel: 'low' | 'medium' | 'high'          // ENUM
    buyingBehavior: 'impulsive' | 'committee_driven' | 'roi_based' | 'mixed'  // ENUM
    averageSalesCycle: string
    seasonality: string
  }
  marketDynamics: {
    demandDrivers: string[]             // 4-6 items
    buyingTriggers: string[]            // 4-6 items
    barriersToPurchase: string[]        // 3-5 items
    macroRisks: {                       // ← V2 MISSING
      regulatoryConcerns: string
      marketDownturnRisks: string
      industryConsolidation: string
    }
  }
  painPoints: {
    primary: string[]                   // 5-7 items
    secondary: string[]                 // 5-8 items (REQUIRED in V1)
  }
  psychologicalDrivers: {              // ← V2 has this as optional string[]
    drivers: Array<{
      driver: string
      description: string              // ← V2 MISSING: no descriptions
    }>
  }
  audienceObjections: {                // ← V2 has this as optional string[]
    objections: Array<{
      objection: string
      howToAddress: string             // ← V2 MISSING: no response strategies
    }>
  }
  messagingOpportunities: {
    summaryRecommendations: string[]    // 3 items
  }
}
```

**V2 (`industryResearch`)** — Same structure but with key losses:

```typescript
{
  categorySnapshot: {
    category?: string                   // ALL OPTIONAL (was required)
    marketSize?: string                 // NEW field
    marketMaturity?: string             // Downgraded from enum to string
    awarenessLevel?: string             // Downgraded from enum to string
    averageSalesCycle?: string
    seasonality?: string
    // MISSING: buyingBehavior enum
  }
  marketDynamics: {
    demandDrivers: string[]
    buyingTriggers: string[]
    barriersToPurchase: string[]
    // MISSING: macroRisks object
  }
  painPoints: {
    primary: string[]
    secondary?: string[]                // Downgraded to optional
  }
  messagingOpportunities: {
    summaryRecommendations: string[]
  }
  psychologicalDrivers?: { drivers: string[] }  // Flattened, no descriptions
  audienceObjections?: string[]                  // Flattened, no response strategies
}
```

**Gap Analysis:**

| Lost from V1 | Impact | V3 Recommendation |
|--------------|--------|-------------------|
| `buyingBehavior` enum | Loses ad targeting signal | **Restore** — critical for campaign structure |
| `macroRisks` object | Loses regulatory/downturn context | **Restore** — affects budget planning |
| `psychologicalDrivers.description` | Loses "how it manifests" detail | **Restore** — drives creative copy |
| `audienceObjections.howToAddress` | Loses response strategy per objection | **Restore** — drives objection-handling ads |
| Enum types → strings | Loses frontend rendering precision | **Restore enums** — enables chips/badges |
| Required → optional fields | May produce sparse output | **Make `category`, `marketMaturity` required** |
| `marketSize` field | V2 has this (NEW) | **Keep** — good addition |

---

### 2. Competitor Intelligence

**V1 (`competitorAnalysis`)** — Deeply structured per competitor:

```typescript
{
  competitors: Array<{
    name: string
    website?: string
    positioning: string
    offer: string                      // ← V2 MISSING
    price: string
    funnels: string                    // ← V2 MISSING
    adPlatforms: string[]              // ← V2 MISSING
    strengths: string[]
    weaknesses: string[]
    threatAssessment?: {               // ← V2 MISSING (entire object)
      threatFactors: {
        marketShareRecognition: number   // 1-10
        adSpendIntensity: number         // 1-10
        productOverlap: number           // 1-10
        priceCompetitiveness: number     // 1-10
        growthTrajectory: number         // 1-10
      }
      topAdHooks?: string[]
      likelyResponse?: string
      counterPositioning?: string
    }
    pricingTiers?: Array<{             // ← V2 MISSING
      tier: string
      price: string
      features?: string[]
    }>
    reviewData?: {                     // ← V2 MISSING
      trustpilot?: { trustScore, totalReviews, aiSummary }
      g2?: { rating, reviewCount, productCategory }
    }
  }>
  creativeLibrary: {                   // V1: structured booleans
    creativeFormats: {
      ugc: boolean
      carousels: boolean
      statics: boolean
      testimonial: boolean
      productDemo: boolean
    }
  }
  funnelBreakdown: {                   // V1: structured analysis
    landingPagePatterns: string[]
    headlineStructure: string[]
    ctaHierarchy: string[]
    socialProofPatterns: string[]
    leadCaptureMethods: string[]
    formFriction: 'low' | 'medium' | 'high'
  }
  marketStrengths: string[]
  marketWeaknesses: string[]
  whiteSpaceGaps: Array<{             // V1: structured objects
    gap: string
    type: 'messaging' | 'feature' | 'audience' | 'channel'
    evidence: string
    exploitability: number             // 1-10
    impact: number                     // 1-10
    recommendedAction: string
  }>
}
```

**V2 (`competitorIntel`)** — Dramatically simplified:

```typescript
{
  competitors: Array<{
    name: string
    positioning?: string               // Downgraded to optional
    price?: string                     // Downgraded to optional
    adCount?: number                   // NEW (replaces adPlatforms)
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]            // NEW (replaces threatAssessment)
    // MISSING: offer, funnels, adPlatforms, threatAssessment,
    //          pricingTiers, reviewData
  }>
  marketStrengths: string[]
  marketWeaknesses: string[]
  whiteSpaceGaps: string[]             // Downgraded from objects to strings
  creativeLibrary?: Array<{ summary: string }>  // Flattened from structured booleans
  funnelBreakdown?: Array<{ stage: string, summary: string }>  // Flattened
  keywordOverlap?: number              // NEW (0-100)
}
```

**Gap Analysis:**

| Lost from V1 | Impact | V3 Recommendation |
|--------------|--------|-------------------|
| `threatAssessment` (5-factor scoring) | Loses quantified threat ranking | **Restore** — core competitive analysis |
| `offer`, `funnels`, `adPlatforms` | Loses go-to-market intelligence | **Restore** — critical for positioning |
| `pricingTiers` (from Firecrawl) | Loses pricing page intelligence | **Restore** — drives pricing strategy |
| `reviewData` (Trustpilot, G2) | Loses social proof intelligence | **Restore** — drives proof-point ads |
| `creativeLibrary.creativeFormats` booleans | Loses structured creative intel | **Restore** — determines ad format strategy |
| `funnelBreakdown` structured analysis | Loses landing page + CTA patterns | **Restore** — informs funnel design |
| `whiteSpaceGaps` structured objects | Loses exploitability/impact scoring | **Restore** — quantifies opportunity size |
| `keywordOverlap` + `adCount` | V2 additions | **Keep** — useful additions |

---

### 3. ICP Validation

**V1 (`icpAnalysisValidation`)** — The most comprehensive V1 section (12 top-level fields):

```typescript
{
  coherenceCheck: {                    // ← V2: flattened to optional string
    clearlyDefined: boolean
    reachableThroughPaidChannels: boolean
    adequateScale: boolean
    hasPainOfferSolves: boolean
    hasBudgetAndAuthority: boolean
  }
  painSolutionFit: {                   // ← V2: flattened to optional string
    primaryPain: string
    offerComponentSolvingIt: string
    fitAssessment: 'strong' | 'moderate' | 'weak'
    notes: string
  }
  marketReachability: {                // ← V2 MISSING entirely
    metaVolume: boolean
    linkedInVolume: boolean
    googleSearchDemand: boolean
    contradictingSignals: string[]
  }
  economicFeasibility: {               // ← V2 MISSING entirely
    hasBudget: boolean
    purchasesSimilar: boolean
    tamAlignedWithCac: boolean
    notes: string
  }
  riskScores: Array<{                 // V1: full risk matrix
    risk: string
    category: 'audience_reachability' | 'budget_adequacy' | 'pain_strength' |
              'competitive_intensity' | 'proof_credibility' | 'platform_policy' |
              'seasonality' | 'data_quality'
    probability: number                // 1-5
    impact: number                     // 1-5
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
  customerPsychographics: {            // ← V2 MISSING entirely
    goalsAndDreams: string[]
    fearsAndInsecurities: string[]
    embarrassingSituations: string[]
    perceivedEnemy: string
    failedSolutions: string[]
    dayInTheLife: string               // 1st-person narrative
  }
  triggerEvents: Array<{               // ← V2: flattened to string[]
    event: string
    annualFrequencyEstimate: string
    urgencyLevel: 'immediate' | 'near-term' | 'planning-cycle'
    detectionMethod: string
    recommendedHook: string
  }>
  segmentSizing: Array<{              // ← V2 MISSING entirely
    totalAddressableAccounts: number
    totalAddressableContacts: number
    segmentSharePercent: number
    priorityTier: number
    recommendedBudgetWeight: number
    priorityFactors: {
      painSeverity: number             // 1-10
      budgetAuthority: number          // 1-10
      reachability: number             // 1-10
      triggerFrequency: number         // 1-10
    }
  }>
  samEstimate: {                       // ← V2 MISSING entirely
    totalMatchingCompanies: number
    filteringFunnel: Array<{ stage, count, dropOffReason }>
    estimatedSAMCompanies: number
    estimatedAnnualContractValue: number
    confidence: 'high' | 'medium' | 'low'
    dataSources: string[]
  }
  sensitivityAnalysis: {               // ← V2 MISSING entirely
    bestCase: { assumedCPL, leadToSqlRate, sqlToCustomerRate, conditions }
    baseCase: { assumedCPL, leadToSqlRate, sqlToCustomerRate, conditions, confidencePercent }
    worstCase: { assumedCPL, leadToSqlRate, sqlToCustomerRate, conditions }
    breakEven: { maxCPLFor3xLTV, maxCAC, minLeadToSqlRate, budgetFloorForTesting }
  }
}
```

**V2 (`icpValidation`)** — Drastically simplified:

```typescript
{
  validatedPersona: string
  demographics: string
  channels: string[]
  triggers: string[]                    // Flattened from structured objects
  objections: string[]
  decisionFactors: Array<{ factor: string, relevance?: string }>
  audienceSize: string
  confidenceScore: number               // 0-100
  decisionProcess: string
  coherenceCheck?: string               // Flattened from 5-boolean object
  painSolutionFit?: string              // Flattened from structured object
  riskScores?: Array<{ factor: string, relevance?: string }>  // Simplified
}
```

**Gap Analysis:**

| Lost from V1 | Impact | V3 Recommendation |
|--------------|--------|-------------------|
| `coherenceCheck` 5-boolean structure | Loses paid channel viability signals | **Restore** — go/no-go for ad spend |
| `painSolutionFit` structured object | Loses fit assessment enum + notes | **Restore** — affects offer messaging |
| `marketReachability` entire object | Loses Meta/LinkedIn/Google volume checks | **MUST restore** — core platform viability |
| `economicFeasibility` entire object | Loses budget/TAM/CAC alignment | **MUST restore** — determines if ads viable |
| `customerPsychographics` entire object | Loses emotional drivers, day-in-life narrative | **MUST restore** — gold for ad creative |
| `triggerEvents` structured objects | Loses frequency, urgency, detection method, hooks | **Restore** — drives trigger-based campaigns |
| `segmentSizing` entire object | Loses TAM/contacts/budget weight per segment | **Restore** — determines budget allocation |
| `samEstimate` entire object | Loses filtering funnel + ACV estimate | **Restore** — ROI projection input |
| `sensitivityAnalysis` entire object | Loses best/base/worst case CAC projections | **MUST restore** — core financial viability |
| `riskScores` probability × impact matrix | Loses quantified risk assessment | **Restore** — risk-based budget guardrails |

**This is the biggest regression.** V1 ICP was ~12 structured objects; V2 is ~12 flat strings/arrays.

---

### 4. Offer Analysis

**V1 (`offerAnalysisViability`)**: Nearly identical to V2.

**Delta**: V1 schema and V2 schema are **~95% the same**. The V2 additions of `strengths`, `weaknesses`, and `pricingComparison` are improvements.

| Changed | V1 → V2 | V3 Recommendation |
|---------|---------|-------------------|
| `strengths` | NEW in V2 | **Keep** |
| `weaknesses` | NEW in V2 | **Keep** |
| `pricingComparison` | NEW in V2 | **Keep** |

**Verdict**: V2 offer analysis is the closest to V1 parity. Minor elevation only.

---

### 5. Strategic Synthesis

**V1 (`crossAnalysisSynthesis`)** — Rich messaging framework:

```typescript
{
  keyInsights: Array<{
    insight: string
    source: 'industryMarketOverview' | 'icpAnalysisValidation' | ...  // ← V2 MISSING
    implication: string
    priority: 'high' | 'medium' | 'low'
  }>
  recommendedPositioning: string
  positioningStrategy: { primary, alternatives, differentiators, avoidPositions }
  messagingFramework: {
    coreMessage: string                // ← V2: optional
    supportingMessages: string[]       // ← V2: optional
    proofPoints: string[]              // ← V2: optional
    tonalGuidelines: string[]          // ← V2: optional
    adHooks: Array<{                   // ← V2 MISSING entirely
      hook: string
      technique: 'controversial' | 'revelation' | 'myth-bust' | ...  // 11 types
      targetAwareness: 'unaware' | 'problem-aware' | 'solution-aware' | ...
      source?: { type: 'extracted' | 'inspired' | 'generated', competitors?, platform? }
    }>
    angles: Array<{                    // ← V2 MISSING entirely
      name: string
      description: string
      targetEmotion: string
      exampleHeadline: string
    }>
    proofPointsDetailed: Array<{       // ← V2 MISSING entirely
      claim: string
      evidence: string
      source?: string
    }>
    objectionHandlers: Array<{         // ← V2 MISSING entirely
      objection: string
      response: string
      reframe: string
    }>
  }
  recommendedPlatforms: Array<{
    platform: 'Meta' | 'LinkedIn' | 'Google' | 'YouTube' | 'TikTok'  // ← V2: free string
    reasoning: string
    priority: 'primary' | 'secondary' | 'testing'
  }>
  criticalSuccessFactors: string[]
  potentialBlockers: string[]
  nextSteps: string[]
}
```

**V2 (`strategicSynthesis`)** — Core structure preserved but messaging framework gutted:

**Gap Analysis:**

| Lost from V1 | Impact | V3 Recommendation |
|--------------|--------|-------------------|
| `keyInsights[].source` field | Loses traceability to source section | **Restore** — enables "drill into source" UI |
| `messagingFramework.adHooks` | Loses 5-8 ready-to-use hooks with technique + awareness level | **MUST restore** — this IS the deliverable |
| `messagingFramework.angles` | Loses creative angles with emotions + example headlines | **MUST restore** — drives creative briefs |
| `messagingFramework.proofPointsDetailed` | Loses claim-evidence pairs | **Restore** — drives proof-based ads |
| `messagingFramework.objectionHandlers` | Loses objection-response-reframe triples | **Restore** — drives retargeting copy |
| `platform` enum → free string | Loses UI rendering precision | **Restore enum** |
| `messagingFramework` all-optional | Could produce empty framework | **Make required** |

**This is the second biggest regression.** The messaging framework is the most actionable part of the entire pipeline.

---

### 6. Keyword Intelligence

**V1 (`keywordIntelligence`)** — Full SpyFu data model:

```typescript
{
  clientDomain: {                      // ← V2 MISSING
    domain: string
    organicKeywords: number
    paidKeywords: number
    monthlyOrganicClicks: number
    monthlyPaidClicks: number
    organicClicksValue: number
    paidClicksValue: number
  }
  competitorDomains: DomainKeywordStats[]  // ← V2 MISSING
  organicGaps: KeywordOpportunity[]    // ← V2 MISSING
  paidGaps: KeywordOpportunity[]       // ← V2 MISSING
  sharedKeywords: KeywordOpportunity[] // ← V2 MISSING
  relatedExpansions: KeywordOpportunity[]  // ← V2 MISSING
  clientStrengths: KeywordOpportunity[]
  competitorTopKeywords: Array<{       // ← V2 MISSING
    competitorName: string
    domain: string
    keywords: KeywordOpportunity[]
  }>
  quickWins: KeywordOpportunity[]
  longTermPlays: KeywordOpportunity[]  // ← V2 MISSING
  highIntentKeywords: KeywordOpportunity[]
  contentTopicClusters: Array<{
    theme: string
    keywords: string[]
    searchVolumeTotal: number          // V1: number (V2: string | number)
    recommendedFormat: string          // ← V2 MISSING
  }>
  strategicRecommendations: {          // ← V2 MISSING entirely
    organicStrategy: string[]
    paidSearchStrategy: string[]
    competitivePositioning: string[]
    quickWinActions: string[]
  }
  metadata: {
    clientDomain: string               // V1: full metadata
    competitorDomainsAnalyzed: string[]
    totalKeywordsAnalyzed: number
    spyfuCost: number
    collectedAt: string
  }
  seoAudit?: {                         // ← V2 MISSING entirely
    technical: { pages[], sitemapFound, robotsTxtFound, overallScore }
    performance: { mobile: PageSpeedMetrics, desktop: PageSpeedMetrics }
    overallScore: number
  }
}
```

**V2 (`keywordIntel`)**: Only keeps `keywords`, `quickWins`, `highIntentKeywords`, `clientStrengths`, `contentTopicClusters`, and `metadata.totalKeywordsAnalyzed`.

**Gap Analysis:**

| Lost from V1 | Impact | V3 Recommendation |
|--------------|--------|-------------------|
| `clientDomain` stats | Loses baseline organic/paid position | **Restore** — benchmarking input |
| `competitorDomains` stats | Loses competitor keyword strength comparison | **Restore** — competitive landscape |
| `organicGaps`, `paidGaps` | Loses gap-specific keyword lists | **Restore** — drives search strategy |
| `longTermPlays` | Loses high-difficulty opportunity pipeline | **Restore** — content strategy input |
| `strategicRecommendations` | Loses 4-pillar actionable strategy | **MUST restore** — makes keywords actionable |
| `seoAudit` | Loses technical SEO + PageSpeed data | **Restore** — landing page optimization input |
| `contentTopicClusters.recommendedFormat` | Loses format recommendations per cluster | **Restore** — content calendar input |
| Typed `KeywordOpportunity` | V1 has `searchVolume: number`, `cpc: number`, `difficulty: number` | **Restore strict types** |

---

### 7. Media Plan

**V1 (separate 10-section pipeline)** — Massive structured output:

```typescript
{
  executiveSummary: { overview, primaryObjective, budget, timeline, priorities }
  platformStrategy: Array<{
    platform, rationale, budgetPercentage, monthlySpend,
    campaignTypes, targetingApproach, expectedCplRange: { min, max },
    priority, adFormats, placements, synergiesWithOtherPlatforms,
    competitiveDensity, audienceSaturation, platformRiskFactors,
    qvcScore, qvcBreakdown: { targetingPrecision, leadQuality, costEfficiency, ... }
  }>
  icpTargeting: {
    segments: Array<{ name, description, targetingParameters, estimatedReach, funnelPosition }>
    platformTargeting: Array<{ platform, interests, jobTitles, customAudiences, exclusions }>
    demographics, psychographics, geographicTargeting
  }
  campaignStructure: {
    campaigns: Array<{ name, objective, platform, funnelStage, dailyBudget, adSets }>
    namingConvention: { campaignPattern, adSetPattern, adPattern, utmStructure }
    retargetingSegments, negativeKeywords
  }
  creativeStrategy: {
    angles, formatSpecs, testingPlan, refreshCadence, brandGuidelines
  }
  budgetAllocation: {
    totalMonthlyBudget, platformBreakdown, dailyCeiling,
    rampUpStrategy, funnelSplit, monthlyRoadmap
  }
  campaignPhases: Array<{ name, phase, durationWeeks, objective, activities, successCriteria }>
  kpiTargets: Array<{ metric, target, timeframe, measurementMethod, benchmark, scenarioThresholds }>
  performanceModel: { cacModel: { targetCAC, targetCPL, rates, LTV ratio }, monitoringSchedule }
  riskMonitoring: { risks: Array<{ risk, category, severity, mitigation, contingency }>, assumptions }
}
```

**V2 (`mediaPlan`)** — Collapsed to 5 fields:

```typescript
{
  allocations: Array<{ channel, percentage, spend?, rationale? }>
  totalBudget: string
  timeline: string[]
  kpis: Array<{ channel?, metric?, target?, value? }>
  testingPlan: string[]
}
```

**Gap Analysis:**

| Lost from V1 | Impact | V3 Recommendation |
|--------------|--------|-------------------|
| `executiveSummary` | Loses high-level strategy overview | **Restore** |
| `platformStrategy` (full structure) | Loses CPL ranges, QVC scores, saturation, risk factors | **MUST restore** — core media plan |
| `icpTargeting` | Loses platform-specific targeting parameters | **MUST restore** — execution-ready targeting |
| `campaignStructure` | Loses naming conventions, UTM, retargeting, negatives | **MUST restore** — execution blueprint |
| `creativeStrategy` | Loses angles, format specs, refresh cadence | **Restore** — creative brief |
| `budgetAllocation` (structured) | Loses funnel split, ramp strategy, monthly roadmap | **Restore** — budget execution plan |
| `campaignPhases` | Loses phased rollout plan with go/no-go gates | **Restore** — implementation timeline |
| `kpiTargets` (structured) | Loses benchmarks, measurement methods, scenario thresholds | **MUST restore** — accountability framework |
| `performanceModel` | Loses CAC model + monitoring schedule | **Restore** — ROI projection |
| `riskMonitoring` | Loses risk matrix + assumptions | **Restore** — defensive planning |

**This is the most severe regression.** V1 media plan was 10 structured sections; V2 is 5 flat fields.

---

## Summary: V2 Schema Regression Severity

| Section | V1 Fields | V2 Fields | Coverage | Severity |
|---------|-----------|-----------|----------|----------|
| Industry & Market | 6 objects, ~25 fields | 6 objects, ~15 fields | ~60% | MODERATE |
| Competitor Intel | 7 objects, ~50+ fields | 6 objects, ~15 fields | ~30% | **CRITICAL** |
| ICP Validation | 12 objects, ~80+ fields | 12 fields (flat) | ~15% | **CRITICAL** |
| Offer Analysis | 5 objects, ~25 fields | 7 objects, ~28 fields | ~105% | GOOD (improved) |
| Strategic Synthesis | 7 objects, ~40+ fields | 7 objects, ~20 fields | ~50% | **HIGH** |
| Keyword Intelligence | 12 objects, ~50+ fields | 6 objects, ~15 fields | ~30% | **CRITICAL** |
| Media Plan | 10 sections, ~100+ fields | 5 flat fields | ~5% | **CRITICAL** |

---

## V3 Elevation Priorities

### Tier 1: MUST RESTORE (Critical regressions)

1. **ICP `customerPsychographics`** — Goals, fears, perceived enemy, day-in-the-life narrative
2. **ICP `sensitivityAnalysis`** — Best/base/worst case CAC projections + break-even
3. **ICP `marketReachability`** — Meta/LinkedIn/Google volume booleans
4. **Synthesis `messagingFramework.adHooks`** — Ready-to-use hooks with technique + awareness level
5. **Synthesis `messagingFramework.angles`** — Creative angles with target emotion + example headline
6. **Competitor `threatAssessment`** — 5-factor scoring per competitor
7. **Media Plan full structure** — Restore at minimum: `platformStrategy`, `campaignStructure`, `kpiTargets`, `budgetAllocation`

### Tier 2: SHOULD RESTORE (High-value losses)

8. **ICP `segmentSizing`** — TAM/contacts per segment with priority factors
9. **ICP `economicFeasibility`** — Budget/TAM/CAC alignment
10. **ICP `triggerEvents` structured** — Frequency, urgency, detection method, recommended hook
11. **Competitor `funnelBreakdown` structured** — Landing page patterns, headline formulas, CTA hierarchy
12. **Competitor `whiteSpaceGaps` structured** — Exploitability × impact scoring
13. **Keyword `strategicRecommendations`** — 4-pillar actionable keyword strategy
14. **Keyword `clientDomain` + `competitorDomains`** — Baseline domain keyword stats

### Tier 3: NICE TO HAVE (Quality improvements)

15. **Industry `macroRisks`** — Regulatory, downturn, consolidation context
16. **Competitor `reviewData`** — Trustpilot/G2 sentiment
17. **Keyword `seoAudit`** — Technical SEO + PageSpeed
18. **All sections**: Restore enum types where V1 used them (strings → enums)
19. **Synthesis `keyInsights[].source`** — Traceability to source section

### V2-Only Additions to Keep

| V2 Addition | Section | Value |
|-------------|---------|-------|
| `marketSize` | industryResearch | Good for sizing context |
| `adCount` | competitorIntel | Quick competitive pressure metric |
| `keywordOverlap` | competitorIntel | Novel competitive metric |
| `strengths`, `weaknesses` | offerAnalysis | Good additions |
| `pricingComparison` | offerAnalysis | Useful for pricing strategy |
| `opportunities` per competitor | competitorIntel | Actionable per-competitor |

---

## Implementation Note

V2's simplified schemas were designed for **streaming-friendly progressive rendering** in the chat UI. V1's rich schemas were designed for **batch generation** into a full document.

**V3 should bridge both**: Keep the streaming-friendly flat types for the real-time card rendering, but add a `detailed` nested object per section that populates after streaming completes. This gives users immediate visual feedback (cards) while building toward V1-depth output behind the scenes.

```typescript
// V3 pattern: streaming-friendly base + rich details
type V3SectionOutput<TBase, TDetailed> = TBase & {
  detailed?: TDetailed  // Populated after streaming, before persist
}
```

---

# Part 3: V3 Schema Elevation Strategy

## The Core Problem

V2 has **more powerful tools than V1** (8 betaZodTool wrappers, web search, chart generation, live ad platform data) but **produces dramatically less structured output**. The runners underutilize available tools:

| Runner | Tools Available | Tools Actually Used |
|--------|----------------|-------------------|
| `industry.ts` | 9 tools | web_search only |
| `competitors.ts` | 9 tools | web_search + adLibrary + spyfu + pagespeed |
| `icp.ts` | 9 tools | web_search only |
| `offer.ts` | 9 tools | web_search + firecrawl |
| `synthesize.ts` | 9 tools | chartTool only |
| `keywords.ts` | 9 tools | spyfu only |
| `media-planner.ts` | 9 tools | googleAds + metaAds + ga4 + chart |

## V3 Elevation: Per-Section Plan

### 1. Industry Research → V3

**Current**: 8K tokens, web_search only, ~15 fields
**V3 Target**: 12K tokens, web_search + firecrawl, ~25 fields

**Restore from V1:**
- `categorySnapshot.buyingBehavior` enum (`impulsive | committee_driven | roi_based | mixed`)
- `marketDynamics.macroRisks` object (regulatory, downturn, consolidation)
- `psychologicalDrivers` with `{ driver, description }` objects
- `audienceObjections` with `{ objection, howToAddress }` objects
- Make `category`, `marketMaturity`, `awarenessLevel` REQUIRED
- Restore enum types: `marketMaturity: 'early' | 'growing' | 'saturated'`

**NEW for V3 (beyond V1):**
- `marketBenchmarks`: { avgCPC, avgCPL, avgCAC } sourced from web search for the specific industry
- `trendSignals`: Array of { trend, direction: 'rising' | 'declining' | 'stable', evidence }
- `seasonalityCalendar`: 12-month array of { month, intensity: 1-10, notes }
- Add `firecrawl` tool to runner — scrape industry report landing pages for deeper data

**Token budget**: Increase to 12K (from 8K) — additional 4K covers restored + new fields

---

### 2. Competitor Intel → V3

**Current**: 8K tokens, web_search + adLibrary + spyfu + pagespeed, ~15 fields
**V3 Target**: 16K tokens, same tools + firecrawl, ~50+ fields

**Restore from V1:**
- `threatAssessment` per competitor (5-factor scoring 1-10 + `topAdHooks`, `likelyResponse`, `counterPositioning`)
- `offer`, `funnels`, `adPlatforms` per competitor
- `pricingTiers` per competitor (from firecrawl scraping)
- `creativeLibrary.creativeFormats` as structured booleans
- `funnelBreakdown` structured (landing page patterns, headline structure, CTA hierarchy, form friction enum)
- `whiteSpaceGaps` as structured objects (gap, type enum, evidence, exploitability 1-10, impact 1-10, recommendedAction)

**NEW for V3:**
- `estimatedMonthlyAdSpend` per competitor (from SpyFu paid keywords data)
- `adCreativeThemes`: Array of { theme, count, platforms, exampleHook } from Ad Library
- `websitePerformance` per competitor: { performanceScore, lcp, cls } from PageSpeed
- Add `firecrawl` to competitor runner — scrape pricing pages for `pricingTiers`

**Token budget**: Increase to 16K (from 8K) — this is the richest section

---

### 3. ICP Validation → V3

**Current**: 8K tokens, web_search only, ~12 flat fields
**V3 Target**: 16K tokens, web_search + firecrawl, ~80+ fields (V1 parity + enhancements)

**Restore ALL from V1:**
- `coherenceCheck` (5 booleans: clearlyDefined, reachable, adequateScale, hasPain, hasBudget)
- `painSolutionFit` (primaryPain, offerComponent, fitAssessment enum, notes)
- `marketReachability` (metaVolume, linkedInVolume, googleSearchDemand, contradictingSignals)
- `economicFeasibility` (hasBudget, purchasesSimilar, tamAlignedWithCac, notes)
- `riskScores` full matrix (risk, category enum, probability 1-5, impact 1-5, mitigation, contingency)
- `finalVerdict` (status: validated | workable | invalid, reasoning, recommendations)
- `customerPsychographics` (goalsAndDreams, fears, embarrassingSituations, perceivedEnemy, failedSolutions, dayInTheLife)
- `triggerEvents` structured (event, annualFrequency, urgencyLevel enum, detectionMethod, recommendedHook)
- `segmentSizing` (TAM accounts, contacts, segmentShare%, priorityTier, budgetWeight, priorityFactors 1-10)
- `samEstimate` (filteringFunnel, estimatedSAM, estimatedACV, confidence, dataSources)
- `sensitivityAnalysis` (bestCase, baseCase, worstCase CAC projections + breakEven)

**NEW for V3:**
- `platformAudienceSize`: { meta: number, linkedin: number, google: number } — estimated from web search benchmarks
- `buyingCommittee`: Array of { role, influence: 'decision-maker' | 'influencer' | 'gatekeeper', messagingAngle }
- Add `firecrawl` tool — scrape LinkedIn company pages and competitor case studies for ICP validation data

**Token budget**: 16K required — this is the deepest analytical section

---

### 4. Offer Analysis → V3

**Current**: 8K tokens, web_search + firecrawl, ~28 fields
**V3 Target**: 10K tokens, same tools, ~35 fields

**Keep V2 as-is** (already at ~105% V1 coverage), add:
- `competitivePricing`: Array of { competitor, lowestTier, highestTier, comparison: 'cheaper' | 'similar' | 'premium' }
- `conversionPotential`: { landingPageScore: 1-10, urgencyFactors, frictionPoints }
- Tighten firecrawl usage — scrape client + top 2 competitor pricing pages

**Token budget**: 10K (from 8K) — modest increase

---

### 5. Strategic Synthesis → V3

**Current**: 10K tokens, chartTool only, ~20 fields
**V3 Target**: 16K tokens, chartTool, ~40+ fields

**Restore from V1:**
- `keyInsights[].source` field (traceability to source section)
- `messagingFramework` as REQUIRED (not optional)
- `messagingFramework.adHooks`: Array of { hook, technique enum (11 types), targetAwareness enum (5 levels), source }
- `messagingFramework.angles`: Array of { name, description, targetEmotion, exampleHeadline }
- `messagingFramework.proofPointsDetailed`: Array of { claim, evidence, source? }
- `messagingFramework.objectionHandlers`: Array of { objection, response, reframe }
- `recommendedPlatforms[].platform` as enum (Meta | LinkedIn | Google | YouTube | TikTok)

**NEW for V3:**
- `budgetAllocationRecommendation`: { platform: string, percentage: number, reasoning: string }[]
- `competitivePositioningMap`: chart URL from chartTool (radar chart of client vs competitors)
- `channelPriorityMatrix`: chart URL (bar chart of platform recommendations)
- Force chartTool usage for at least 2 visualizations

**Token budget**: 16K (from 10K) — messaging framework needs space

---

### 6. Keyword Intelligence → V3

**Current**: 4K tokens, spyfu only, ~15 fields
**V3 Target**: 10K tokens, spyfu + pagespeed, ~50+ fields

**Restore from V1:**
- `clientDomain` stats (organic/paid keywords, clicks, click value)
- `competitorDomains` stats (same per competitor)
- `organicGaps`, `paidGaps` as typed `KeywordOpportunity[]`
- `longTermPlays` keyword list
- `strategicRecommendations` (organicStrategy, paidSearchStrategy, competitivePositioning, quickWinActions)
- `contentTopicClusters[].recommendedFormat`
- Typed `KeywordOpportunity`: { keyword, searchVolume: number, cpc: number, difficulty: number, source enum }

**NEW for V3:**
- `seoAudit` from PageSpeed tool — add pagespeed to keyword runner
- `negativeKeywords`: Array of { keyword, reason } — keywords to exclude from paid campaigns
- `competitorKeywordGapChart`: chart URL from chartTool (Venn diagram of keyword overlap)
- Restore full metadata: `clientDomain`, `competitorDomainsAnalyzed`, `collectedAt`

**Token budget**: 10K (from 4K) — 2.5x increase for restored depth

---

### 7. Media Plan → V3

**Current**: 10K tokens, googleAds + metaAds + ga4 + chart, 5 flat fields
**V3 Target**: 20K tokens, same tools, ~100+ fields (restore full V1 10-section structure)

**Restore full V1 structure:**
- `executiveSummary` (overview, primaryObjective, budget, timeline, priorities)
- `platformStrategy` per platform (rationale, budgetPercentage, monthlySpend, campaignTypes, targetingApproach, expectedCplRange, adFormats, placements, synergies, QVC score)
- `icpTargeting` (segments with targeting parameters, platform-specific audiences)
- `campaignStructure` (campaigns with ad sets, naming convention, UTM structure, retargeting, negatives)
- `creativeStrategy` (angles, format specs, testing plan, refresh cadence)
- `budgetAllocation` (platformBreakdown, dailyCeiling, rampUpStrategy, funnelSplit, monthlyRoadmap)
- `campaignPhases` (3-4 phases with objectives, activities, success criteria, go/no-go)
- `kpiTargets` (metric, target, timeframe, measurementMethod, benchmark, scenarioThresholds)
- `performanceModel` (CAC model, monitoring schedule)
- `riskMonitoring` (risks with severity, mitigation, contingency + assumptions)

**NEW for V3:**
- `liveDataInsights`: { platform, metric, currentValue, recommendation } — from Google Ads/Meta/GA4 when connected
- `budgetAllocationChart`: pie chart URL from chartTool
- `channelPerformanceForecast`: chart URL (projected metrics by month)
- `implementationChecklist`: Array of { task, platform, priority, estimatedHours }

**Token budget**: 20K (from 10K) — needs full 10-section structure

---

## New SDK Features to Leverage

| Feature | Where to Use | Impact |
|---------|-------------|--------|
| **Citations API** | All runners → synthesis | Auto-cite web search sources with exact URLs |
| **Output.object + Tools** | Refactor runners to use `generateText` + `Output.object` | Unified tool calling + structured output |
| **Web Search** (`web_search_20250305`) | Already using; increase `max_uses` per runner | More comprehensive research |
| **Batch API** | "Refresh research" feature | 50% cost savings for background re-runs |
| **Token Counting** | Pre-dispatch validation | Route to cheaper models when feasible |
| **Extended Thinking** | Synthesis + ICP runners | Force deep reasoning for CAC projections |
| **input_examples** | Complex tools (firecrawl, spyfu) | 72% → 90% accuracy on tool parameters |

---

## Token Budget Summary

| Section | V2 Current | V3 Target | Delta |
|---------|-----------|-----------|-------|
| Industry Research | 8K | 12K | +4K |
| Competitor Intel | 8K | 16K | +8K |
| ICP Validation | 8K | 16K | +8K |
| Offer Analysis | 8K | 10K | +2K |
| Strategic Synthesis | 10K | 16K | +6K |
| Keyword Intelligence | 4K | 10K | +6K |
| Media Plan | 10K | 20K | +10K |
| **Total** | **56K** | **100K** | **+44K** |

Cost impact: ~$0.15-0.30 more per full research run (at Sonnet 4.6 pricing).

---

# Part 4: Current Onboarding UX Map

## User Journey: Step by Step

### Step 0: Landing Page (`/`)
- Hero: "Launch Your SaaS Marketing With AI Precision"
- CTA: "Generate Strategic Research" → `/journey`
- Auth: Clerk middleware gates `/journey` (public: `/`, sign-in, sign-up)

### Step 1: Welcome State (First Visit to `/journey`)

**Three-panel AppShell layout:**
- Left: Collapsed sidebar
- Center: Welcome screen
- Right: Hidden (appears later with research progress)

**User sees:**
1. Three-step visual guide:
   - "1. Seed context" — give EGOS your homepage
   - "2. Verify findings" — review what AI discovered
   - "3. Watch research stream" — six sections generate live

2. Two input fields:
   - Website URL (required feel, optional technically)
   - LinkedIn company page (optional)

3. Two actions:
   - **"Analyze website first"** → triggers prefill (Firecrawl scrape + LLM extraction)
   - **"Start without website analysis"** → skips to chat

### Step 2: Prefill Review (if website analyzed)

**Card: "I pulled these details from your site"**
- For each discovered field: label, confidence badge, source badge, value
- Per-field actions: Use this | Edit | Reject | View source
- Bottom: "Use these details and continue" | "Skip review"

**Auto-discovered fields** (from URL):
companyName, industry, targetCustomers, targetJobTitles, companySize,
headquartersLocation, productDescription, coreFeatures, valueProposition,
pricing, competitors, uniqueDifferentiator, marketProblem, customerTransformation

### Step 3: Session Creation
- POST `/api/journey/new-session` → Supabase `journey_sessions` row
- Session ID stored in localStorage

### Step 4: Chat Begins
- Welcome message appears
- Profile Card shows: "What I know so far — X/8 essentials confirmed"
- Agent starts guided questioning flow

### Step 5-10: Guided Onboarding Phases

**Phase 1 — Company Basics** (if not prefilled):
- Company name, website URL, business model (chips: B2B SaaS | B2C | Marketplace | Agency | Other)
- If URL provided: `scrapeClientSite(url)` fires → shows findings → asks for confirmation

**Phase 2 — ICP Deep Dive:**
- "Tell me about your best customers" → `primaryIcpDescription`
- Company size (multiSelect chips)
- Industry, job titles, geography, buying triggers
- Best client sources (multiSelect: Referrals | LinkedIn | Paid Ads | SEO | Events...)

**TRIGGER**: Once `businessModel` + `primaryIcpDescription` confirmed → `researchIndustry` fires immediately while agent keeps asking questions

**Phase 3 — Product & Offer:**
- Product description, core deliverables, pricing tiers, value prop
- Current funnel type (multiSelect: Lead Form | Free Trial | Webinar | Demo...)

**Phase 4 — Competitive Landscape:**
- "Who do you compete with?" → top 2-3 competitors
- **TRIGGER**: `competitorFastHits(competitorUrl)` fires for each competitor mentioned
- Unique edge, competitor frustrations, market bottlenecks

**Phase 5 — Customer Journey:**
- Situation before buying, desired transformation, common objections
- Sales cycle length (chips: <7d | 7-14d | 14-30d | 30d+)

**Phase 6 — Brand & Budget:**
- Brand positioning, monthly ad budget (**TRIGGER**: unlocks mediaPlan)
- Campaign duration, target CPL/CAC, goals (multiSelect)

### Research Streaming (concurrent with Steps 5-10)

Research fires as triggers are met — NOT sequential with questions:
1. `industryResearch` → after businessModel + ICP description
2. `competitorIntel` → after industry complete + competitors named
3. `icpValidation` → after industry complete + ICP description
4. `offerAnalysis` → after competitors complete + product description
5. `strategicSynthesis` → after all 4 above complete
6. `keywordIntel` → after synthesis complete
7. `mediaPlan` → after synthesis + keywords + budget collected

**Right panel** shows live progress tracker: 7 sections with status dots, elapsed timer, checkmarks.

**Research cards** appear inline in chat as they complete — user can Approve or Request Revision on each card.

### Step 11: Completion
- Agent presents strategic narrative weaving all findings
- Confirmation askUser: "Looks good, let's go" | "I want to change something"
- On confirm → enters **Strategist Mode** (no more field collection, pure strategy conversation)

---

## Onboarding UX Audit: What's Good vs. What Needs Work

### What's Working Well
- Progressive research triggering (fires between questions, not after all collected)
- Chip/pill UI for categorical questions reduces friction
- Prefill from website analysis eliminates ~5 questions
- Three-panel layout provides context without overwhelming
- Research cards appear inline — user sees value accumulating
- Resume prompt preserves progress across sessions
- Profile card shows "what I know" — transparent progress tracking

### What Needs Improvement

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| **8 question phases before any research** | Too many questions before first research fires | Fire `industryResearch` after just URL + goal (2 fields) |
| **Prefill is all-or-nothing** | User must review ALL fields before continuing | Progressive prefill — inject confirmed fields as agent asks |
| **No "quick start" path** | Every user goes through full 15-20 question flow | Add "Express mode" — URL + budget + goal → fire all research with defaults |
| **Research progress only on desktop** | Mobile users can't see research status | Add inline progress indicator in chat on mobile |
| **No mid-conversation research preview** | User can't peek at running research | Add "peek" button during streaming — show partial results |
| **Phase ordering is rigid** | Agent asks in fixed order even if user volunteers info early | System prompt should detect volunteered info and skip ahead |
| **No time estimate** | User doesn't know how long the full process takes | Show "~10 min to complete strategy" estimate |
| **Late budget collection** | Budget asked in Phase 6 — blocks mediaPlan until very end | Move budget to Phase 1 (it's one of the 3 essential fields) |

### Ideal V3 Onboarding Flow (Recommended)

**Minute 0-1**: User provides URL → instant Firecrawl scrape → "Smart Prefill" card with 10+ fields
**Minute 1-2**: Three essential questions: Goal, Budget bracket, ICP description (chips + text)
**Minute 2-3**: `industryResearch` + `icpValidation` fire immediately. Agent asks about competitors while research runs.
**Minute 3-5**: User names competitors → `competitorIntel` fires. Agent asks about offer/product.
**Minute 5-7**: `offerAnalysis` fires. User sees 4 research cards building simultaneously.
**Minute 7-10**: All 4 prerequisites complete → `strategicSynthesis` → `keywordIntel` → `mediaPlan` cascade.
**Minute 10-12**: Full strategy complete. User has been engaged throughout with progressive value.

**Key principle**: Every user input should visibly trigger research. The flywheel accelerates with each answer.
