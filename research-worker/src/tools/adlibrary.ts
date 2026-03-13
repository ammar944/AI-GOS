import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type {
  WorkerAdCreative,
  WorkerAdInsight,
  WorkerAdPlatform,
  WorkerLibraryLinks,
} from './adlibrary-types';

interface SearchApiAdRecord {
  platform?: string;
  headline?: string;
  title?: string;
  description?: string;
  body?: string;
  text?: string;
  advertiser_id?: string;
  advertiser_name?: string;
  ad_id?: string;
  id?: string;
  format?: string;
  image_url?: string;
  video_url?: string;
  details_url?: string;
  first_shown?: string;
  last_shown?: string;
  is_active?: boolean;
}

interface ForeplayBrand {
  id?: string;
  brand_id?: string;
  name?: string;
}

interface ForeplayAdRecord {
  headline?: string;
  title?: string;
  description?: string;
  body?: string;
  primary_text?: string;
  platform?: string;
  source?: string;
}

const SEARCH_API_TIMEOUT_MS = 12_000;
const FOREPLAY_TIMEOUT_MS = 8_000;

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0] ?? value;
}

function extractMessage(record: Record<string, unknown>): string | null {
  const candidates = [
    record.headline,
    record.title,
    record.description,
    record.body,
    record.text,
    record.primary_text,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function guessTheme(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('free') || normalized.includes('trial')) {
    return 'Free trial / offer';
  }
  if (normalized.includes('demo') || normalized.includes('book')) {
    return 'Demo / conversion CTA';
  }
  if (normalized.includes('pipeline') || normalized.includes('revenue')) {
    return 'Revenue accountability';
  }
  if (normalized.includes('faster') || normalized.includes('speed')) {
    return 'Speed to value';
  }
  if (normalized.includes('cost') || normalized.includes('reduce')) {
    return 'Efficiency / savings';
  }

  return message.length > 90 ? `${message.slice(0, 87)}...` : message;
}

export async function fetchJson(
  url: string,
  init?: RequestInit,
  timeoutMs = SEARCH_API_TIMEOUT_MS,
): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

// --- Advertiser name matching for false-positive protection ---

export function isAdvertiserMatch(
  advertiserName: string | undefined,
  companyName: string,
  domain?: string,
): boolean {
  if (!advertiserName) return true; // no name to filter on → keep
  const advLower = advertiserName.toLowerCase().trim();
  const compLower = companyName.toLowerCase().trim();

  // Exact match
  if (advLower === compLower) return true;

  // Advertiser name starts with company name (e.g., "Hey Digital Inc." matches "Hey Digital")
  // This intentionally rejects prefixed names like "AR Funnel.io" for query "Funnel.io"
  if (advLower.startsWith(compLower)) return true;

  // Company name starts with advertiser name (e.g., query "Hey Digital Agency" matches advertiser "Hey Digital")
  if (compLower.startsWith(advLower)) return true;

  // Domain-based match
  if (domain) {
    const domainBase = normalizeDomain(domain).split('.')[0] ?? '';
    if (domainBase.length >= 3 && advLower.includes(domainBase)) return true;
  }

  return false;
}

// --- Platform-specific SearchAPI fetchers ---

export async function searchGoogleAds(
  companyName: string,
): Promise<SearchApiAdRecord[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    engine: 'google_ads_transparency',
    q: companyName,
    api_key: apiKey,
  });

  const payload = await fetchJson(
    `https://www.searchapi.io/api/v1/search?${params.toString()}`,
  );
  const ads = Array.isArray((payload as { ads?: unknown[] }).ads)
    ? (payload as { ads: unknown[] }).ads
    : [];

  return ads.filter(
    (ad): ad is SearchApiAdRecord =>
      Boolean(ad) && typeof ad === 'object' && !Array.isArray(ad),
  );
}

export async function searchLinkedInAds(
  companyName: string,
): Promise<SearchApiAdRecord[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    engine: 'linkedin_ad_library',
    q: companyName,
    api_key: apiKey,
  });

  const payload = await fetchJson(
    `https://www.searchapi.io/api/v1/search?${params.toString()}`,
  );
  const ads = Array.isArray((payload as { ads?: unknown[] }).ads)
    ? (payload as { ads: unknown[] }).ads
    : [];

  return ads.filter(
    (ad): ad is SearchApiAdRecord =>
      Boolean(ad) && typeof ad === 'object' && !Array.isArray(ad),
  );
}

export async function searchMetaAds(
  companyName: string,
): Promise<SearchApiAdRecord[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    engine: 'meta_ad_library',
    q: companyName,
    api_key: apiKey,
  });

  try {
    const payload = await fetchJson(
      `https://www.searchapi.io/api/v1/search?${params.toString()}`,
    );
    const ads = Array.isArray((payload as { ads?: unknown[] }).ads)
      ? (payload as { ads: unknown[] }).ads
      : [];

    return ads.filter(
      (ad): ad is SearchApiAdRecord =>
        Boolean(ad) && typeof ad === 'object' && !Array.isArray(ad),
    );
  } catch {
    // Meta ad library endpoint may not be available
    return [];
  }
}

async function searchForeplayAds(domain: string): Promise<ForeplayAdRecord[]> {
  const apiKey = process.env.FOREPLAY_API_KEY;
  if (!apiKey || process.env.ENABLE_FOREPLAY !== 'true') {
    return [];
  }

  const normalizedDomain = normalizeDomain(domain);
  const brandParams = new URLSearchParams({
    domain: normalizedDomain,
    limit: '1',
    order: 'most_ranked',
  });
  const brandPayload = await fetchJson(
    `https://public.api.foreplay.co/api/brand/getBrandsByDomain?${brandParams.toString()}`,
    {
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
      },
    },
    FOREPLAY_TIMEOUT_MS,
  );

  const brands = Array.isArray((brandPayload as { data?: unknown[] }).data)
    ? (brandPayload as { data: unknown[] }).data
    : Array.isArray(brandPayload)
      ? (brandPayload as unknown[])
      : [];
  const primaryBrand = brands.find(
    (brand): brand is ForeplayBrand =>
      Boolean(brand) &&
      typeof brand === 'object' &&
      !Array.isArray(brand) &&
      Boolean((brand as ForeplayBrand).id ?? (brand as ForeplayBrand).brand_id),
  );

  const brandId = primaryBrand?.id ?? primaryBrand?.brand_id;
  if (!brandId) {
    return [];
  }

  const adParams = new URLSearchParams({
    brand_ids: brandId,
    limit: '12',
    order: 'newest',
  });
  const adPayload = await fetchJson(
    `https://public.api.foreplay.co/api/brand/getAdsByBrandId?${adParams.toString()}`,
    {
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
      },
    },
    FOREPLAY_TIMEOUT_MS,
  );

  const ads = Array.isArray((adPayload as { data?: unknown[] }).data)
    ? (adPayload as { data: unknown[] }).data
    : Array.isArray(adPayload)
      ? (adPayload as unknown[])
      : [];

  return ads.filter(
    (ad): ad is ForeplayAdRecord =>
      Boolean(ad) && typeof ad === 'object' && !Array.isArray(ad),
  );
}

// --- Normalization to WorkerAdCreative ---

function guessFormat(
  record: SearchApiAdRecord,
): WorkerAdCreative['format'] {
  if (record.format) {
    const f = record.format.toLowerCase();
    if (f.includes('video')) return 'video';
    if (f.includes('carousel')) return 'carousel';
    if (f.includes('image')) return 'image';
    if (f.includes('text')) return 'text';
  }
  if (record.video_url) return 'video';
  if (record.image_url) return 'image';
  return 'unknown';
}

function guessPlatform(
  record: SearchApiAdRecord,
  sourcePlatform: WorkerAdPlatform,
): WorkerAdPlatform {
  if (record.platform) {
    const p = record.platform.toLowerCase();
    if (p.includes('linkedin')) return 'linkedin';
    if (p.includes('meta') || p.includes('facebook') || p.includes('instagram'))
      return 'meta';
    if (p.includes('google')) return 'google';
  }
  return sourcePlatform;
}

export function normalizeSearchApiToCreatives(
  records: SearchApiAdRecord[],
  sourcePlatform: WorkerAdPlatform,
  companyName: string,
  domain?: string,
): WorkerAdCreative[] {
  return records
    .filter((record) =>
      isAdvertiserMatch(
        record.advertiser_name,
        companyName,
        domain,
      ),
    )
    .map((record, index) => ({
      platform: guessPlatform(record, sourcePlatform),
      id: record.ad_id ?? record.id ?? `${sourcePlatform}-${index}`,
      advertiser:
        record.advertiser_name ?? companyName,
      headline:
        typeof record.headline === 'string' && record.headline.trim().length > 0
          ? record.headline.trim()
          : typeof record.title === 'string' && record.title.trim().length > 0
            ? record.title.trim()
            : undefined,
      body:
        typeof record.description === 'string' && record.description.trim().length > 0
          ? record.description.trim()
          : typeof record.body === 'string' && record.body.trim().length > 0
            ? record.body.trim()
            : undefined,
      imageUrl:
        typeof record.image_url === 'string' && record.image_url.trim().length > 0
          ? record.image_url
          : undefined,
      videoUrl:
        typeof record.video_url === 'string' && record.video_url.trim().length > 0
          ? record.video_url
          : undefined,
      format: guessFormat(record),
      isActive: record.is_active ?? true,
      firstSeen:
        typeof record.first_shown === 'string' ? record.first_shown : undefined,
      lastSeen:
        typeof record.last_shown === 'string' ? record.last_shown : undefined,
      detailsUrl:
        typeof record.details_url === 'string' && record.details_url.trim().length > 0
          ? record.details_url
          : undefined,
    }));
}

// --- Library link generation ---

function deriveGoogleAdvertiserUrl(
  creatives: WorkerAdCreative[],
  domain?: string,
  companyName?: string,
): string {
  const googleCreative = creatives.find(
    (c) =>
      c.platform === 'google' &&
      c.detailsUrl?.includes('adstransparency.google.com'),
  );

  if (googleCreative?.detailsUrl) {
    const url = googleCreative.detailsUrl;
    return url.includes('?') ? url : `${url}?region=US`;
  }

  if (domain) {
    const d = normalizeDomain(domain);
    return `https://adstransparency.google.com/?region=anywhere&q=${encodeURIComponent(d)}`;
  }

  return `https://adstransparency.google.com/?region=anywhere&q=${encodeURIComponent(companyName ?? '')}`;
}

export function buildLibraryLinks(
  companyName: string,
  domain?: string,
  creatives?: WorkerAdCreative[],
): WorkerLibraryLinks {
  const encodedName = encodeURIComponent(companyName.trim());
  return {
    metaLibraryUrl: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodedName}&search_type=keyword_unordered&media_type=all`,
    linkedInLibraryUrl: `https://www.linkedin.com/ad-library/search?keyword=${encodedName}`,
    googleAdvertiserUrl: deriveGoogleAdvertiserUrl(
      creatives ?? [],
      domain,
      companyName,
    ),
  };
}

// --- Build full insight ---

export function buildAdInsight(
  googleAds: SearchApiAdRecord[],
  linkedInAds: SearchApiAdRecord[],
  metaAds: SearchApiAdRecord[],
  foreplayAds: ForeplayAdRecord[],
  companyName: string,
  domain?: string,
): WorkerAdInsight {
  // Normalize to creatives with advertiser matching
  const googleCreatives = normalizeSearchApiToCreatives(
    googleAds, 'google', companyName, domain,
  );
  const linkedInCreatives = normalizeSearchApiToCreatives(
    linkedInAds, 'linkedin', companyName, domain,
  );
  const metaCreatives = normalizeSearchApiToCreatives(
    metaAds, 'meta', companyName, domain,
  );
  const adCreatives = [...googleCreatives, ...linkedInCreatives, ...metaCreatives];

  // Build summary from all sources
  const allRawAds = [
    ...googleAds,
    ...linkedInAds,
    ...metaAds,
    ...foreplayAds,
  ];
  const platforms = [
    ...new Set(
      adCreatives
        .map((c) => c.platform)
        .filter((p): p is WorkerAdPlatform => Boolean(p)),
    ),
  ];
  const messages = allRawAds
    .map((ad) => extractMessage(ad as Record<string, unknown>))
    .filter((message): message is string => Boolean(message));
  const themes = [...new Set(messages.map(guessTheme))].slice(0, 3);
  const sampleMessages = [...new Set(messages)].slice(0, 3);

  const totalSearchApiAds = googleAds.length + linkedInAds.length + metaAds.length;
  const sourceConfidence: WorkerAdInsight['summary']['sourceConfidence'] =
    totalSearchApiAds >= 3 && foreplayAds.length > 0
      ? 'high'
      : totalSearchApiAds > 0
        ? 'medium'
        : 'low';

  const normalizedPlatforms =
    platforms.length > 0
      ? platforms
      : totalSearchApiAds > 0
        ? ['Google']
        : ['Not verified'];

  const evidence =
    totalSearchApiAds > 0 && foreplayAds.length > 0
      ? `Observed ${totalSearchApiAds} current ad-library records and ${foreplayAds.length} historical creative records. Coverage is partial across platforms.`
      : totalSearchApiAds > 0
        ? `Observed ${totalSearchApiAds} current ad-library records. Multi-platform active coverage is not fully verified.`
        : foreplayAds.length > 0
          ? `Limited coverage: ${foreplayAds.length} historical creative records only. Current active ads are not verified.`
          : 'Not verified: no ad-library sources were configured or returned results.';

  const libraryLinks = buildLibraryLinks(companyName, domain, adCreatives);

  return {
    summary: {
      activeAdCount: adCreatives.length || allRawAds.length,
      platforms: normalizedPlatforms,
      themes,
      evidence,
      sourceConfidence,
      sampleMessages,
    },
    adCreatives,
    libraryLinks,
    sourcesUsed: {
      linkedin: linkedInAds.length,
      meta: metaAds.length,
      google: googleAds.length,
      foreplay: foreplayAds.length,
    },
  };
}

export const adLibraryTool = betaZodTool({
  name: 'adLibrary',
  description:
    'Fetch competitor ad activity and creative intelligence from public ad libraries. Returns structured platform coverage, ad creatives, library links, and source-confidence summaries.',
  inputSchema: z.object({
    companyName: z.string().describe('The company name to search for ads'),
    domain: z.string().optional().describe('The competitor domain (e.g. "salesforce.com")'),
  }),
  run: async ({ companyName, domain }) => {
    try {
      // Fetch from all platforms in parallel
      const [googleAds, linkedInAds, metaAds] = await Promise.all([
        searchGoogleAds(companyName).catch(() => [] as SearchApiAdRecord[]),
        searchLinkedInAds(companyName).catch(() => [] as SearchApiAdRecord[]),
        searchMetaAds(companyName).catch(() => [] as SearchApiAdRecord[]),
      ]);

      const totalSearchApi = googleAds.length + linkedInAds.length + metaAds.length;
      const foreplayAds =
        domain && totalSearchApi < 3
          ? await searchForeplayAds(domain)
          : [];

      const insight = buildAdInsight(
        googleAds, linkedInAds, metaAds, foreplayAds, companyName, domain,
      );

      return JSON.stringify(insight);
    } catch (error) {
      const libraryLinks = buildLibraryLinks(companyName, domain);
      return JSON.stringify({
        summary: {
          activeAdCount: 0,
          platforms: [],
          themes: [],
          evidence:
            error instanceof Error
              ? error.message
              : 'Ad activity lookup failed.',
          sourceConfidence: 'low',
          sampleMessages: [],
        },
        adCreatives: [],
        libraryLinks,
        sourcesUsed: {
          linkedin: 0,
          meta: 0,
          google: 0,
          foreplay: 0,
        },
      } satisfies WorkerAdInsight);
    }
  },
});
