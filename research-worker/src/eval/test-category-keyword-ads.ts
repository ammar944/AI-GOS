/**
 * CLI smoke test for category-keyword-ads (6th Competitor Intel tab).
 *
 * Run:
 *   npx tsx src/eval/test-category-keyword-ads.ts
 *
 * Or pass custom keywords:
 *   npx tsx src/eval/test-category-keyword-ads.ts "ai website builder" "no code website"
 *
 * Cost: up to 8 Meta page_search + up to 16 Meta ad fetches + 8 Google SERP
 * = ~32 SearchAPI calls per run. Budget once, do not loop.
 */

import 'dotenv/config';
import { fetchCategoryKeywordAds } from '../tools/category-keyword-ads';

const DEFAULT_KEYWORDS = [
  'ai website builder',
  'wix alternative uk',
  'website builder for small business',
  'build a website fast',
  'no code website builder',
  'ai website generator',
];

async function main(): Promise<void> {
  if (!process.env.SEARCHAPI_KEY) {
    console.error('Missing SEARCHAPI_KEY — set it in research-worker/.env');
    process.exit(2);
  }

  const keywords = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_KEYWORDS;
  console.log(`\n[test] probing ${keywords.length} category keywords:\n  - ${keywords.join('\n  - ')}\n`);

  const start = Date.now();
  const result = await fetchCategoryKeywordAds({ keywords });
  const durationMs = Date.now() - start;

  const meetsBar = result.ads.length >= 20;

  console.log('\n─── RESULT ──────────────────────────────────────────');
  console.log(`Duration:        ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`Ads returned:    ${result.ads.length}   ${meetsBar ? 'PASS (≥20)' : 'BELOW BAR (<20)'}`);
  console.log(`Keywords probed: ${result.keywordsProbed.length}`);
  console.log(`Source split:    meta=${result.sources.meta}  google=${result.sources.google}`);
  if (result.error) console.log(`Error:           ${result.error}`);

  if (result.ads.length === 0) {
    console.log('\nNo ads. Possible causes:');
    console.log('  - SearchAPI Meta page_search returned no brand-matching pages for these keywords');
    console.log('  - Google SERP returned no paid ad slots (unlikely for commercial terms)');
    console.log('  - SEARCHAPI_KEY is invalid / rate-limited');
    process.exit(meetsBar ? 0 : 1);
  }

  console.log('\n─── SAMPLE ADS (first 10) ───────────────────────────');
  for (const ad of result.ads.slice(0, 10)) {
    console.log(
      `\n[${ad.source.padEnd(6)}] ${ad.advertiser}  (kw: "${ad.keyword}")\n  ${ad.headline || '(no headline)'}` +
        (ad.body ? `\n  ${ad.body.slice(0, 140)}` : '') +
        (ad.landingPage ? `\n  → ${ad.landingPage}` : ''),
    );
  }

  // Advertiser diversity — how many unique brands are we surfacing?
  const uniqueAdvertisers = new Set(result.ads.map((a) => a.advertiser.toLowerCase())).size;
  console.log(`\n─── DIVERSITY ───────────────────────────────────────`);
  console.log(`Unique advertisers: ${uniqueAdvertisers}`);
  console.log(`Ads per advertiser: ${(result.ads.length / Math.max(uniqueAdvertisers, 1)).toFixed(1)}`);

  // Performance bar: should return in under 15s even with all 8 keywords.
  const perfOk = durationMs < 20_000;
  console.log(`\n─── PERF ────────────────────────────────────────────`);
  console.log(`Duration ${perfOk ? 'OK' : 'SLOW'}: ${(durationMs / 1000).toFixed(1)}s (bar: <20s)`);

  process.exit(meetsBar && perfOk ? 0 : 1);
}

main().catch((err) => {
  console.error('[test-category-keyword-ads] fatal:', err);
  process.exit(1);
});
