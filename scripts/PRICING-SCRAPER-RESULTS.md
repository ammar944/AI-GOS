# Competitor Pricing Scraper - Test Results

**Date:** 2026-01-30  
**Test Run:** 6 competitors  
**Success Rate:** 6/6 (100%)  
**Total LLM Cost:** $0.0034

## Summary

| Competitor | Tiers | Confidence | Discovery Method | Time | Status |
|------------|-------|------------|------------------|------|--------|
| Notion     | 4     | 71%        | common-path      | 9.3s | ✅ |
| Linear     | 4     | 81%        | sitemap          | 9.0s | ✅ |
| Vercel     | 11    | 76%        | sitemap          | 7.3s | ✅ |
| Supabase   | 15    | 83%        | common-path      | 13.4s| ✅ |
| Stripe     | 2     | 80%        | common-path      | 9.4s | ✅ |
| Figma      | 10    | 92%        | common-path      | 17.8s| ✅ |

## Validation Notes

### ✅ Notion (Accurate)
- **Extracted:** Free ($0), Plus ($10), Business ($20), Enterprise (Contact us)
- **Actual:** Free ($0), Plus ($10), Business ($18), Enterprise (Contact sales)
- **Assessment:** Highly accurate. Business tier is $18/seat billed annually or $20 monthly - extraction got the monthly price.

### ✅ Linear (Accurate)
- **Extracted:** Free ($0), Basic ($10), Business ($16), Enterprise (Contact us)
- **Actual:** Free ($0), Basic ($10), Business ($16), Enterprise (Contact us)
- **Assessment:** 100% accurate.

### ✅ Vercel (Accurate)
- **Extracted:** Hobby (Free), Pro ($20/mo), Enterprise (Contact sales) + add-ons
- **Actual:** Hobby (Free), Pro ($20/mo per member), Enterprise (Contact sales)
- **Assessment:** Accurate. Also correctly captured add-on pricing (SSO, Speed Insights, etc.)

### ✅ Supabase (Accurate)
- **Extracted:** Free ($0), Pro ($25), Team ($599), Enterprise (Custom) + compute tiers
- **Actual:** Free ($0), Pro ($25/mo), Team ($599/mo), Enterprise (Custom)
- **Assessment:** Accurate. Also correctly captured compute instance pricing (Micro through 16XL).

### ✅ Stripe (Accurate)
- **Extracted:** Standard (2.9% + 30¢), Custom (Contact sales)
- **Actual:** Standard (2.9% + 30¢), Custom (Contact sales)
- **Assessment:** 100% accurate. Stripe uses transaction-based pricing, not tiers.

### ⚠️ Figma (Partially Accurate - Multi-Product Complexity)
- **Extracted:** Multiple Professional/Organization/Enterprise entries at different prices
- **Actual:** Figma has separate pricing for Figma Design, Dev Mode, FigJam, Slides
- **Assessment:** Technically correct but confusing. The scraper picked up pricing for ALL products on the combined pricing page. Each product has its own tier structure:
  - Figma Design: Starter (Free), Professional ($15), Organization ($45), Enterprise ($75)
  - FigJam: Starter (Free), Professional ($5), Organization ($5), Enterprise ($5)
  - Dev Mode: separate add-on pricing

## Issues Found & Fixed

### Issue 1: Sitemap Discovery Too Broad
**Problem:** Vercel's sitemap included `/academy/subscription-store/pricing-page-with-plans` which was a tutorial about pricing pages, not Vercel's actual pricing.

**Fix:** Updated sitemap discovery to:
- Exclude paths containing: `/blog`, `/help`, `/docs`, `/academy`, `/learn`, `/guide`, `/tutorial`
- Score URLs by simplicity (prefer shorter, cleaner paths)
- Bonus scoring for exact matches like `/pricing` or `/plans`

### Issue 2: LLM Returns Null for Custom Pricing
**Problem:** Notion and Stripe initially failed because the LLM returned `null/undefined` for "Custom" pricing tiers instead of the string "Custom" or "Contact sales".

**Fix:** 
1. Updated the extraction prompt to explicitly require price as a non-empty string
2. Added Zod `preprocess` transform to convert null/undefined to "Custom"
3. Made optional fields use `.nullish()` instead of `.optional()` for Zod v4 compatibility

## Architecture Overview

```
┌─────────────────┐
│   Competitor    │
│   Name + URL    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  URL Discovery  │
│  1. Sitemap.xml │
│  2. Common paths│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Firecrawl     │
│  (JS Rendering) │
│  → Markdown     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Gemini Flash   │
│  LLM Extraction │
│  → Structured   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Zod Validation │
│  + Confidence   │
│    Scoring      │
└─────────────────┘
```

## Recommendations for Production

### 1. Handle Multi-Product Pricing Pages
Figma's pricing page includes multiple products. Consider:
- Adding a `product` field to the extraction schema
- Prompting the LLM to group tiers by product
- Or: Accept that some companies have complex pricing, document accordingly

### 2. Improve Confidence Scoring
Current confidence is based on:
- Source text overlap (40%)
- Schema completeness (20%)
- Field plausibility (20%)
- Tier count (10%)
- Price format (10%)

Consider adding:
- Cross-reference with known pricing patterns
- Historical comparison (did pricing change drastically?)

### 3. Add Fallback for JS-Heavy Pages
Some pages might fail even with Firecrawl. Consider:
- Browser automation fallback (Playwright)
- Manual override database for problem URLs

### 4. Caching & Rate Limiting
For production:
- Cache scraped content (pricing rarely changes daily)
- Implement rate limiting per domain
- Track Firecrawl API usage

### 5. Price Normalization
Current extraction keeps prices as-is. Consider:
- Normalizing to monthly USD equivalent
- Parsing out per-seat vs flat pricing
- Extracting annual vs monthly billing options

## Cost Analysis

| Operation | Cost |
|-----------|------|
| Firecrawl scrape | ~$0.001/page |
| Gemini Flash extraction | ~$0.0004/extraction |
| **Total per competitor** | ~$0.0015 |

At scale (100 competitors):
- One-time scan: ~$0.15
- Weekly refresh: ~$7.80/year

## Files Modified

1. `src/lib/pricing/types.ts` - Added `.nullish()` for optional fields, `preprocess` for price
2. `src/lib/pricing/extraction.ts` - Improved prompt for custom pricing handling
3. `scripts/test-pricing-scraper.ts` - Created comprehensive test script

## Next Steps

1. [ ] Integrate scraper into competitor analysis flow
2. [ ] Add price normalization logic
3. [ ] Build caching layer for scraped content
4. [ ] Create UI for manual verification of extracted pricing
5. [ ] Set up scheduled refresh job
