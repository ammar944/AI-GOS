/**
 * Test Meta ad fetch with the discovered page_id
 */

const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY || "9B2DEKA9p64c2rHUUeS9MdqZ";
const SEARCHAPI_BASE = "https://www.searchapi.io/api/v1/search";

async function testMetaAds() {
  // Tesla's verified page_id from our page search
  const pageId = "254515547747520";

  console.log("Testing Meta Ad Library with Tesla's page_id:", pageId);
  console.log("=".repeat(60));

  // Test 1: With page_id
  console.log("\n1. Fetching with page_id...");
  const params1 = new URLSearchParams({
    engine: "meta_ad_library",
    page_id: pageId,
    country: "US",
    api_key: SEARCHAPI_KEY,
  });

  const resp1 = await fetch(`${SEARCHAPI_BASE}?${params1}`);
  const data1 = await resp1.json();

  console.log("Response keys:", Object.keys(data1));
  console.log("Error:", data1.error || "None");
  console.log("Ads count:", data1.ads?.length || 0);

  if (data1.ads?.length > 0) {
    console.log("First ad:", JSON.stringify(data1.ads[0], null, 2));
  }

  // Test 2: Try without country filter
  console.log("\n2. Fetching with page_id (no country filter)...");
  const params2 = new URLSearchParams({
    engine: "meta_ad_library",
    page_id: pageId,
    api_key: SEARCHAPI_KEY,
  });

  const resp2 = await fetch(`${SEARCHAPI_BASE}?${params2}`);
  const data2 = await resp2.json();

  console.log("Response keys:", Object.keys(data2));
  console.log("Error:", data2.error || "None");
  console.log("Ads count:", data2.ads?.length || 0);

  // Test 3: Try with country=ALL
  console.log("\n3. Fetching with page_id (country=ALL)...");
  const params3 = new URLSearchParams({
    engine: "meta_ad_library",
    page_id: pageId,
    country: "ALL",
    api_key: SEARCHAPI_KEY,
  });

  const resp3 = await fetch(`${SEARCHAPI_BASE}?${params3}`);
  const data3 = await resp3.json();

  console.log("Response keys:", Object.keys(data3));
  console.log("Error:", data3.error || "None");
  console.log("Ads count:", data3.ads?.length || 0);

  // Test 4: Try with a different company that we know has ads (Nike)
  console.log("\n4. Testing with Nike (for comparison)...");

  // First find Nike's page
  const nikeSearch = new URLSearchParams({
    engine: "meta_ad_library_page_search",
    q: "Nike",
    api_key: SEARCHAPI_KEY,
  });

  const nikeSearchResp = await fetch(`${SEARCHAPI_BASE}?${nikeSearch}`);
  const nikeSearchData = await nikeSearchResp.json();

  const nikePages = nikeSearchData.page_results || [];
  const nikePage = nikePages.find((p: any) =>
    p.verification === "BLUE_VERIFIED" &&
    p.name?.toLowerCase() === "nike"
  ) || nikePages[0];

  if (nikePage) {
    console.log("Found Nike page:", nikePage.name, "id:", nikePage.page_id);

    const nikeParams = new URLSearchParams({
      engine: "meta_ad_library",
      page_id: nikePage.page_id,
      country: "ALL",
      api_key: SEARCHAPI_KEY,
    });

    const nikeResp = await fetch(`${SEARCHAPI_BASE}?${nikeParams}`);
    const nikeData = await nikeResp.json();

    console.log("Nike ads count:", nikeData.ads?.length || 0);
    console.log("Error:", nikeData.error || "None");

    if (nikeData.ads?.length > 0) {
      console.log("Nike has ads - API working!");
    }
  }

  // Test 5: Check raw response structure
  console.log("\n5. Raw response for Tesla page_id query:");
  console.log(JSON.stringify(data3, null, 2).slice(0, 2000));
}

testMetaAds().catch(console.error);
