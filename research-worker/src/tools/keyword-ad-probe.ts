/**
 * Keyword-anchored ad discovery.
 *
 * Source: Mahdy 2026-04-03 feedback — "leverage keywords to find ads when
 * name search misses". When ad-library name-search fails (short / generic
 * names, niche products), we need an alternate path to surface competitor
 * ad creatives.
 *
 * Primary path (free, deterministic): SpyFu's `getPaidSerps` endpoint
 * already returns ad copy (title + bodyHtml) attributed to the competitor
 * domain — we were paying for this data and throwing it away. This tool
 * extracts those ads from the existing SpyFu response.
 *
 * Fallback path (only if SpyFu had no ad copy on a keyword): probe Google
 * SERP via SearchAPI for that keyword, filter ad slots by competitor domain.
 */

const SEARCHAPI_BASE = 'https://www.searchapi.io/api/v1/search';
const PROBE_TIMEOUT_MS = 10_000;
const MAX_KEYWORDS_PER_COMPETITOR = 5;
const MAX_ADS_CAPTURED = 10;

export interface KeywordAd {
  keyword: string;
  headline: string;
  description: string;
  landingPage: string | null;
  source: 'spyfu' | 'serp';
}

export interface KeywordAdProbeResult {
  competitorName: string;
  domain: string;
  keywordsProbed: number;
  adsFound: KeywordAd[];
  error?: string;
}

interface SpyfuKeywordRecord {
  keyword: string;
  title?: string;
  bodyHtml?: string;
  adPosition?: number;
  landingPage?: string | null;
}

function normalizeDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase();
}

function hostnameMatches(urlOrHost: string | null | undefined, targetDomain: string): boolean {
  if (!urlOrHost || !targetDomain) return false;
  try {
    const host = urlOrHost.startsWith('http') ? new URL(urlOrHost).hostname : urlOrHost;
    const left = normalizeDomain(host);
    const right = normalizeDomain(targetDomain);
    if (!left || !right) return false;
    return left === right || left.endsWith(`.${right}`);
  } catch {
    const left = normalizeDomain(urlOrHost);
    const right = normalizeDomain(targetDomain);
    return Boolean(left) && Boolean(right) && (left === right || left.endsWith(`.${right}`));
  }
}

/**
 * Extract SpyFu paid-SERP records from the raw SpyFu keywords payload.
 *
 * SpyFu's getPaidSerps returns `{ resultCount, results: [...], totalMatchingResults }`.
 * Callers have historically passed the raw keyword payload (either the full
 * object or just the array) — we handle both shapes.
 */
export function extractSpyfuAdRecords(spyfuKeywords: unknown): SpyfuKeywordRecord[] {
  if (!spyfuKeywords) return [];

  let records: unknown[] = [];
  if (Array.isArray(spyfuKeywords)) {
    records = spyfuKeywords;
  } else if (typeof spyfuKeywords === 'object') {
    const obj = spyfuKeywords as Record<string, unknown>;
    if (Array.isArray(obj.results)) records = obj.results;
    else if (Array.isArray(obj.keywords)) records = obj.keywords;
  }

  const seenKeywords = new Set<string>();
  const out: SpyfuKeywordRecord[] = [];
  for (const raw of records) {
    if (!raw || typeof raw !== 'object') continue;
    const obj = raw as Record<string, unknown>;
    const kw =
      (typeof obj.keyword === 'string' && obj.keyword) ||
      (typeof obj.term === 'string' && obj.term) ||
      (typeof obj.query === 'string' && obj.query) ||
      null;
    if (!kw) continue;
    const trimmed = kw.trim();
    if (!trimmed || trimmed.length > 120) continue;
    const dedupeKey = trimmed.toLowerCase();
    if (seenKeywords.has(dedupeKey)) continue;
    seenKeywords.add(dedupeKey);
    out.push({
      keyword: trimmed,
      title: typeof obj.title === 'string' ? obj.title : undefined,
      bodyHtml: typeof obj.bodyHtml === 'string' ? obj.bodyHtml : undefined,
      adPosition: typeof obj.adPosition === 'number' ? obj.adPosition : undefined,
      landingPage:
        (typeof obj.landingPage === 'string' && obj.landingPage) ||
        (typeof obj.url === 'string' && obj.url) ||
        null,
    });
  }
  return out;
}

/** Convenience: just the keyword strings. */
export function extractTopKeywords(spyfuKeywords: unknown, limit: number): string[] {
  return extractSpyfuAdRecords(spyfuKeywords).slice(0, limit).map((r) => r.keyword);
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

function extractDescriptionFromBodyHtml(bodyHtml: string | undefined): string {
  if (!bodyHtml) return '';
  const stripped = stripHtml(bodyHtml);
  // Body HTML often contains navigation chrome; take the longest plain-text
  // paragraph-ish window as the most likely ad description.
  const tokens = stripped.split(/[.!?]\s/).map((s) => s.trim()).filter(Boolean);
  const longest = tokens.sort((a, b) => b.length - a.length)[0] ?? stripped;
  return longest.slice(0, 300);
}

function adLinkFromSerpResponse(ad: Record<string, unknown>): string | null {
  const candidates = [ad.link, ad.url, ad.displayed_link, ad.tracking_link];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  return null;
}

async function querySerpAds(
  keyword: string,
  apiKey: string,
): Promise<Array<Record<string, unknown>>> {
  const params = new URLSearchParams({
    engine: 'google',
    q: keyword,
    api_key: apiKey,
  });
  const res = await fetch(`${SEARCHAPI_BASE}?${params.toString()}`, {
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SERP probe ${res.status}: ${body.slice(0, 160)}`);
  }
  const payload = (await res.json()) as { ads?: unknown };
  return Array.isArray(payload.ads) ? (payload.ads as Array<Record<string, unknown>>) : [];
}

export async function probeKeywordAds(params: {
  competitorName: string;
  domain: string;
  spyfuKeywords: unknown;
  /** When false, only use SpyFu's pre-scraped ad copy (no SearchAPI calls). Default true. */
  enableSerpFallback?: boolean;
}): Promise<KeywordAdProbeResult> {
  const { competitorName, domain } = params;
  const enableSerpFallback = params.enableSerpFallback !== false;
  const baseResult: KeywordAdProbeResult = {
    competitorName,
    domain,
    keywordsProbed: 0,
    adsFound: [],
  };

  if (!domain) return { ...baseResult, error: 'No domain' };

  const records = extractSpyfuAdRecords(params.spyfuKeywords).slice(
    0,
    MAX_KEYWORDS_PER_COMPETITOR,
  );
  if (records.length === 0) {
    return { ...baseResult, error: 'No SpyFu keywords to probe' };
  }

  const adsFound: KeywordAd[] = [];
  const keywordsNeedingSerp: string[] = [];

  // Primary path — extract ad copy SpyFu already returned.
  for (const rec of records) {
    if (rec.title && rec.title.trim().length > 0) {
      adsFound.push({
        keyword: rec.keyword,
        headline: rec.title.slice(0, 160),
        description: extractDescriptionFromBodyHtml(rec.bodyHtml),
        landingPage: rec.landingPage ?? null,
        source: 'spyfu',
      });
    } else {
      keywordsNeedingSerp.push(rec.keyword);
    }
  }

  // Fallback — probe Google SERP for any keyword where SpyFu had no ad copy.
  if (enableSerpFallback && keywordsNeedingSerp.length > 0) {
    const apiKey = process.env.SEARCHAPI_KEY;
    if (apiKey) {
      await Promise.allSettled(
        keywordsNeedingSerp.map(async (keyword) => {
          try {
            const ads = await querySerpAds(keyword, apiKey);
            for (const ad of ads) {
              const link = adLinkFromSerpResponse(ad);
              if (!hostnameMatches(link, domain)) continue;
              const headline = typeof ad.title === 'string' ? ad.title : '';
              const description =
                (typeof ad.description === 'string' && ad.description) ||
                (typeof ad.snippet === 'string' && ad.snippet) ||
                '';
              if (!headline && !description) continue;
              adsFound.push({
                keyword,
                headline: headline.slice(0, 160),
                description: description.slice(0, 300),
                landingPage: link,
                source: 'serp',
              });
            }
          } catch (err) {
            console.warn(
              `[keyword-ad-probe] ${competitorName} SERP fallback "${keyword}": ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }),
      );
    }
  }

  // De-dupe by (keyword, headline) and cap to evidence budget.
  const seen = new Set<string>();
  const deduped: KeywordAd[] = [];
  for (const ad of adsFound) {
    const key = `${ad.keyword.toLowerCase()}|${ad.headline.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ad);
    if (deduped.length >= MAX_ADS_CAPTURED) break;
  }

  return {
    competitorName,
    domain,
    keywordsProbed: records.length,
    adsFound: deduped,
  };
}
