import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type {
  WorkerAdCreative,
  WorkerAdInsight,
  WorkerAdPlatform,
  WorkerLibraryLinks,
} from './adlibrary-types';

interface SearchApiAdRecord {
  // Flat fields (some platforms)
  platform?: string;
  headline?: string;
  title?: string;
  description?: string;
  body?: string | { text?: string };
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

  // Meta nested structure (SearchAPI returns raw Meta Ad Library format)
  page_name?: string;
  ad_archive_id?: string;
  ad_library_url?: string;
  publisher_platform?: string[];
  start_date?: number;
  end_date?: number;
  start_date_formatted?: string;
  end_date_formatted?: string;
  snapshot?: {
    title?: string;
    caption?: string;
    body?: { text?: string } | string;
    cta_text?: string;
    display_format?: string;
    link_url?: string;
    images?: Array<string | { url?: string }>;
    videos?: Array<{ video_hd_url?: string; video_preview_image_url?: string }>;
    cards?: Array<{ title?: string; body?: string; original_image_url?: string }>;
    page_name?: string;
  };

  // LinkedIn nested structure
  content?: {
    headline?: string;
    body?: string;
    image?: string;
  };
  advertiser?: {
    name?: string;
    promotor?: string;
    thumbnail?: string;
  };
  ad_type?: string;
  link?: string;
  position?: number;
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
  // Check nested structures first (Meta snapshot, LinkedIn content)
  const snapshot = record.snapshot as SearchApiAdRecord['snapshot'] | undefined;
  const content = record.content as SearchApiAdRecord['content'] | undefined;

  const candidates = [
    // Flat fields
    record.headline,
    record.title,
    record.description,
    typeof record.body === 'string' ? record.body : null,
    record.text,
    record.primary_text,
    // Meta nested (snapshot)
    snapshot?.title,
    snapshot?.caption,
    typeof snapshot?.body === 'object' && snapshot?.body ? (snapshot.body as { text?: string }).text : snapshot?.body,
    snapshot?.cards?.[0]?.title,
    // LinkedIn nested (content)
    content?.headline,
    content?.body,
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

  try {
    const payload = await fetchJson(
      `https://www.searchapi.io/api/v1/search?${params.toString()}`,
    );

    // SearchAPI returns { error: "..." } if the engine isn't enabled
    if (payload && typeof payload === 'object' && 'error' in payload) {
      console.warn('[adlibrary] Google Ads Transparency engine not available:', (payload as { error: string }).error);
      return [];
    }

    const ads = Array.isArray((payload as { ads?: unknown[] }).ads)
      ? (payload as { ads: unknown[] }).ads
      : [];

    return ads.filter(
      (ad): ad is SearchApiAdRecord =>
        Boolean(ad) && typeof ad === 'object' && !Array.isArray(ad),
    );
  } catch {
    return [];
  }
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
    .filter((record) => {
      // LinkedIn SearchAPI returns keyword-matched ads (ads in the competitive space),
      // NOT ads BY the company. Skip advertiser matching for LinkedIn.
      if (sourcePlatform === 'linkedin') return true;

      // For Meta/Google, verify the advertiser matches the target company
      const advertiserName =
        record.advertiser_name ??
        record.page_name ??                          // Meta top-level
        record.snapshot?.page_name ??                // Meta snapshot
        record.advertiser?.promotor ??               // LinkedIn (sponsoring brand)
        record.advertiser?.name;                     // LinkedIn (person name)
      return isAdvertiserMatch(advertiserName, companyName, domain);
    })
    .map((record, index) => {
      const snap = record.snapshot;
      const content = record.content;

      // Extract headline from all possible locations
      const headline = firstNonEmpty([
        record.headline,
        record.title,
        snap?.title,
        snap?.caption,
        snap?.cards?.[0]?.title,
        content?.headline,
      ]);

      // Extract body from all possible locations (handle body as object or string)
      const snapBodyText = snap?.body
        ? typeof snap.body === 'string' ? snap.body : snap.body.text
        : undefined;
      const recordBodyText = record.body
        ? typeof record.body === 'string' ? record.body : record.body.text
        : undefined;
      const body = firstNonEmpty([
        record.description,
        recordBodyText,
        record.text,
        snapBodyText,
        snap?.cards?.[0]?.body,
        content?.body,
      ]);

      // Extract image URL from all possible locations
      const snapFirstImage = snap?.images?.[0];
      const snapImageUrl = typeof snapFirstImage === 'string'
        ? snapFirstImage
        : (snapFirstImage as { url?: string } | undefined)?.url;
      const imageUrl = firstNonEmpty([
        record.image_url,
        snapImageUrl,
        snap?.cards?.[0]?.original_image_url,
        snap?.videos?.[0]?.video_preview_image_url,
        content?.image,
      ]);

      // Extract video URL
      const videoUrl = firstNonEmpty([
        record.video_url,
        snap?.videos?.[0]?.video_hd_url,
      ]);

      // Extract advertiser name
      const advertiser =
        record.advertiser_name ??
        record.page_name ??
        record.advertiser?.promotor ??
        record.advertiser?.name ??
        companyName;

      // Extract format — check nested display_format too
      const displayFormat = snap?.display_format ?? record.ad_type ?? record.format;
      let format = guessFormat(record);
      if (displayFormat) {
        const df = displayFormat.toUpperCase();
        if (df === 'VIDEO' || df.includes('VIDEO')) format = 'video';
        else if (df === 'IMAGE' || df.includes('IMAGE')) format = 'image';
        else if (df === 'CAROUSEL' || df.includes('CAROUSEL')) format = 'carousel';
        else if (df === 'TEXT' || df.includes('TEXT')) format = 'text';
      }
      // Override based on actual media presence
      if (videoUrl && format === 'unknown') format = 'video';
      else if (imageUrl && format === 'unknown') format = 'image';

      // Extract dates
      const firstSeen = record.first_shown ?? record.start_date_formatted ?? undefined;
      const lastSeen = record.last_shown ?? record.end_date_formatted ?? undefined;

      // Extract details URL
      const detailsUrl = firstNonEmpty([
        record.details_url,
        record.ad_library_url,
        record.link,
      ]);

      return {
        platform: guessPlatform(record, sourcePlatform),
        id: record.ad_id ?? record.ad_archive_id ?? record.id ?? `${sourcePlatform}-${index}`,
        advertiser,
        headline,
        body,
        imageUrl,
        videoUrl,
        format,
        isActive: record.is_active ?? true,
        firstSeen,
        lastSeen,
        detailsUrl,
      };
    });
}

/** Return the first non-empty string from candidates */
function firstNonEmpty(candidates: (string | undefined | null)[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return undefined;
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
