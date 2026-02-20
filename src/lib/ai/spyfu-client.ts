// SpyFu API Client
// Low-level HTTP client for SpyFu REST API v2
// Docs: https://developer.spyfu.com/

// =============================================================================
// Configuration
// =============================================================================

const SPYFU_API_KEY = process.env.SPYFU_API_KEY;
const SPYFU_BASE_URL = 'https://api.spyfu.com/apis';

const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY_MS = 1000;

/** Informational/navigational terms to exclude from keyword discovery */
const EXCLUDE_TERMS = 'jobs,job,salary,salaries,career,careers,hiring,internship,course,courses,certification,tutorial,near me,reddit,quora,agency,agencies,consultant,freelancer';

/** Minimum search volume threshold to filter out ultra-low-volume keywords */
const MIN_SEARCH_VOLUME = 50;

// =============================================================================
// Types — Raw SpyFu API Responses
// =============================================================================

export interface SpyFuDomainStats {
  domain: string;
  organicKeywords: number;
  paidKeywords: number;
  monthlyOrganicClicks: number;
  monthlyPaidClicks: number;
  organicClicksValue: number;
  paidClicksValue: number;
}

export interface SpyFuKeywordResult {
  keyword: string;
  searchVolume: number;
  cpc: number;
  difficulty: number;
  clicksPerMonth?: number;
  rankingPosition?: number;
}

export interface SpyFuKombatResult {
  /** Keywords only competitors rank for (gaps) */
  weaknesses: SpyFuKeywordResult[];
  /** Keywords both client and competitors rank for */
  shared: SpyFuKeywordResult[];
  /** Keywords only the client ranks for */
  strengths: SpyFuKeywordResult[];
}

/** Raw domain stats response from SpyFu API v2 getDomainStatsForExactDate */
interface RawDomainStatsResponse {
  domain?: string;
  results?: RawDomainStatsEntry[];
  resultCount?: number;
}

/** Single month entry within domain stats results array */
interface RawDomainStatsEntry {
  searchMonth?: number;
  searchYear?: number;
  averageOrganicRank?: number;
  monthlyPaidClicks?: number;
  averageAdRank?: number;
  totalOrganicResults?: number;  // = organic keywords count
  monthlyBudget?: number;        // = estimated monthly ad spend
  monthlyOrganicValue?: number;  // = organic traffic value
  totalAdsPurchased?: number;    // = paid keywords count
  monthlyOrganicClicks?: number; // = organic click estimate
  strength?: number;             // domain authority 0-100
}

/** Raw keyword item from SpyFu */
interface RawKeywordItem {
  keyword?: string;
  term?: string;
  searchVolume?: number;
  liveSearchVolume?: number;
  exactLocalMonthlySearchVolume?: number;
  broadCostPerClick?: number;    // v2 actual field name
  phraseCostPerClick?: number;   // v2 actual field name
  exactCostPerClick?: number;    // v2 actual field name
  costPerClick?: number;         // legacy fallback
  cpc?: number;                  // legacy fallback
  rankingDifficulty?: number;
  keywordDifficulty?: number;
  totalMonthlyClicks?: number;   // v2 actual field name
  seoClicksPerMonth?: number;
  clicksPerMonth?: number;
  position?: number;
  rankPosition?: number;
  rank?: number;
}

/** Raw v2 list response (used by Kombat, Related, Most Valuable, Bulk) */
interface RawListResponse {
  results?: RawKeywordItem[];
  resultCount?: number;
  totalMatchingResults?: number;
}

// =============================================================================
// Helpers
// =============================================================================

/** Extract domain from a full URL (e.g., "https://foo.com/bar" -> "foo.com") */
export function extractDomain(url: string): string {
  try {
    // Add protocol if missing so URL constructor works
    const withProtocol = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    // Fallback: strip protocol and path manually
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0];
  }
}

/** Check if SpyFu API is available */
export function isSpyFuAvailable(): boolean {
  return !!SPYFU_API_KEY;
}

// =============================================================================
// UTF-8 Mojibake Sanitization
// =============================================================================

/** Common UTF-8 → Latin-1 mojibake patterns (Ã-prefix sequences) */
const MOJIBAKE_MAP: [string, string][] = [
  ['Ã§', 'ç'], ['Ã©', 'é'], ['Ã¨', 'è'], ['Ã¼', 'ü'], ['Ã¶', 'ö'],
  ['Ã¤', 'ä'], ['Ã±', 'ñ'], ['Ã¡', 'á'], ['Ã­', 'í'], ['Ã³', 'ó'],
  ['Ãº', 'ú'], ['Ã¢', 'â'], ['Ã®', 'î'], ['Ã´', 'ô'], ['Ã»', 'û'],
  ['Ã«', 'ë'], ['Ã¯', 'ï'], ['Â', ''],
];

/** Check if text contains mojibake artifacts (Ã or Â sequences) */
export function hasMojibakeArtifacts(text: string): boolean {
  return /[ÃÂ]/.test(text);
}

/** Sanitize common UTF-8 mojibake patterns back to correct characters */
export function sanitizeMojibake(text: string): string {
  if (!hasMojibakeArtifacts(text)) return text;
  let result = text;
  for (const [bad, good] of MOJIBAKE_MAP) {
    result = result.replaceAll(bad, good);
  }
  return result;
}

// =============================================================================
// Generic Fetch with Retry
// =============================================================================

async function spyfuFetch<T>(
  endpoint: string,
  params: Record<string, string | number | boolean> = {},
): Promise<T> {
  if (!SPYFU_API_KEY) {
    throw new Error('SPYFU_API_KEY not configured');
  }

  const url = new URL(`${SPYFU_BASE_URL}${endpoint}`);
  // Auth via api_key query parameter
  url.searchParams.set('api_key', SPYFU_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Charset': 'utf-8',
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[SpyFu] Rate limited on ${endpoint}, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const errMsg = `SpyFu API error ${response.status} on ${endpoint}: ${text.slice(0, 500)}`;
        console.error(`[SpyFu] ${errMsg}`);
        throw new Error(errMsg);
      }

      const data = await response.json();

      // Debug logging for domain stats to diagnose response shape
      if (endpoint.includes('DomainStats')) {
        console.log(`[SpyFu DEBUG] ${endpoint} raw response keys:`, Object.keys(data), 'resultCount:', data.resultCount);
        if (data.results?.[0]) console.log(`[SpyFu DEBUG] First result keys:`, Object.keys(data.results[0]));
      }

      return data as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[SpyFu] Attempt ${attempt + 1} failed for ${endpoint}: ${lastError.message.slice(0, 200)}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[SpyFu] All ${MAX_RETRIES + 1} attempts failed for ${endpoint}: ${lastError?.message}`);
  throw lastError ?? new Error(`SpyFu API failed after ${MAX_RETRIES + 1} attempts`);
}

async function spyfuFetchPost<T>(
  endpoint: string,
  body: unknown,
  params: Record<string, string | number | boolean> = {},
): Promise<T> {
  if (!SPYFU_API_KEY) {
    throw new Error('SPYFU_API_KEY not configured');
  }

  const url = new URL(`${SPYFU_BASE_URL}${endpoint}`);
  // Auth via api_key query parameter
  url.searchParams.set('api_key', SPYFU_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Charset': 'utf-8',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[SpyFu] Rate limited on POST ${endpoint}, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const errMsg = `SpyFu API error ${response.status} on POST ${endpoint}: ${text.slice(0, 500)}`;
        console.error(`[SpyFu] ${errMsg}`);
        throw new Error(errMsg);
      }

      return await response.json() as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[SpyFu] POST attempt ${attempt + 1} failed for ${endpoint}: ${lastError.message.slice(0, 200)}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[SpyFu] All ${MAX_RETRIES + 1} POST attempts failed for ${endpoint}: ${lastError?.message}`);
  throw lastError ?? new Error(`SpyFu POST API failed after ${MAX_RETRIES + 1} attempts`);
}

// =============================================================================
// Normalization Helpers
// =============================================================================

function normalizeKeywordItem(raw: RawKeywordItem): SpyFuKeywordResult {
  return {
    keyword: sanitizeMojibake(raw.keyword || raw.term || ''),
    searchVolume: raw.searchVolume ?? raw.liveSearchVolume ?? raw.exactLocalMonthlySearchVolume ?? 0,
    cpc: raw.broadCostPerClick ?? raw.exactCostPerClick ?? raw.phraseCostPerClick ?? raw.costPerClick ?? raw.cpc ?? 0,
    difficulty: raw.rankingDifficulty ?? raw.keywordDifficulty ?? 0,
    clicksPerMonth: raw.totalMonthlyClicks ?? raw.seoClicksPerMonth ?? raw.clicksPerMonth,
    rankingPosition: raw.position ?? raw.rankPosition ?? raw.rank,
  };
}

// =============================================================================
// Public API Functions
// =============================================================================

/**
 * Get domain overview stats (organic/paid keyword counts, clicks, value)
 * Uses v2 getDomainStatsForExactDate endpoint
 * Tries current month first; falls back to previous month if no results.
 * ~1 API row per call
 */
export async function getDomainStats(domain: string): Promise<SpyFuDomainStats> {
  const cleanDomain = extractDomain(domain);
  const now = new Date();

  const emptyStats: SpyFuDomainStats = {
    domain: cleanDomain,
    organicKeywords: 0,
    paidKeywords: 0,
    monthlyOrganicClicks: 0,
    monthlyPaidClicks: 0,
    organicClicksValue: 0,
    paidClicksValue: 0,
  };

  // Try current month first, then previous month (data may not be available yet)
  const monthsToTry = [
    { year: now.getFullYear(), month: now.getMonth() + 1 },
    {
      year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
      month: now.getMonth() === 0 ? 12 : now.getMonth(),
    },
  ];

  for (const { year, month } of monthsToTry) {
    try {
      const raw = await spyfuFetch<RawDomainStatsResponse>(
        '/domain_stats_api/v2/getDomainStatsForExactDate',
        { domain: cleanDomain, year, month },
      );

      const latest = raw.results?.[0];
      if (!latest) {
        console.warn(`[SpyFu] No domain stats results for ${cleanDomain} at ${year}-${month}, trying earlier month...`);
        continue;
      }

      return {
        domain: cleanDomain,
        organicKeywords: latest.totalOrganicResults ?? 0,
        paidKeywords: latest.totalAdsPurchased ?? 0,
        monthlyOrganicClicks: latest.monthlyOrganicClicks ?? 0,
        monthlyPaidClicks: latest.monthlyPaidClicks ?? 0,
        organicClicksValue: latest.monthlyOrganicValue ?? 0,
        paidClicksValue: latest.monthlyBudget ?? 0,
      };
    } catch (error) {
      console.warn(`[SpyFu] getDomainStatsForExactDate failed for ${cleanDomain} at ${year}-${month}:`, error instanceof Error ? error.message : error);
      continue;
    }
  }

  console.warn(`[SpyFu] No domain stats found for ${cleanDomain} in any recent month, returning zeros`);
  return emptyStats;
}

/**
 * Kombat: Get SEO keyword gaps between client and competitors
 * v2 API requires separate calls for weaknesses, shared, and strengths
 * ~300 API rows per analysis (3 x pageSize)
 */
export async function getCompetingSeoKeywords(
  clientDomain: string,
  competitorDomains: string[],
  maxResults = 100,
): Promise<SpyFuKombatResult> {
  const cleanClient = extractDomain(clientDomain);
  const cleanCompetitors = competitorDomains.map(extractDomain);
  const competitorsCsv = cleanCompetitors.join(',');

  // Run 3 parallel calls for weaknesses, shared, and strengths
  const [weaknessesRaw, sharedRaw, strengthsRaw] = await Promise.all([
    // Weaknesses: competitors rank, client doesn't
    spyfuFetch<RawListResponse>(
      '/keyword_api/v2/kombat/getCompetingSeoKeywords',
      {
        includeDomainsCsv: competitorsCsv,
        excludeDomainsCsv: cleanClient,
        isIntersection: false,
        pageSize: maxResults,
      },
    ).catch(() => ({ results: [] } as RawListResponse)),

    // Shared: all domains rank
    spyfuFetch<RawListResponse>(
      '/keyword_api/v2/kombat/getCompetingSeoKeywords',
      {
        includeDomainsCsv: `${cleanClient},${competitorsCsv}`,
        isIntersection: true,
        pageSize: maxResults,
      },
    ).catch(() => ({ results: [] } as RawListResponse)),

    // Strengths: client ranks, competitors don't
    spyfuFetch<RawListResponse>(
      '/keyword_api/v2/kombat/getCompetingSeoKeywords',
      {
        includeDomainsCsv: cleanClient,
        excludeDomainsCsv: competitorsCsv,
        isIntersection: false,
        pageSize: maxResults,
      },
    ).catch(() => ({ results: [] } as RawListResponse)),
  ]);

  return {
    weaknesses: (weaknessesRaw.results ?? []).map(normalizeKeywordItem),
    shared: (sharedRaw.results ?? []).map(normalizeKeywordItem),
    strengths: (strengthsRaw.results ?? []).map(normalizeKeywordItem),
  };
}

/**
 * Kombat: Get PPC keyword gaps between client and competitors
 * v2 API requires separate calls for weaknesses, shared, and strengths
 * ~300 API rows per analysis (3 x pageSize)
 */
export async function getCompetingPpcKeywords(
  clientDomain: string,
  competitorDomains: string[],
  maxResults = 100,
): Promise<SpyFuKombatResult> {
  const cleanClient = extractDomain(clientDomain);
  const cleanCompetitors = competitorDomains.map(extractDomain);
  const competitorsCsv = cleanCompetitors.join(',');

  const [weaknessesRaw, sharedRaw, strengthsRaw] = await Promise.all([
    spyfuFetch<RawListResponse>(
      '/keyword_api/v2/kombat/getCompetingPpcKeywords',
      {
        includeDomainsCsv: competitorsCsv,
        excludeDomainsCsv: cleanClient,
        isIntersection: false,
        pageSize: maxResults,
      },
    ).catch(() => ({ results: [] } as RawListResponse)),

    spyfuFetch<RawListResponse>(
      '/keyword_api/v2/kombat/getCompetingPpcKeywords',
      {
        includeDomainsCsv: `${cleanClient},${competitorsCsv}`,
        isIntersection: true,
        pageSize: maxResults,
      },
    ).catch(() => ({ results: [] } as RawListResponse)),

    spyfuFetch<RawListResponse>(
      '/keyword_api/v2/kombat/getCompetingPpcKeywords',
      {
        includeDomainsCsv: cleanClient,
        excludeDomainsCsv: competitorsCsv,
        isIntersection: false,
        pageSize: maxResults,
      },
    ).catch(() => ({ results: [] } as RawListResponse)),
  ]);

  return {
    weaknesses: (weaknessesRaw.results ?? []).map(normalizeKeywordItem),
    shared: (sharedRaw.results ?? []).map(normalizeKeywordItem),
    strengths: (strengthsRaw.results ?? []).map(normalizeKeywordItem),
  };
}

/**
 * Get the most valuable organic keywords for a domain
 * Ranked by estimated monthly clicks value
 * ~50 API rows per call
 */
export async function getMostValuableKeywords(
  domain: string,
  maxResults = 50,
): Promise<SpyFuKeywordResult[]> {
  const cleanDomain = extractDomain(domain);
  const raw = await spyfuFetch<RawListResponse>(
    '/serp_api/v2/seo/getMostValuableKeywords',
    {
      query: cleanDomain,
      pageSize: maxResults,
      excludeTerms: EXCLUDE_TERMS,
      'searchVolume.min': MIN_SEARCH_VOLUME,
    },
  );

  return (raw.results ?? []).map(normalizeKeywordItem);
}

/**
 * Get related keywords from a seed keyword
 * Useful for thematic expansion
 * ~50 API rows per call
 */
export async function getRelatedKeywords(
  keyword: string,
  maxResults = 50,
): Promise<SpyFuKeywordResult[]> {
  const raw = await spyfuFetch<RawListResponse>(
    '/keyword_api/v2/related/getRelatedKeywords',
    {
      query: keyword,
      pageSize: maxResults,
      excludeTerms: EXCLUDE_TERMS,
      'searchVolume.min': MIN_SEARCH_VOLUME,
    },
  );

  return (raw.results ?? []).map(normalizeKeywordItem);
}

/**
 * Bulk keyword metrics lookup
 * Enriches a list of keywords with full metrics (volume, CPC, difficulty)
 * Rows = number of keywords
 */
export async function getKeywordsByBulkSearch(
  keywords: string[],
): Promise<SpyFuKeywordResult[]> {
  if (keywords.length === 0) return [];

  // Cap at 100 keywords per batch
  const batch = keywords.slice(0, 100);

  const raw = await spyfuFetchPost<RawListResponse>(
    '/keyword_api/v2/related/getKeywordInformation',
    { keywords: batch.join(',') },
  );

  return (raw.results ?? []).map(normalizeKeywordItem);
}
