// research-worker/src/tools/apify-ads.ts
// Apify-powered ad scraping across Meta, Google, LinkedIn, and TikTok.
// Returns the same WorkerAdInsight shape as the SearchAPI-based adlibrary tool
// so it can be swapped in or used as a fallback.

import { ApifyClient } from 'apify-client';
import type {
  WorkerAdCreative,
  WorkerAdInsight,
  WorkerAdPlatform,
  WorkerLibraryLinks,
} from './adlibrary-types';
import { buildLibraryLinks, isAdvertiserMatch } from './adlibrary';

// ── Actor IDs ──────────────────────────────────────────────────────────────
// Best actors by reliability + cost from Apify Store research (March 2026)
const ACTORS = {
  meta: 'curious_coder/facebook-ads-library-scraper',   // $0.00075/ad, 99.5% success, 10.4M runs — expects urls[{url}]
  google: 'dz_omar/google-ads-scraper',                  // $0.01–$0.00002/ad tiered — expects searchTargets[]
  // LinkedIn: dz_omar actor is broken (ignores all keyword/account inputs).
  // Use SearchAPI for LinkedIn instead — it works and returns 18+ results.
} as const;

// ── Timeouts ───────────────────────────────────────────────────────────────
const WAIT_SECS = 75;        // Max wait for actor run — must fit within parallel-fetch 90s timeout
const ADS_PER_PLATFORM = 20; // Ads to fetch per platform per competitor

// ── Types for Apify actor outputs ──────────────────────────────────────────
// curious_coder/facebook-ads-library-scraper actual output shape
interface ApifyMetaAd {
  ad_archive_id?: string;
  ad_id?: string;
  page_id?: string;
  page_name?: string;
  is_active?: boolean;
  start_date?: number;
  end_date?: number;
  start_date_formatted?: string;
  end_date_formatted?: string;
  publisher_platform?: string[];
  ad_library_url?: string;
  spend?: { lower_bound?: string; upper_bound?: string; currency?: string };
  impressions_with_index?: unknown;
  reach_estimate?: unknown;
  snapshot?: {
    body?: { text?: string };
    title?: string;
    caption?: string;
    cta_text?: string;
    cta_type?: string;
    display_format?: string;
    link_url?: string;
    link_description?: string;
    images?: Array<{ url?: string; [k: string]: unknown }>;
    videos?: Array<{ video_hd_url?: string; video_preview_image_url?: string; [k: string]: unknown }>;
    page_name?: string;
    page_profile_uri?: string;
    cards?: Array<{ body?: string; title?: string; image_url?: string; [k: string]: unknown }>;
  };
  [key: string]: unknown;
}

// dz_omar/google-ads-scraper actual output shape
interface ApifyGoogleAd {
  advertiserId?: string;
  creativeId?: string;
  creativeRegions?: string[];
  adTransparencyUrl?: string;
  previewUrls?: string[];
  format?: string;
  regionStats?: Array<{
    regionName?: string;
    firstShown?: string | number;
    lastShown?: string | number;
    impressions?: { lowerBound?: number; upperBound?: number };
  }>;
  [key: string]: unknown;
}

// LinkedIn ad output (dz_omar or similar)
interface ApifyLinkedInAd {
  advertiserName?: string;
  advertiserUrl?: string;
  adHeadline?: string;
  adText?: string;
  mediaUrl?: string;
  creativeType?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

// ── Client singleton ───────────────────────────────────────────────────────
let _client: ApifyClient | null = null;

function getClient(): ApifyClient | null {
  if (_client) return _client;
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;
  _client = new ApifyClient({ token });
  return _client;
}

// ── Platform-specific fetchers ─────────────────────────────────────────────

async function fetchMetaAds(
  companyName: string,
  _domain?: string,
): Promise<ApifyMetaAd[]> {
  const client = getClient();
  if (!client) return [];

  // curious_coder actor expects urls[] — Meta Ad Library search URLs
  const encodedQuery = encodeURIComponent(companyName);
  const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodedQuery}&search_type=keyword_unordered&media_type=all`;

  try {
    const run = await client.actor(ACTORS.meta).call(
      {
        urls: [{ url: adLibraryUrl }],
        limit: ADS_PER_PLATFORM,
      },
      { waitSecs: WAIT_SECS },
    );

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items as ApifyMetaAd[];
  } catch (error) {
    console.error(`[apify-ads] Meta fetch failed for "${companyName}":`, error);
    return [];
  }
}

async function fetchGoogleAds(
  companyName: string,
  domain?: string,
): Promise<ApifyGoogleAd[]> {
  const client = getClient();
  if (!client) return [];

  // dz_omar actor — expects searchTargets as string array
  try {
    const run = await client.actor(ACTORS.google).call(
      {
        searchTargets: [domain ?? companyName],
        maxResults: ADS_PER_PLATFORM,
      },
      { waitSecs: WAIT_SECS },
    );

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    return items as ApifyGoogleAd[];
  } catch (error) {
    console.error(`[apify-ads] Google fetch failed for "${companyName}":`, error);
    return [];
  }
}

async function fetchLinkedInAds(
  companyName: string,
): Promise<ApifyLinkedInAd[]> {
  // All tested Apify LinkedIn actors are broken (ignore keyword/account inputs).
  // Fall back to SearchAPI which reliably returns LinkedIn ad library data.
  try {
    const { searchLinkedInAds, normalizeSearchApiToCreatives } = await import('./adlibrary');
    const raw = await searchLinkedInAds(companyName);
    // Return empty — LinkedIn data will come through the normalizeSearchApiToCreatives
    // path in fetchAdsWithFallback. We return raw here for the summary count.
    return raw.slice(0, ADS_PER_PLATFORM).map((r) => ({
      advertiserName: r.advertiser_name,
      adHeadline: r.headline ?? r.title,
      adText: r.description ?? r.body,
    })) as ApifyLinkedInAd[];
  } catch (error) {
    console.error(`[apify-ads] LinkedIn (SearchAPI fallback) failed for "${companyName}":`, error);
    return [];
  }
}

// ── Normalization to WorkerAdCreative ──────────────────────────────────────

function normalizeMetaAds(
  ads: ApifyMetaAd[],
  companyName: string,
  domain?: string,
): WorkerAdCreative[] {
  return ads
    .map((ad, i) => {
      const snap = ad.snapshot;
      const hasVideo = snap?.videos && snap.videos.length > 0;
      const hasImage = snap?.images && snap.images.length > 0;
      const hasCards = snap?.cards && snap.cards.length > 1;
      const displayFormat = (snap?.display_format ?? '').toUpperCase();

      return {
        platform: 'meta' as WorkerAdPlatform,
        id: ad.ad_archive_id ?? ad.ad_id ?? `meta-${i}`,
        advertiser: ad.page_name ?? snap?.page_name ?? companyName,
        headline: snap?.title ?? snap?.caption ?? undefined,
        body: snap?.body?.text ?? undefined,
        imageUrl: hasImage ? snap!.images![0]?.url : snap?.videos?.[0]?.video_preview_image_url,
        videoUrl: hasVideo ? snap!.videos![0]?.video_hd_url : undefined,
        format: displayFormat === 'VIDEO'
          ? 'video'
          : hasCards || displayFormat === 'CAROUSEL'
            ? 'carousel'
            : hasImage || displayFormat === 'IMAGE'
              ? 'image'
              : 'text',
        isActive: ad.is_active ?? true,
        firstSeen: ad.start_date_formatted ?? undefined,
        lastSeen: ad.end_date_formatted ?? undefined,
        detailsUrl: ad.ad_library_url ?? undefined,
        platforms: ad.publisher_platform,
      };
    });
}

function normalizeGoogleAds(
  ads: ApifyGoogleAd[],
  companyName: string,
  _domain?: string,
): WorkerAdCreative[] {
  return ads.map((ad, i) => {
    const format = (ad.format ?? '').toUpperCase();
    const firstRegion = ad.regionStats?.[0];
    const lastShown = firstRegion?.lastShown;

    return {
      platform: 'google' as WorkerAdPlatform,
      id: ad.creativeId ?? `google-${i}`,
      advertiser: companyName, // Google Ads Transparency groups by advertiser already
      headline: undefined, // Google transparency doesn't expose ad copy directly
      body: undefined,
      imageUrl: ad.previewUrls?.[0] ?? undefined,
      videoUrl: undefined,
      format: format === 'VIDEO'
        ? 'video'
        : format === 'IMAGE'
          ? 'image'
          : format === 'TEXT'
            ? 'text'
            : 'unknown',
      isActive: true, // Google only shows currently running ads
      firstSeen: firstRegion?.firstShown != null ? String(firstRegion.firstShown) : undefined,
      lastSeen: lastShown != null ? String(lastShown) : undefined,
      detailsUrl: ad.adTransparencyUrl ?? undefined,
    };
  });
}

function normalizeLinkedInAds(
  ads: ApifyLinkedInAd[],
  companyName: string,
  domain?: string,
): WorkerAdCreative[] {
  return ads
    .filter((ad) => isAdvertiserMatch(ad.advertiserName, companyName, domain))
    .map((ad, i) => {
      const creativeType = (ad.creativeType ?? '').toLowerCase();
      const format: WorkerAdCreative['format'] = creativeType.includes('video')
        ? 'video'
        : creativeType.includes('carousel')
          ? 'carousel'
          : ad.mediaUrl
            ? 'image'
            : 'text';

      return {
        platform: 'linkedin' as WorkerAdPlatform,
        id: `linkedin-${i}`,
        advertiser: ad.advertiserName ?? companyName,
        headline: ad.adHeadline ?? undefined,
        body: ad.adText ?? undefined,
        imageUrl: format !== 'video' ? ad.mediaUrl ?? undefined : undefined,
        videoUrl: format === 'video' ? ad.mediaUrl ?? undefined : undefined,
        format,
        isActive: !ad.endDate,
        firstSeen: ad.startDate ?? undefined,
        lastSeen: ad.endDate ?? undefined,
      };
    });
}

// ── Theme detection (reuse from adlibrary.ts logic) ────────────────────────

function guessTheme(message: string): string {
  const n = message.toLowerCase();
  if (n.includes('free') || n.includes('trial')) return 'Free trial / offer';
  if (n.includes('demo') || n.includes('book')) return 'Demo / conversion CTA';
  if (n.includes('pipeline') || n.includes('revenue')) return 'Revenue accountability';
  if (n.includes('faster') || n.includes('speed')) return 'Speed to value';
  if (n.includes('cost') || n.includes('reduce')) return 'Efficiency / savings';
  if (n.includes('case stud') || n.includes('testimoni')) return 'Social proof';
  if (n.includes('webinar') || n.includes('report') || n.includes('guide')) return 'Lead magnet';
  return message.length > 90 ? `${message.slice(0, 87)}...` : message;
}

// ── Quality filter ─────────────────────────────────────────────────────────

/**
 * Remove low-quality or irrelevant ads from a creative list.
 * An ad is dropped if:
 *   - Both headline AND body are empty (text-less shell ad with no copy to analyse)
 *   - The advertiser field doesn't match the expected company (cross-contamination
 *     from broad keyword searches returning competitor-of-competitor results).
 *     Google ads are excluded from the advertiser check because the Apify Google
 *     actor assigns the query company name as the advertiser — no signal there.
 */
function filterRelevantAds(
  creatives: WorkerAdCreative[],
  _companyName: string,
  _domain?: string,
): WorkerAdCreative[] {
  // Only drop completely empty shell ads (no text and no media).
  // Advertiser matching is handled upstream by normalizeSearchApiToCreatives
  // which already filters on advertiser name. Don't double-filter here because
  // SearchAPI keyword searches return ads mentioning the keyword, not ads BY the company.
  return creatives.filter((c) => {
    const hasText = Boolean(c.headline) || Boolean(c.body);
    const hasMedia = Boolean(c.imageUrl) || Boolean(c.videoUrl);
    return hasText || hasMedia;
  });
}

// ── Main function ──────────────────────────────────────────────────────────

export interface ApifyAdFetchOptions {
  /** Which platforms to scrape. Defaults to all three. */
  platforms?: ('meta' | 'google' | 'linkedin')[];
  /** Max ads per platform per competitor. Defaults to 20. */
  limit?: number;
}

/**
 * Fetch competitor ads from Apify actors across Meta, Google, and LinkedIn.
 * Returns the same WorkerAdInsight shape as the SearchAPI-based tool.
 *
 * Requires APIFY_API_TOKEN env var.
 */
export async function fetchApifyAds(
  companyName: string,
  domain?: string,
  options: ApifyAdFetchOptions = {},
): Promise<WorkerAdInsight> {
  const platforms = options.platforms ?? ['meta', 'google', 'linkedin'];
  const startTime = Date.now();

  // Fetch all platforms in parallel
  const [metaRaw, googleRaw, linkedInRaw] = await Promise.all([
    platforms.includes('meta')
      ? fetchMetaAds(companyName, domain)
      : Promise.resolve([] as ApifyMetaAd[]),
    platforms.includes('google')
      ? fetchGoogleAds(companyName, domain)
      : Promise.resolve([] as ApifyGoogleAd[]),
    platforms.includes('linkedin')
      ? fetchLinkedInAds(companyName)
      : Promise.resolve([] as ApifyLinkedInAd[]),
  ]);

  // Normalize to WorkerAdCreative
  const metaCreatives = normalizeMetaAds(metaRaw, companyName, domain);
  const googleCreatives = normalizeGoogleAds(googleRaw, companyName, domain);
  const linkedInCreatives = normalizeLinkedInAds(linkedInRaw, companyName, domain);
  const allCreatives = [...metaCreatives, ...googleCreatives, ...linkedInCreatives];

  // Build themes from ad copy
  const allMessages = allCreatives
    .map((c) => c.headline ?? c.body)
    .filter((m): m is string => Boolean(m));
  const themes = [...new Set(allMessages.map(guessTheme))].slice(0, 5);
  const sampleMessages = [...new Set(allMessages)].slice(0, 5);

  // Determine confidence
  const totalAds = allCreatives.length;
  const platformsCovered = [
    ...new Set(allCreatives.map((c) => c.platform)),
  ] as string[];
  const sourceConfidence: WorkerAdInsight['summary']['sourceConfidence'] =
    totalAds >= 5 && platformsCovered.length >= 2
      ? 'high'
      : totalAds > 0
        ? 'medium'
        : 'low';

  const durationMs = Date.now() - startTime;
  const evidence =
    totalAds > 0
      ? `Apify scraped ${totalAds} ads across ${platformsCovered.join(', ')} in ${(durationMs / 1000).toFixed(1)}s. Meta: ${metaRaw.length}, Google: ${googleRaw.length}, LinkedIn: ${linkedInRaw.length}.`
      : 'No ads found via Apify scrapers.';

  const libraryLinks = buildLibraryLinks(companyName, domain, allCreatives);

  return {
    summary: {
      activeAdCount: totalAds,
      platforms: platformsCovered.length > 0 ? platformsCovered : ['Not verified'],
      themes,
      evidence,
      sourceConfidence,
      sampleMessages,
    },
    adCreatives: allCreatives,
    libraryLinks,
    sourcesUsed: {
      linkedin: linkedInRaw.length,
      meta: metaRaw.length,
      google: googleRaw.length,
      foreplay: 0,
    },
  };
}

/**
 * Fetch competitor ads using the best source per platform:
 *   - Meta/Facebook → Apify (rich data: headlines, body, images, videos, spend)
 *   - Google        → Apify (only working option, SearchAPI engine not enabled)
 *   - LinkedIn      → SearchAPI (all Apify LinkedIn actors are broken)
 *
 * If APIFY_API_TOKEN is missing, falls back to SearchAPI for everything.
 */
export async function fetchCompetitorAds(
  companyName: string,
  domain?: string,
): Promise<WorkerAdInsight> {
  // Apify actors take 30-60s per competitor — too slow for 5-competitor parallel fetch.
  // Use SearchAPI (2-3s) for the parallel pipeline. Apify can be used for single-competitor
  // deep-dive enrichment in a future "drill down" feature.
  const hasApify = false;
  const startTime = Date.now();

  // Always get LinkedIn from SearchAPI (only reliable source)
  const { searchLinkedInAds, searchMetaAds, normalizeSearchApiToCreatives } = await import('./adlibrary');
  const linkedInRawPromise = searchLinkedInAds(companyName).catch(() => []);

  let metaCreatives: WorkerAdCreative[] = [];
  let googleCreatives: WorkerAdCreative[] = [];
  let linkedInCreatives: WorkerAdCreative[] = [];
  let metaCount = 0;
  let googleCount = 0;
  let linkedInCount = 0;

  if (hasApify) {
    // Apify for Meta + Google (parallel with LinkedIn SearchAPI)
    const [metaRaw, googleRaw, linkedInRaw] = await Promise.all([
      fetchMetaAds(companyName, domain),
      fetchGoogleAds(companyName, domain),
      linkedInRawPromise,
    ]);

    metaCreatives = normalizeMetaAds(metaRaw, companyName, domain);
    googleCreatives = normalizeGoogleAds(googleRaw, companyName, domain);
    metaCount = metaRaw.length;
    googleCount = googleRaw.length;
    linkedInCreatives = normalizeSearchApiToCreatives(linkedInRaw, 'linkedin', companyName, domain);
    linkedInCount = linkedInRaw.length;
  } else {
    // No Apify — SearchAPI for everything
    const [linkedInRaw, metaRaw] = await Promise.all([
      linkedInRawPromise,
      searchMetaAds(companyName).catch(() => []),
    ]);

    metaCreatives = normalizeSearchApiToCreatives(metaRaw, 'meta', companyName, domain);
    metaCount = metaRaw.length;
    linkedInCreatives = normalizeSearchApiToCreatives(linkedInRaw, 'linkedin', companyName, domain);
    linkedInCount = linkedInRaw.length;
  }

  // Filter out shell/irrelevant ads, then cap at 60 total (20 per platform × 3)
  const allCreatives = filterRelevantAds(
    [...metaCreatives, ...googleCreatives, ...linkedInCreatives],
    companyName,
    domain,
  ).slice(0, 60);

  // Build summary
  const allMessages = allCreatives
    .map((c) => c.headline ?? c.body)
    .filter((m): m is string => Boolean(m));
  const themes = [...new Set(allMessages.map(guessTheme))].slice(0, 5);
  const sampleMessages = [...new Set(allMessages)].slice(0, 5);
  const platformsCovered = [...new Set(allCreatives.map((c) => c.platform))] as string[];
  const totalAds = allCreatives.length;
  const durationMs = Date.now() - startTime;

  const sourceConfidence: WorkerAdInsight['summary']['sourceConfidence'] =
    totalAds >= 5 && platformsCovered.length >= 2
      ? 'high'
      : totalAds > 0
        ? 'medium'
        : 'low';

  const sources = hasApify
    ? `Apify (Meta: ${metaCount}, Google: ${googleCount}) + SearchAPI (LinkedIn: ${linkedInCount})`
    : `SearchAPI (Meta: ${metaCount}, LinkedIn: ${linkedInCount})`;

  const libraryLinks = buildLibraryLinks(companyName, domain, allCreatives);

  return {
    summary: {
      activeAdCount: totalAds,
      platforms: platformsCovered.length > 0 ? platformsCovered : ['Not verified'],
      themes,
      evidence: totalAds > 0
        ? `${sources} — ${totalAds} ads in ${(durationMs / 1000).toFixed(1)}s.`
        : 'No ads found.',
      sourceConfidence,
      sampleMessages,
    },
    adCreatives: allCreatives,
    libraryLinks,
    sourcesUsed: {
      meta: metaCount,
      google: googleCount,
      linkedin: linkedInCount,
      foreplay: 0,
    },
  };
}

/** Deduplicate creatives by advertiser + headline + platform */
function deduplicateCreatives(creatives: WorkerAdCreative[]): WorkerAdCreative[] {
  const seen = new Set<string>();
  return creatives.filter((c) => {
    const key = `${c.platform}:${c.advertiser}:${c.headline ?? ''}:${c.body?.slice(0, 50) ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
