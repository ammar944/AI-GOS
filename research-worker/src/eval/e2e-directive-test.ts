/**
 * E2E test: fetch competitor ads for "Directive" through the full pipeline.
 * Verifies the advertiser-first lookup returns relevant ads.
 *
 * Usage: npx tsx src/eval/e2e-directive-test.ts
 */
import 'dotenv/config';
import { fetchCompetitorAds } from '../tools/apify-ads';

async function main() {
  console.log('E2E Test: fetchCompetitorAds("Directive", "directiveconsulting.com")');
  console.log('═'.repeat(60));

  const start = Date.now();
  const result = await fetchCompetitorAds('Directive', 'directiveconsulting.com');
  const elapsed = Date.now() - start;

  console.log(`\nCompleted in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`Total ads: ${result.summary.activeAdCount}`);
  console.log(`Platforms: ${result.summary.platforms.join(', ')}`);
  console.log(`Confidence: ${result.summary.sourceConfidence}`);
  console.log(`Evidence: ${result.summary.evidence}`);
  console.log(`Sources: Meta=${result.sourcesUsed.meta}, Google=${result.sourcesUsed.google}, LinkedIn=${result.sourcesUsed.linkedin}`);

  if (result.adCreatives.length > 0) {
    console.log(`\nTop ads:`);
    for (const ad of result.adCreatives.slice(0, 8)) {
      const advertiser = ad.advertiser ?? 'unknown';
      const headline = ad.headline?.slice(0, 60) ?? ad.body?.slice(0, 60) ?? '(no text)';
      const isDirective = advertiser.toLowerCase().includes('directive');
      const marker = isDirective ? '✓' : '✗';
      console.log(`  ${marker} [${ad.platform}] ${advertiser} — "${headline}"`);
    }

    const directiveAds = result.adCreatives.filter(ad =>
      (ad.advertiser ?? '').toLowerCase().includes('directive')
    );
    const precision = result.adCreatives.length > 0
      ? Math.round((directiveAds.length / result.adCreatives.length) * 100)
      : 0;
    console.log(`\nPrecision: ${directiveAds.length}/${result.adCreatives.length} (${precision}%) ads are from Directive`);
    console.log(precision >= 80 ? '✓ PASS — high precision' : precision > 0 ? '~ PARTIAL — some relevant ads' : '✗ FAIL — no relevant ads');
  } else {
    console.log('\nNo ads returned — "no verified ads found" state');
    console.log('✓ PASS — empty is better than wrong (per design doc premise)');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('Library links:');
  console.log(`  Meta:     ${result.libraryLinks.metaLibraryUrl}`);
  console.log(`  LinkedIn: ${result.libraryLinks.linkedInLibraryUrl}`);
  console.log(`  Google:   ${result.libraryLinks.googleAdvertiserUrl}`);
}

main().catch(console.error);
