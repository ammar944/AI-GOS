/**
 * Integration test for the Ad Library Service with Google fix
 * Run with: npx tsx test-service-integration.ts
 */

// Set env var for the service
process.env.SEARCHAPI_KEY = process.env.SEARCHAPI_KEY || "9B2DEKA9p64c2rHUUeS9MdqZ";

async function main() {
  console.log("=".repeat(60));
  console.log("Ad Library Service Integration Test");
  console.log("=".repeat(60));

  // Dynamic import to use the actual service
  const { createAdLibraryService } = await import("./src/lib/ad-library/index.js");

  const service = createAdLibraryService();

  console.log("\nTesting fetchAllPlatforms for Tesla...\n");

  const response = await service.fetchAllPlatforms({
    query: "Tesla",
    domain: "tesla.com",
    limit: 10,
    googleAdFormat: "image", // Test the new filter
  });

  console.log("=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));

  console.log(`\nTotal ads: ${response.totalAds}`);
  console.log(`Has creatives: ${response.hasCreatives}`);

  for (const result of response.results) {
    console.log(`\n${result.platform.toUpperCase()}:`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Ads: ${result.ads.length} (total available: ${result.totalCount})`);

    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }

    if (result.ads.length > 0) {
      const advertisers = [...new Set(result.ads.map(ad => ad.advertiser))];
      console.log(`  Advertisers: ${advertisers.join(", ")}`);

      const formats = result.ads.reduce((acc: Record<string, number>, ad) => {
        acc[ad.format] = (acc[ad.format] || 0) + 1;
        return acc;
      }, {});
      console.log(`  Formats: ${JSON.stringify(formats)}`);

      const withImages = result.ads.filter(ad => ad.imageUrl).length;
      const withVideos = result.ads.filter(ad => ad.videoUrl).length;
      console.log(`  With images: ${withImages}, With videos: ${withVideos}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Test complete!");
}

main().catch(console.error);
