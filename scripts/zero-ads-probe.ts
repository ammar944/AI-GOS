/**
 * zero-ads-probe.ts — BOUNDED live sandbox probe to settle the 0-ads cause.
 *
 * READ-ONLY diagnostic. Makes real (paid) SearchAPI calls, HARD-capped at
 * MAX_SEARCHAPI_REQUESTS total. No loop runs without the abort condition.
 * Prints NO secret values — only Boolean presence of keys.
 *
 * Run (from worktree root):
 *   node_modules/.bin/tsx --env-file=.env.local scripts/zero-ads-probe.ts
 * or, if tsx is on PATH:
 *   npx tsx --env-file=.env.local scripts/zero-ads-probe.ts
 *
 * Optional: raise the cap to also raw-replicate all 6 cells (=25 reqs):
 *   MAX_SEARCHAPI_REQUESTS=25 npx tsx --env-file=.env.local scripts/zero-ads-probe.ts
 */

// dotenv is redundant with tsx --env-file but kept as a belt-and-braces loader
// that NEVER prints values. If --env-file already populated process.env, this
// is a no-op for existing keys (override:false).
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local', override: false });

import {
  adLibraryAgentTool,
  type AdLibraryOutput,
} from '../src/lib/lab-engine/agents/tools/adlibrary';
import {
  isAdvertiserMatch,
  normalizeDomain,
  resolveBestCandidate,
} from '../src/lib/lab-engine/agents/tools/advertiser-match';

// ---------------------------------------------------------------------------
// Hard request budget — paid-API rule: no unbounded loops.
// ---------------------------------------------------------------------------
const MAX_SEARCHAPI_REQUESTS = Number(process.env.MAX_SEARCHAPI_REQUESTS ?? '24');
let searchApiRequestCount = 0;

class BudgetExceededError extends Error {
  constructor() {
    super(`HARD CAP hit: ${MAX_SEARCHAPI_REQUESTS} SearchAPI requests reached. Aborting.`);
    this.name = 'BudgetExceededError';
  }
}

/** Reserve one request slot or abort. Call IMMEDIATELY before every fetch. */
function reserveRequest(label: string): void {
  if (searchApiRequestCount >= MAX_SEARCHAPI_REQUESTS) {
    console.error(`\n[BUDGET] Refusing request (${label}) — cap ${MAX_SEARCHAPI_REQUESTS} reached.`);
    throw new BudgetExceededError();
  }
  searchApiRequestCount += 1;
  console.log(`[BUDGET] request ${searchApiRequestCount}/${MAX_SEARCHAPI_REQUESTS} — ${label}`);
}

const SEARCH_API_BASE = 'https://www.searchapi.io/api/v1/search';
const REGION = 'US';
const FETCH_TIMEOUT_MS = 15_000;

type Json = Record<string, unknown>;

function asRecord(v: unknown): Json | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Json) : null;
}
function getArray(rec: Json | null, key: string): unknown[] {
  const v = rec?.[key];
  return Array.isArray(v) ? v : [];
}
function getRecordArray(rec: Json | null, key: string): Json[] {
  return getArray(rec, key).flatMap((i) => {
    const r = asRecord(i);
    return r === null ? [] : [r];
  });
}
function firstString(values: readonly unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/** Raw SearchAPI GET. Reserves a budget slot first. Returns {status, body}. */
async function rawSearchApi(
  params: Record<string, string>,
  apiKey: string,
  label: string,
): Promise<{ status: number; body: Json }> {
  reserveRequest(label);
  const qs = new URLSearchParams({ ...params, api_key: apiKey });
  // NOTE: api_key is in the query string but is NEVER logged — we log params
  // WITHOUT the key below.
  const safeParams = { ...params };
  console.log(`  -> GET engine=${params.engine} params=${JSON.stringify(safeParams)}`);
  const res = await fetch(`${SEARCH_API_BASE}?${qs.toString()}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  let body: Json = {};
  try {
    body = asRecord(await res.json()) ?? {};
  } catch {
    body = {};
  }
  console.log(`  <- HTTP ${res.status}${res.ok ? '' : ' (NON-OK)'}`);
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Raw replication of the lab engine's two-step fetch, with full logging.
// Mirrors src/lib/lab-engine/agents/tools/adlibrary.ts searchGoogleAds /
// searchMetaAds (engine names, param keys, response keys) EXACTLY.
// ---------------------------------------------------------------------------
interface Candidate { id: string; name: string; }

function readCandidates(payload: Json, collectionKey: string, idKeys: readonly string[]): Candidate[] {
  return getRecordArray(payload, collectionKey).flatMap((c) => {
    const id = firstString(idKeys.map((k) => c[k]));
    const name = firstString([c.name, c.advertiser_name, c.page_name]);
    return id === undefined || name === undefined ? [] : [{ id, name }];
  });
}

async function rawReplicate(
  advertiser: string,
  domain: string,
  platform: 'google' | 'meta',
  apiKey: string,
): Promise<void> {
  console.log(`\n--- RAW REPLICATE [${advertiser} / ${platform}] domain=${domain} ---`);
  const normDomain = normalizeDomain(domain);

  // Step 1: candidate search
  const candStep =
    platform === 'google'
      ? await rawSearchApi(
          { engine: 'google_ads_transparency_center_advertiser_search', q: advertiser, region: REGION },
          apiKey,
          `raw:${platform}:candidates:${advertiser}`,
        )
      : await rawSearchApi(
          { engine: 'meta_ad_library_page_search', q: advertiser },
          apiKey,
          `raw:${platform}:candidates:${advertiser}`,
        );

  if (!isOk(candStep.status)) {
    console.log(`  RESULT: candidate fetch NON-OK (HTTP ${candStep.status}). See interpretation table: key-invalid (401/403) vs rate-limit (429) vs server (5xx).`);
    return;
  }

  const candidates =
    platform === 'google'
      ? readCandidates(candStep.body, 'advertisers', ['id', 'advertiser_id'])
      : readCandidates(candStep.body, 'page_results', ['page_id', 'id']);

  console.log(`  candidates (${candidates.length}):`, candidates.map((c) => `${c.name} [${c.id}]`));

  // resolveBestCandidate is called by the lab with isDomainVerified = (domain !== undefined) = true here.
  const verdict = resolveBestCandidate(candidates, advertiser, normDomain, true);
  console.log(`  verdict: ${verdict.verdict} — ${verdict.reason}`);
  if (verdict.candidates) {
    console.log('  scored:', verdict.candidates.map((c) => `${c.name} score=${c.score.toFixed(2)} domMatch=${c.domainMatch}`));
  }

  if (verdict.verdict === 'rejected' || verdict.candidate === undefined) {
    console.log('  RESULT: NO CANDIDATE accepted -> lab throws NoMatchedAdvertiserError -> not_implemented gap. Cause = no-candidate.');
    return;
  }

  // Step 2: ads fetch by id
  const adsStep =
    platform === 'google'
      ? await rawSearchApi(
          { engine: 'google_ads_transparency_center', advertiser_id: verdict.candidate.id, region: REGION },
          apiKey,
          `raw:${platform}:ads:${advertiser}`,
        )
      : await rawSearchApi(
          { engine: 'meta_ad_library', page_id: verdict.candidate.id, active_status: 'all' },
          apiKey,
          `raw:${platform}:ads:${advertiser}`,
        );

  if (!isOk(adsStep.status)) {
    console.log(`  RESULT: ads fetch NON-OK (HTTP ${adsStep.status}).`);
    return;
  }

  const rawRows =
    platform === 'google'
      ? getRecordArray(adsStep.body, 'ad_creatives')
      : getRecordArray(adsStep.body, 'ads');
  console.log(`  raw rows PRE-FILTER: ${rawRows.length}`);

  // Replicate the two lab post-filters separately to localize over-filtering.
  // Filter A: isAdvertiserMatch on a best-effort advertiser-name + URL guess.
  let survivedAdvertiserMatch = 0;
  let survivedUsableText = 0;
  for (const row of rawRows) {
    const advName = firstString([
      row.advertiser_name,
      row.page_name,
      asRecord(row.snapshot)?.page_name,
      asRecord(row.advertiser)?.promotor,
      asRecord(row.advertiser)?.name,
      advertiser,
    ]);
    const adUrl = firstString([
      row.details_url, row.ad_library_url, row.link,
      asRecord(row.snapshot)?.link_url, row.landing_url,
    ]);
    const passA = isAdvertiserMatch(advName, advertiser, normDomain, adUrl);
    if (passA) {
      survivedAdvertiserMatch += 1;
      const text = firstString([
        row.headline, row.title, row.description,
        typeof row.body === 'string' ? row.body : asRecord(row.body)?.text,
        row.text,
      ]);
      const hasTemplate = /\{\{[^}]+\}\}/.test(text ?? '') || /\{\{[^}]+\}\}/.test(advName ?? '');
      if (!hasTemplate) survivedUsableText += 1;
    }
  }
  console.log(`  survived isAdvertiserMatch: ${survivedAdvertiserMatch}/${rawRows.length}`);
  console.log(`  survived +hasUsableCreativeText: ${survivedUsableText}/${rawRows.length}`);
  if (rawRows.length > 0 && survivedUsableText === 0) {
    console.log('  RESULT: rows fetched but ALL filtered out. Cause = over-filter (advertiser-match/template).');
  } else if (rawRows.length === 0) {
    console.log('  RESULT: candidate accepted but ads endpoint returned 0 rows. Cause = candidate-but-no-ads (true empty at source for this advertiser_id/page_id).');
  } else {
    console.log(`  RESULT: ${survivedUsableText} ad(s) would survive. Engine path is HEALTHY for this cell.`);
  }
}

function isOk(status: number): boolean {
  return status >= 200 && status < 300;
}

// ---------------------------------------------------------------------------
// Production-truth check via the actual lab tool execute().
// Each call internally makes 2 SearchAPI fetches (candidate + ads). We must
// reserve those 2 slots BEFORE calling, because execute() bypasses our
// rawSearchApi() counter (it uses the lab's own fetchWithRetry).
// ---------------------------------------------------------------------------
async function runExecute(
  advertiser: string,
  domain: string,
  platform: 'google' | 'meta',
): Promise<AdLibraryOutput> {
  // Reserve the 2 internal fetches up front so the global cap stays honest.
  reserveRequest(`execute:${platform}:candidate:${advertiser}`);
  reserveRequest(`execute:${platform}:ads:${advertiser}`);
  const controller = new AbortController();
  const out = (await adLibraryAgentTool.execute!(
    { advertiser, platform, max_results: 8, domain },
    { abortSignal: controller.signal, toolCallId: 'probe', messages: [] } as never,
  )) as AdLibraryOutput;
  if (out.type === 'result') {
    console.log(`  execute() -> result: ${out.ads.length} ad(s) for ${advertiser}/${platform}`);
  } else {
    console.log(`  execute() -> GAP reason=${out.reason} msg="${out.message}"`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const ADVERTISERS: Array<{ name: string; domain: string }> = [
  { name: 'Notion', domain: 'notion.so' },
  { name: 'ClickUp', domain: 'clickup.com' },
  { name: 'Asana', domain: 'asana.com' },
];
const PLATFORMS: Array<'google' | 'meta'> = ['google', 'meta'];

async function main(): Promise<void> {
  console.log('=== zero-ads-probe ===');
  console.log('SEARCHAPI_KEY present:', Boolean(process.env.SEARCHAPI_KEY));
  console.log('FOREPLAY_API_KEY present:', Boolean(process.env.FOREPLAY_API_KEY));
  console.log(`Hard request cap: ${MAX_SEARCHAPI_REQUESTS}`);

  const apiKey = process.env.SEARCHAPI_KEY;
  if (apiKey === undefined || apiKey.trim() === '') {
    console.error('\nSEARCHAPI_KEY missing/empty. Cause = key-invalid/absent. The lab tool returns a missing_credential gap and never fetches. Stopping.');
    return;
  }

  try {
    // (1) LinkedIn engine existence probe — request #1.
    console.log('\n--- LINKEDIN ENGINE PROBE (raw) ---');
    const li = await rawSearchApi(
      { engine: 'linkedin_ad_library', advertiser: 'Notion' },
      apiKey,
      'raw:linkedin:Notion',
    );
    if (isOk(li.status)) {
      const liAds = getArray(li.body, 'ads');
      const hasError = 'error' in li.body;
      console.log(`  linkedin_ad_library: HTTP 200, ads=${liAds.length}, errorField=${hasError}`);
      console.log('  RESULT: LinkedIn engine EXISTS and is reachable via advertiser= param.');
    } else {
      console.log(`  RESULT: linkedin_ad_library HTTP ${li.status} — engine unavailable/forbidden on this plan, OR rate-limited.`);
    }

    // (2) Production-truth execute() for all 6 cells (2 reqs each = 12 -> total 13).
    const cellOutcomes: Array<{ advertiser: string; domain: string; platform: 'google' | 'meta'; gap: boolean; empty: boolean }> = [];
    for (const { name, domain } of ADVERTISERS) {
      for (const platform of PLATFORMS) {
        console.log(`\n--- EXECUTE [${name} / ${platform}] domain=${domain} ---`);
        const out = await runExecute(name, domain, platform);
        const gap = out.type !== 'result';
        const empty = out.type === 'result' && out.ads.length === 0;
        cellOutcomes.push({ advertiser: name, domain, platform, gap, empty });
      }
    }

    // (3) Raw-replicate cells in PRIORITY order (gap/empty first — those are the
    //     ones we most need to diagnose) until the remaining budget is spent.
    //     The hard counter aborts deterministically; <=24 guaranteed.
    const priority = [...cellOutcomes].sort(
      (a, b) => Number(b.gap || b.empty) - Number(a.gap || a.empty),
    );
    console.log('\n=== RAW REPLICATION (priority: gap/empty cells first) ===');
    for (const cell of priority) {
      // each raw cell needs 2 requests; stop cleanly if they would not fit.
      if (searchApiRequestCount + 2 > MAX_SEARCHAPI_REQUESTS) {
        console.log(`\n[BUDGET] Stopping raw replication — ${MAX_SEARCHAPI_REQUESTS - searchApiRequestCount} request(s) left, a cell needs 2. Remaining cells skipped (raise MAX_SEARCHAPI_REQUESTS to cover all).`);
        break;
      }
      await rawReplicate(cell.advertiser, cell.domain, cell.platform, apiKey);
    }
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      console.log('\nProbe stopped by hard budget guard (expected safety abort).');
    } else {
      console.error('\nProbe aborted by error:', err instanceof Error ? err.message : String(err));
    }
  } finally {
    console.log(`\n=== DONE. Total SearchAPI requests used: ${searchApiRequestCount}/${MAX_SEARCHAPI_REQUESTS} ===`);
    printInterpretationTable();
  }
}

function printInterpretationTable(): void {
  console.log(`\n================ INTERPRETATION TABLE (outcome -> cause) ================
A. SEARCHAPI_KEY present:false                                  -> KEY ABSENT (config). Lab returns missing_credential gap; never fetches.
B. candidate/ads fetch HTTP 401 or 403                          -> KEY INVALID/unauthorized for this engine on the plan.
C. candidate/ads fetch HTTP 429                                 -> RATE LIMITED (transient). Re-run later; not a 0-ads root cause.
D. candidate/ads fetch HTTP 5xx                                 -> SearchAPI server error (transient/provider-side).
E. candidates list EMPTY (HTTP 200, 0 candidates)              -> NO CANDIDATE. Advertiser not indexed by this engine. Lab -> not_implemented gap.
F. candidates non-empty BUT verdict=rejected                   -> NO CANDIDATE (name-match below 0.8 / wrong entity). Lab -> not_implemented gap.
G. verdict accepted/ambiguous, ads endpoint returns 0 rows     -> CANDIDATE-BUT-NO-ADS. Advertiser has no live creatives for that platform/region (true empty at source).
H. raw rows > 0 BUT survived(+usableText) == 0                 -> OVER-FILTER. isAdvertiserMatch or template/usable-text gate drops everything. Code-side fix.
I. raw rows > 0 AND survived > 0 BUT execute() returned 0/gap  -> DIVERGENCE between raw path and lab execute(): region/param/maxResults/normalizeDomain mismatch. Inspect the differing arg.
J. raw rows > 0 AND survived > 0 AND execute() returned ads    -> HEALTHY. 0-ads in production is NOT this cell; look upstream (seeding/competitor inputs, not the tool).
========================================================================`);
}

void main();
