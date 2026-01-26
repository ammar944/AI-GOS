/**
 * Ad Library API Test Script
 *
 * Run with: npx ts-node test-ad-libraries-local.ts
 * Or: node test-ad-libraries-local.js (after compiling)
 *
 * Make sure to install node-fetch if needed: npm install node-fetch
 */

const SEARCHAPI_KEY = "pUvcBNQPLcNBsHtscnniYWUx";
const TEST_COMPANY = "Coca-Cola";
const TEST_DOMAIN = "coca-cola.com";

interface AdLibraryResult {
  platform: string;
  success: boolean;
  totalAds: number;
  sampleAds: any[];
  error?: string;
}

async function testLinkedInAdLibrary(): Promise<AdLibraryResult> {
  console.log("\n🔷 Testing LINKEDIN Ad Library...");
  console.log(`   Query: ${TEST_COMPANY}`);
  console.log("   " + "-".repeat(50));

  try {
    const url = `https://www.searchapi.io/api/v1/search?engine=linkedin_ad_library&q=${encodeURIComponent(TEST_COMPANY)}&api_key=${SEARCHAPI_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.log(`   ❌ Error: ${data.error}`);
      return { platform: "linkedin", success: false, totalAds: 0, sampleAds: [], error: data.error };
    }

    const totalAds = data.search_information?.total_results || data.ads?.length || 0;
    console.log(`   ✅ Total ads found: ${totalAds}`);

    if (data.ads && data.ads.length > 0) {
      console.log(`   📋 Sample ads (first 3):`);
      data.ads.slice(0, 3).forEach((ad: any, i: number) => {
        console.log(`\n   [${i + 1}] Advertiser: ${ad.advertiser?.name || "Unknown"}`);
        console.log(`       Type: ${ad.ad_type || "N/A"}`);
        console.log(`       Headline: ${ad.content?.headline?.slice(0, 60) || "N/A"}...`);
        console.log(`       Has Image: ${ad.content?.image ? "✅" : "❌"}`);
        if (ad.content?.image) {
          console.log(`       Image URL: ${ad.content.image.slice(0, 80)}...`);
        }
      });
    }

    return {
      platform: "linkedin",
      success: true,
      totalAds,
      sampleAds: data.ads?.slice(0, 3) || []
    };

  } catch (error: any) {
    console.log(`   ❌ Request failed: ${error.message}`);
    return { platform: "linkedin", success: false, totalAds: 0, sampleAds: [], error: error.message };
  }
}

async function testMetaAdLibrary(): Promise<AdLibraryResult> {
  console.log("\n🔵 Testing META Ad Library (Facebook/Instagram)...");
  console.log(`   Query: ${TEST_COMPANY}`);
  console.log("   " + "-".repeat(50));

  try {
    const url = `https://www.searchapi.io/api/v1/search?engine=meta_ad_library&q=${encodeURIComponent(TEST_COMPANY)}&country=US&api_key=${SEARCHAPI_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.log(`   ❌ Error: ${data.error}`);
      return { platform: "meta", success: false, totalAds: 0, sampleAds: [], error: data.error };
    }

    const totalAds = data.search_information?.total_results || data.ads?.length || 0;
    console.log(`   ✅ Total ads found: ${totalAds}`);

    if (data.ads && data.ads.length > 0) {
      console.log(`   📋 Sample ads (first 3):`);
      data.ads.slice(0, 3).forEach((ad: any, i: number) => {
        console.log(`\n   [${i + 1}] Page: ${ad.page_name || ad.snapshot?.page_name || "Unknown"}`);
        console.log(`       Active: ${ad.is_active ? "✅" : "❌"}`);
        console.log(`       Platforms: ${ad.publisher_platform?.join(", ") || "N/A"}`);
        console.log(`       Body: ${(ad.snapshot?.body?.text || "N/A").slice(0, 60)}...`);

        const hasImage = ad.snapshot?.images?.length > 0;
        const hasVideo = ad.snapshot?.videos?.length > 0;
        console.log(`       Has Image: ${hasImage ? "✅" : "❌"} | Has Video: ${hasVideo ? "✅" : "❌"}`);

        if (hasImage) {
          const imgUrl = typeof ad.snapshot.images[0] === 'string'
            ? ad.snapshot.images[0]
            : ad.snapshot.images[0]?.url || ad.snapshot.images[0]?.original_image_url || JSON.stringify(ad.snapshot.images[0]).slice(0, 80);
          console.log(`       Image URL: ${String(imgUrl).slice(0, 80)}...`);
        }
      });
    }

    return {
      platform: "meta",
      success: true,
      totalAds,
      sampleAds: data.ads?.slice(0, 3) || []
    };

  } catch (error: any) {
    console.log(`   ❌ Request failed: ${error.message}`);
    return { platform: "meta", success: false, totalAds: 0, sampleAds: [], error: error.message };
  }
}

async function testGoogleAdsTransparency(): Promise<AdLibraryResult> {
  console.log("\n🔴 Testing GOOGLE Ads Transparency Center...");
  console.log(`   Domain: ${TEST_DOMAIN}`);
  console.log("   " + "-".repeat(50));

  try {
    const url = `https://www.searchapi.io/api/v1/search?engine=google_ads_transparency_center&domain=${encodeURIComponent(TEST_DOMAIN)}&api_key=${SEARCHAPI_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.log(`   ❌ Error: ${data.error}`);
      return { platform: "google", success: false, totalAds: 0, sampleAds: [], error: data.error };
    }

    // Google uses "ad_creatives" not "ads"
    const ads = data.ad_creatives || [];
    const totalAds = data.search_information?.total_results || ads.length || 0;

    console.log(`   ✅ Total ads found: ${totalAds}`);

    if (ads.length > 0) {
      console.log(`   📋 Sample ads (first 3):`);
      ads.slice(0, 3).forEach((ad: any, i: number) => {
        console.log(`\n   [${i + 1}] Format: ${ad.format || "Unknown"}`);
        console.log(`       Advertiser: ${ad.advertiser?.name || "Unknown"}`);
        console.log(`       First shown: ${ad.first_shown_datetime || "N/A"}`);
        console.log(`       Last shown: ${ad.last_shown_datetime || "N/A"}`);
        console.log(`       Days shown: ${ad.total_days_shown || "N/A"}`);

        const hasImage = !!ad.image?.link;
        const isVideo = ad.format?.toLowerCase() === "video";
        console.log(`       Has Image: ${hasImage ? "✅" : "❌"} | Is Video: ${isVideo ? "✅" : "❌"}`);

        if (ad.image?.link) {
          console.log(`       Image URL: ${ad.image.link}`);
        }
        if (ad.details_link) {
          console.log(`       Details: ${ad.details_link.slice(0, 80)}...`);
        }
      });
    }

    return {
      platform: "google",
      success: true,
      totalAds,
      sampleAds: ads.slice(0, 3)
    };

  } catch (error: any) {
    console.log(`   ❌ Request failed: ${error.message}`);
    return { platform: "google", success: false, totalAds: 0, sampleAds: [], error: error.message };
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 AD LIBRARY API TEST");
  console.log("=".repeat(60));
  console.log(`\nAPI Key: ${SEARCHAPI_KEY.slice(0, 8)}...`);
  console.log(`Test Company: ${TEST_COMPANY}`);
  console.log(`Test Domain: ${TEST_DOMAIN}`);

  const results: AdLibraryResult[] = [];

  // Test all three platforms
  results.push(await testLinkedInAdLibrary());
  results.push(await testMetaAdLibrary());
  results.push(await testGoogleAdsTransparency());

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));

  results.forEach(result => {
    const icon = result.success ? "✅" : "❌";
    const status = result.success ? `${result.totalAds} ads found` : result.error;
    console.log(`${icon} ${result.platform.toUpperCase().padEnd(10)} | ${status}`);
  });

  const hasCreatives = results.some(r =>
    r.sampleAds.some((ad: any) =>
      ad.content?.image ||
      ad.snapshot?.images?.length > 0 ||
      ad.image?.link
    )
  );

  console.log("\n" + "-".repeat(60));
  console.log(`🖼️  Creative images available: ${hasCreatives ? "YES ✅" : "NO ❌"}`);
  console.log("=".repeat(60));

  // Output raw JSON for one successful result
  const successfulResult = results.find(r => r.success && r.sampleAds.length > 0);
  if (successfulResult) {
    console.log("\n📄 Sample raw data (first ad from " + successfulResult.platform + "):");
    console.log(JSON.stringify(successfulResult.sampleAds[0], null, 2));
  }
}

main().catch(console.error);
