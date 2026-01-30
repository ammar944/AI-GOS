# Architecture Research: Pricing Extraction Integration

**Domain:** Competitor pricing intelligence via Firecrawl scraping
**Researched:** 2026-01-31
**Confidence:** HIGH

## Executive Summary

Firecrawl pricing extraction integrates into the existing Section 4 competitor research pipeline (`competitor-research.ts`) as a replacement for Perplexity-based pricing extraction. The architecture follows the established pattern of service abstraction with graceful degradation - similar to how Foreplay enrichment was integrated into the ad library service.

**Key architectural insight:** This is a service replacement, not a pipeline addition. The integration point is narrow and well-defined: replace lines 41-49 (pricingTiers extraction in systemPrompt) with a Firecrawl-based pricing service that returns the same `PricingTier[]` type.

---

## Current Architecture

### Section 4: Competitor Research Pipeline

**Entry point:** `src/lib/strategic-blueprint/pipeline/competitor-research.ts`

**Flow:**
1. `researchCompetitors(context: string)` orchestrates competitor analysis
2. Creates ResearchAgent with Perplexity Deep Research model
3. Sends systemPrompt requesting competitor data including pricing tiers
4. Perplexity returns JSON with `competitors[].pricingTiers` array
5. `parseCompetitorAnalysisJSON()` validates and parses response
6. `fetchCompetitorAds()` enriches with ad library data (graceful degradation)
7. `mergeAdsIntoCompetitors()` combines ads, pricing, and messaging themes
8. Returns `CitedSectionOutput<CompetitorAnalysis>`

**Current pricing extraction approach (lines 41-49, 93-100):**
```typescript
// System prompt includes pricing tier schema
pricingTiers: [
  {
    tier: "string e.g. Starter, Pro, Enterprise",
    price: "string e.g. $99/mo, $299/mo, Custom pricing",
    description: "brief summary",
    targetAudience: "who this tier is for",
    features: ["3-5 specific features"],
    limitations: "usage limits if any"
  }
]
// Instructions emphasize visiting pricing pages
// But Perplexity synthesizes from multiple sources (reviews, articles)
// Result: Inaccurate pricing data
```

**Problem:** Perplexity synthesizes from indirect sources (reviews, articles, blog posts) instead of scraping actual pricing pages. This produces hallucinated or outdated pricing data.

### Type System

**`PricingTier` interface** (output-types.ts:256-269):
```typescript
export interface PricingTier {
  tier: string;                // Tier name
  price: string;               // Price string
  description?: string;        // What this tier offers
  targetAudience?: string;     // Who it's for
  features?: string[];         // Key features (3-5)
  limitations?: string;        // Usage limits
}
```

**`CompetitorSnapshot` interface** (output-types.ts:281-308):
```typescript
export interface CompetitorSnapshot {
  name: string;
  website?: string;            // <-- Entry point for Firecrawl
  // ... other fields
  pricingTiers?: PricingTier[]; // <-- Output target
  // ... other fields
}
```

### Service Pattern

**Existing pattern: Ad Library Service** (lines 132-149)
```typescript
// Graceful degradation with try/catch
try {
  const adService = createEnhancedAdLibraryService();
  competitorAds = await fetchCompetitorAds(adService, data.competitors);
} catch (error) {
  if (errorMessage.includes('SEARCHAPI_KEY')) {
    console.info('[...] API key not configured - skipping');
  } else {
    console.error('[...] Ad library search failed:', errorMessage);
  }
}
```

**Key insight:** Service failures don't crash the pipeline - they log and continue with partial data.

---

## Integration Points

### Primary Integration Point

**Location:** `competitor-research.ts` lines 130-169

**Current flow:**
```
researchCompetitors()
  └─> Perplexity research (returns competitors with pricing)
  └─> fetchCompetitorAds() [optional enrichment]
  └─> mergeAdsIntoCompetitors()
  └─> return CitedSectionOutput
```

**New flow:**
```
researchCompetitors()
  └─> Perplexity research (returns competitors WITHOUT pricing emphasis)
  └─> fetchCompetitorPricing() [NEW - Firecrawl-based]
  └─> fetchCompetitorAds() [optional enrichment]
  └─> mergeAdsIntoCompetitors()
  └─> return CitedSectionOutput
```

### Data Handoff Points

**Input to pricing service:**
- `CompetitorSnapshot[]` from Perplexity (includes `website` field)

**Output from pricing service:**
- `Map<string, PricingTier[]>` keyed by competitor name
- Similar to `competitorAds` map pattern (line 133)

**Merge point:**
- `mergeAdsIntoCompetitors()` already merges external data
- Extend to merge pricing map: `pricingMap.get(competitor.name) || competitor.pricingTiers`

---

## New Components

### 1. Firecrawl Client (`src/lib/firecrawl/client.ts`)

**Purpose:** Wrap `@mendable/firecrawl-js` SDK with AI-GOS patterns

**Responsibilities:**
- Initialize FirecrawlApp with API key from env
- Provide typed methods for scraping and extraction
- Handle Firecrawl-specific errors
- Convert Firecrawl responses to internal types

**Interface:**
```typescript
export class FirecrawlClient {
  private app: FirecrawlApp;

  constructor(apiKey?: string);

  async scrapeUrl(url: string, options?: ScrapeOptions): Promise<ScrapeResult>;
  async extractStructured<T>(
    url: string,
    schema: z.ZodType<T>,
    prompt?: string
  ): Promise<T>;
}

export function createFirecrawlClient(): FirecrawlClient;
```

**Dependencies:**
- `@mendable/firecrawl-js` (npm package)
- `FIRECRAWL_API_KEY` environment variable
- Zod for schema validation

**Error handling:**
- Throw descriptive errors on API failures
- Timeout handling (Firecrawl can be slow for JS-heavy pages)
- Rate limit handling (429 responses)

### 2. Pricing Discovery Service (`src/lib/pricing/discovery.ts`)

**Purpose:** Find pricing page URL from competitor website

**Responsibilities:**
- Try common pricing page paths (`/pricing`, `/plans`, `/pricing-plans`)
- Use Firecrawl's `map` endpoint to discover sitemap
- Filter URLs for pricing-related keywords
- Return best candidate URL or undefined

**Interface:**
```typescript
export interface PricingPageDiscovery {
  url: string;
  confidence: 'high' | 'medium' | 'low';
  method: 'direct' | 'sitemap' | 'crawl';
}

export async function discoverPricingPage(
  websiteUrl: string,
  firecrawl: FirecrawlClient
): Promise<PricingPageDiscovery | undefined>;
```

**Strategy:**
1. **Direct attempt** - Try `/pricing`, `/plans`, `/pricing-plans` paths (confidence: high)
2. **Sitemap discovery** - Use Firecrawl map endpoint, filter for pricing keywords (confidence: medium)
3. **Fallback** - Return undefined, let LLM extract from homepage (confidence: low)

**Cost optimization:** Prefer direct attempts to minimize Firecrawl credits

### 3. Pricing Extraction Service (`src/lib/pricing/extraction.ts`)

**Purpose:** Extract structured pricing data from scraped page

**Responsibilities:**
- Scrape pricing page with Firecrawl
- Use LLM (via OpenRouter) to extract structured PricingTier[] from markdown
- Apply confidence scoring based on data completeness
- Handle missing or unclear pricing

**Interface:**
```typescript
export interface PricingExtractionResult {
  tiers: PricingTier[];
  confidence: number; // 0-100
  source: string;     // URL scraped
  scrapedAt: string;  // ISO timestamp
}

export async function extractPricing(
  pricingUrl: string,
  firecrawl: FirecrawlClient,
  llmClient: OpenRouterClient
): Promise<PricingExtractionResult>;
```

**LLM extraction strategy:**
```typescript
// Use fast, cheap model (Gemini 2.0 Flash)
const systemPrompt = `Extract pricing tiers from this pricing page markdown.
Return JSON array matching PricingTier schema.
If pricing is unclear or custom-only, return empty array.`;

const response = await llmClient.chatJSONValidated(
  { model: MODELS.GEMINI_2_FLASH, messages: [...] },
  z.array(PricingTierSchema),
  retries: 2
);
```

**Confidence scoring:**
- High (80-100): All tiers have price, features, clear structure
- Medium (50-79): Some tiers missing features or using "Custom" pricing
- Low (0-49): Minimal data, mostly "Contact us" or "Custom pricing"

### 4. Pricing Service (`src/lib/pricing/service.ts`)

**Purpose:** Orchestrate pricing discovery + extraction for multiple competitors

**Responsibilities:**
- Coordinate discovery and extraction
- Batch processing with parallel requests
- Error recovery and graceful degradation
- Return Map of competitor name -> pricing data

**Interface:**
```typescript
export interface PricingServiceOptions {
  maxConcurrent?: number;      // Parallel requests (default: 3)
  timeout?: number;             // Per-competitor timeout (default: 30s)
  fallbackToPerplexity?: boolean; // Use Perplexity if Firecrawl fails (default: false)
}

export interface CompetitorPricingResult {
  competitor: string;
  pricing: PricingExtractionResult | null;
  error?: string;
}

export async function fetchCompetitorPricing(
  competitors: CompetitorSnapshot[],
  options?: PricingServiceOptions
): Promise<Map<string, PricingExtractionResult>>;
```

**Error handling:**
- Skip competitors without website URL
- Timeout individual requests (don't block pipeline)
- Log failures but return partial results
- Similar to ad library pattern (lines 132-149)

---

## Modified Components

### 1. `competitor-research.ts` - Add Pricing Service Call

**Location:** After Perplexity research, before ad library

**Changes:**
```typescript
// After line 130 (after Perplexity research)
let competitorPricing = new Map<string, PricingExtractionResult>();
try {
  competitorPricing = await fetchCompetitorPricing(data.competitors, {
    maxConcurrent: 3,
    timeout: 30000,
  });
  console.log(`[Competitor Research] Fetched pricing for ${competitorPricing.size} competitors`);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  if (errorMessage.includes('FIRECRAWL_API_KEY')) {
    console.info('[Competitor Research] FIRECRAWL_API_KEY not configured - skipping pricing extraction');
  } else {
    console.error('[Competitor Research] Pricing extraction failed:', errorMessage);
  }
}

// Update mergeAdsIntoCompetitors to merge pricing
data = {
  ...data,
  competitors: mergePricingIntoCompetitors(
    mergeAdsIntoCompetitors(data.competitors, competitorAds),
    competitorPricing
  ),
};
```

**Rationale:** Graceful degradation pattern - failures don't crash pipeline

### 2. `competitor-research.ts` - Add Pricing Merge Function

**New function:**
```typescript
/**
 * Merge Firecrawl pricing into competitor snapshots
 * Prefers Firecrawl pricing over Perplexity pricing when available
 */
function mergePricingIntoCompetitors(
  competitors: CompetitorSnapshot[],
  pricingMap: Map<string, PricingExtractionResult>
): CompetitorSnapshot[] {
  return competitors.map(competitor => {
    const pricing = pricingMap.get(competitor.name);

    if (pricing && pricing.confidence >= 50) {
      // Use Firecrawl pricing if confidence is reasonable
      console.log(`[Competitor Research] ${competitor.name} - Using Firecrawl pricing (confidence: ${pricing.confidence})`);
      return {
        ...competitor,
        pricingTiers: pricing.tiers,
      };
    }

    // Keep Perplexity pricing as fallback (or undefined)
    return competitor;
  });
}
```

**Decision logic:**
- Confidence >= 50: Use Firecrawl pricing
- Confidence < 50: Keep Perplexity pricing as fallback
- No Firecrawl result: Keep Perplexity pricing

### 3. `env.ts` - Add Firecrawl API Key

**Changes:**
```typescript
const OPTIONAL_ENV_VARS = {
  server: [
    "FOREPLAY_API_KEY",
    "ENABLE_FOREPLAY",
    "FIRECRAWL_API_KEY",  // <-- ADD THIS
  ] as const,
  // ...
}
```

**Rationale:** Optional like Foreplay - feature degrades gracefully without it

### 4. `competitor-research.ts` - Adjust Perplexity Prompt

**Current:** Lines 93-100 emphasize pricing extraction

**Modified:** Reduce pricing emphasis, let Firecrawl handle it
```typescript
// REMOVE detailed pricing tier extraction from systemPrompt
// KEEP high-level price field for fallback: "price": "string - e.g. '$997/mo'"
// SIMPLIFY pricingTiers to optional fallback, not primary focus
```

**Rationale:** Avoid redundant work - let Perplexity focus on positioning/offers, Firecrawl on pricing

---

## Data Flow

### End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ researchCompetitors(context)                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Perplexity Deep Research                                      │
│    - Returns: CompetitorSnapshot[] with basic info + website    │
│    - Pricing: Minimal (fallback only)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Firecrawl Pricing Extraction (NEW)                           │
│    For each competitor with website:                            │
│      a. discoverPricingPage(website) → pricingUrl              │
│      b. firecrawl.scrape(pricingUrl) → markdown                │
│      c. llm.extract(markdown, PricingTierSchema) → tiers       │
│      d. calculateConfidence(tiers) → 0-100 score               │
│    Returns: Map<name, PricingExtractionResult>                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Ad Library Enrichment (Existing)                             │
│    - Returns: Map<name, EnrichedAdCreative[]>                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Merge All Data                                                │
│    - mergePricingIntoCompetitors(competitors, pricingMap)       │
│    - mergeAdsIntoCompetitors(competitors, adsMap)               │
│    Returns: Enriched CompetitorSnapshot[]                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Return CitedSectionOutput<CompetitorAnalysis>                   │
└─────────────────────────────────────────────────────────────────┘
```

### Pricing Extraction Detail

```
┌──────────────────────────────────────────────────────────────────┐
│ fetchCompetitorPricing(competitors[])                            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
          ┌───────────────────────────────────────┐
          │ For each competitor (max 3 parallel)  │
          └───────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
    ┌─────────────────────┐     ┌─────────────────────┐
    │ Has website URL?    │     │ Skip (no website)   │
    └─────────────────────┘     └─────────────────────┘
                │
                ▼
    ┌─────────────────────────────────────────────────┐
    │ discoverPricingPage(website)                    │
    │   1. Try /pricing, /plans, /pricing-plans       │
    │   2. Firecrawl map → filter sitemap             │
    │   3. Return best URL or undefined               │
    └─────────────────────────────────────────────────┘
                │
                ▼
    ┌─────────────────────────────────────────────────┐
    │ Found pricing page?                             │
    │   YES → Continue                                │
    │   NO  → Try homepage (low confidence)           │
    └─────────────────────────────────────────────────┘
                │
                ▼
    ┌─────────────────────────────────────────────────┐
    │ firecrawl.scrapeUrl(pricingUrl)                 │
    │   Returns: { markdown, html, metadata }         │
    │   Cost: 1 Firecrawl credit                      │
    └─────────────────────────────────────────────────┘
                │
                ▼
    ┌─────────────────────────────────────────────────┐
    │ llm.chatJSONValidated(markdown, PricingTier[])  │
    │   Model: Gemini 2.0 Flash (cheap, fast)         │
    │   Returns: PricingTier[]                         │
    │   Cost: ~$0.0001 per competitor                  │
    └─────────────────────────────────────────────────┘
                │
                ▼
    ┌─────────────────────────────────────────────────┐
    │ calculateConfidence(tiers)                       │
    │   High: All tiers complete with features         │
    │   Medium: Some gaps, custom pricing              │
    │   Low: Mostly "Contact us"                       │
    └─────────────────────────────────────────────────┘
                │
                ▼
    ┌─────────────────────────────────────────────────┐
    │ Return PricingExtractionResult                   │
    │   { tiers, confidence, source, scrapedAt }       │
    └─────────────────────────────────────────────────┘
```

---

## Component Dependencies

### Dependency Graph

```
competitor-research.ts
    │
    ├─> @/lib/pricing/service [NEW]
    │       │
    │       ├─> @/lib/pricing/discovery [NEW]
    │       │       └─> @/lib/firecrawl/client [NEW]
    │       │               └─> @mendable/firecrawl-js [NPM]
    │       │
    │       └─> @/lib/pricing/extraction [NEW]
    │               ├─> @/lib/firecrawl/client [NEW]
    │               └─> @/lib/openrouter/client [EXISTING]
    │
    ├─> @/lib/research [EXISTING]
    │       └─> @/lib/openrouter/client
    │
    └─> @/lib/ad-library [EXISTING]
            └─> (ad library dependencies)
```

### External Dependencies

**New NPM package:**
```json
{
  "dependencies": {
    "@mendable/firecrawl-js": "^4.10.0"
  }
}
```

**Version rationale:** Latest stable (as of 2026-01-31)

**Environment variables:**
- `FIRECRAWL_API_KEY` (optional, server-only)

---

## Suggested Build Order

### Phase 1: Firecrawl Foundation (Standalone)

**Goal:** Establish Firecrawl client and test independently

**Tasks:**
1. Add `@mendable/firecrawl-js` to package.json
2. Create `src/lib/firecrawl/client.ts` with FirecrawlClient class
3. Add `FIRECRAWL_API_KEY` to env.ts as optional
4. Create basic test script to scrape a known pricing page
5. Verify error handling (missing API key, invalid URL, timeout)

**Success criteria:**
- Can scrape a URL and get markdown response
- Graceful error on missing API key
- Timeout handling works

**Risk mitigation:** Build in isolation - doesn't touch existing pipeline yet

### Phase 2: Pricing Discovery (Crawl Logic)

**Goal:** Find pricing pages from website URLs

**Tasks:**
1. Create `src/lib/pricing/discovery.ts`
2. Implement `discoverPricingPage()` with 3-tier strategy
3. Test with 5-10 real competitor websites
4. Measure success rate (direct vs sitemap vs fallback)
5. Add logging for discovery method used

**Success criteria:**
- Finds pricing page for 70%+ of test websites
- Logs discovery confidence and method
- Falls back gracefully when no pricing page found

**Decision point:** If success rate < 50%, consider adding crawl strategy

### Phase 3: LLM Extraction (Data Parsing)

**Goal:** Extract structured PricingTier[] from markdown

**Tasks:**
1. Create `src/lib/pricing/extraction.ts`
2. Implement `extractPricing()` with Gemini 2.0 Flash
3. Define Zod schema for PricingTier validation
4. Implement confidence scoring algorithm
5. Test with 10 real pricing page markdown samples
6. Measure extraction accuracy and confidence correlation

**Success criteria:**
- Extracts tiers with 80%+ accuracy on test samples
- Confidence score correlates with data quality
- Handles edge cases (custom pricing, contact-only, freemium)

**Validation:** Manual review of 10 extracted results vs actual pages

### Phase 4: Pricing Service Orchestration

**Goal:** Batch processing for multiple competitors

**Tasks:**
1. Create `src/lib/pricing/service.ts`
2. Implement `fetchCompetitorPricing()` with parallel processing
3. Add timeout and error handling per competitor
4. Implement graceful degradation pattern (like ad library)
5. Add cost tracking and logging
6. Test with 5 competitors in parallel

**Success criteria:**
- Processes 5 competitors in < 60s total
- One failure doesn't crash batch
- Logs clear errors per competitor
- Returns partial results on timeout

**Performance target:** 3 parallel requests, 30s timeout each

### Phase 5: Pipeline Integration

**Goal:** Replace Perplexity pricing in competitor-research.ts

**Tasks:**
1. Add `fetchCompetitorPricing()` call after Perplexity research
2. Implement `mergePricingIntoCompetitors()` function
3. Update Perplexity systemPrompt (reduce pricing emphasis)
4. Add try/catch with graceful degradation
5. Update cost tracking to include Firecrawl costs
6. Test full pipeline with real onboarding data

**Success criteria:**
- Pipeline still completes if Firecrawl fails
- Pricing data more accurate than Perplexity-only
- Total cost increase < $0.10 per blueprint
- No breaking changes to output types

**Validation:** Run 5 real blueprints, compare pricing quality

### Phase 6: Confidence Scoring & UI

**Goal:** Surface confidence scores to users

**Tasks:**
1. Extend CompetitorSnapshot type with `pricingConfidence?: number`
2. Update UI to show confidence indicator
3. Add tooltip explaining confidence score
4. Consider adding "Verify pricing" CTA for low confidence
5. Log confidence distribution for monitoring

**Success criteria:**
- Users can see which pricing is high vs low confidence
- Low confidence pricing includes warning
- Confidence scores visible in review UI

**Future enhancement:** Allow users to manually correct pricing

---

## Cost Analysis

### Firecrawl Costs

**Per competitor:**
- Pricing page discovery: 0 credits (direct attempt) or 1 credit (sitemap map)
- Pricing page scrape: 1 credit
- **Total: 1-2 credits per competitor**

**Blueprint with 5 competitors:**
- Firecrawl: 5-10 credits
- Cost: $0.016 - $0.032 (at $16/1000 credits for Hobby plan)

### LLM Extraction Costs

**Per competitor:**
- Model: Gemini 2.0 Flash
- Input: ~1000 tokens (pricing page markdown)
- Output: ~500 tokens (structured JSON)
- Cost: ~$0.0001 per competitor

**Blueprint with 5 competitors:**
- LLM extraction: $0.0005

### Total Cost Impact

**Per blueprint (5 competitors):**
- Firecrawl: $0.016 - $0.032
- LLM extraction: $0.0005
- **Total increase: ~$0.02 - $0.03**

**Current blueprint cost:** ~$0.15 (Perplexity Deep Research dominant)
**New blueprint cost:** ~$0.17 - $0.18 (+13% increase)

**Cost optimization opportunities:**
1. Cache pricing pages (pricing rarely changes daily)
2. Skip Firecrawl if Perplexity confidence is high
3. Batch competitors to same domain (reuse sitemaps)

---

## Error Handling Strategy

### Graceful Degradation Levels

**Level 1: Missing API key**
- Skip Firecrawl entirely
- Log info message (not error)
- Use Perplexity pricing as fallback
- User sees message: "Pricing data from AI synthesis"

**Level 2: Individual competitor failure**
- Log error with competitor name
- Continue processing other competitors
- Return partial results
- User sees Perplexity pricing for failed competitor

**Level 3: Timeout on slow page**
- Abort scrape after 30s
- Log timeout with URL
- Try homepage as fallback (if time permits)
- Return low confidence or undefined

**Level 4: Extraction validation failure**
- Retry with adjusted prompt (1 retry)
- If still fails, return empty tiers
- Log validation error
- User sees "Custom pricing" or fallback

### Error Logging Pattern

```typescript
try {
  const pricing = await fetchCompetitorPricing(competitors);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  if (errorMessage.includes('FIRECRAWL_API_KEY')) {
    console.info('[Pricing] API key not configured - using Perplexity fallback');
  } else if (errorMessage.includes('timeout')) {
    console.warn('[Pricing] Timeout - partial results returned');
  } else {
    console.error('[Pricing] Extraction failed:', errorMessage);
  }
}
```

**Matches existing ad library pattern** (lines 139-148)

---

## Performance Considerations

### Parallel Processing

**Current bottleneck:** Sequential Perplexity research (single call)
**New bottleneck:** Parallel Firecrawl scraping (3 concurrent max)

**Timing estimate (5 competitors):**
- Perplexity research: 45s (unchanged)
- Firecrawl pricing (3 parallel): 15-20s
- Ad library fetch: 10-15s (unchanged)
- **Total: ~70-80s** (up from 60-70s)

**Optimization:** Run Firecrawl and ad library in parallel (Promise.all)
```typescript
const [pricingMap, adsMap] = await Promise.all([
  fetchCompetitorPricing(data.competitors),
  fetchCompetitorAds(adService, data.competitors),
]);
```
**New total: ~60-70s** (no increase)

### Timeout Strategy

**Per-competitor timeout:** 30s
- Firecrawl scrape: typically 5-10s
- LLM extraction: 2-3s
- Buffer for slow pages: 20s

**Total pipeline timeout:** 120s (unchanged from current Perplexity timeout)

### Rate Limiting

**Firecrawl rate limits:**
- Hobby plan: 2 requests/second
- Current design: 3 concurrent requests
- **Mitigation:** Add 500ms delay between batches if needed

**OpenRouter rate limits:**
- Gemini 2.0 Flash: High throughput
- Current design: 1 request per competitor
- **No issue expected**

---

## Testing Strategy

### Unit Tests

**Firecrawl Client:**
- Mock FirecrawlApp SDK
- Test error handling (missing key, timeout, invalid URL)
- Test response parsing

**Pricing Discovery:**
- Test direct path attempts
- Mock sitemap responses
- Test URL filtering logic

**Pricing Extraction:**
- Test LLM response parsing
- Test confidence scoring algorithm
- Test validation with Zod schema

**Pricing Service:**
- Mock Firecrawl and LLM clients
- Test parallel processing
- Test error recovery
- Test partial results on failure

### Integration Tests

**End-to-end pricing flow:**
1. Input: Real competitor website URL
2. Expected: PricingTier[] with confidence score
3. Validate: Accuracy vs manual scraping

**Pipeline integration:**
1. Input: Onboarding data with 5 competitors
2. Expected: CompetitorAnalysis with Firecrawl pricing
3. Validate: Pricing data quality vs Perplexity-only

**Graceful degradation:**
1. Input: Invalid API key
2. Expected: Pipeline completes with Perplexity fallback
3. Validate: No crashes, info logged

### Performance Tests

**Parallel processing:**
- Test 10 competitors simultaneously
- Measure total time
- Validate max 3 concurrent Firecrawl requests

**Timeout handling:**
- Mock slow Firecrawl response (31s)
- Validate timeout triggers
- Validate partial results returned

---

## Rollout Strategy

### Phased Rollout

**Phase 1: Internal testing**
- Deploy with `FIRECRAWL_API_KEY` in staging
- Test with 20 real blueprints
- Measure accuracy improvement
- Monitor costs

**Phase 2: Feature flag**
- Add `ENABLE_FIRECRAWL_PRICING=true` env var
- Default to false in production
- Enable for beta users
- Collect feedback

**Phase 3: Gradual rollout**
- Enable for 25% of users
- Monitor error rates
- Compare pricing quality metrics
- Increase to 50%, then 100%

**Phase 4: Full deployment**
- Remove feature flag
- Make Firecrawl default
- Keep Perplexity as fallback

### Rollback Plan

**If Firecrawl fails:**
1. Set `ENABLE_FIRECRAWL_PRICING=false`
2. Pipeline reverts to Perplexity-only
3. No code deployment needed
4. Investigate and fix

**If costs exceed budget:**
1. Add caching layer
2. Reduce competitors processed
3. Skip Firecrawl for low-value blueprints

---

## Monitoring & Observability

### Key Metrics

**Success metrics:**
- Pricing extraction success rate (%)
- Average confidence score
- Pricing page discovery rate (%)

**Performance metrics:**
- Average scrape time per competitor
- Total pricing phase duration
- Timeout frequency

**Cost metrics:**
- Firecrawl credits used per blueprint
- LLM extraction cost per blueprint
- Total cost increase vs baseline

**Quality metrics:**
- Manual validation accuracy (sample)
- User corrections/feedback
- Confidence score distribution

### Logging Strategy

**Per-competitor logs:**
```
[Pricing] Tesla: Discovered pricing page via direct (/pricing)
[Pricing] Tesla: Scraped successfully (8.2s, 1 credit)
[Pricing] Tesla: Extracted 3 tiers (confidence: 85)
```

**Aggregate logs:**
```
[Pricing] Processed 5 competitors: 4 success, 1 timeout
[Pricing] Total cost: $0.023 (Firecrawl: $0.020, LLM: $0.003)
[Pricing] Average confidence: 72
```

**Error logs:**
```
[Pricing] Error: SpaceX timeout after 30s on https://spacex.com/pricing
[Pricing] Warning: Low confidence (35) for Rivian - manual review recommended
```

---

## Future Enhancements

### Phase 7+: Advanced Features

**Pricing change detection:**
- Store historical pricing data
- Compare current scrape to previous
- Alert on significant changes

**Confidence boosting:**
- Compare Firecrawl vs Perplexity pricing
- If they match, boost confidence to 95+
- If they differ, flag for manual review

**Smart caching:**
- Cache pricing pages for 7 days
- Re-scrape only if cache expired
- Reduce costs by 80%+ for repeat competitors

**Multi-source validation:**
- Scrape multiple pricing sources (main site, G2, Capterra)
- Cross-validate pricing data
- Use consensus for high confidence

**User corrections:**
- Allow users to edit incorrect pricing
- Store corrections in database
- Use corrections to improve LLM prompts

---

## Architecture Decisions

### ADR 1: Firecrawl vs Playwright

**Decision:** Use Firecrawl API over Playwright

**Rationale:**
- Firecrawl handles JS rendering automatically
- No browser management overhead
- Built-in markdown conversion
- Cost-effective for low volume
- Faster development

**Tradeoffs:**
- External dependency (API downtime risk)
- Ongoing cost per scrape
- Less control over scraping logic

**Alternative considered:** Playwright + Cheerio
- Pros: No external API, full control
- Cons: Complex setup, browser management, slower development

### ADR 2: Gemini 2.0 Flash for Extraction

**Decision:** Use Gemini 2.0 Flash for LLM extraction

**Rationale:**
- Cheapest model ($0.075/$0.30 per 1M tokens)
- Fast response time (2-3s)
- Sufficient accuracy for structured extraction
- JSON mode support

**Tradeoffs:**
- Lower accuracy than GPT-4o or Claude
- May struggle with complex pricing pages

**Mitigation:** Retry with Claude Sonnet if Gemini fails validation

### ADR 3: Graceful Degradation Pattern

**Decision:** Make Firecrawl optional, fall back to Perplexity

**Rationale:**
- Matches existing ad library pattern
- Pipeline never breaks
- Easy to deploy incrementally
- Users always get some pricing data

**Tradeoffs:**
- More complex error handling
- Can't rely on Firecrawl always being available

**Alternative considered:** Make Firecrawl required
- Pros: Simpler code, guaranteed quality
- Cons: Breaks pipeline if API down, harder rollback

### ADR 4: Parallel Processing with Rate Limiting

**Decision:** Process 3 competitors in parallel, rate limit to 2 req/s

**Rationale:**
- Balance speed vs API rate limits
- Complete 5 competitors in 15-20s
- Stay within Firecrawl Hobby plan limits

**Tradeoffs:**
- More complex concurrency logic
- Need to track in-flight requests

**Alternative considered:** Sequential processing
- Pros: Simpler code
- Cons: 5x slower (75-100s total)

---

## Sources

**Firecrawl Pricing & Features:**
- [Firecrawl Pricing](https://www.firecrawl.dev/pricing)
- [Firecrawl vs Apify: 2026 guide](https://blog.apify.com/firecrawl-vs-apify/)
- [Honest look at Firecrawl pricing 2025](https://www.eesel.ai/blog/firecrawl-pricing)
- [Firecrawl GitHub Repository](https://github.com/firecrawl/firecrawl)

**Firecrawl API Integration:**
- [Firecrawl Scrape Endpoint](https://docs.firecrawl.dev/features/scrape)
- [Mastering Firecrawl Scrape API](https://www.firecrawl.dev/blog/mastering-firecrawl-scrape-endpoint)
- [Mastering Firecrawl Extract Endpoint](https://www.firecrawl.dev/blog/mastering-firecrawl-extract-endpoint)
- [Firecrawl Node SDK](https://docs.firecrawl.dev/sdks/node)
- [@mendable/firecrawl-js npm package](https://www.npmjs.com/package/@mendable/firecrawl-js)

**Existing Codebase:**
- `src/lib/strategic-blueprint/pipeline/competitor-research.ts` (read directly)
- `src/lib/strategic-blueprint/output-types.ts` (read directly)
- `src/lib/research/agent.ts` (read directly)
- `src/lib/env.ts` (read directly)
