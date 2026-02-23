/**
 * Test ad recall for niche SaaS companies.
 * Run: npx tsx scripts/test-niche-ads.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually (no dotenv dep in this Next.js project)
const envPath = resolve(__dirname, '..', '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error('Could not load .env.local');
}

import { createEnhancedAdLibraryService } from '../src/lib/ad-library';

const NICHE_COMPANIES = [
  { name: 'lemlist', domain: 'lemlist.com' },
  { name: 'instantly', domain: 'instantly.ai' },
  { name: 'beehiiv', domain: 'beehiiv.com' },
  { name: 'taplio', domain: 'taplio.com' },
  { name: 'crisp', domain: 'crisp.chat' },
  { name: 'fathom', domain: 'fathom.video' },
];

interface TestResult {
  company: string;
  domain: string;
  totalAds: number;
  byPlatform: Record<string, number>;
  bySource: Record<string, number>;
  byRelevanceCategory: Record<string, number>;
  avgRelevanceScore: number;
  sampleAdvertisers: string[];
  durationMs: number;
  error?: string;
}

async function testCompany(
  company: { name: string; domain: string },
  service: ReturnType<typeof createEnhancedAdLibraryService>
): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await service.fetchAllPlatforms({
      query: company.name,
      domain: company.domain,
      limit: 120,
      recallMode: 'high',
      countries: ['US', 'CA', 'GB', 'AU'],
      enableForeplayEnrichment: false, // skip to save time/credits
      includeForeplayAsSource: false,
    });

    const ads = result.ads || [];

    const byPlatform: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byRelevanceCategory: Record<string, number> = {};
    const advertisers = new Set<string>();
    let totalScore = 0;

    for (const ad of ads) {
      byPlatform[ad.platform] = (byPlatform[ad.platform] ?? 0) + 1;
      const src = (ad as any).source ?? 'searchapi';
      bySource[src] = (bySource[src] ?? 0) + 1;
      const cat = ad.relevance?.category ?? 'unknown';
      byRelevanceCategory[cat] = (byRelevanceCategory[cat] ?? 0) + 1;
      totalScore += ad.relevance?.score ?? 0;
      if (ad.advertiser) advertisers.add(ad.advertiser);
    }

    return {
      company: company.name,
      domain: company.domain,
      totalAds: ads.length,
      byPlatform,
      bySource,
      byRelevanceCategory,
      avgRelevanceScore: ads.length > 0 ? Math.round(totalScore / ads.length) : 0,
      sampleAdvertisers: Array.from(advertisers).slice(0, 5),
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      company: company.name,
      domain: company.domain,
      totalAds: 0,
      byPlatform: {},
      bySource: {},
      byRelevanceCategory: {},
      avgRelevanceScore: 0,
      sampleAdvertisers: [],
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log('=== Niche SaaS Ad Recall Test ===\n');
  console.log(`Testing ${NICHE_COMPANIES.length} companies with high-recall mode + multi-country fetch\n`);

  const service = createEnhancedAdLibraryService();

  // Run sequentially to avoid rate limits
  const results: TestResult[] = [];
  for (const company of NICHE_COMPANIES) {
    console.log(`\n--- Testing: ${company.name} (${company.domain}) ---`);
    const result = await testCompany(company, service);
    results.push(result);

    if (result.error) {
      console.log(`  ERROR: ${result.error}`);
    } else {
      console.log(`  Total ads: ${result.totalAds}`);
      console.log(`  Platforms: ${JSON.stringify(result.byPlatform)}`);
      console.log(`  Sources: ${JSON.stringify(result.bySource)}`);
      console.log(`  Relevance categories: ${JSON.stringify(result.byRelevanceCategory)}`);
      console.log(`  Avg relevance score: ${result.avgRelevanceScore}`);
      console.log(`  Advertisers: [${result.sampleAdvertisers.join(', ')}]`);
      console.log(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
    }
  }

  // Summary table
  console.log('\n\n=== SUMMARY ===\n');
  console.log(
    'Company'.padEnd(15) +
    'Total'.padEnd(8) +
    'Meta'.padEnd(8) +
    'LinkedIn'.padEnd(10) +
    'Google'.padEnd(8) +
    'AvgRel'.padEnd(8) +
    'Categories'.padEnd(30) +
    'Time'
  );
  console.log('-'.repeat(100));

  for (const r of results) {
    if (r.error) {
      console.log(`${r.company.padEnd(15)}ERROR: ${r.error}`);
      continue;
    }
    console.log(
      r.company.padEnd(15) +
      String(r.totalAds).padEnd(8) +
      String(r.byPlatform['meta'] ?? 0).padEnd(8) +
      String(r.byPlatform['linkedin'] ?? 0).padEnd(10) +
      String(r.byPlatform['google'] ?? 0).padEnd(8) +
      String(r.avgRelevanceScore).padEnd(8) +
      JSON.stringify(r.byRelevanceCategory).padEnd(30) +
      `${(r.durationMs / 1000).toFixed(1)}s`
    );
  }

  const totalAds = results.reduce((sum, r) => sum + r.totalAds, 0);
  const totalTime = results.reduce((sum, r) => sum + r.durationMs, 0);
  console.log('-'.repeat(100));
  console.log(`TOTAL: ${totalAds} ads across ${NICHE_COMPANIES.length} companies in ${(totalTime / 1000).toFixed(1)}s`);
}

main().catch(console.error);
