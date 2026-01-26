/**
 * Debug Meta Ad Library page lookup issue
 * Run with: npx tsx test-meta-debug.ts
 */

const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY || "9B2DEKA9p64c2rHUUeS9MdqZ";
const SEARCHAPI_BASE = "https://www.searchapi.io/api/v1/search";

interface TestCase {
  name: string;
  query: string;
  description: string;
}

const TEST_CASES: TestCase[] = [
  { name: "Tesla", query: "Tesla", description: "Original query" },
  { name: "Tesla Inc", query: "Tesla Inc", description: "With Inc suffix" },
  { name: "Tesla Motors", query: "Tesla Motors", description: "Old company name" },
  { name: "Nike", query: "Nike", description: "Different brand test" },
  { name: "Coca-Cola", query: "Coca-Cola", description: "Different brand test" },
  { name: "Apple", query: "Apple", description: "Different brand test" },
  { name: "Microsoft", query: "Microsoft", description: "Different brand test" },
];

async function testMetaPageSearch(query: string): Promise<{
  success: boolean;
  pages: Array<{ name: string; id: string; likes?: number }>;
  error?: string;
  rawResponse?: unknown;
}> {
  try {
    const params = new URLSearchParams({
      engine: "meta_ad_library_page_search",
      q: query,
      api_key: SEARCHAPI_KEY,
    });

    const response = await fetch(`${SEARCHAPI_BASE}?${params}`);
    const data = await response.json();

    if (data.error) {
      return { success: false, pages: [], error: data.error, rawResponse: data };
    }

    const pages = (data.pages || []).map((p: any) => ({
      name: p.name || p.page_name || "Unknown",
      id: p.id || p.page_id || "Unknown",
      likes: p.likes,
    }));

    return { success: true, pages, rawResponse: data };
  } catch (error: any) {
    return { success: false, pages: [], error: error.message };
  }
}

async function testMetaDirectQuery(query: string): Promise<{
  success: boolean;
  adsCount: number;
  advertisers: string[];
  error?: string;
}> {
  try {
    const params = new URLSearchParams({
      engine: "meta_ad_library",
      q: query,
      country: "US",
      api_key: SEARCHAPI_KEY,
    });

    const response = await fetch(`${SEARCHAPI_BASE}?${params}`);
    const data = await response.json();

    if (data.error) {
      return { success: false, adsCount: 0, advertisers: [], error: data.error };
    }

    const ads = data.ads || [];
    const advertisers = [...new Set(ads.map((ad: any) =>
      ad.page_name || ad.snapshot?.page_name || "Unknown"
    ))];

    return { success: true, adsCount: ads.length, advertisers: advertisers.slice(0, 10) };
  } catch (error: any) {
    return { success: false, adsCount: 0, advertisers: [], error: error.message };
  }
}

async function testMetaWithPageId(pageId: string, pageName: string): Promise<{
  success: boolean;
  adsCount: number;
  hasImages: number;
  hasVideos: number;
  error?: string;
}> {
  try {
    const params = new URLSearchParams({
      engine: "meta_ad_library",
      page_id: pageId,
      country: "US",
      api_key: SEARCHAPI_KEY,
    });

    const response = await fetch(`${SEARCHAPI_BASE}?${params}`);
    const data = await response.json();

    if (data.error) {
      return { success: false, adsCount: 0, hasImages: 0, hasVideos: 0, error: data.error };
    }

    const ads = data.ads || [];
    const hasImages = ads.filter((ad: any) => ad.snapshot?.images?.length > 0).length;
    const hasVideos = ads.filter((ad: any) => ad.snapshot?.videos?.length > 0).length;

    return { success: true, adsCount: ads.length, hasImages, hasVideos };
  } catch (error: any) {
    return { success: false, adsCount: 0, hasImages: 0, hasVideos: 0, error: error.message };
  }
}

async function main() {
  console.log("=".repeat(70));
  console.log("META AD LIBRARY DEBUG");
  console.log("=".repeat(70));

  // Test 1: Page Search with different queries
  console.log("\n1. TESTING PAGE SEARCH");
  console.log("-".repeat(70));

  for (const testCase of TEST_CASES) {
    console.log(`\n[${testCase.name}] Query: "${testCase.query}" (${testCase.description})`);

    const result = await testMetaPageSearch(testCase.query);

    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    } else if (result.pages.length === 0) {
      console.log(`   ⚠️ No pages found`);
      // Show raw response for debugging
      console.log(`   Raw response keys: ${Object.keys(result.rawResponse || {}).join(", ")}`);
    } else {
      console.log(`   ✅ Found ${result.pages.length} pages:`);
      result.pages.slice(0, 5).forEach((p, i) => {
        console.log(`      [${i + 1}] "${p.name}" (id: ${p.id}) - ${p.likes?.toLocaleString() || "?"} likes`);
      });
    }
  }

  // Test 2: Direct query without page_id
  console.log("\n\n2. TESTING DIRECT QUERY (without page_id)");
  console.log("-".repeat(70));

  for (const testCase of TEST_CASES.slice(0, 4)) {
    console.log(`\n[${testCase.name}] Query: "${testCase.query}"`);

    const result = await testMetaDirectQuery(testCase.query);

    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    } else {
      console.log(`   Found ${result.adsCount} ads`);
      console.log(`   Advertisers: ${result.advertisers.join(", ") || "None"}`);
    }
  }

  // Test 3: If we found any pages, test fetching with page_id
  console.log("\n\n3. TESTING WITH PAGE_ID (if pages found)");
  console.log("-".repeat(70));

  // Find a test case that returned pages
  for (const testCase of TEST_CASES) {
    const pageResult = await testMetaPageSearch(testCase.query);

    if (pageResult.pages.length > 0) {
      const firstPage = pageResult.pages[0];
      console.log(`\n[${testCase.name}] Using page_id: ${firstPage.id} for "${firstPage.name}"`);

      const adsResult = await testMetaWithPageId(firstPage.id, firstPage.name);

      if (adsResult.error) {
        console.log(`   ❌ Error: ${adsResult.error}`);
      } else {
        console.log(`   ✅ Found ${adsResult.adsCount} ads`);
        console.log(`   With images: ${adsResult.hasImages}, With videos: ${adsResult.hasVideos}`);
      }

      // Only test one successful case
      break;
    }
  }

  // Test 4: Check alternative engines/parameters
  console.log("\n\n4. CHECKING API RESPONSE STRUCTURE");
  console.log("-".repeat(70));

  // Get raw response for Tesla to understand what's returned
  const teslaParams = new URLSearchParams({
    engine: "meta_ad_library_page_search",
    q: "Tesla",
    api_key: SEARCHAPI_KEY,
  });

  const teslaResponse = await fetch(`${SEARCHAPI_BASE}?${teslaParams}`);
  const teslaData = await teslaResponse.json();

  console.log("\nRaw API response for 'Tesla' page search:");
  console.log(JSON.stringify(teslaData, null, 2));

  console.log("\n" + "=".repeat(70));
  console.log("DEBUG COMPLETE");
  console.log("=".repeat(70));
}

main().catch(console.error);
