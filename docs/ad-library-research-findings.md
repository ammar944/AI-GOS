# Ad Library Research Findings

**Date:** 2026-01-23
**Status:** Implemented & Tested

---

## Executive Summary

This document captures research findings on improving the Ad Library service that fetches competitor ads from LinkedIn, Meta, and Google via SearchAPI.io. The primary issue was that Google Ads were returning inaccurate results (domain-sponsored listings instead of actual ad creatives).

---

## Architecture Overview

```
Competitor Research Pipeline
    ↓
AdLibraryService.fetchAllPlatforms({query, domain, limit})
    ├── fetchLinkedInAds()  → advertiser parameter
    ├── fetchMetaAds()      → page_id lookup → fetch by page_id
    └── fetchGoogleAds()    → advertiser_id lookup → fetch with filters
            ↓
    Post-fetch validation (fuzzy name matching, 0.8 threshold)
            ↓
    Normalized AdCreative[] attached to CompetitorSnapshot
```

---

## Platform-Specific Findings

### LinkedIn Ad Library

**API Endpoint:** `engine=linkedin_ad_library`

**Current Implementation:** Working correctly
- Uses `advertiser` parameter (not `q`) to filter by company name
- Returns ads with images, headlines, body text
- Post-fetch filtering removes similar-named companies

**Test Results:**
```
Tesla: 24 ads found, all with images
Filtered: 10 → 4 ads (removed "Tesla Technologies & Software", "Tesla Hague", etc.)
```

---

### Meta Ad Library (Facebook/Instagram)

**API Endpoints:**
- Page search: `engine=meta_ad_library_page_search`
- Ad fetch: `engine=meta_ad_library`

**Issue Found:** API returns `page_results` not `pages`

**Fix Implemented:**
1. Changed to check for `page_results` key in response
2. Added scoring system for page selection:
   - Verified pages: +50 points
   - Similarity score: 0-100 points
   - Follower count: logarithmic tiebreaker

**Test Results:**
```
Tesla page search: Found 15 candidates
Selected: "Tesla" (id: 254515547747520) - BLUE_VERIFIED, 9.5M IG followers, score: 150.7
Ad fetch: 0 ads (Tesla doesn't run Meta ads - expected behavior)

Nike page search: Found page successfully
Ad fetch: 30 ads with images/videos
```

**Key Insight:** Tesla genuinely doesn't run Facebook/Instagram ads (confirmed by API returning 0 results even with correct page_id).

---

### Google Ads Transparency Center

**API Endpoints:**
- Advertiser search: `engine=google_ads_transparency_center_advertiser_search`
- Ad fetch: `engine=google_ads_transparency_center`

**Original Issue:** Using `domain` parameter only returned:
- Mixed advertisers (e.g., Taiwanese Tesla subsidiary)
- Text-only ads (domain sponsorship mentions)
- Potentially inaccurate results

**Fix Implemented:** Two-step approach (similar to Meta):

```
Step 1: Advertiser Search
  q: "Tesla"
  → Returns: advertiser_id="AR17828074650563772417", name="Tesla Inc."

Step 2: Ad Fetch with Filters
  advertiser_id: "AR17828074650563772417"
  ad_format: "image" (optional - excludes text-only)
  platform: "youtube" (optional - filter by placement)
```

**Available Parameters:**

| Parameter | Values | Purpose |
|-----------|--------|---------|
| `advertiser_id` | AR... | Target specific advertiser (from lookup) |
| `domain` | example.com | Fallback if advertiser not found |
| `ad_format` | text, image, video | Filter by creative type |
| `platform` | google_search, youtube, google_shopping, google_maps, google_play | Filter by placement |
| `time_period` | today, last_7_days, last_30_days, YYYY-MM-DD..YYYY-MM-DD | Date range |
| `region` | US, anywhere, etc. | Geographic filter |

**Test Results - Comparison:**

| Method | Advertisers | Formats | Total Available |
|--------|-------------|---------|-----------------|
| `domain=tesla.com` | Taiwan Tesla + Tesla Inc. | 33 video, 5 text, 2 image | 3000 |
| `advertiser_id` (all) | Tesla Inc. only | 32 video, 5 text, 3 image | 3000 |
| `advertiser_id` + `ad_format=image` | Tesla Inc. only | 40 image | 500 |
| `advertiser_id` + `ad_format=video` | Tesla Inc. only | 40 video | 900 |
| `advertiser_id` + `platform=youtube` | Tesla Inc. only | 34 video, 3 image, 3 text | 2000 |

**Key Findings:**
1. `advertiser_id` returns ONLY ads from the exact target company
2. `ad_format=image` or `video` effectively filters out text-only ads
3. 500 image ads and 900 video ads available for Tesla

---

## Code Changes

### Files Modified

**`src/lib/ad-library/types.ts`**
```typescript
// Added types for Google filtering
export type GoogleAdFormat = 'text' | 'image' | 'video';
export type GoogleAdPlatform = 'google_play' | 'google_maps' | 'google_search' | 'youtube' | 'google_shopping';

// Updated AdLibraryOptions
interface AdLibraryOptions {
  query: string;
  domain?: string;
  limit?: number;
  country?: string;
  googleAdFormat?: GoogleAdFormat;    // NEW
  googlePlatform?: GoogleAdPlatform;  // NEW
}
```

**`src/lib/ad-library/service.ts`**

1. Added `lookupGoogleAdvertiserId()` method:
   - Searches by company name
   - Returns best matching advertiser with fuzzy matching
   - Falls back to domain if not found

2. Updated `fetchGoogleAds()`:
   - Uses two-step approach (advertiser lookup → fetch)
   - Defaults `googleAdFormat` to `'image'` to exclude text-only domain sponsor ads
   - Supports `googlePlatform` filter
   - **Post-fetch filter**: Removes any ads without `imageUrl` or `videoUrl`

3. Fixed `lookupMetaPageId()`:
   - Changed from `data.pages` to `data.page_results`
   - Added scoring system preferring verified pages

4. Updated `fetchLinkedInAds()`:
   - Enhanced image extraction to check `advertiser.thumbnail` as fallback
   - Added video extraction for LinkedIn video ads
   - **Post-fetch filter**: Removes ads without embedded image preview

5. Updated `fetchMetaAds()`:
   - **Post-fetch filter**: Removes dynamic catalog ads without images (e.g., `{{product.name}}`)

---

## API Response Structures

### Google Advertiser Search Response
```json
{
  "advertisers": [
    {
      "id": "AR17828074650563772417",
      "name": "Tesla Inc.",
      "region": "US",
      "ads_count": { "lower": 2000, "upper": 3000 },
      "is_verified": true
    }
  ],
  "domains": [
    { "name": "tesla.com" }
  ]
}
```

### Google Ad Creative Response
```json
{
  "ad_creatives": [
    {
      "id": "CR14479110649247956993",
      "advertiser": { "id": "AR...", "name": "Tesla Inc." },
      "format": "video",
      "first_shown_datetime": "2025-06-12T02:51:20Z",
      "last_shown_datetime": "2026-01-23T15:37:06Z",
      "total_days_shown": 226,
      "image": { "link": "https://..." },
      "details_link": "https://adstransparency.google.com/..."
    }
  ]
}
```

### Meta Page Search Response
```json
{
  "page_results": [
    {
      "page_id": "254515547747520",
      "name": "Tesla",
      "verification": "BLUE_VERIFIED",
      "likes": 18790,
      "ig_followers": 9564113,
      "ig_username": "teslamotors"
    }
  ]
}
```

---

## Usage Examples

### Basic Usage
```typescript
const service = createAdLibraryService();

const response = await service.fetchAllPlatforms({
  query: "Tesla",
  domain: "tesla.com",
  limit: 10,
});
```

### With Google Filters
```typescript
const response = await service.fetchAllPlatforms({
  query: "Nike",
  domain: "nike.com",
  limit: 20,
  googleAdFormat: "image",      // Exclude text-only ads
  googlePlatform: "youtube",    // Focus on YouTube ads
});
```

---

## Test Files Created

| File | Purpose |
|------|---------|
| `test-ad-libraries-research.ts` | Comprehensive test of all platforms with comparisons |
| `test-google-fix.ts` | Validates Google advertiser_id approach |
| `test-service-integration.ts` | End-to-end service test |
| `test-meta-debug.ts` | Debug Meta page lookup issues |
| `test-meta-ads.ts` | Test Meta ad fetch with specific page_id |

Run with: `npx tsx <filename>`

---

## Recommendations

### Immediate
- [x] Implement Google advertiser_id lookup (DONE)
- [x] Fix Meta page_results key issue (DONE)
- [x] Add googleAdFormat filter option (DONE)

### Future Enhancements
- [ ] Cache advertiser_id lookups to reduce API calls
- [ ] Add retry logic for transient API failures
- [ ] Consider adding `time_period` filter for recent ads only
- [ ] Implement pagination for fetching more than 40 ads

---

## Environment

**Required:** `SEARCHAPI_KEY` environment variable

**API Base:** `https://www.searchapi.io/api/v1/search`

**Rate Limits:** 100ms minimum between requests to same platform (request-scoped)

---

## References

- [SearchAPI.io Google Ads Transparency Center API](https://www.searchapi.io/docs/google-ads-transparency-center-api)
- [SearchAPI.io Advertiser Search API](https://www.searchapi.io/docs/google-ads-transparency-center-advertiser-search-api)
- [SearchAPI.io Meta Ad Library API](https://www.searchapi.io/docs/meta-ad-library-api)
