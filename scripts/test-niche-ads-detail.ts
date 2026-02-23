/**
 * Detailed ad recall test — shows advertiser names per platform to detect false positives.
 * Run: npx tsx scripts/test-niche-ads-detail.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error('Could not load .env.local');
}

import { createEnhancedAdLibraryService } from '../src/lib/ad-library';

// Focus on the suspicious ones + a clean one for comparison
const COMPANIES = [
  { name: 'crisp', domain: 'crisp.chat' },
  { name: 'fathom', domain: 'fathom.video' },
  { name: 'beehiiv', domain: 'beehiiv.com' },
  { name: 'instantly', domain: 'instantly.ai' },
  { name: 'lemlist', domain: 'lemlist.com' },
];

async function main() {
  const service = createEnhancedAdLibraryService();

  for (const company of COMPANIES) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`  ${company.name.toUpperCase()} (${company.domain})`);
    console.log('='.repeat(80));

    const result = await service.fetchAllPlatforms({
      query: company.name,
      domain: company.domain,
      limit: 120,
      recallMode: 'high',
      countries: ['US', 'CA', 'GB', 'AU'],
      enableForeplayEnrichment: false,
      includeForeplayAsSource: false,
    });

    const ads = result.ads || [];

    // Group by platform
    const byPlatform: Record<string, typeof ads> = {};
    for (const ad of ads) {
      const p = ad.platform;
      if (!byPlatform[p]) byPlatform[p] = [];
      byPlatform[p].push(ad);
    }

    for (const [platform, platformAds] of Object.entries(byPlatform)) {
      console.log(`\n  --- ${platform.toUpperCase()} (${platformAds.length} ads) ---`);

      // Group by advertiser within platform
      const byAdvertiser: Record<string, { count: number; scores: number[]; categories: string[]; headlines: string[] }> = {};
      for (const ad of platformAds) {
        const adv = ad.advertiser || '(unknown)';
        if (!byAdvertiser[adv]) byAdvertiser[adv] = { count: 0, scores: [], categories: [], headlines: [] };
        byAdvertiser[adv].count++;
        byAdvertiser[adv].scores.push(ad.relevance?.score ?? 0);
        byAdvertiser[adv].categories.push(ad.relevance?.category ?? 'unknown');
        if (ad.headline && byAdvertiser[adv].headlines.length < 2) {
          byAdvertiser[adv].headlines.push(ad.headline.slice(0, 80));
        }
      }

      // Sort by count descending
      const sorted = Object.entries(byAdvertiser).sort((a, b) => b[1].count - a[1].count);
      for (const [advertiser, info] of sorted) {
        const avgScore = Math.round(info.scores.reduce((a, b) => a + b, 0) / info.scores.length);
        const cats = [...new Set(info.categories)].join(', ');
        const isFalsePositive = !advertiser.toLowerCase().includes(company.name.toLowerCase()) &&
          !company.name.toLowerCase().includes(advertiser.toLowerCase().replace(/[^a-z]/g, ''));
        const flag = isFalsePositive ? ' ⚠️  POSSIBLE FALSE POSITIVE' : ' ✅';
        console.log(`    ${advertiser} — ${info.count} ads, avg score ${avgScore}, [${cats}]${flag}`);
        for (const h of info.headlines) {
          console.log(`      "${h}"`);
        }
      }
    }

    console.log(`\n  TOTAL: ${ads.length} ads`);
  }
}

main().catch(console.error);
