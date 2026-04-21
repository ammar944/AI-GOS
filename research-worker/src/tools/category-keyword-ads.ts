/**
 * Category keyword ad sweep — unanchored, advertiser-agnostic.
 *
 * Origin: Ammar + Mahdy 2026-04-21 — the existing per-competitor probe
 * (keyword-ad-probe.ts) is domain-anchored, so it only surfaces ads whose
 * landing page is on a known competitor's domain. This leaves the user
 * missing the long tail of advertisers bidding on category terms (lovable,
 * aura.build, 10web, etc.) who never show up inside the fixed 5-competitor
 * slots.
 *
 * This tool fans the category's top coreKeywords out across two sources
 * and returns every ad it finds without a domain filter:
 *
 *   1. Meta Ad Library — page_search by keyword, then pull ads from the
 *      top matched pages per keyword. Surfaces advertisers whose Page name
 *      / handle matches the term.
 *   2. Google SERP — ad slot scrape via SearchAPI for the keyword.
 *      Surfaces whoever is actively bidding on the exact category term.
 *
 * Output is a single flat `CategoryKeywordAd[]` deduped by (advertiser,
 * headline) and capped at MAX_ADS so the Competitor Intel card stays
 * scannable.
 */

const SEARCHAPI_BASE = 'https://www.searchapi.io/api/v1/search';
const FETCH_TIMEOUT_MS = 10_000;

const MAX_KEYWORDS = 8;
const MAX_PAGES_PER_KEYWORD = 2;
const MAX_ADS = 25;

export type CategoryAdSource = 'meta' | 'google';

export interface CategoryKeywordAd {
  source: CategoryAdSource;
  keyword: string;
  advertiser: string;
  headline: string;
  body: string;
  landingPage: string | null;
  imageUrl: string | null;
  detailsUrl: string | null;
}

export interface CategoryKeywordAdResult {
  keywordsProbed: string[];
  ads: CategoryKeywordAd[];
  sources: { meta: number; google: number };
  error?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SearchAPI ${res.status}: ${body.slice(0, 160)}`);
  }
  return res.json();
}

async function fetchGoogleSerpAdsForKeyword(
  keyword: string,
  apiKey: string,
): Promise<CategoryKeywordAd[]> {
  const params = new URLSearchParams({ engine: 'google', q: keyword, api_key: apiKey });
  let payload: unknown;
  try {
    payload = await fetchJson(`${SEARCHAPI_BASE}?${params.toString()}`);
  } catch (err) {
    console.warn(
      `[category-keyword-ads] google "${keyword}": ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
  const rawAds = Array.isArray((payload as { ads?: unknown[] }).ads)
    ? ((payload as { ads: unknown[] }).ads as Array<Record<string, unknown>>)
    : [];

  const result: CategoryKeywordAd[] = [];
  for (const ad of rawAds) {
    const headline = firstString(ad.title) ?? '';
    const body =
      firstString(ad.description, ad.snippet, ad.extensions) ?? '';
    const link = firstString(ad.link, ad.url, ad.displayed_link, ad.tracking_link);
    const advertiser =
      firstString(ad.source, ad.displayed_link, ad.domain) ??
      (() => {
        try {
          return link ? new URL(link).hostname.replace(/^www\./, '') : '';
        } catch {
          return '';
        }
      })();
    if (!headline && !body) continue;
    if (!advertiser) continue;
    result.push({
      source: 'google',
      keyword,
      advertiser,
      headline: headline.slice(0, 160),
      body: body.slice(0, 300),
      landingPage: link,
      imageUrl: null,
      detailsUrl: null,
    });
  }
  return result;
}

async function fetchMetaAdsForKeyword(
  keyword: string,
  apiKey: string,
): Promise<CategoryKeywordAd[]> {
  // Step 1 — keyword → matching Pages.
  const pageParams = new URLSearchParams({
    engine: 'meta_ad_library_page_search',
    q: keyword,
    api_key: apiKey,
  });
  let pagePayload: unknown;
  try {
    pagePayload = await fetchJson(`${SEARCHAPI_BASE}?${pageParams.toString()}`);
  } catch (err) {
    console.warn(
      `[category-keyword-ads] meta page search "${keyword}": ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
  const pages = Array.isArray((pagePayload as { page_results?: unknown[] }).page_results)
    ? ((pagePayload as { page_results: unknown[] }).page_results as Array<{
        name?: string;
        page_id?: string;
      }>)
    : [];
  const topPages = pages.slice(0, MAX_PAGES_PER_KEYWORD);
  if (topPages.length === 0) return [];

  const out: CategoryKeywordAd[] = [];
  await Promise.allSettled(
    topPages.map(async (page) => {
      if (!page.page_id) return;
      const adParams = new URLSearchParams({
        engine: 'meta_ad_library',
        page_id: page.page_id,
        active_status: 'all',
        api_key: apiKey,
      });
      let adPayload: unknown;
      try {
        adPayload = await fetchJson(`${SEARCHAPI_BASE}?${adParams.toString()}`);
      } catch (err) {
        console.warn(
          `[category-keyword-ads] meta ads for page_id=${page.page_id} (kw="${keyword}"): ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
      }
      const ads = Array.isArray((adPayload as { ads?: unknown[] }).ads)
        ? ((adPayload as { ads: unknown[] }).ads as Array<Record<string, unknown>>)
        : [];
      for (const ad of ads.slice(0, 6)) {
        const snapshot = (ad.snapshot ?? {}) as Record<string, unknown>;
        const body = firstString(
          (snapshot as { body?: { text?: string } }).body?.text,
          (ad as { ad_creative_bodies?: string[] }).ad_creative_bodies?.[0],
        );
        const headline = firstString(
          (snapshot as { title?: string }).title,
          (ad as { ad_creative_link_titles?: string[] }).ad_creative_link_titles?.[0],
          (snapshot as { link_description?: string }).link_description,
        );
        if (!headline && !body) continue;
        const imageCandidate =
          (snapshot as {
            images?: Array<{ original_image_url?: string; resized_image_url?: string }>;
          }).images?.[0];
        const imageUrl =
          firstString(imageCandidate?.original_image_url, imageCandidate?.resized_image_url) ??
          null;
        const landingPage = firstString(
          (snapshot as { link_url?: string }).link_url,
          (ad as { link?: string }).link,
        );
        const detailsUrl = ad.ad_archive_id
          ? `https://www.facebook.com/ads/library/?id=${String(ad.ad_archive_id)}`
          : null;
        out.push({
          source: 'meta',
          keyword,
          advertiser: page.name?.trim() || 'Unknown advertiser',
          headline: (headline ?? '').slice(0, 160),
          body: stripHtml(body ?? '').slice(0, 300),
          landingPage,
          imageUrl,
          detailsUrl,
        });
      }
    }),
  );
  return out;
}

export async function fetchCategoryKeywordAds(params: {
  keywords: string[];
}): Promise<CategoryKeywordAdResult> {
  const apiKey = process.env.SEARCHAPI_KEY;
  const cleaned = params.keywords
    .map((k) => (typeof k === 'string' ? k.trim() : ''))
    .filter((k) => k.length > 0);
  const keywords = Array.from(new Set(cleaned)).slice(0, MAX_KEYWORDS);

  const base: CategoryKeywordAdResult = {
    keywordsProbed: keywords,
    ads: [],
    sources: { meta: 0, google: 0 },
  };

  if (!apiKey) return { ...base, error: 'SEARCHAPI_KEY not configured' };
  if (keywords.length === 0) return { ...base, error: 'No category keywords to probe' };

  const [googleBatches, metaBatches] = await Promise.all([
    Promise.all(keywords.map((k) => fetchGoogleSerpAdsForKeyword(k, apiKey))),
    Promise.all(keywords.map((k) => fetchMetaAdsForKeyword(k, apiKey))),
  ]);

  const all: CategoryKeywordAd[] = [...googleBatches.flat(), ...metaBatches.flat()];

  const seen = new Set<string>();
  const deduped: CategoryKeywordAd[] = [];
  for (const ad of all) {
    const key = `${ad.advertiser.toLowerCase()}|${ad.headline.toLowerCase().slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ad);
    if (deduped.length >= MAX_ADS) break;
  }

  return {
    keywordsProbed: keywords,
    ads: deduped,
    sources: {
      meta: deduped.filter((a) => a.source === 'meta').length,
      google: deduped.filter((a) => a.source === 'google').length,
    },
  };
}
