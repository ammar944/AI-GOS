/**
 * Ad Library Research & Testing Script
 *
 * Tests all three platforms (LinkedIn, Meta, Google) and validates
 * the proposed improvements for Google Ads Transparency Center.
 *
 * Run with: npx tsx test-ad-libraries-research.ts
 */

const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY || "9B2DEKA9p64c2rHUUeS9MdqZ";
const SEARCHAPI_BASE = "https://www.searchapi.io/api/v1/search";

// Test companies - using well-known brands that should have ads on all platforms
const TEST_CASES = [
  { name: "Tesla", domain: "tesla.com" },
  { name: "Nike", domain: "nike.com" },
  { name: "Coca-Cola", domain: "coca-cola.com" },
];

interface TestResult {
  platform: string;
  method: string;
  success: boolean;
  totalAds: number;
  adsWithImages: number;
  adsWithVideos: number;
  textOnlyAds: number;
  sampleAdvertisers: string[];
  error?: string;
  rawSample?: unknown;
}

// ============================================================================
// LINKEDIN TESTS
// ============================================================================

async function testLinkedIn(companyName: string): Promise<TestResult> {
  console.log(`\n🔷 LINKEDIN: Testing "${companyName}"...`);

  try {
    // Current approach: using 'advertiser' parameter
    const params = new URLSearchParams({
      engine: "linkedin_ad_library",
      advertiser: companyName,
      api_key: SEARCHAPI_KEY,
    });

    const response = await fetch(`${SEARCHAPI_BASE}?${params}`);
    const data = await response.json();

    if (data.error) {
      return {
        platform: "linkedin",
        method: "advertiser param",
        success: false,
        totalAds: 0,
        adsWithImages: 0,
        adsWithVideos: 0,
        textOnlyAds: 0,
        sampleAdvertisers: [],
        error: data.error,
      };
    }

    const ads = data.ads || [];
    const advertisers = [...new Set(ads.map((ad: any) => ad.advertiser?.name || "Unknown"))];

    let adsWithImages = 0;
    let adsWithVideos = 0;
    let textOnlyAds = 0;

    for (const ad of ads) {
      const hasImage = !!ad.content?.image;
      const hasVideo = ad.content?.type?.toLowerCase() === "video";

      if (hasVideo) adsWithVideos++;
      else if (hasImage) adsWithImages++;
      else textOnlyAds++;
    }

    console.log(`   ✅ Found ${ads.length} ads`);
    console.log(`   📊 Images: ${adsWithImages} | Videos: ${adsWithVideos} | Text-only: ${textOnlyAds}`);
    console.log(`   👤 Advertisers: ${advertisers.slice(0, 3).join(", ")}`);

    return {
      platform: "linkedin",
      method: "advertiser param",
      success: true,
      totalAds: ads.length,
      adsWithImages,
      adsWithVideos,
      textOnlyAds,
      sampleAdvertisers: advertisers.slice(0, 5),
      rawSample: ads[0],
    };
  } catch (error: any) {
    return {
      platform: "linkedin",
      method: "advertiser param",
      success: false,
      totalAds: 0,
      adsWithImages: 0,
      adsWithVideos: 0,
      textOnlyAds: 0,
      sampleAdvertisers: [],
      error: error.message,
    };
  }
}

// ============================================================================
// META TESTS
// ============================================================================

async function testMetaPageSearch(companyName: string): Promise<{ pageId?: string; pageName?: string; error?: string }> {
  console.log(`\n🔵 META: Step 1 - Page search for "${companyName}"...`);

  try {
    const params = new URLSearchParams({
      engine: "meta_ad_library_page_search",
      q: companyName,
      api_key: SEARCHAPI_KEY,
    });

    const response = await fetch(`${SEARCHAPI_BASE}?${params}`);
    const data = await response.json();

    if (data.error) {
      console.log(`   ❌ Error: ${data.error}`);
      return { error: data.error };
    }

    const pages = data.pages || [];
    console.log(`   Found ${pages.length} pages`);

    if (pages.length > 0) {
      // Show top 3 candidates
      pages.slice(0, 3).forEach((page: any, i: number) => {
        console.log(`   [${i + 1}] "${page.name || page.page_name}" (id: ${page.id || page.page_id}) - ${page.likes || 0} likes`);
      });

      const bestPage = pages[0];
      return {
        pageId: bestPage.id || bestPage.page_id,
        pageName: bestPage.name || bestPage.page_name,
      };
    }

    return { error: "No pages found" };
  } catch (error: any) {
    return { error: error.message };
  }
}

async function testMetaAds(companyName: string, pageId?: string): Promise<TestResult> {
  console.log(`\n🔵 META: Step 2 - Fetching ads${pageId ? ` for page_id ${pageId}` : " (direct query)"}...`);

  try {
    const params = new URLSearchParams({
      engine: "meta_ad_library",
      country: "US",
      api_key: SEARCHAPI_KEY,
    });

    if (pageId) {
      params.set("page_id", pageId);
    } else {
      params.set("q", companyName);
    }

    const response = await fetch(`${SEARCHAPI_BASE}?${params}`);
    const data = await response.json();

    if (data.error) {
      return {
        platform: "meta",
        method: pageId ? "page_id" : "q param",
        success: false,
        totalAds: 0,
        adsWithImages: 0,
        adsWithVideos: 0,
        textOnlyAds: 0,
        sampleAdvertisers: [],
        error: data.error,
      };
    }

    const ads = data.ads || [];
    const advertisers = [...new Set(ads.map((ad: any) => ad.page_name || ad.snapshot?.page_name || "Unknown"))];

    let adsWithImages = 0;
    let adsWithVideos = 0;
    let textOnlyAds = 0;

    for (const ad of ads) {
      const hasImages = ad.snapshot?.images?.length > 0;
      const hasVideos = ad.snapshot?.videos?.length > 0;

      if (hasVideos) adsWithVideos++;
      else if (hasImages) adsWithImages++;
      else textOnlyAds++;
    }

    console.log(`   ✅ Found ${ads.length} ads`);
    console.log(`   📊 Images: ${adsWithImages} | Videos: ${adsWithVideos} | Text-only: ${textOnlyAds}`);
    console.log(`   👤 Advertisers: ${advertisers.slice(0, 3).join(", ")}`);

    return {
      platform: "meta",
      method: pageId ? "page_id" : "q param",
      success: true,
      totalAds: ads.length,
      adsWithImages,
      adsWithVideos,
      textOnlyAds,
      sampleAdvertisers: advertisers.slice(0, 5),
      rawSample: ads[0],
    };
  } catch (error: any) {
    return {
      platform: "meta",
      method: pageId ? "page_id" : "q param",
      success: false,
      totalAds: 0,
      adsWithImages: 0,
      adsWithVideos: 0,
      textOnlyAds: 0,
      sampleAdvertisers: [],
      error: error.message,
    };
  }
}

// ============================================================================
// GOOGLE ADS TRANSPARENCY TESTS
// ============================================================================

async function testGoogleAdvertiserSearch(companyName: string): Promise<{
  advertiserId?: string;
  advertiserName?: string;
  adsCount?: { lower: number; upper: number };
  isVerified?: boolean;
  error?: string
}> {
  console.log(`\n🔴 GOOGLE: Step 1 - Advertiser search for "${companyName}"...`);

  try {
    const params = new URLSearchParams({
      engine: "google_ads_transparency_center_advertiser_search",
      q: companyName,
      api_key: SEARCHAPI_KEY,
    });

    const response = await fetch(`${SEARCHAPI_BASE}?${params}`);
    const data = await response.json();

    if (data.error) {
      console.log(`   ❌ Error: ${data.error}`);
      return { error: data.error };
    }

    const advertisers = data.advertisers || [];
    const domains = data.domains || [];

    console.log(`   Found ${advertisers.length} advertisers, ${domains.length} domains`);

    if (advertisers.length > 0) {
      // Show top 3 candidates
      advertisers.slice(0, 3).forEach((adv: any, i: number) => {
        console.log(`   [${i + 1}] "${adv.name}" (id: ${adv.id}) - ${adv.ads_count?.lower || 0}-${adv.ads_count?.upper || 0} ads, verified: ${adv.is_verified}`);
      });

      const bestMatch = advertisers[0];
      return {
        advertiserId: bestMatch.id,
        advertiserName: bestMatch.name,
        adsCount: bestMatch.ads_count,
        isVerified: bestMatch.is_verified,
      };
    }

    if (domains.length > 0) {
      console.log(`   Domains found: ${domains.slice(0, 3).map((d: any) => d.name).join(", ")}`);
    }

    return { error: "No advertisers found" };
  } catch (error: any) {
    return { error: error.message };
  }
}

interface GoogleAdsTestOptions {
  domain?: string;
  advertiserId?: string;
  adFormat?: "text" | "image" | "video";
  platform?: string;
}

async function testGoogleAds(companyName: string, options: GoogleAdsTestOptions): Promise<TestResult> {
  const methodDesc = options.advertiserId
    ? `advertiser_id + ${options.adFormat || "all formats"}`
    : `domain only`;

  console.log(`\n🔴 GOOGLE: Testing with ${methodDesc}...`);

  try {
    const params = new URLSearchParams({
      engine: "google_ads_transparency_center",
      api_key: SEARCHAPI_KEY,
    });

    if (options.advertiserId) {
      params.set("advertiser_id", options.advertiserId);
    } else if (options.domain) {
      params.set("domain", options.domain);
    } else {
      return {
        platform: "google",
        method: methodDesc,
        success: false,
        totalAds: 0,
        adsWithImages: 0,
        adsWithVideos: 0,
        textOnlyAds: 0,
        sampleAdvertisers: [],
        error: "No domain or advertiser_id provided",
      };
    }

    if (options.adFormat) {
      params.set("ad_format", options.adFormat);
    }

    if (options.platform) {
      params.set("platform", options.platform);
    }

    console.log(`   Request: ${SEARCHAPI_BASE}?${params.toString().replace(SEARCHAPI_KEY, "***")}`);

    const response = await fetch(`${SEARCHAPI_BASE}?${params}`);
    const data = await response.json();

    if (data.error) {
      return {
        platform: "google",
        method: methodDesc,
        success: false,
        totalAds: 0,
        adsWithImages: 0,
        adsWithVideos: 0,
        textOnlyAds: 0,
        sampleAdvertisers: [],
        error: data.error,
      };
    }

    // Google uses "ad_creatives" not "ads"
    const ads = data.ad_creatives || [];
    const advertisers = [...new Set(ads.map((ad: any) => ad.advertiser?.name || "Unknown"))];

    let adsWithImages = 0;
    let adsWithVideos = 0;
    let textOnlyAds = 0;

    for (const ad of ads) {
      const format = (ad.format || "").toLowerCase();
      const hasImage = !!ad.image?.link;

      if (format === "video") adsWithVideos++;
      else if (format === "image" || hasImage) adsWithImages++;
      else textOnlyAds++;
    }

    console.log(`   ✅ Found ${ads.length} ads (total available: ${data.search_information?.total_results || "unknown"})`);
    console.log(`   📊 Images: ${adsWithImages} | Videos: ${adsWithVideos} | Text-only: ${textOnlyAds}`);
    console.log(`   👤 Advertisers: ${advertisers.slice(0, 3).join(", ")}`);

    // Show format breakdown
    const formats = ads.reduce((acc: Record<string, number>, ad: any) => {
      const f = ad.format || "unknown";
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {});
    console.log(`   📋 Format breakdown: ${JSON.stringify(formats)}`);

    return {
      platform: "google",
      method: methodDesc,
      success: true,
      totalAds: ads.length,
      adsWithImages,
      adsWithVideos,
      textOnlyAds,
      sampleAdvertisers: advertisers.slice(0, 5),
      rawSample: ads[0],
    };
  } catch (error: any) {
    return {
      platform: "google",
      method: methodDesc,
      success: false,
      totalAds: 0,
      adsWithImages: 0,
      adsWithVideos: 0,
      textOnlyAds: 0,
      sampleAdvertisers: [],
      error: error.message,
    };
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runFullTest(testCase: { name: string; domain: string }) {
  console.log("\n" + "=".repeat(70));
  console.log(`🧪 TESTING: ${testCase.name} (${testCase.domain})`);
  console.log("=".repeat(70));

  const results: TestResult[] = [];

  // 1. LinkedIn test
  results.push(await testLinkedIn(testCase.name));

  // 2. Meta tests
  const metaPage = await testMetaPageSearch(testCase.name);
  if (metaPage.pageId) {
    results.push(await testMetaAds(testCase.name, metaPage.pageId));
  } else {
    results.push(await testMetaAds(testCase.name)); // Fallback to direct query
  }

  // 3. Google tests - compare approaches

  // 3a. Current approach: domain only
  results.push(await testGoogleAds(testCase.name, { domain: testCase.domain }));

  // 3b. New approach: advertiser lookup
  const googleAdv = await testGoogleAdvertiserSearch(testCase.name);

  if (googleAdv.advertiserId) {
    // 3c. With advertiser_id (all formats)
    results.push(await testGoogleAds(testCase.name, {
      advertiserId: googleAdv.advertiserId
    }));

    // 3d. With advertiser_id + image format only
    results.push(await testGoogleAds(testCase.name, {
      advertiserId: googleAdv.advertiserId,
      adFormat: "image"
    }));

    // 3e. With advertiser_id + video format only
    results.push(await testGoogleAds(testCase.name, {
      advertiserId: googleAdv.advertiserId,
      adFormat: "video"
    }));

    // 3f. With advertiser_id + YouTube platform
    results.push(await testGoogleAds(testCase.name, {
      advertiserId: googleAdv.advertiserId,
      platform: "youtube"
    }));
  }

  return results;
}

async function main() {
  console.log("=".repeat(70));
  console.log("🔬 AD LIBRARY RESEARCH TEST");
  console.log("=".repeat(70));
  console.log(`API Key: ${SEARCHAPI_KEY.slice(0, 8)}...`);
  console.log(`Testing ${TEST_CASES.length} companies across 3 platforms`);
  console.log("This will test current implementation vs proposed improvements");

  const allResults: { company: string; results: TestResult[] }[] = [];

  // Test first company only to conserve API calls
  const testCase = TEST_CASES[0];
  const results = await runFullTest(testCase);
  allResults.push({ company: testCase.name, results });

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 SUMMARY");
  console.log("=".repeat(70));

  for (const { company, results } of allResults) {
    console.log(`\n${company}:`);
    console.log("-".repeat(50));

    for (const r of results) {
      const status = r.success ? "✅" : "❌";
      const creatives = r.adsWithImages + r.adsWithVideos;
      console.log(
        `${status} ${r.platform.toUpperCase().padEnd(8)} | ${r.method.padEnd(35)} | ` +
        `${r.totalAds} ads (${creatives} with creatives, ${r.textOnlyAds} text-only)`
      );
      if (r.error) {
        console.log(`   Error: ${r.error}`);
      }
    }
  }

  // Key findings
  console.log("\n" + "=".repeat(70));
  console.log("🔍 KEY FINDINGS");
  console.log("=".repeat(70));

  const googleResults = allResults[0]?.results.filter(r => r.platform === "google") || [];
  const domainResult = googleResults.find(r => r.method === "domain only");
  const advIdResult = googleResults.find(r => r.method.includes("advertiser_id") && !r.method.includes("image") && !r.method.includes("video") && !r.method.includes("youtube"));
  const imageResult = googleResults.find(r => r.method.includes("image"));
  const videoResult = googleResults.find(r => r.method.includes("video"));

  if (domainResult && advIdResult) {
    console.log(`\nGoogle domain vs advertiser_id comparison:`);
    console.log(`  Domain only:     ${domainResult.totalAds} ads (${domainResult.textOnlyAds} text-only)`);
    console.log(`  Advertiser ID:   ${advIdResult.totalAds} ads (${advIdResult.textOnlyAds} text-only)`);

    if (imageResult) {
      console.log(`  + image filter:  ${imageResult.totalAds} ads`);
    }
    if (videoResult) {
      console.log(`  + video filter:  ${videoResult.totalAds} ads`);
    }
  }

  // Show raw sample for debugging
  console.log("\n" + "=".repeat(70));
  console.log("📄 SAMPLE RAW DATA (first Google ad from advertiser_id method)");
  console.log("=".repeat(70));
  if (advIdResult?.rawSample) {
    console.log(JSON.stringify(advIdResult.rawSample, null, 2));
  } else if (domainResult?.rawSample) {
    console.log("(From domain method):");
    console.log(JSON.stringify(domainResult.rawSample, null, 2));
  } else {
    console.log("No sample available");
  }
}

main().catch(console.error);
