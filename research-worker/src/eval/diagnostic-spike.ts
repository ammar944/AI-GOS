/**
 * Diagnostic spike: compare keyword search vs advertiser-first lookup
 * across 5 test companies on LinkedIn, Meta, and Google.
 *
 * Usage: npx tsx src/eval/diagnostic-spike.ts
 * Requires: SEARCHAPI_KEY in .env
 */
import 'dotenv/config';

const API_KEY = process.env.SEARCHAPI_KEY;
if (!API_KEY) {
  console.error('SEARCHAPI_KEY not found in environment');
  process.exit(1);
}

const BASE = 'https://www.searchapi.io/api/v1/search';

const COMPANIES = [
  { name: 'Directive', domain: 'directiveconsulting.com', ambiguity: 'high' },
  { name: 'Kalangi', domain: 'kalangi.com', ambiguity: 'low' },
  { name: 'Buffer', domain: 'buffer.com', ambiguity: 'high' },
  { name: 'HubSpot', domain: 'hubspot.com', ambiguity: 'low' },
  { name: 'Go', domain: 'go.dev', ambiguity: 'extreme' },
];

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { error: `${res.status} ${res.statusText}`, body: text.slice(0, 200) };
  }
  return res.json();
}

function qs(params: Record<string, string>): string {
  return new URLSearchParams({ ...params, api_key: API_KEY! }).toString();
}

// ─── LinkedIn ───────────────────────────────────────────────

async function linkedInKeyword(name: string) {
  const url = `${BASE}?${qs({ engine: 'linkedin_ad_library', q: name })}`;
  return fetchJson(url);
}

async function linkedInAdvertiser(name: string) {
  const url = `${BASE}?${qs({ engine: 'linkedin_ad_library', advertiser: name })}`;
  return fetchJson(url);
}

// ─── Meta ───────────────────────────────────────────────────

async function metaKeyword(name: string) {
  const url = `${BASE}?${qs({ engine: 'meta_ad_library', q: name, country: 'US' })}`;
  return fetchJson(url);
}

async function metaPageSearch(name: string) {
  const url = `${BASE}?${qs({ engine: 'meta_ad_library_page_search', q: name })}`;
  return fetchJson(url);
}

// ─── Google ─────────────────────────────────────────────────

async function googleKeyword(name: string) {
  const url = `${BASE}?${qs({ engine: 'google_ads_transparency_center', q: name })}`;
  return fetchJson(url);
}

async function googleAdvertiserSearch(name: string) {
  const url = `${BASE}?${qs({ engine: 'google_ads_transparency_center_advertiser_search', q: name })}`;
  return fetchJson(url);
}

// ─── Analysis helpers ───────────────────────────────────────

function extractAdvertiserNames(data: unknown, platform: string): string[] {
  if (!data || typeof data !== 'object' || 'error' in (data as Record<string, unknown>)) return [];
  const d = data as Record<string, unknown>;

  if (platform === 'linkedin') {
    const ads = (d.ads ?? d.organic_results ?? []) as Array<Record<string, unknown>>;
    return ads
      .map(a => (a.advertiser as Record<string, unknown>)?.name as string ?? a.advertiser_name as string)
      .filter(Boolean);
  }
  if (platform === 'meta') {
    const ads = (d.ads ?? d.results ?? []) as Array<Record<string, unknown>>;
    return ads.map(a => a.page_name as string ?? a.advertiser_name as string).filter(Boolean);
  }
  if (platform === 'google') {
    const ads = (d.ads ?? d.results ?? d.advertisers ?? []) as Array<Record<string, unknown>>;
    return ads.map(a => a.advertiser_name as string ?? a.name as string).filter(Boolean);
  }
  if (platform === 'meta_pages') {
    const pages = (d.page_results ?? []) as Array<Record<string, unknown>>;
    return pages.map(p => p.name as string).filter(Boolean);
  }
  return [];
}

function matchRate(names: string[], target: string): { total: number; matched: number; rate: string; samples: string[] } {
  const targetLower = target.toLowerCase();
  const matched = names.filter(n => n.toLowerCase().includes(targetLower) || targetLower.includes(n.toLowerCase()));
  return {
    total: names.length,
    matched: matched.length,
    rate: names.length ? `${Math.round((matched.length / names.length) * 100)}%` : 'N/A',
    samples: names.slice(0, 5),
  };
}

// ─── Main ───────────────────────────────────────────────────

async function testCompany(company: typeof COMPANIES[0]) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${company.name} (${company.domain}) — ambiguity: ${company.ambiguity}`);
  console.log('═'.repeat(60));

  // LinkedIn: keyword vs advertiser
  console.log('\n  LinkedIn:');
  const [liKeyword, liAdvertiser] = await Promise.all([
    linkedInKeyword(company.name),
    linkedInAdvertiser(company.name),
  ]);
  const liKwNames = extractAdvertiserNames(liKeyword, 'linkedin');
  const liAdvNames = extractAdvertiserNames(liAdvertiser, 'linkedin');
  const liKwMatch = matchRate(liKwNames, company.name);
  const liAdvMatch = matchRate(liAdvNames, company.name);
  console.log(`    keyword (q:):      ${liKwMatch.total} ads, ${liKwMatch.rate} match — ${JSON.stringify(liKwMatch.samples)}`);
  console.log(`    advertiser param:  ${liAdvMatch.total} ads, ${liAdvMatch.rate} match — ${JSON.stringify(liAdvMatch.samples)}`);

  // Meta: keyword vs page_search
  console.log('\n  Meta:');
  const [metaKw, metaPages] = await Promise.all([
    metaKeyword(company.name),
    metaPageSearch(company.name),
  ]);
  const metaKwNames = extractAdvertiserNames(metaKw, 'meta');
  const metaPageNames = extractAdvertiserNames(metaPages, 'meta_pages');
  const metaKwMatch = matchRate(metaKwNames, company.name);
  const metaPageMatch = matchRate(metaPageNames, company.name);
  console.log(`    keyword (q:):      ${metaKwMatch.total} ads, ${metaKwMatch.rate} match — ${JSON.stringify(metaKwMatch.samples)}`);
  console.log(`    page_search:       ${metaPageMatch.total} pages, ${metaPageMatch.rate} match — ${JSON.stringify(metaPageMatch.samples)}`);

  // Google: keyword vs advertiser_search
  console.log('\n  Google:');
  const [googleKw, googleAdv] = await Promise.all([
    googleKeyword(company.name),
    googleAdvertiserSearch(company.name),
  ]);
  const googleKwNames = extractAdvertiserNames(googleKw, 'google');
  const googleAdvNames = extractAdvertiserNames(googleAdv, 'google');
  const googleKwMatch = matchRate(googleKwNames, company.name);
  const googleAdvMatch = matchRate(googleAdvNames, company.name);
  console.log(`    keyword (q:):       ${googleKwMatch.total} ads, ${googleKwMatch.rate} match — ${JSON.stringify(googleKwMatch.samples)}`);
  console.log(`    advertiser_search:  ${googleAdvMatch.total} results, ${googleAdvMatch.rate} match — ${JSON.stringify(googleAdvMatch.samples)}`);

  return { company: company.name, linkedin: { keyword: liKwMatch, advertiser: liAdvMatch }, meta: { keyword: metaKwMatch, pageSearch: metaPageMatch }, google: { keyword: googleKwMatch, advertiserSearch: googleAdvMatch } };
}

async function main() {
  console.log('SearchAPI Diagnostic Spike');
  console.log(`Testing ${COMPANIES.length} companies: keyword search vs advertiser-first lookup`);
  console.log(`API calls: ${COMPANIES.length * 6} (6 per company)\n`);

  const results = [];
  for (const company of COMPANIES) {
    try {
      const result = await testCompany(company);
      results.push(result);
    } catch (err) {
      console.error(`  ERROR for ${company.name}:`, err instanceof Error ? err.message : err);
    }
    // Small delay between companies to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  SUMMARY');
  console.log('═'.repeat(60));
  console.log('\n  Company         | Platform  | Keyword Match | Advertiser Match | Winner');
  console.log('  ' + '-'.repeat(80));
  for (const r of results) {
    console.log(`  ${r.company.padEnd(16)} | LinkedIn  | ${r.linkedin.keyword.rate.padEnd(13)} | ${r.linkedin.advertiser.rate.padEnd(16)} | ${r.linkedin.advertiser.matched >= r.linkedin.keyword.matched ? 'advertiser' : 'keyword'}`);
    console.log(`  ${''.padEnd(16)} | Meta      | ${r.meta.keyword.rate.padEnd(13)} | ${r.meta.pageSearch.rate.padEnd(16)} | ${r.meta.pageSearch.matched >= r.meta.keyword.matched ? 'page_search' : 'keyword'}`);
    console.log(`  ${''.padEnd(16)} | Google    | ${r.google.keyword.rate.padEnd(13)} | ${r.google.advertiserSearch.rate.padEnd(16)} | ${r.google.advertiserSearch.matched >= r.google.keyword.matched ? 'adv_search' : 'keyword'}`);
  }

  const advertiserWins = results.filter(r =>
    r.linkedin.advertiser.matched >= r.linkedin.keyword.matched &&
    r.meta.pageSearch.matched >= r.meta.keyword.matched
  ).length;
  console.log(`\n  Advertiser-first wins for ${advertiserWins}/${results.length} companies.`);
  console.log(advertiserWins >= 4
    ? '  ✓ PREMISE CONFIRMED — proceed with Approach B.'
    : '  ✗ PREMISE NOT CONFIRMED — re-evaluate approach.');
}

main().catch(console.error);
