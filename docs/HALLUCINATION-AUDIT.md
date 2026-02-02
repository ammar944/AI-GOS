# AI-GOS Hallucination Audit

**Date:** 2026-01-31  
**Auditor:** Doppler (AI Assistant)  
**Status:** Initial Audit Complete

## Executive Summary

AI-GOS uses Perplexity Sonar for "deep research" across multiple pipeline stages. While Perplexity has web search capabilities, it can still hallucinate or fabricate data, especially for:
- Specific numbers (pricing, market size, statistics)
- Competitor details (features, positioning)
- Quotes and testimonials
- URLs and links

**Pricing was the first hallucination discovered and fixed.** This audit identifies other potential hallucination risks.

---

## Risk Assessment by Component

### 🔴 HIGH RISK - Likely to Hallucinate

#### 1. Competitor Pricing (FIXED ✅)
- **Location:** `pipeline/competitor-research.ts`
- **Issue:** Perplexity fabricated pricing tiers, prices, and features
- **Status:** Fixed - Now uses Firecrawl scraping + strict LLM extraction
- **Verification:** Source quotes required for each price

#### 2. Competitor Ad Examples / Hooks
- **Location:** `pipeline/competitor-research.ts` → `creativeLibrary.adHooks`
- **Issue:** Perplexity generates "example hooks" that may not be real ads
- **Risk Level:** 🔴 HIGH
- **Symptoms:** 
  - Generic hooks like "Stop wasting money on..."
  - No source URLs for specific ad copy
  - Hooks don't match actual competitor voice
- **Fix Needed:** Integrate with real ad libraries (Meta Ad Library API, LinkedIn Ads) or mark as "AI-generated suggestions" not "competitor examples"

#### 3. Market Statistics & Numbers
- **Location:** `pipeline/industry-market-research.ts`
- **Fields at risk:**
  - `categorySnapshot.averageSalesCycle` - specific timeframes
  - Market size numbers if mentioned
  - Growth percentages
  - Conversion rate benchmarks
- **Risk Level:** 🔴 HIGH
- **Issue:** LLMs confidently generate plausible-sounding statistics
- **Fix Needed:** Either cite specific sources with URLs, or mark as "estimated ranges" not facts

#### 4. Competitor Strengths/Weaknesses
- **Location:** `pipeline/competitor-research.ts` → `competitors[].strengths/weaknesses`
- **Risk Level:** 🔴 HIGH
- **Issue:** Perplexity may generate generic strengths/weaknesses not based on real reviews
- **Fix Needed:** Scrape G2/Capterra reviews directly, or mark as "potential" not "verified"

---

### 🟡 MEDIUM RISK - Sometimes Hallucinated

#### 5. Pain Points
- **Location:** `pipeline/industry-market-research.ts` → `painPoints.primary/secondary`
- **Risk Level:** 🟡 MEDIUM
- **Issue:** Pain points may be generic industry assumptions, not validated from real customer feedback
- **Mitigation:** Usually directionally correct but specificity may be fabricated
- **Fix Needed:** Could scrape Reddit, forums, G2 reviews for actual quotes

#### 6. Buying Triggers & Demand Drivers
- **Location:** `pipeline/industry-market-research.ts` → `marketDynamics`
- **Risk Level:** 🟡 MEDIUM
- **Issue:** Triggers may be educated guesses, not data-driven
- **Mitigation:** Generally reasonable but not verified

#### 7. Competitor Website URLs
- **Location:** `pipeline/competitor-research.ts` → `competitors[].website`
- **Risk Level:** 🟡 MEDIUM
- **Issue:** URLs may be incorrect or outdated
- **Fix Needed:** Verify URLs are reachable before displaying

#### 8. ICP Validation Assessments
- **Location:** `pipeline/icp-research.ts`
- **Risk Level:** 🟡 MEDIUM
- **Issue:** Assessments like "hasBudget: true" may not be based on real data
- **Mitigation:** The boolean flags are opinion-based anyway

---

### 🟢 LOW RISK - Generally Accurate

#### 9. Competitor Names
- **Location:** `pipeline/competitor-research.ts` → `competitors[].name`
- **Risk Level:** 🟢 LOW
- **Issue:** Company names are usually correct
- **Note:** May miss newer competitors or include irrelevant ones

#### 10. General Market Categorization
- **Location:** `pipeline/industry-market-research.ts` → `categorySnapshot.category`
- **Risk Level:** 🟢 LOW
- **Issue:** Market category is usually directionally correct

#### 11. Ad Creative from Ad Library (VERIFIED ✅)
- **Location:** `lib/ad-library/` 
- **Status:** Uses real Meta Ad Library API
- **Verification:** Real ads with screenshots and URLs

---

## Components Using Verified Data Sources

| Component | Data Source | Verified? |
|-----------|-------------|-----------|
| Competitor Ads | Meta Ad Library API | ✅ Yes |
| Competitor Pricing | Firecrawl Scraping | ✅ Yes (after fix) |
| LinkedIn Ads | LinkedIn Ad Library | ✅ Yes |
| User Input (ICP, Offer) | User-provided | ✅ Yes |

---

## Recommendations

### Immediate Fixes (High Priority)

1. **Ad Hooks/Creative Examples**
   - Option A: Only show real ads from Ad Library, remove "example hooks"
   - Option B: Clearly label as "AI-suggested hooks (not real competitor ads)"
   - Option C: Scrape actual ad copy from Meta Ad Library

2. **Market Statistics**
   - Add disclaimer: "Market estimates based on AI analysis. Verify with industry reports."
   - Or: Remove specific numbers, use ranges like "typically 2-6 months"

3. **Competitor Strengths/Weaknesses**
   - Option A: Scrape G2/Capterra for real review quotes
   - Option B: Label as "potential strengths/weaknesses based on market positioning"

### Medium-Term Improvements

4. **Pain Points Verification**
   - Scrape Reddit (r/SaaS, r/startups, industry subreddits)
   - Scrape G2/Capterra review complaints
   - Include source quotes

5. **URL Verification**
   - Add HTTP HEAD check for all competitor URLs
   - Flag unreachable URLs

### Long-Term Architecture

6. **Citation Requirements**
   - Require URL source for any specific claim
   - Display citations in UI (already partially implemented)
   - Allow users to verify/dispute claims

7. **Confidence Scoring**
   - Add confidence scores to all AI-generated content
   - Low confidence = needs verification badge

---

## Current Hallucination Safeguards

| Safeguard | Status | Location |
|-----------|--------|----------|
| Pricing source quotes | ✅ Implemented | `lib/pricing/extraction.ts` |
| Pricing confidence scoring | ✅ Implemented | `lib/pricing/extraction.ts` |
| Ad relevance scoring | ✅ Implemented | `lib/ad-library/relevance-scorer.ts` |
| Citation extraction | ✅ Implemented | All research functions |
| Strict LLM prompts | ✅ Implemented | All pipeline files |

---

## Testing Checklist

To verify hallucination after fixes:

- [ ] Generate blueprint for known company (e.g., Notion)
- [ ] Verify competitor pricing matches their actual pricing page
- [ ] Verify ad hooks exist in real Ad Library results
- [ ] Check market statistics against industry reports
- [ ] Verify competitor URLs are reachable
- [ ] Check pain points against real forum posts

---

## Appendix: Files Reviewed

```
src/lib/strategic-blueprint/pipeline/
├── competitor-research.ts     # Competitor data + pricing
├── icp-research.ts            # ICP validation
├── industry-market-research.ts # Market data + pain points
├── offer-research.ts          # Offer analysis
└── strategic-blueprint-generator.ts # Orchestrator

src/lib/ad-library/            # Real ad data (verified)
src/lib/pricing/               # Pricing scraping (fixed)
src/lib/firecrawl/             # Web scraping
src/lib/research/              # Perplexity integration
```
