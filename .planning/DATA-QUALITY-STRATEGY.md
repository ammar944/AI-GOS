# Data Quality Strategy

## The Problem

Perplexity is great for research but **unreliable for specific data**:
- ❌ Pricing tiers → Often hallucinated or outdated
- ❌ Exact metrics → Makes up numbers
- ❌ Current ad creatives → Can't actually see ads

## The Solution: Hybrid Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCE MAPPING                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PERPLEXITY (Research Layer)                                            │
│  ├── Market trends and dynamics           ✓ Good at aggregating         │
│  ├── Pain points from forums/reviews      ✓ Pulls from multiple sources │
│  ├── Competitor names and positioning     ✓ Can verify existence        │
│  ├── Industry statistics (with citations) ✓ When cited, usually accurate│
│  └── Buying behaviors and triggers        ✓ Synthesizes patterns        │
│                                                                          │
│  FIRECRAWL (Truth Layer - Direct Scraping)                              │
│  ├── Pricing pages → Exact tiers, prices  ✓ From actual source          │
│  ├── Landing page copy → Real messaging   ✓ What they actually say      │
│  └── Feature lists → Accurate details     ✓ From product pages          │
│                                                                          │
│  AD LIBRARY APIS (Creative Layer)                                        │
│  ├── Meta Ad Library → Real ad creatives  ✓ Actual running ads          │
│  ├── LinkedIn Ad Library → B2B ads        ✓ Actual running ads          │
│  └── Ad hooks and copy → Real examples    ✓ Not hypothetical            │
│                                                                          │
│  CLAUDE (Synthesis Layer)                                                │
│  └── Cross-analysis synthesis             ✓ No web search needed        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Section-by-Section Data Sources

### Section 1: Industry & Market Overview
| Field | Source | Reliability |
|-------|--------|-------------|
| categorySnapshot | Perplexity | High - general market data |
| marketDynamics | Perplexity | High - trend aggregation |
| painPoints | Perplexity | High - forums/reviews synthesis |
| psychologicalDrivers | Perplexity | Medium - inferred from patterns |
| audienceObjections | Perplexity | High - from reviews/forums |
| messagingOpportunities | Perplexity | Medium - strategic inference |

### Section 2: ICP Analysis & Validation
| Field | Source | Reliability |
|-------|--------|-------------|
| coherenceCheck | Perplexity + Logic | High |
| painSolutionFit | Perplexity | High |
| marketReachability | Perplexity | Medium - estimates |
| economicFeasibility | Perplexity | Medium |
| riskAssessment | Perplexity | Medium - judgment call |
| finalVerdict | Perplexity | Medium - synthesis |

### Section 3: Offer Analysis & Viability
| Field | Source | Reliability |
|-------|--------|-------------|
| offerClarity | Perplexity + Logic | High |
| offerStrength | Perplexity | Medium - subjective scores |
| marketOfferFit | Perplexity | Medium |
| redFlags | Perplexity | High - pattern matching |
| recommendation | Perplexity | Medium - judgment |

### Section 4: Competitor Analysis (HYBRID)
| Field | Source | Reliability |
|-------|--------|-------------|
| competitors[].name | Perplexity | High |
| competitors[].website | Perplexity | High - verifiable |
| competitors[].positioning | Perplexity | High - from websites |
| competitors[].price | **Firecrawl** | **High - scraped** |
| competitors[].pricingTiers | **Firecrawl** | **High - scraped** |
| competitors[].adCreatives | **Ad Library** | **High - real ads** |
| competitors[].strengths | Perplexity (G2/Capterra) | High |
| competitors[].weaknesses | Perplexity (G2/Capterra) | High |
| creativeLibrary.adHooks | **Ad Library** | **High - real hooks** |
| gapsAndOpportunities | Perplexity | Medium - inference |

### Section 5: Cross-Analysis Synthesis
| Field | Source | Reliability |
|-------|--------|-------------|
| All fields | Claude (from Sections 1-4) | High - synthesis only |

## Implementation in Code

```typescript
// competitor-research.ts

// Step 1: Perplexity for research (NOT pricing)
const baseData = await researchCompetitors(context);

// Step 2: Firecrawl for real pricing
const pricingResults = await scrapePricingForCompetitors(baseData.competitors);

// Step 3: Ad Library for real ads
const adResults = await fetchCompetitorAds(baseData.competitors);

// Step 4: Merge, REPLACING Perplexity data with real data
const enrichedData = mergeCompetitorData(baseData, pricingResults, adResults);
```

## Quality Guardrails

### For Perplexity
```typescript
// In schema - tell it NOT to guess pricing
price: z.string()
  .describe('General tier (Premium/Mid-market/SMB). Do NOT guess exact prices.')
```

### For Firecrawl
```typescript
// Only use if confidence >= 60%
if (scraped.success && scraped.confidence >= 60) {
  return scrapedPricing;
} else {
  return { pricingSource: 'unavailable' };
}
```

### For Ad Library
```typescript
// Use fallback if primary fails
const ads = await fetchWithFallback([
  () => fetchMetaAds(competitor),
  () => fetchLinkedInAds(competitor),
  () => [], // Empty if all fail
]);
```

## What NOT To Do

❌ **Don't ask Perplexity for exact prices**
```typescript
// BAD
price: z.string().describe('Exact pricing like $99/mo')

// GOOD
price: z.string().describe('General tier. Exact prices scraped separately.')
```

❌ **Don't trust Perplexity for current ad creatives**
```typescript
// BAD - Perplexity can't see ads
adHooks: z.array(z.string()).describe('Current ad hooks from Meta')

// GOOD - Get from Ad Library API
const realAds = await fetchMetaAdLibrary(competitor);
```

❌ **Don't use Perplexity output without enrichment for Section 4**
```typescript
// BAD
return perplexityResult;

// GOOD
return enrichWithRealData(perplexityResult, firecrawl, adLibrary);
```

## Monitoring Quality

Track these metrics:
- Firecrawl scrape success rate (target: >80%)
- Pricing confidence scores (target: avg >70%)
- Ad Library hit rate (target: >60% of competitors have ads)
- Citation count from Perplexity (more = better sourced)
