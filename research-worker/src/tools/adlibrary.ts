import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

interface SearchApiAdRecord {
  platform?: string;
  headline?: string;
  title?: string;
  description?: string;
  body?: string;
  text?: string;
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

interface AdInsightRecord {
  activeAdCount: number;
  platforms: string[];
  themes: string[];
  evidence: string;
  sourceConfidence: 'high' | 'medium' | 'low';
  sampleMessages: string[];
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

async function fetchJson(
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

async function searchSearchApiAds(
  companyName: string,
): Promise<SearchApiAdRecord[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) {
    return [];
  }

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

function buildAdInsight(
  searchApiAds: SearchApiAdRecord[],
  foreplayAds: ForeplayAdRecord[],
): AdInsightRecord {
  const allAds = [...searchApiAds, ...foreplayAds];
  const platforms = [
    ...new Set(
      allAds
        .map((ad) =>
          typeof ad.platform === 'string'
            ? ad.platform
            : 'source' in ad && typeof ad.source === 'string'
              ? ad.source
              : undefined,
        )
        .filter(
          (platform): platform is string =>
            Boolean(platform && platform.trim().length > 0),
        ),
    ),
  ];
  const messages = allAds
    .map((ad) => extractMessage(ad as Record<string, unknown>))
    .filter((message): message is string => Boolean(message));
  const themes = [...new Set(messages.map(guessTheme))].slice(0, 3);
  const sampleMessages = [...new Set(messages)].slice(0, 3);
  const activeAdCount = allAds.length;
  const sourceConfidence: AdInsightRecord['sourceConfidence'] =
    searchApiAds.length >= 3 && foreplayAds.length > 0
      ? 'high'
      : searchApiAds.length > 0
        ? 'medium'
        : 'low';
  const normalizedPlatforms =
    searchApiAds.length > 0
      ? platforms
      : ['Not verified'];
  const evidence =
    searchApiAds.length > 0 && foreplayAds.length > 0
      ? `Observed ${searchApiAds.length} current ad-library records and ${foreplayAds.length} historical creative records. Coverage is partial across platforms.`
      : searchApiAds.length > 0
        ? `Observed ${searchApiAds.length} current ad-library records. Multi-platform active coverage is not fully verified.`
        : foreplayAds.length > 0
          ? `Limited coverage: ${foreplayAds.length} historical creative records only. Current active ads are not verified.`
          : 'Not verified: no ad-library sources were configured or returned results.';

  return {
    activeAdCount,
    platforms: normalizedPlatforms,
    themes,
    evidence,
    sourceConfidence,
    sampleMessages,
  };
}

export const adLibraryTool = betaZodTool({
  name: 'adLibrary',
  description:
    'Fetch competitor ad activity and creative intelligence. Returns structured platform, theme, and source-confidence summaries, with optional Foreplay enrichment when configured.',
  inputSchema: z.object({
    companyName: z.string().describe('The company name to search for ads'),
    domain: z.string().optional().describe('The competitor domain (e.g. "salesforce.com")'),
  }),
  run: async ({ companyName, domain }) => {
    try {
      const searchApiAds = await searchSearchApiAds(companyName);
      const foreplayAds =
        domain && searchApiAds.length < 3
          ? await searchForeplayAds(domain)
          : [];
      const summary = buildAdInsight(searchApiAds, foreplayAds);

      return JSON.stringify({
        summary,
        sourcesUsed: {
          searchApi: searchApiAds.length,
          foreplay: foreplayAds.length,
        },
      });
    } catch (error) {
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
        sourcesUsed: {
          searchApi: 0,
          foreplay: 0,
        },
      });
    }
  },
});
