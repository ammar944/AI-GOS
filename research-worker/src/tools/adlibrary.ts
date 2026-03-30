import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type {
  WorkerAdCreative,
  WorkerAdInsight,
  WorkerAdPlatform,
  WorkerLibraryLinks,
} from './adlibrary-types';
import {
  calculateSimilarity,
  extractCompanyFromDomain,
  isAdvertiserMatch as jaroWinklerMatch,
} from '../utils/name-matcher';

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
  const n = message.toLowerCase();
  // Universal offer / CTA patterns
  if (n.includes('free') || n.includes('trial') || n.includes('sample')) return 'Free offer / trial';
  if (n.includes('discount') || n.includes('% off') || n.includes('sale') || n.includes('deal')) return 'Discount / promotion';
  if (n.includes('limited') || n.includes('hurry') || n.includes('expires') || n.includes('last chance')) return 'Urgency / scarcity';
  if (n.includes('shop') || n.includes('buy now') || n.includes('order') || n.includes('add to cart')) return 'Direct purchase CTA';
  if (n.includes('shipping') || n.includes('delivery') || n.includes('fast delivery')) return 'Shipping / fulfillment';
  // B2B / service patterns
  if (n.includes('demo') || n.includes('book') || n.includes('schedule') || n.includes('appointment')) return 'Booking / demo CTA';
  if (n.includes('quote') || n.includes('estimate') || n.includes('consultation')) return 'Quote / consultation';
  if (n.includes('pipeline') || n.includes('revenue') || n.includes('roi')) return 'Revenue / ROI';
  if (n.includes('faster') || n.includes('speed') || n.includes('quick') || n.includes('instant')) return 'Speed to value';
  if (n.includes('cost') || n.includes('reduce') || n.includes('save') || n.includes('affordable')) return 'Savings / value';
  // Trust / social proof
  if (n.includes('testimonial') || n.includes('review') || n.includes('rated') || n.includes('trusted')) return 'Social proof';
  if (n.includes('webinar') || n.includes('learn') || n.includes('guide') || n.includes('download')) return 'Education / content';
  if (n.includes('guarantee') || n.includes('warranty') || n.includes('risk-free') || n.includes('money back')) return 'Trust / guarantee';
  // Local service patterns
  if (n.includes('near') || n.includes('local') || n.includes('serving') || n.includes('area')) return 'Local targeting';
  if (n.includes('licensed') || n.includes('certified') || n.includes('insured') || n.includes('accredited')) return 'Credentials / trust';
  if (n.includes('call') || n.includes('contact') || n.includes('reach')) return 'Contact CTA';

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

/**
 * Check if an advertiser name matches the searched company.
 * Uses multi-layer validation:
 * 1. Exact match (normalized)
 * 2. Full containment (one name contains the other)
 * 3. First-word match + Jaro-Winkler (the advertiser's FIRST word must match)
 * 4. Domain-based fallback (advertiser starts with the domain base)
 *
 * Rejects: "Direct Metals" vs "Directive" (different first words, JW=0.82)
 * Rejects: "TEPLOBAK Buffer Tanks" vs "Buffer" (buffer is not the first word)
 * Passes:  "Buffer Inc" vs "Buffer" (first word matches exactly)
 */
export function isAdvertiserMatch(
  advertiserName: string | undefined,
  companyName: string,
  domain?: string,
): boolean {
  if (!advertiserName) return false;

  const advNorm = advertiserName.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  const compNorm = companyName.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

  // Layer 1: Exact match after normalization
  if (advNorm === compNorm) return true;

  // Layer 2: Full containment — the company name appears as a contiguous substring
  // starting at a word boundary (beginning of string or after a space).
  // "Buffer Inc" contains "buffer" at position 0 → pass
  // "TEPLOBAK Buffer Tanks" contains "buffer" at position 9 → only if it's at a word boundary
  if (advNorm.startsWith(compNorm + ' ') || advNorm.startsWith(compNorm)) {
    // Company name is the leading part of the advertiser → strong match
    return true;
  }
  if (compNorm.startsWith(advNorm + ' ') || compNorm.startsWith(advNorm)) {
    // Advertiser name is the leading part of the company → strong match
    return true;
  }

  // Layer 3: First-word agreement + Jaro-Winkler
  // The advertiser's first meaningful word must exactly match the company's first word.
  // This prevents "Direct Metals" from matching "Directive" (direct ≠ directive)
  // and "TEPLOBAK Buffer" from matching "Buffer" (teplobak ≠ buffer).
  const advWords = advNorm.split(' ').filter(w => w.length > 1);
  const compWords = compNorm.split(' ').filter(w => w.length > 1);
  const advFirst = advWords[0] ?? '';
  const compFirst = compWords[0] ?? '';

  if (advFirst === compFirst && advFirst.length > 0) {
    // First words match — use Jaro-Winkler at standard threshold
    if (jaroWinklerMatch(advertiserName, companyName, 0.8)) return true;
  }

  // Layer 4: Domain-based fallback — advertiser name starts with the domain base
  if (domain) {
    const domainBase = normalizeDomain(domain).split('.')[0] ?? '';
    if (domainBase.length >= 3) {
      // Domain base must be at the START of the advertiser name (word boundary)
      // "buffer" matches "Buffer Inc" but NOT "TEPLOBAK Buffer Tanks"
      if (advNorm.startsWith(domainBase)) return true;
    }
  }

  return false;
}

// --- Candidate matching with tiebreaker ---

interface Candidate {
  name: string;
  id: string;
  entity: Record<string, unknown>;
}

/**
 * Pick the best candidate from a list using Jaro-Winkler matching.
 * Tiebreaker: highest score → domain match → first result (API sort order).
 * Returns null if no candidate scores >= 0.8.
 */
function pickBestCandidate(
  candidates: Candidate[],
  companyName: string,
  domain?: string,
): Candidate | null {
  if (candidates.length === 0) return null;

  const domainBase = domain ? extractCompanyFromDomain(domain) : undefined;
  const scored = candidates
    .map(c => {
      const score = calculateSimilarity(c.name, companyName);
      const domainMatch = domainBase
        ? c.name.toLowerCase().includes(domainBase.toLowerCase())
        : false;
      return { candidate: c, score, domainMatch };
    })
    .filter(s => s.score >= 0.8)
    .sort((a, b) => {
      // Highest Jaro-Winkler first
      if (b.score !== a.score) return b.score - a.score;
      // Domain match wins ties
      if (a.domainMatch !== b.domainMatch) return a.domainMatch ? -1 : 1;
      // Otherwise preserve API order
      return 0;
    });

  return scored.length > 0 ? scored[0].candidate : null;
}

// --- Platform-specific SearchAPI fetchers ---

/**
 * Google Ads: two-step advertiser-first lookup.
 * 1. Search for advertiser by name → get advertiser_id
 * 2. Fetch ads by advertiser_id
 *
 * Falls back to domain-based lookup via google_ads_advertiser_info if available.
 */
export async function searchGoogleAds(
  companyName: string,
  domain?: string,
): Promise<SearchApiAdRecord[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) return [];

  const BASE = 'https://www.searchapi.io/api/v1/search';

  try {
    // Step 1: Find the advertiser
    const searchParams = new URLSearchParams({
      engine: 'google_ads_transparency_center_advertiser_search',
      q: companyName,
      api_key: apiKey,
    });
    const searchPayload = await fetchJson(`${BASE}?${searchParams.toString()}`);

    if (searchPayload && typeof searchPayload === 'object' && 'error' in searchPayload) {
      console.warn('[adlibrary] Google advertiser search not available:', (searchPayload as { error: string }).error);
      return [];
    }

    const advertisers = Array.isArray((searchPayload as { advertisers?: unknown[] }).advertisers)
      ? (searchPayload as { advertisers: unknown[] }).advertisers as Array<{ name?: string; id?: string }>
      : [];

    // Pick best match using Jaro-Winkler with tiebreaker
    const match = pickBestCandidate(
      advertisers.map(a => ({ name: a.name ?? '', id: a.id ?? '', entity: a })),
      companyName,
      domain,
    );

    if (!match) {
      // Fallback: try domain-based advertiser info lookup
      if (domain) {
        const domainParams = new URLSearchParams({
          engine: 'google_ads_advertiser_info',
          q: domain,
          api_key: apiKey,
        });
        try {
          const domainPayload = await fetchJson(`${BASE}?${domainParams.toString()}`);
          const domainId = (domainPayload as { advertiser_id?: string })?.advertiser_id;
          if (domainId) {
            return fetchGoogleAdsByAdvertiserId(domainId, apiKey);
          }
        } catch { /* domain lookup failed, return empty */ }
      }
      return [];
    }

    // Step 2: Fetch ads by advertiser_id
    return fetchGoogleAdsByAdvertiserId(match.id, apiKey);
  } catch {
    return [];
  }
}

async function fetchGoogleAdsByAdvertiserId(
  advertiserId: string,
  apiKey: string,
): Promise<SearchApiAdRecord[]> {
  const params = new URLSearchParams({
    engine: 'google_ads_transparency_center',
    advertiser_id: advertiserId,
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

/**
 * LinkedIn Ads: advertiser-first lookup.
 * Uses the `advertiser` param (NOT `q`) to search by company name.
 */
export async function searchLinkedInAds(
  companyName: string,
  _domain?: string,
): Promise<SearchApiAdRecord[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    engine: 'linkedin_ad_library',
    advertiser: companyName,
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
    return [];
  }
}

/**
 * Meta Ads: two-step advertiser-first lookup.
 * 1. Search for the company page via meta_ad_library_page_search → get page_id
 * 2. Fetch ads from that page via meta_ad_library with page_id filter
 */
export async function searchMetaAds(
  companyName: string,
  domain?: string,
): Promise<SearchApiAdRecord[]> {
  const apiKey = process.env.SEARCHAPI_KEY;
  if (!apiKey) return [];

  const BASE = 'https://www.searchapi.io/api/v1/search';

  try {
    // Step 1: Find the page
    const pageSearchParams = new URLSearchParams({
      engine: 'meta_ad_library_page_search',
      q: companyName,
      api_key: apiKey,
    });
    const pagePayload = await fetchJson(`${BASE}?${pageSearchParams.toString()}`);

    const pageResults = Array.isArray((pagePayload as { page_results?: unknown[] }).page_results)
      ? (pagePayload as { page_results: unknown[] }).page_results as Array<{ name?: string; page_id?: string; likes?: number }>
      : [];

    // Pick best page match using Jaro-Winkler with tiebreaker
    const match = pickBestCandidate(
      pageResults.map(p => ({ name: p.name ?? '', id: p.page_id ?? '', entity: p })),
      companyName,
      domain,
    );

    if (!match) return [];

    // Step 2: Fetch ads from the matched page
    const adParams = new URLSearchParams({
      engine: 'meta_ad_library',
      page_id: match.id,
      country: 'US',
      api_key: apiKey,
    });
    const adPayload = await fetchJson(`${BASE}?${adParams.toString()}`);
    const ads = Array.isArray((adPayload as { ads?: unknown[] }).ads)
      ? (adPayload as { ads: unknown[] }).ads
      : [];

    return ads.filter(
      (ad): ad is SearchApiAdRecord =>
        Boolean(ad) && typeof ad === 'object' && !Array.isArray(ad),
    );
  } catch {
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
      // With advertiser-first lookup, all platforms now return targeted results.
      // Still apply advertiser matching as a safety net.
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
        record.advertiser?.thumbnail,
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
    })
    .filter((creative) => {
      // Quality gate: reject ads with unresolved template variables or no content.
      // Meta DCO ads contain {{product.name}}, {{product.brand}}, etc. — raw templates
      // that were never rendered. These are useless to show.
      const hasTemplate = /\{\{[^}]+\}\}/.test(creative.headline ?? '') ||
        /\{\{[^}]+\}\}/.test(creative.body ?? '') ||
        /\{\{[^}]+\}\}/.test(creative.advertiser ?? '');
      if (hasTemplate) return false;

      // Reject ads with no meaningful content — no headline AND no body AND no image
      const hasText = (creative.headline && creative.headline.trim().length > 3) ||
        (creative.body && creative.body.trim().length > 10);
      const hasMedia = !!creative.imageUrl || !!creative.videoUrl;
      if (!hasText && !hasMedia) return false;

      return true;
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
  // Deduplicate ads — check BOTH id AND content fingerprint
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const adCreatives = [...googleCreatives, ...linkedInCreatives, ...metaCreatives].filter((ad) => {
    // Primary key: ad id (if non-fallback)
    if (ad.id && !ad.id.includes('-')) {
      if (seenIds.has(ad.id)) return false;
      seenIds.add(ad.id);
    }
    // Secondary key: content fingerprint — ALWAYS checked (catches same content with different IDs)
    const fingerprint = `${ad.platform}|${(ad.headline ?? '').slice(0, 80).toLowerCase().trim()}|${(ad.body ?? '').slice(0, 80).toLowerCase().trim()}|${ad.imageUrl ?? ''}`;
    if (seenFingerprints.has(fingerprint)) return false;
    seenFingerprints.add(fingerprint);
    return true;
  });

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
      // Fetch from all platforms in parallel using advertiser-first lookup
      const [googleAds, linkedInAds, metaAds] = await Promise.all([
        searchGoogleAds(companyName, domain).catch(() => [] as SearchApiAdRecord[]),
        searchLinkedInAds(companyName, domain).catch(() => [] as SearchApiAdRecord[]),
        searchMetaAds(companyName, domain).catch(() => [] as SearchApiAdRecord[]),
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
