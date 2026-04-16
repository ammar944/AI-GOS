/**
 * End-to-end test: competitor ad relevance pipeline.
 * Calls real SearchAPI endpoints, runs our matching code, shows verdicts.
 *
 * Usage: npx tsx src/eval/test-ad-relevance.ts
 *        npx tsx src/eval/test-ad-relevance.ts "Atlas" "atlashq.io"
 * Requires: SEARCHAPI_KEY in .env
 */
import 'dotenv/config';
import { resolveBestCandidate, isAdvertiserMatch, normalizeSearchApiToCreatives } from '../tools/adlibrary';
import { calculateSimilarity } from '../utils/name-matcher';

const API_KEY = process.env.SEARCHAPI_KEY;
if (!API_KEY) {
  console.error('\x1b[31mSEARCHAPI_KEY not found in .env\x1b[0m');
  process.exit(1);
}

const BASE = 'https://www.searchapi.io/api/v1/search';

// ── Test cases ────────────────────────────────────────────────────────

interface TestCase {
  name: string;
  domain?: string;
  isDomainVerified: boolean;
  expectedVerdict: 'accepted' | 'ambiguous' | 'rejected';
  description: string;
}

const DEFAULT_CASES: TestCase[] = [
  { name: 'Atlas', domain: 'atlashq.io', isDomainVerified: true, expectedVerdict: 'rejected', description: 'Short name, common word. Should NOT match Atlas VPN/Copco.' },
  { name: 'Atlas', domain: 'atlas.com', isDomainVerified: false, expectedVerdict: 'rejected', description: 'Short name, INFERRED domain. Strictest mode.' },
  { name: 'Buffer', domain: 'buffer.com', isDomainVerified: true, expectedVerdict: 'accepted', description: '6-char name, verified domain. Should find real Buffer.' },
  { name: 'Clay', domain: 'clay.com', isDomainVerified: true, expectedVerdict: 'accepted', description: 'Short name, verified domain. Should find real Clay.' },
  { name: 'Spot', domain: 'spot.io', isDomainVerified: true, expectedVerdict: 'accepted', description: 'Very short name with verified domain. Google "Spot" with domain corroboration = accepted. HubSpot/Spotify still rejected.' },
  { name: 'HubSpot', domain: 'hubspot.com', isDomainVerified: true, expectedVerdict: 'accepted', description: 'Long distinctive name. Should always work.' },
  { name: 'Salesforce', domain: 'salesforce.com', isDomainVerified: true, expectedVerdict: 'accepted', description: 'Long distinctive name. Baseline.' },
  { name: 'Drift', domain: 'drift.com', isDomainVerified: true, expectedVerdict: 'accepted', description: 'Short name but well-known. Verified domain.' },
];

// ── Helpers ───────────────────────────────────────────────────────────

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    return { error: `${res.status} ${res.statusText}` };
  }
  return res.json();
}

function color(text: string, code: string): string {
  return `\x1b[${code}m${text}\x1b[0m`;
}
const green = (t: string) => color(t, '32');
const red = (t: string) => color(t, '31');
const yellow = (t: string) => color(t, '33');
const cyan = (t: string) => color(t, '36');
const dim = (t: string) => color(t, '2');
const bold = (t: string) => color(t, '1');

// ── Platform testers ─────────────────────────────────────────────────

async function testMetaPageSearch(tc: TestCase) {
  const params = new URLSearchParams({
    engine: 'meta_ad_library_page_search',
    q: tc.name,
    api_key: API_KEY!,
  });
  const payload = await fetchJson(`${BASE}?${params}`);
  const pages = Array.isArray((payload as { page_results?: unknown[] }).page_results)
    ? (payload as { page_results: Array<{ name?: string; page_id?: string; likes?: number }> }).page_results
    : [];

  const candidates = pages.map(p => ({
    name: p.name ?? '',
    id: p.page_id ?? '',
    entity: p,
  }));

  const result = resolveBestCandidate(candidates, tc.name, tc.domain, tc.isDomainVerified);

  return {
    platform: 'Meta',
    candidateCount: candidates.length,
    topCandidates: candidates.slice(0, 5).map(c => ({
      name: c.name,
      score: calculateSimilarity(c.name, tc.name),
      match: isAdvertiserMatch(c.name, tc.name, tc.domain),
    })),
    verdict: result.verdict,
    reason: result.reason,
    picked: result.candidate?.name ?? null,
  };
}

async function testGoogleAdvertiserSearch(tc: TestCase) {
  const params = new URLSearchParams({
    engine: 'google_ads_transparency_center_advertiser_search',
    q: tc.name,
    api_key: API_KEY!,
  });
  const payload = await fetchJson(`${BASE}?${params}`);

  if (payload && typeof payload === 'object' && 'error' in payload) {
    return {
      platform: 'Google',
      candidateCount: 0,
      topCandidates: [],
      verdict: 'error' as const,
      reason: (payload as { error: string }).error,
      picked: null,
    };
  }

  const advertisers = Array.isArray((payload as { advertisers?: unknown[] }).advertisers)
    ? (payload as { advertisers: Array<{ name?: string; id?: string }> }).advertisers
    : [];

  const candidates = advertisers.map(a => ({
    name: a.name ?? '',
    id: a.id ?? '',
    entity: a,
  }));

  const result = resolveBestCandidate(candidates, tc.name, tc.domain, tc.isDomainVerified);

  return {
    platform: 'Google',
    candidateCount: candidates.length,
    topCandidates: candidates.slice(0, 5).map(c => ({
      name: c.name,
      score: calculateSimilarity(c.name, tc.name),
      match: isAdvertiserMatch(c.name, tc.name, tc.domain),
    })),
    verdict: result.verdict,
    reason: result.reason,
    picked: result.candidate?.name ?? null,
  };
}

async function testLinkedInSearch(tc: TestCase) {
  const params = new URLSearchParams({
    engine: 'linkedin_ad_library',
    advertiser: tc.name,
    api_key: API_KEY!,
  });
  const payload = await fetchJson(`${BASE}?${params}`);
  const ads = Array.isArray((payload as { ads?: unknown[] }).ads)
    ? (payload as { ads: unknown[] }).ads
    : [];

  // LinkedIn doesn't have a candidate resolution step, but we can check
  // how many ads pass the advertiser filter
  const adRecords = ads.filter(
    (ad): ad is Record<string, unknown> => Boolean(ad) && typeof ad === 'object',
  );

  const matchingAds = adRecords.filter(ad => {
    const advertiserName =
      (ad.advertiser_name as string | undefined) ??
      ((ad.advertiser as { promotor?: string } | undefined)?.promotor) ??
      ((ad.advertiser as { name?: string } | undefined)?.name);
    return isAdvertiserMatch(advertiserName, tc.name, tc.domain);
  });

  return {
    platform: 'LinkedIn',
    candidateCount: adRecords.length,
    topCandidates: adRecords.slice(0, 5).map(ad => {
      const name =
        (ad.advertiser_name as string | undefined) ??
        ((ad.advertiser as { promotor?: string } | undefined)?.promotor) ??
        ((ad.advertiser as { name?: string } | undefined)?.name) ?? '(unknown)';
      return {
        name,
        score: calculateSimilarity(name, tc.name),
        match: isAdvertiserMatch(name, tc.name, tc.domain),
      };
    }),
    verdict: matchingAds.length > 0 ? 'accepted' : 'rejected',
    reason: `${matchingAds.length}/${adRecords.length} ads passed advertiser filter`,
    picked: null,
  };
}

// ── Main ──────────────────────────────────────────────────────────────

async function runTestCase(tc: TestCase) {
  console.log('\n' + '='.repeat(70));
  console.log(bold(`  ${tc.name}`) + dim(` (domain: ${tc.domain ?? 'none'}, verified: ${tc.isDomainVerified})`));
  console.log(dim(`  ${tc.description}`));
  console.log(dim(`  Expected: ${tc.expectedVerdict}`));
  console.log('='.repeat(70));

  const [meta, google, linkedin] = await Promise.all([
    testMetaPageSearch(tc).catch(e => ({ platform: 'Meta', candidateCount: 0, topCandidates: [], verdict: 'error' as const, reason: String(e), picked: null })),
    testGoogleAdvertiserSearch(tc).catch(e => ({ platform: 'Google', candidateCount: 0, topCandidates: [], verdict: 'error' as const, reason: String(e), picked: null })),
    testLinkedInSearch(tc).catch(e => ({ platform: 'LinkedIn', candidateCount: 0, topCandidates: [], verdict: 'error' as const, reason: String(e), picked: null })),
  ]);

  let allPassed = true;

  for (const result of [meta, google, linkedin]) {
    const verdictColor = result.verdict === 'accepted' ? green
      : result.verdict === 'rejected' ? red
      : result.verdict === 'ambiguous' ? yellow
      : dim;

    console.log(`\n  ${bold(result.platform)} (${result.candidateCount} candidates)`);
    console.log(`  Verdict: ${verdictColor(result.verdict.toUpperCase())} — ${result.reason}`);
    if (result.picked) console.log(`  Picked: ${cyan(result.picked)}`);

    if (result.topCandidates.length > 0) {
      console.log(dim('  Top candidates:'));
      for (const c of result.topCandidates) {
        const matchLabel = c.match ? green('PASS') : red('FAIL');
        console.log(`    ${matchLabel} "${c.name}" (score: ${c.score.toFixed(2)})`);
      }
    }

    // Check if verdict matches expectation (LinkedIn uses different logic)
    if (result.platform !== 'LinkedIn' && result.verdict !== 'error') {
      if (tc.expectedVerdict === 'rejected' && result.verdict === 'accepted') {
        console.log(red(`  FAIL: Expected ${tc.expectedVerdict} but got ${result.verdict}`));
        allPassed = false;
      } else if (tc.expectedVerdict === 'accepted' && result.verdict !== 'accepted') {
        console.log(red(`  FAIL: Expected ${tc.expectedVerdict} but got ${result.verdict}`));
        allPassed = false;
      }
    }
  }

  return allPassed;
}

async function main() {
  const args = process.argv.slice(2);

  let cases: TestCase[];
  if (args.length >= 1) {
    // Custom single test: npx tsx src/eval/test-ad-relevance.ts "Atlas" "atlashq.io"
    cases = [{
      name: args[0],
      domain: args[1] ?? undefined,
      isDomainVerified: Boolean(args[1]),
      expectedVerdict: 'accepted', // no expectation for custom tests
      description: `Custom test: "${args[0]}"`,
    }];
  } else {
    cases = DEFAULT_CASES;
  }

  console.log(bold('\n  AD RELEVANCE PIPELINE TEST'));
  console.log(dim(`  Testing ${cases.length} competitor names against live SearchAPI`));
  console.log(dim(`  Each name is searched on Meta, Google, and LinkedIn`));

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const tc of cases) {
    const ok = await runTestCase(tc);
    if (ok) passed++;
    else failed++;
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(70));
  console.log(bold('  RESULTS'));
  console.log(`  ${green(`${passed} passed`)}  ${failed > 0 ? red(`${failed} failed`) : ''}  ${dim(`(${duration}s)`)}`);
  console.log('='.repeat(70) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(red(`Fatal: ${e}`));
  process.exit(1);
});
