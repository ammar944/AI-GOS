# Feature Landscape: Intelligent Pricing Extraction

**Domain:** Competitor pricing intelligence for SaaS products
**Researched:** 2026-01-31
**Project Context:** AI-GOS v2.2 - Adding intelligent pricing extraction to existing competitor analysis pipeline

## Table Stakes

Features users expect from accurate pricing extraction systems. Missing = product feels incomplete or inaccurate.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Multi-URL Pattern Discovery** | Pricing pages live at `/pricing`, `/plans`, `/packages`, `/buy`, etc. - not just one pattern | Low | Common patterns are well-documented; heuristic-based approach |
| **Structured Tier Extraction** | Extract tier name, price, description, features, limitations into structured format | Medium | Already exists in codebase (`PricingTier` type); need reliable extraction logic |
| **Currency Normalization** | Handle $99/mo, $99/month, $1,188/year consistently | Low | String parsing with standardization rules |
| **Tiered vs Flat Pricing Detection** | Detect if pricing is multi-tier (Starter/Pro/Enterprise) or single-price | Low | Count pricing sections on page |
| **"Contact Us" / Custom Pricing Handling** | Many enterprise products don't show prices - must handle gracefully | Low | Detect "Contact sales", "Custom pricing" text patterns |
| **Confidence Scoring** | Report how confident the extraction is (HIGH/MEDIUM/LOW) | Medium | Based on: page title match, structured data presence, extraction completeness |
| **Graceful Fallback** | When extraction fails, return partial data or clear error state | Low | Better than returning nothing or wrong data |
| **Basic Validation** | Detect obviously wrong extractions (negative prices, missing tier names) | Low | Sanity checks before returning data |

## Differentiators

Features that set this implementation apart from basic scraping. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Intelligent Page Discovery** | Don't just try `/pricing` - analyze site navigation, sitemap, footer links to find where pricing actually lives | High | **Key differentiator** - solves "pricing is at /solutions/pricing" problem; requires crawl strategy |
| **Extraction Confidence Breakdown** | Not just "LOW confidence" but WHY - "Page found (HIGH), pricing structure detected (MEDIUM), tier features incomplete (LOW)" | Medium | Helps users understand what to manually verify |
| **Feature List Extraction** | Extract bullet-point features per tier, not just tier name/price | Medium | High value for competitor analysis - see what features they gate |
| **Target Audience Detection** | Extract "For teams of 5-10", "Best for enterprises" tier descriptions | Medium | Enriches competitive intelligence beyond raw pricing |
| **Limitation Extraction** | Extract usage caps: "Up to 10,000 contacts", "5 users included" | Medium | Critical for comparing value between competitors |
| **Source URL Tracking** | Return which URL pricing was extracted from + timestamp | Low | Enables manual verification and debugging |
| **Multi-Currency Detection** | Detect when site shows prices in multiple currencies and extract default/USD | Medium | Improves accuracy for international competitors |
| **Annual vs Monthly Detection** | Extract both monthly and annual pricing when available | Low | Shows discount patterns (e.g., "Save 20% annually") |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain or out-of-scope for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full Site Crawling** | Crawling entire competitor sites wastes resources, hits rate limits, and is legally risky | Use targeted discovery: sitemap + navigation links + common patterns. Stop after finding pricing page. |
| **Historical Pricing Tracking** | Storing pricing snapshots over time adds database complexity and storage costs | Explicitly out of scope for v2.2 (per PROJECT.md). Extract current pricing only. Future milestone (v2.3+). |
| **Price Change Alerts** | Monitoring competitors for price changes requires polling/cron infrastructure | Out of scope for v2.2. Current milestone is one-time extraction during blueprint generation. |
| **Screenshot Storage** | Storing pricing page screenshots for "proof" consumes storage and bandwidth | Store source URL and extraction timestamp. Users can visit URL to verify if needed. |
| **JavaScript-Heavy Rendering** | Full browser automation (Playwright/Puppeteer) for client-side rendered pricing pages | Use Firecrawl API which handles JS rendering. Don't build custom browser automation. |
| **Template-Based Extraction** | Creating templates per competitor ("Shopify pricing looks like X") | Use LLM-powered extraction that adapts to any page structure. Templates break when sites redesign. |
| **Aggressive Retry Logic** | Retrying failed requests 5-10 times to "guarantee" success | One attempt with Firecrawl. If it fails, mark confidence as LOW and move on. Don't delay entire blueprint generation. |
| **Pricing Trend Visualization** | Charts showing "Competitor X raised prices 3 times this year" | Out of scope - requires historical data. Focus on accurate current extraction. |
| **A/B Test Detection** | Detecting when competitors show different pricing to different visitors | Overly complex for v2.2. Extract what we see on first visit. Edge case doesn't justify complexity. |

## Feature Dependencies

```
Existing codebase provides:
- PricingTier type (tier, price, description, targetAudience, features, limitations)
- CompetitorSnapshot with pricingTiers[] field
- Perplexity-based competitor research (being replaced)
- Ad library integration for ad creatives

New features build on this:
[Competitor URL]
    → Intelligent Page Discovery
        → URL candidates (/pricing, /plans, sitemap links)
    → Firecrawl Scraping
        → HTML/markdown of pricing page
    → LLM-Powered Extraction
        → Structured PricingTier[] data
    → Confidence Scoring
        → Per-field and overall confidence
    → Integration
        → Replace Perplexity pricing in Section 4 pipeline
```

**Critical dependency**: Firecrawl API integration
- Handles JS rendering (client-side pricing pages)
- Bypasses basic anti-bot protection
- Returns clean markdown for LLM parsing
- Estimated cost: ~$0.001-0.01 per page ([Kadoa pricing](https://www.kadoa.com/blog/best-ai-web-scrapers-2026) shows $0.001/page for AI scrapers in 2026)

## MVP Recommendation

For v2.2 MVP, prioritize:

### Phase 1: Foundation (High Priority)
1. **Multi-URL Pattern Discovery** - Try 5-7 common patterns (`/pricing`, `/plans`, `/buy`, etc.)
2. **Firecrawl Integration** - Single page scrape with error handling
3. **LLM-Powered Extraction** - Parse markdown → PricingTier[] using GPT-4o/Claude
4. **Basic Confidence Scoring** - HIGH (all fields extracted) / MEDIUM (partial) / LOW (failed or minimal data)
5. **Integration with CompetitorSnapshot** - Replace Perplexity pricing data source

### Phase 2: Intelligence (Medium Priority)
6. **Intelligent Page Discovery** - Sitemap parsing + navigation link analysis to find non-standard pricing URLs
7. **Confidence Breakdown** - Per-field confidence (page_found, structure_detected, features_complete)
8. **Feature/Limitation Extraction** - Extract tier features and usage caps, not just tier/price
9. **Source URL Tracking** - Return `pricingSourceUrl` and `extractedAt` timestamp

### Defer to Post-MVP
- **Multi-Currency Detection** - Start with USD/default currency only
- **Target Audience Detection** - Extract if present, but don't require
- **Annual vs Monthly Detection** - Extract monthly pricing; annual is bonus
- **Advanced Validation** - Start with basic sanity checks (no negative prices, required fields present)

**Rationale for ordering:**
- Phase 1 delivers immediate value: replace inaccurate Perplexity pricing with direct scraping
- Phase 2 adds "intelligent" aspect - finding pricing pages that aren't at `/pricing`
- Deferring multi-currency and advanced features keeps v2.2 scope tight
- Can iterate based on accuracy metrics from initial deployment

## Expected Behavior Examples

### Scenario 1: Standard SaaS Pricing Page
**Input:** `https://competitor.com` (website URL)
**Discovery:** Try `/pricing` → Success (200 OK)
**Extraction Output:**
```typescript
{
  pricingTiers: [
    {
      tier: "Starter",
      price: "$29/mo",
      description: "Perfect for small teams",
      targetAudience: "1-5 users",
      features: ["5 projects", "Basic analytics", "Email support"],
      limitations: "Up to 5 users, 5 projects"
    },
    {
      tier: "Pro",
      price: "$99/mo",
      description: "For growing businesses",
      targetAudience: "5-20 users",
      features: ["Unlimited projects", "Advanced analytics", "Priority support", "API access"],
      limitations: "Up to 20 users"
    },
    {
      tier: "Enterprise",
      price: "Custom",
      description: "For large organizations",
      targetAudience: "20+ users",
      features: ["Everything in Pro", "Dedicated account manager", "SSO", "SLA"],
      limitations: null
    }
  ],
  pricingSourceUrl: "https://competitor.com/pricing",
  extractedAt: "2026-01-31T12:34:56Z",
  confidence: {
    overall: "HIGH",
    breakdown: {
      page_found: "HIGH",
      structure_detected: "HIGH",
      tiers_extracted: "HIGH",
      features_extracted: "MEDIUM"
    }
  }
}
```

### Scenario 2: Non-Standard Pricing URL
**Input:** `https://saas-tool.io`
**Discovery:**
- Try `/pricing` → 404
- Try `/plans` → 404
- Parse sitemap → Found `/solutions/business-pricing`
- Success!

**Extraction Output:**
```typescript
{
  pricingTiers: [
    { tier: "Basic", price: "$49/mo", description: "Essential features", features: ["Feature A", "Feature B"] },
    { tier: "Advanced", price: "$149/mo", description: "All features", features: ["Everything in Basic", "Feature C", "Feature D"] }
  ],
  pricingSourceUrl: "https://saas-tool.io/solutions/business-pricing",
  extractedAt: "2026-01-31T12:35:22Z",
  confidence: {
    overall: "MEDIUM",
    breakdown: {
      page_found: "MEDIUM", // Found via sitemap, not standard URL
      structure_detected: "HIGH",
      tiers_extracted: "HIGH",
      features_extracted: "HIGH"
    }
  }
}
```

### Scenario 3: Contact-Only Pricing (Enterprise SaaS)
**Input:** `https://enterprise-software.com`
**Discovery:** Try `/pricing` → 200 OK
**Page Content:** "Contact our sales team for custom pricing tailored to your needs"

**Extraction Output:**
```typescript
{
  pricingTiers: [
    {
      tier: "Enterprise",
      price: "Contact Sales",
      description: "Custom pricing tailored to your needs",
      features: null, // No public pricing details
      limitations: null
    }
  ],
  pricingSourceUrl: "https://enterprise-software.com/pricing",
  extractedAt: "2026-01-31T12:36:10Z",
  confidence: {
    overall: "LOW",
    breakdown: {
      page_found: "HIGH",
      structure_detected: "LOW", // No tier structure
      tiers_extracted: "LOW", // Only "Contact Sales"
      features_extracted: "LOW" // No features listed
    }
  }
}
```

### Scenario 4: Extraction Failure
**Input:** `https://competitor-old-site.com`
**Discovery:** All URL patterns return 404
**Extraction Output:**
```typescript
{
  pricingTiers: undefined, // Maintain existing behavior
  pricingSourceUrl: null,
  extractedAt: "2026-01-31T12:37:45Z",
  confidence: {
    overall: "LOW",
    breakdown: {
      page_found: "LOW", // Could not find pricing page
      structure_detected: null,
      tiers_extracted: null,
      features_extracted: null
    }
  },
  error: "Pricing page not found after trying 7 URL patterns and sitemap analysis"
}
```

## Accuracy Benchmarks (Industry Standards 2026)

Based on research into automated data extraction tools in 2026:

| Metric | Industry Standard | AI-GOS Target |
|--------|-------------------|---------------|
| **Page Discovery Success Rate** | 85-90% for SaaS sites | 90%+ (leverage sitemap + navigation) |
| **Tier Extraction Accuracy** | 95-99% for structured pages | 95%+ (GPT-4o/Claude on clean markdown) |
| **Feature List Completeness** | 70-80% (often incomplete) | 75%+ (acceptable for competitive intel) |
| **Price Parsing Accuracy** | 98%+ (high priority field) | 99%+ (critical for comparison) |
| **Overall Confidence = HIGH** | When 90%+ fields extracted | When tier + price + 2+ features extracted per tier |
| **Processing Time** | 2-5 seconds per competitor | <3s (Firecrawl + LLM call; don't block blueprint gen) |

**Source:** [Automated Data Extraction accuracy rates](https://www.solvexia.com/blog/automated-data-extraction) show 95-99% accuracy for structured documents in 2026; [Azure Document Intelligence](https://www.itmagination.com/technologies/azure-ai-document-intelligence) achieves 99%+ with confidence scoring.

## Integration Points with Existing Codebase

### Current State (v2.1)
```typescript
// src/lib/strategic-blueprint/pipeline/competitor-research.ts
// Lines 696-730: Ad library enhancement logic

// Currently: Perplexity returns pricing in free-text
// Then: extractPricingFromText() parses ad copy for pricing mentions
// Problem: Inaccurate - pulls from reviews/articles, not actual pricing pages
```

### Target State (v2.2)
```typescript
// New service: src/lib/pricing-extraction/index.ts
export async function extractCompetitorPricing(
  competitorUrl: string
): Promise<PricingExtractionResult> {
  // 1. Intelligent page discovery
  const pricingPageUrl = await discoverPricingPage(competitorUrl);

  // 2. Firecrawl scraping
  const pageContent = await scrapePricingPage(pricingPageUrl);

  // 3. LLM extraction
  const tiers = await extractPricingTiers(pageContent);

  // 4. Confidence scoring
  const confidence = calculateConfidence(pricingPageUrl, pageContent, tiers);

  return { tiers, pricingSourceUrl: pricingPageUrl, confidence };
}

// Integration in competitor-research.ts:
// Replace extractPricingFromText() calls with extractCompetitorPricing()
```

### Breaking Changes
**None.** This is additive:
- `PricingTier` type already exists
- `CompetitorSnapshot.pricingTiers` field already exists
- New extraction replaces Perplexity parsing, doesn't change output schema

### New Fields (Optional Extensions)
```typescript
// Could extend CompetitorSnapshot with metadata:
interface CompetitorSnapshot {
  // ... existing fields
  pricingTiers?: PricingTier[];
  pricingSourceUrl?: string; // NEW: Where pricing was found
  pricingExtractedAt?: string; // NEW: When extraction ran
  pricingConfidence?: ConfidenceScore; // NEW: Extraction confidence
}
```

## Success Metrics

How to know if intelligent pricing extraction is working:

### Functional Metrics
- **Discovery Rate:** 90%+ of competitor URLs successfully find pricing page
- **Extraction Accuracy:** 95%+ correct tier/price extraction (vs manual verification on 50 sample competitors)
- **Feature Completeness:** 75%+ of tiers include at least 3 features
- **High Confidence Rate:** 70%+ extractions marked HIGH confidence
- **Processing Time:** <3 seconds per competitor (don't slow down blueprint generation)

### Quality Metrics
- **False Positive Rate:** <5% (extracting wrong pricing or non-pricing content)
- **Graceful Degradation:** 100% of failures return structured error with LOW confidence (no crashes)
- **User Trust:** Confidence scores correlate with actual accuracy (HIGH = 95%+ accurate, MEDIUM = 80%+, LOW = <80%)

### Business Metrics
- **Replacement Success:** v2.2 pricing data is more accurate than v2.1 Perplexity pricing
- **Manual Verification Need:** Users need to verify <30% of extractions (vs 60%+ with Perplexity)
- **Cost Per Extraction:** <$0.02 per competitor (Firecrawl + LLM call)

## Common Pitfalls to Avoid

Based on research into pricing scraper mistakes in 2026:

### 1. Static Selectors Break on Redesigns
**Problem:** Hardcoding CSS selectors like `.pricing-card` breaks when site redesigns
**Prevention:** Use LLM-based extraction on markdown (semantic understanding, not DOM traversal)
**Detection:** Sudden drop in extraction accuracy for specific competitor
**Source:** [Browserless - Web Scraping Anti-Patterns](https://www.browserless.io/blog/patterns-and-anti-patterns-in-web-scraping)

### 2. Rate Limiting Causes Failures
**Problem:** Hitting competitor sites too aggressively triggers rate limits/blocks
**Prevention:**
- Use Firecrawl API which handles anti-bot bypass
- Extract pricing once per blueprint generation (not repeated calls)
- Don't retry more than once on failure
**Detection:** 429 status codes or Firecrawl errors
**Source:** [Vayne - LinkedIn Scraper Mistakes](https://www.vayne.io/en/blog/best-linkedin-scrapers-2026)

### 3. Stale Data Appears Accurate
**Problem:** Extracting old pricing from cached/outdated pages
**Prevention:**
- Firecrawl fetches fresh content (not cached)
- Include `extractedAt` timestamp so users know recency
- Consider cache-busting headers if Firecrawl supports
**Detection:** User reports "this pricing is outdated"

### 4. Confidence Scores Don't Match Reality
**Problem:** Marking extraction as HIGH confidence when it's actually wrong
**Prevention:**
- Conservative scoring: require tier + price + features for HIGH
- Mark "Contact Sales" only pages as LOW confidence
- Test confidence thresholds against manual verification
**Detection:** HIGH confidence extractions failing manual spot-checks

### 5. Incomplete Feature Lists Look Complete
**Problem:** Extracting only visible features, missing "See all features" collapsed content
**Prevention:**
- Firecrawl's JS rendering should expand collapsed sections
- Accept 75% completeness target (not 100%)
- Mark feature extraction confidence separately
**Detection:** Competitor tiers have far fewer features than visible on their site

### 6. Processing Time Blocks Blueprint Generation
**Problem:** Slow pricing extraction delays entire blueprint by 30+ seconds
**Prevention:**
- Async extraction with timeout (5s max per competitor)
- Fail fast: if Firecrawl takes >5s, return LOW confidence and move on
- Consider parallel extraction for multiple competitors
**Detection:** User complaints about slow blueprint generation in v2.2

### 7. Legal/Ethical Scraping Issues
**Problem:** Aggressive scraping violates robots.txt or terms of service
**Prevention:**
- Respect robots.txt (Firecrawl should handle this)
- Rate limit: 1 request per competitor, not repeated polling
- Don't store/republish pricing data (only use for competitive intel)
- Document source URL so users can verify
**Detection:** Legal complaints, Firecrawl API blocks
**Source:** [Medium - Web Scraping DOs and DON'Ts 2026](https://medium.com/@datajournal/dos-and-donts-of-web-scraping-e4f9b2a49431)

## Sources

**Pricing Intelligence & Web Scraping (2026):**
- [Zyte - Price Intelligence Web Scraping](https://www.zyte.com/learn/price-intelligence/)
- [ScrapingBee - Best Price Scraping Tools 2026](https://www.scrapingbee.com/blog/best-competitor-price-scraping-tools/)
- [Kadoa - Best AI Web Scrapers 2026](https://www.kadoa.com/blog/best-ai-web-scrapers-2026)
- [ScrapeOps - AI Web Scraping Tools 2026](https://scrapeops.io/web-scraping-playbook/best-ai-web-scraping-tools/)

**Data Extraction & Confidence Scoring:**
- [SolveXia - Automated Data Extraction Guide 2026](https://www.solvexia.com/blog/automated-data-extraction)
- [Microsoft Learn - Confidence Score Interpretation](https://learn.microsoft.com/en-us/ai-builder/interpret-confidence-score)
- [Azure Document Intelligence Technology Overview](https://www.itmagination.com/technologies/azure-ai-document-intelligence)

**Competitor Pricing Analysis Best Practices:**
- [Visualping - AI Tools for Competitor Analysis 2026](https://visualping.io/blog/best-ai-tools-competitor-analysis)
- [Visualping - Competitor Price Tracking Tools 2026](https://visualping.io/blog/top-tools-competitor-price-tracking)
- [Competera - Competitive Pricing Analysis Methods](https://competera.ai/resources/articles/competitive-pricing-analysis)
- [Tierly - Best Pricing Intelligence Tools for SaaS 2026](https://tierly.app/blog/best-pricing-intelligence-tools)

**SaaS Pricing Trends (2026):**
- [Medium - Future of SaaS Pricing 2026](https://medium.com/@aymane.bt/the-future-of-saas-pricing-in-2026-an-expert-guide-for-founders-and-leaders-a8d996892876)
- [Momentum Nexus - SaaS Pricing Strategy Guide 2026](https://www.momentumnexus.com/blog/saas-pricing-strategy-guide-2026/)

**Web Scraping Anti-Patterns & Pitfalls:**
- [Browserless - Patterns and Anti-Patterns in Web Scraping](https://www.browserless.io/blog/patterns-and-anti-patterns-in-web-scraping)
- [Medium - DOs and DON'Ts of Web Scraping 2026](https://medium.com/@datajournal/dos-and-donts-of-web-scraping-e4f9b2a49431)
- [Vayne - Best LinkedIn Scrapers 2026 + Mistakes to Avoid](https://www.vayne.io/en/blog/best-linkedin-scrapers-2026)
- [Medium - Web Scraping Trends 2025-2026](https://ficstar.medium.com/web-scraping-trends-for-2025-and-2026-0568d38b2b05)

**Crawl Strategy & Discovery:**
- [LinkGraph - Crawl Budget Optimization 2026](https://www.linkgraph.com/blog/crawl-budget-optimization-2/)
- [Altosight - Ultimate Guide to Price Crawlers](https://altosight.com/price-crawlers-tools-guide/)

**Pricing Page Design (Context for Extraction):**
- [Design Studio UI/UX - SaaS Pricing Page Best Practices 2026](https://www.designstudiouiux.com/blog/saas-pricing-page-design-best-practices/)
- [SaasFrame - 211 SaaS Pricing Page Examples 2026](https://www.saasframe.io/categories/pricing-page)
