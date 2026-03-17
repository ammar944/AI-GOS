#!/usr/bin/env npx tsx
// research-worker/scripts/test-ads.ts
//
// Standalone test harness for the Apify + SearchAPI ad scraping pipeline.
// Run from the research-worker directory:
//
//   npx tsx scripts/test-ads.ts "Kalungi" "kalungi.com"
//   npx tsx scripts/test-ads.ts "HubSpot" "hubspot.com" --apify-only
//   npx tsx scripts/test-ads.ts "Salesforce" --searchapi-only
//   npx tsx scripts/test-ads.ts "Nike" --meta-only
//   npx tsx scripts/test-ads.ts "SaaS Launch" "saaslaunch.io" --compare
//
// Requires .env in research-worker/ with APIFY_API_TOKEN and/or SEARCHAPI_KEY

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from research-worker/.env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { fetchApifyAds, fetchCompetitorAds } from '../src/tools/apify-ads';
import {
  searchGoogleAds,
  searchLinkedInAds,
  searchMetaAds,
  buildAdInsight,
} from '../src/tools/adlibrary';
import type { WorkerAdInsight } from '../src/tools/adlibrary-types';

// ── CLI Args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));

const companyName = positional[0];
const domain = positional[1];

if (!companyName) {
  console.error(`
Usage: npx tsx scripts/test-ads.ts <company-name> [domain] [flags]

Flags:
  --apify-only      Only use Apify actors
  --searchapi-only  Only use SearchAPI
  --compare         Run both and compare side-by-side
  --meta-only       Only fetch Meta/Facebook ads
  --google-only     Only fetch Google ads
  --linkedin-only   Only fetch LinkedIn ads
  --json            Output raw JSON instead of formatted table
  --verbose         Show individual ad details

Examples:
  npx tsx scripts/test-ads.ts "Kalungi" "kalungi.com"
  npx tsx scripts/test-ads.ts "HubSpot" "hubspot.com" --compare
  npx tsx scripts/test-ads.ts "Nike" --apify-only --meta-only
`);
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function printInsight(label: string, insight: WorkerAdInsight, verbose: boolean) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'='.repeat(60)}`);

  console.log(`\n  Total ads:       ${insight.summary.activeAdCount}`);
  console.log(`  Platforms:       ${insight.summary.platforms.join(', ')}`);
  console.log(`  Confidence:      ${insight.summary.sourceConfidence}`);
  console.log(`  Themes:          ${insight.summary.themes.join(', ') || '(none detected)'}`);

  console.log(`\n  Sources:`);
  console.log(`    Meta:          ${insight.sourcesUsed.meta}`);
  console.log(`    Google:        ${insight.sourcesUsed.google}`);
  console.log(`    LinkedIn:      ${insight.sourcesUsed.linkedin}`);
  console.log(`    Foreplay:      ${insight.sourcesUsed.foreplay}`);

  console.log(`\n  Evidence: ${insight.summary.evidence}`);

  console.log(`\n  Library Links:`);
  console.log(`    Meta:     ${insight.libraryLinks.metaLibraryUrl}`);
  console.log(`    LinkedIn: ${insight.libraryLinks.linkedInLibraryUrl}`);
  console.log(`    Google:   ${insight.libraryLinks.googleAdvertiserUrl ?? '(none)'}`);

  if (insight.summary.sampleMessages.length > 0) {
    console.log(`\n  Sample Messages:`);
    for (const msg of insight.summary.sampleMessages) {
      console.log(`    - ${msg.slice(0, 120)}${msg.length > 120 ? '...' : ''}`);
    }
  }

  if (verbose && insight.adCreatives.length > 0) {
    console.log(`\n  Ad Creatives (${insight.adCreatives.length}):`);
    for (const ad of insight.adCreatives.slice(0, 20)) {
      console.log(`\n    [${ad.platform.toUpperCase()}] ${ad.advertiser}`);
      if (ad.headline) console.log(`      Headline: ${ad.headline}`);
      if (ad.body) console.log(`      Body:     ${ad.body.slice(0, 150)}${(ad.body.length ?? 0) > 150 ? '...' : ''}`);
      console.log(`      Format:   ${ad.format} | Active: ${ad.isActive}`);
      if (ad.firstSeen) console.log(`      Dates:    ${ad.firstSeen} → ${ad.lastSeen ?? 'current'}`);
      if (ad.imageUrl) console.log(`      Image:    ${ad.imageUrl}`);
      if (ad.videoUrl) console.log(`      Video:    ${ad.videoUrl}`);
      if (ad.detailsUrl) console.log(`      Details:  ${ad.detailsUrl}`);
    }
    if (insight.adCreatives.length > 20) {
      console.log(`\n    ... and ${insight.adCreatives.length - 20} more`);
    }
  }
}

function printComparison(apify: WorkerAdInsight, searchapi: WorkerAdInsight) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  COMPARISON: Apify vs SearchAPI`);
  console.log(`${'='.repeat(60)}`);

  const rows = [
    ['', 'Apify', 'SearchAPI'],
    ['Total Ads', String(apify.summary.activeAdCount), String(searchapi.summary.activeAdCount)],
    ['Meta', String(apify.sourcesUsed.meta), String(searchapi.sourcesUsed.meta)],
    ['Google', String(apify.sourcesUsed.google), String(searchapi.sourcesUsed.google)],
    ['LinkedIn', String(apify.sourcesUsed.linkedin), String(searchapi.sourcesUsed.linkedin)],
    ['Confidence', apify.summary.sourceConfidence, searchapi.summary.sourceConfidence],
    ['Themes', String(apify.summary.themes.length), String(searchapi.summary.themes.length)],
    ['Has Creatives', apify.adCreatives.length > 0 ? 'YES' : 'NO', searchapi.adCreatives.length > 0 ? 'YES' : 'NO'],
  ];

  const colWidths = rows[0]!.map((_, col) =>
    Math.max(...rows.map((row) => (row[col] ?? '').length)) + 2,
  );

  for (const row of rows) {
    console.log(`  ${row.map((cell, i) => cell.padEnd(colWidths[i]!)).join('')}`);
  }

  // Unique ads in each
  const apifyHeadlines = new Set(apify.adCreatives.map((c) => c.headline).filter(Boolean));
  const searchApiHeadlines = new Set(searchapi.adCreatives.map((c) => c.headline).filter(Boolean));
  const apifyOnly = [...apifyHeadlines].filter((h) => !searchApiHeadlines.has(h));
  const searchApiOnly = [...searchApiHeadlines].filter((h) => !apifyHeadlines.has(h));

  if (apifyOnly.length > 0) {
    console.log(`\n  Unique to Apify (${apifyOnly.length}):`);
    for (const h of apifyOnly.slice(0, 5)) {
      console.log(`    - ${h}`);
    }
  }
  if (searchApiOnly.length > 0) {
    console.log(`\n  Unique to SearchAPI (${searchApiOnly.length}):`);
    for (const h of searchApiOnly.slice(0, 5)) {
      console.log(`    - ${h}`);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const verbose = flags.has('--verbose');
  const jsonOutput = flags.has('--json');
  const compare = flags.has('--compare');
  const apifyOnly = flags.has('--apify-only');
  const searchApiOnly = flags.has('--searchapi-only');

  // Determine platforms
  const platforms: ('meta' | 'google' | 'linkedin')[] = [];
  if (flags.has('--meta-only')) platforms.push('meta');
  if (flags.has('--google-only')) platforms.push('google');
  if (flags.has('--linkedin-only')) platforms.push('linkedin');
  if (platforms.length === 0) platforms.push('meta', 'google', 'linkedin');

  console.log(`\nSearching ads for: "${companyName}"${domain ? ` (${domain})` : ''}`);
  console.log(`Platforms: ${platforms.join(', ')}`);
  console.log(`Mode: ${compare ? 'compare' : apifyOnly ? 'apify-only' : searchApiOnly ? 'searchapi-only' : 'fallback (apify → searchapi)'}`);

  // Check env
  const hasApify = Boolean(process.env.APIFY_API_TOKEN);
  const hasSearchApi = Boolean(process.env.SEARCHAPI_KEY);
  console.log(`\nAPI Keys: Apify=${hasApify ? 'YES' : 'MISSING'} | SearchAPI=${hasSearchApi ? 'YES' : 'MISSING'}`);

  if (compare) {
    // Run both in parallel and compare
    const startTime = Date.now();
    const [apifyResult, searchApiResult] = await Promise.all([
      hasApify
        ? fetchApifyAds(companyName, domain, { platforms })
        : Promise.resolve(null),
      hasSearchApi
        ? (async () => {
            const [google, linkedin, meta] = await Promise.all([
              platforms.includes('google') ? searchGoogleAds(companyName).catch(() => []) : [],
              platforms.includes('linkedin') ? searchLinkedInAds(companyName).catch(() => []) : [],
              platforms.includes('meta') ? searchMetaAds(companyName).catch(() => []) : [],
            ]);
            return buildAdInsight(google, linkedin, meta, [], companyName, domain);
          })()
        : Promise.resolve(null),
    ]);

    const totalTime = Date.now() - startTime;
    console.log(`\nTotal time: ${(totalTime / 1000).toFixed(1)}s`);

    if (jsonOutput) {
      console.log(JSON.stringify({ apify: apifyResult, searchapi: searchApiResult }, null, 2));
      return;
    }

    if (apifyResult) printInsight('APIFY RESULTS', apifyResult, verbose);
    else console.log('\n  APIFY: Skipped (no APIFY_API_TOKEN)');

    if (searchApiResult) printInsight('SEARCHAPI RESULTS', searchApiResult, verbose);
    else console.log('\n  SEARCHAPI: Skipped (no SEARCHAPI_KEY)');

    if (apifyResult && searchApiResult) {
      printComparison(apifyResult, searchApiResult);
    }
  } else if (apifyOnly) {
    if (!hasApify) {
      console.error('\nERROR: APIFY_API_TOKEN not set in .env');
      process.exit(1);
    }

    const startTime = Date.now();
    const result = await fetchApifyAds(companyName, domain, { platforms });
    console.log(`\nTime: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printInsight('APIFY RESULTS', result, verbose);
    }
  } else if (searchApiOnly) {
    if (!hasSearchApi) {
      console.error('\nERROR: SEARCHAPI_KEY not set in .env');
      process.exit(1);
    }

    const startTime = Date.now();
    const [google, linkedin, meta] = await Promise.all([
      platforms.includes('google') ? searchGoogleAds(companyName).catch(() => []) : [],
      platforms.includes('linkedin') ? searchLinkedInAds(companyName).catch(() => []) : [],
      platforms.includes('meta') ? searchMetaAds(companyName).catch(() => []) : [],
    ]);
    const result = buildAdInsight(google, linkedin, meta, [], companyName, domain);
    console.log(`\nTime: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printInsight('SEARCHAPI RESULTS', result, verbose);
    }
  } else {
    // Default: fallback mode (Apify first, supplement with SearchAPI if thin)
    const startTime = Date.now();
    const insight = await fetchCompetitorAds(companyName, domain);
    const source = process.env.APIFY_API_TOKEN ? 'apify+searchapi' : 'searchapi';
    console.log(`\nTime: ${((Date.now() - startTime) / 1000).toFixed(1)}s | Source: ${source}`);

    if (jsonOutput) {
      console.log(JSON.stringify({ insight, source }, null, 2));
    } else {
      printInsight(`RESULTS (source: ${source})`, insight, verbose);
    }
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
