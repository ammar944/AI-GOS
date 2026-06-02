/**
 * foreplay-probe.ts — BOUNDED live sandbox probe for the Foreplay ad API (v2).
 *
 * Settles Phase 4.2's decision: is FOREPLAY_API_KEY funded, and does Foreplay
 * return DISPLAYABLE media (durable CDN URLs) vs SIGNAL-ONLY data? Also checks
 * whether ad_library_id looks like a Meta ad_archive_id (dedup tier-1 join).
 *
 * v2: uses DIRECT raw fetches (exactly 1 per domain, NO retry, NO variant loop)
 * so the call count is exact and we don't burn budget on excluded domains /
 * retries (v1 discovered notion.so is on Foreplay's excluded-domain list).
 *
 * THROWAWAY diagnostic. Real (paid) calls, HARD-capped at MAX_FOREPLAY_REQUESTS.
 * Prints NO secret values — only Boolean key presence + URL hosts. DO NOT COMMIT.
 *
 * Run (from worktree root):  npx tsx scripts/foreplay-probe.ts
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local', override: false });

const CAP = Number(process.env.MAX_FOREPLAY_REQUESTS ?? '8');
const BASE = 'https://public.api.foreplay.co';
const TIMEOUT_MS = 12_000;
let reqCount = 0;

class BudgetExceededError extends Error {
  constructor() {
    super(`HARD CAP hit: ${CAP} Foreplay requests reached.`);
    this.name = 'BudgetExceededError';
  }
}

type Json = Record<string, unknown>;

async function rawGet(path: string, params: Record<string, string>, key: string, label: string): Promise<{ status: number; body: Json }> {
  if (reqCount >= CAP) throw new BudgetExceededError();
  reqCount += 1;
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  console.log(`[BUDGET] req ${reqCount}/${CAP} -> ${path} (${label})`);
  let status = 0;
  let body: Json = {};
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: key, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = res.status;
    try {
      body = (await res.json()) as Json;
    } catch {
      body = {};
    }
  } catch (e) {
    console.log(`  fetch error: ${e instanceof Error ? e.name : String(e)}`);
  }
  return { status, body };
}

function host(u?: unknown): string {
  if (typeof u !== 'string' || !u) return '∅';
  try {
    return new URL(u).host;
  } catch {
    return '(unparseable)';
  }
}
function looksSigned(u?: unknown): boolean {
  return typeof u === 'string' && /[?&](oe|oh|_nc_|_nc_sid|_nc_ohc|ccb|stp|efg|Expires|Signature|X-Amz)=/.test(u);
}
function looksLikeMetaArchiveId(id?: unknown): boolean {
  return typeof id === 'string' && /^\d{8,}$/.test(id);
}
function asArray(body: Json): Json[] {
  const d = body.data;
  if (Array.isArray(d)) return d as Json[];
  if (Array.isArray(body)) return body as unknown as Json[];
  return [];
}

// Real brands likely indexed by Foreplay (107M ads); airtable.com was the QA-run brand.
const DOMAINS = ['airtable.com', 'clickup.com', 'monday.com', 'asana.com', 'hubspot.com', 'gong.io'];

interface Decision {
  funded: boolean;
  displayable: boolean;
  signed: boolean;
  video: boolean;
  transcript: boolean;
  metaJoin: boolean;
}

async function main(): Promise<void> {
  console.log('=== foreplay-probe v2 ===');
  const key = process.env.FOREPLAY_API_KEY;
  console.log('FOREPLAY_API_KEY present:', Boolean(key));
  console.log('ENABLE_FOREPLAY:', process.env.ENABLE_FOREPLAY ?? '(unset)');
  console.log(`Hard request cap: ${CAP}`);
  if (!key) {
    console.error('No key. Decision: SIGNAL-ONLY (no key).');
    return;
  }

  const decision: Decision = { funded: false, displayable: false, signed: false, video: false, transcript: false, metaJoin: false };
  let probedBrand = false;

  try {
    for (const domain of DOMAINS) {
      if (reqCount >= CAP) break;
      const b = await rawGet('/api/brand/getBrandsByDomain', { domain, limit: '10', order: 'most_ranked' }, key, `brand:${domain}`);
      if (b.status === 401 || b.status === 402 || b.status === 403) {
        console.log(`  ${domain}: HTTP ${b.status} -> AUTH/CREDIT failure. ${b.status === 402 ? 'NO CREDITS.' : 'key invalid/forbidden.'}`);
        break; // auth/credit failure is global; stop.
      }
      if (b.status === 400) {
        const err = (b.body.error as Json | undefined)?.reason ?? (b.body.error as Json | undefined)?.message;
        console.log(`  ${domain}: HTTP 400 (${String(err ?? 'bad request')}) — skipping.`);
        continue;
      }
      const brands = asArray(b.body);
      const brand = brands[0];
      const brandId = (brand?.id ?? brand?.brand_id) as string | undefined;
      console.log(`  ${domain}: HTTP ${b.status}, brands=${brands.length}, brandId=${brandId ?? '∅'}, name="${(brand?.name as string) ?? '∅'}"`);
      if (!brandId) continue;

      if (reqCount >= CAP) {
        console.log('  [BUDGET] no room for ads fetch.');
        break;
      }
      const a = await rawGet('/api/brand/getAdsByBrandId', { brand_ids: brandId, limit: '6', order: 'newest' }, key, `ads:${domain}`);
      const ads = asArray(a.body);
      console.log(`  ${domain}: ads HTTP ${a.status}, count=${ads.length}`);
      probedBrand = true;
      if (ads.length > 0) decision.funded = true;
      ads.slice(0, 6).forEach((ad, i) => {
        const url = ad.video ?? ad.image ?? ad.video_url ?? ad.image_url ?? ad.media_url;
        const thumb = ad.thumbnail ?? ad.image ?? ad.image_url;
        const transcript = (ad.full_transcription ?? ad.transcript ?? ad.video_transcript) as string | undefined;
        const fmt = (ad.display_format ?? ad.type) as string | undefined;
        const libId = (ad.ad_library_id ?? ad.ad_id ?? ad.id) as string | undefined;
        const signed = looksSigned(url) || looksSigned(thumb);
        const isVid = fmt?.toLowerCase().includes('video') || !!ad.video || !!ad.video_url;
        if (typeof url === 'string' && url && !signed) decision.displayable = true;
        if (signed) decision.signed = true;
        if (isVid) decision.video = true;
        if (transcript && transcript.trim().length > 0) decision.transcript = true;
        if (looksLikeMetaArchiveId(libId)) decision.metaJoin = true;
        console.log(
          `    ad[${i}] libId=${libId ?? '∅'} (metaJoin=${looksLikeMetaArchiveId(libId)}) fmt=${fmt ?? '∅'}` +
            ` url.host=${host(url)} thumb.host=${host(thumb)} signed=${signed}` +
            ` transcript=${transcript ? `${transcript.length}ch` : 'no'} cta=${ad.cta ?? ad.call_to_action ? 'yes' : 'no'}`,
        );
      });
      if (decision.funded) break; // one good brand is enough to decide.
    }
  } catch (e) {
    console.log(e instanceof BudgetExceededError ? '\n[BUDGET] hard cap stop.' : `\nerror: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.log(`\n=== DONE. requests used: ${reqCount}/${CAP} ===`);
  console.log('================ FOREPLAY DECISION ================');
  console.log(`Key present: ${Boolean(key)} | API reached a brand lookup: ${probedBrand || reqCount > 0}`);
  console.log(`Funded (≥1 ad for a real brand): ${decision.funded ? 'YES' : 'NO'}`);
  console.log(`Displayable (durable non-signed media URL): ${decision.displayable ? 'YES' : 'NO'}`);
  console.log(`Signed/expiring URLs: ${decision.signed ? 'present' : 'no'}`);
  console.log(`Video: ${decision.video ? 'YES' : 'no'} | Transcript: ${decision.transcript ? 'YES' : 'no'}`);
  console.log(`ad_library_id ≈ Meta ad_archive_id (dedup tier-1 join): ${decision.metaJoin ? 'YES' : 'NO'}`);
  console.log('--------------------------------------------------');
  if (!decision.funded) {
    console.log('VERDICT: no displayable ads obtained -> implement Foreplay SIGNAL-ONLY (themes/transcript), skip media/proxy. (Confirm at live E2E.)');
  } else if (decision.displayable) {
    console.log('VERDICT: DISPLAYABLE -> Phase 4.2 wires Foreplay creatives w/ media URLs + image-proxy + link-out fallback.');
  } else {
    console.log('VERDICT: SIGNAL-ONLY (no durable media) -> themes/transcript signal only; skip media/proxy.');
  }
  console.log('==================================================');
}

void main();
