---
phase: 35-firecrawl-foundation
plan: 01
subsystem: api
tags: [firecrawl, web-scraping, pricing-intelligence, markdown-extraction]

# Dependency graph
requires:
  - phase: ad-library
    provides: "Pattern for optional service integration with graceful degradation"
provides:
  - "FirecrawlClient for scraping pricing pages with JavaScript rendering"
  - "Graceful degradation pattern when FIRECRAWL_API_KEY is missing"
  - "Pricing page discovery with /pricing, /plans, /buy fallback URLs"
affects: [36-llm-extraction, 37-pipeline-integration, pricing-intelligence]

# Tech tracking
tech-stack:
  added: ["@mendable/firecrawl-js@4.12.0"]
  patterns:
    - "Optional service integration with isAvailable() check"
    - "Graceful degradation returning failure results instead of throwing"
    - "Concurrency-limited batch operations"

key-files:
  created:
    - "src/lib/firecrawl/types.ts"
    - "src/lib/firecrawl/client.ts"
    - "src/lib/firecrawl/index.ts"
  modified:
    - "src/lib/env.ts"
    - "package.json"

key-decisions:
  - "30s timeout default for scraping (matches research recommendation)"
  - "Concurrency limit of 3 for batch scraping (leaves headroom for Hobby plan's 5 browser limit)"
  - "Pricing page fallback order: /pricing → /plans → /buy (most common to least)"
  - "Low word count warning at <100 words to detect JS rendering issues"
  - "Use getEnv() not getRequiredEnv() for optional FIRECRAWL_API_KEY"

patterns-established:
  - "Service client pattern: Constructor initializes SDK, isAvailable() check, all methods return results with success field"
  - "Graceful degradation: Missing API key returns {success: false, error: '...'} without throwing"
  - "Batch operations with chunking: Control concurrency to respect API limits"

# Metrics
duration: 5min
completed: 2026-01-31
---

# Phase 35 Plan 01: Firecrawl Foundation Summary

**FirecrawlClient wrapping @mendable/firecrawl-js SDK with AI-GOS error handling patterns, pricing page discovery, and graceful degradation when API key is missing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-31T00:43:33Z
- **Completed:** 2026-01-31T00:48:11Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- FirecrawlClient service wrapping Firecrawl SDK with graceful degradation
- Pricing page discovery trying /pricing, /plans, /buy fallback URLs in order
- Batch scraping with concurrency limit (3 parallel requests)
- Graceful handling when FIRECRAWL_API_KEY is missing (returns failure, never throws)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Firecrawl SDK and create types** - `ab0165f` (feat)
2. **Task 2: Create FirecrawlClient with graceful degradation** - `210a354` (feat)
3. **Task 3: Create barrel export and verify integration** - `3d029e0` (feat)

## Files Created/Modified

- `src/lib/firecrawl/types.ts` - Type definitions for scraping (ScrapeOptions, ScrapeResult, PricingPageResult, BatchScrapeOptions, BatchScrapeResult)
- `src/lib/firecrawl/client.ts` - FirecrawlClient class with scrape(), scrapePricingPage(), batchScrape() methods
- `src/lib/firecrawl/index.ts` - Barrel export for firecrawl module
- `src/lib/env.ts` - Added FIRECRAWL_API_KEY to optional server env vars
- `package.json` - Added @mendable/firecrawl-js@4.12.0 dependency

## Decisions Made

1. **30s timeout default** - Matches research recommendation for complex pricing pages with heavy JavaScript
2. **Concurrency limit of 3** - Leaves headroom for Firecrawl Hobby plan's 5 concurrent browser limit, prevents rate limiting
3. **Pricing page fallback order: /pricing → /plans → /buy** - Based on most common URL patterns from market research
4. **Low word count warning (<100 words)** - Detects potential JavaScript rendering issues early for debugging
5. **Optional API key via getEnv()** - Allows app to start and function without Firecrawl, graceful degradation pattern
6. **Return failure results vs throwing** - Consistent with AI-GOS error handling, allows pipeline to continue with Perplexity fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Firecrawl SDK API method name**
- **Found during:** Task 2 (Client implementation)
- **Issue:** Plan specified `scrapeUrl()` but SDK method is `scrape()`
- **Fix:** Changed client.ts to use `scrape()` method and corrected response handling (SDK returns Document directly, not a response wrapper)
- **Files modified:** src/lib/firecrawl/client.ts
- **Verification:** TypeScript compilation passes, build succeeds
- **Committed in:** 210a354 (Task 2 commit)

**2. [Rule 3 - Blocking] Recreated types.ts after file loss**
- **Found during:** Task 2 verification
- **Issue:** types.ts file was lost due to user activity between Task 1 and Task 2
- **Fix:** Recreated types.ts file with identical content
- **Files modified:** src/lib/firecrawl/types.ts
- **Verification:** TypeScript compilation passes, imports work
- **Committed in:** 210a354 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both auto-fixes necessary for correct SDK integration. No scope creep.

## Issues Encountered

- User activity between Task 1 and Task 2 resulted in uncommitted work being lost (types.ts file and env.ts edit). Recreated both during Task 2 execution.
- Firecrawl SDK documentation showed `scrape()` method not `scrapeUrl()` as specified in plan. Corrected during implementation.

## User Setup Required

**External service requires API key configuration.**

To enable Firecrawl pricing page scraping:

1. **Sign up for Firecrawl** at https://firecrawl.dev
2. **Get API key** from dashboard
3. **Add to environment:**
   ```bash
   FIRECRAWL_API_KEY=fc-your-api-key-here
   ```
4. **Verify availability:**
   ```typescript
   import { createFirecrawlClient } from '@/lib/firecrawl';
   const client = createFirecrawlClient();
   console.log(client.isAvailable()); // Should return true
   ```

**Note:** Application continues to function without FIRECRAWL_API_KEY (graceful degradation). Phase 37 will implement Perplexity fallback when Firecrawl is unavailable.

## Usage Example

```typescript
import { createFirecrawlClient } from '@/lib/firecrawl';

// Create client
const client = createFirecrawlClient();

// Check availability
if (!client.isAvailable()) {
  console.log('Firecrawl not configured, using fallback');
  // ... use Perplexity instead
  return;
}

// Scrape a pricing page (tries /pricing, /plans, /buy)
const result = await client.scrapePricingPage('https://stripe.com');

if (result.found) {
  console.log(`Found pricing at: ${result.url}`);
  console.log(`Content length: ${result.markdown?.length} chars`);
  // Pass result.markdown to LLM for extraction (Phase 36)
} else {
  console.log(`No pricing page found: ${result.error}`);
  console.log(`Attempted: ${result.attemptedUrls.join(', ')}`);
}

// Batch scrape multiple competitors
const batchResult = await client.batchScrape({
  urls: [
    'https://stripe.com/pricing',
    'https://square.com/pricing',
    'https://paddle.com/pricing',
  ],
  timeout: 45000, // 45s per URL
});

console.log(`Success: ${batchResult.successCount}/${batchResult.results.size}`);
```

## Next Phase Readiness

**Ready for Phase 36 (LLM Extraction & Confidence):**
- FirecrawlClient returns clean markdown content
- Pricing page discovery handles common URL patterns
- Error handling provides clear failure modes for fallback logic
- Batch scraping enables parallel competitor analysis

**What Phase 36 needs to know:**
1. `scrapePricingPage()` returns markdown in `PricingPageResult.markdown`
2. `found: false` means all fallback URLs failed - use Perplexity instead
3. Markdown is raw page content - LLM extraction needed to structure pricing tiers
4. Low word count warnings indicate potential JS rendering issues - may need manual URL specification

**No blockers or concerns.**

---
*Phase: 35-firecrawl-foundation*
*Completed: 2026-01-31*
