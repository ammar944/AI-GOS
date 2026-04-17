/**
 * CLI smoke test for keyword-ad-probe.
 *
 * Run:
 *   npx tsx src/eval/test-keyword-ad-probe.ts <competitorName> <competitorDomain>
 *
 * Example:
 *   npx tsx src/eval/test-keyword-ad-probe.ts "Drift" "drift.com"
 *
 * Cost: ~5 SearchAPI calls + 1 SpyFu call per run (~$0.10).
 */

import 'dotenv/config';
import { spyfuTool } from '../tools/spyfu';
import { probeKeywordAds, extractTopKeywords } from '../tools/keyword-ad-probe';

function runResultToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((b: unknown) =>
        b && typeof b === 'object' && 'text' in b && typeof (b as { text: unknown }).text === 'string'
          ? (b as { text: string }).text
          : '',
      )
      .join('');
  }
  return '';
}

async function main(): Promise<void> {
  const [, , name, domain] = process.argv;
  if (!name || !domain) {
    console.error('Usage: tsx test-keyword-ad-probe.ts <competitorName> <domain>');
    process.exit(2);
  }

  const needed = ['SEARCHAPI_KEY', 'SPYFU_API_KEY'];
  for (const k of needed) {
    if (!process.env[k]) {
      console.error(`Missing required env: ${k}`);
      process.exit(3);
    }
  }

  console.log(`\n=== Keyword-Ad Probe Test ===`);
  console.log(`Competitor: ${name} (${domain})`);

  console.log(`\n[1/2] Fetching SpyFu paid keywords...`);
  const t0 = Date.now();
  const spyfuRaw = runResultToString(await spyfuTool.run({ domain }));
  const spyfu = JSON.parse(spyfuRaw) as { keywords?: unknown };
  console.log(`  SpyFu returned in ${Date.now() - t0}ms`);

  const keywordSample = extractTopKeywords(spyfu.keywords, 5);
  console.log(`  Extracted top keywords: ${JSON.stringify(keywordSample)}`);

  console.log(`\n[2/2] Probing Google SERP for each keyword and filtering by domain...`);
  const t1 = Date.now();
  const result = await probeKeywordAds({
    competitorName: name,
    domain,
    spyfuKeywords: spyfu.keywords,
  });
  console.log(`  Probe completed in ${Date.now() - t1}ms`);
  console.log(`\n=== Result ===`);
  console.log(`Keywords probed: ${result.keywordsProbed}`);
  console.log(`Ads found (domain-matched): ${result.adsFound.length}`);
  if (result.error) console.log(`Error: ${result.error}`);
  console.log('');
  for (const ad of result.adsFound) {
    console.log(`  [${ad.keyword}]`);
    console.log(`    headline: ${ad.headline}`);
    if (ad.description) console.log(`    description: ${ad.description}`);
    if (ad.landingPage) console.log(`    landing: ${ad.landingPage}`);
    console.log('');
  }

  if (result.adsFound.length === 0) {
    console.log('(No domain-matched ads recovered. Possible reasons:');
    console.log('  - Competitor not running Google ads on these keywords right now');
    console.log('  - SpyFu returned no paid keywords for this domain');
    console.log('  - SearchAPI returned no ad slots for the queries)');
  }
}

main().catch((err) => {
  console.error('[test-keyword-ad-probe] fatal:', err);
  process.exit(1);
});
