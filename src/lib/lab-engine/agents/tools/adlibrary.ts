import { tool } from "ai";
import { z } from "zod";

import {
  ToolGapSchema,
  apiErrorGap,
  credentialGap,
  errorToGap,
  fetchWithRetry,
  type ToolGap,
} from "./_shared";
import {
  isAdvertiserMatch,
  normalizeDomain,
  resolveBestCandidate,
} from "./advertiser-match";

const adLibraryPlatformSchema = z.enum(["meta", "google"]);

const adLibraryAdSchema = z
  .object({
    url: z.string().url(),
    id: z.string().min(1).optional(),
    advertiserName: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    snippet: z.string().min(1).optional(),
    landingUrl: z.string().url().optional(),
    imageUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    detailsUrl: z.string().url().optional(),
    firstSeen: z.string().min(1).optional(),
    lastSeen: z.string().min(1).optional(),
    format: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const AdLibraryOutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      advertiser: z.string().min(1),
      platform: adLibraryPlatformSchema,
      ads: z.array(adLibraryAdSchema),
    })
    .strict(),
  ToolGapSchema,
]);

export type AdLibraryOutput = z.infer<typeof AdLibraryOutputSchema>;

type AdLibraryPlatform = z.infer<typeof adLibraryPlatformSchema>;
type SearchApiRecord = Record<string, unknown>;

interface Candidate {
  id: string;
  name: string;
}

interface NormalizedAd {
  url: string;
  id?: string;
  advertiserName?: string;
  title?: string;
  snippet?: string;
  landingUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  detailsUrl?: string;
  firstSeen?: string;
  lastSeen?: string;
  format?: string;
  isActive?: boolean;
}

class SearchApiHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`SearchAPI ${status}`);
    this.name = "SearchApiHttpError";
    this.status = status;
  }
}

class NoMatchedAdvertiserError extends Error {
  readonly advertiserName: string;
  readonly domain: string | undefined;
  readonly platform: AdLibraryPlatform;

  constructor({
    advertiserName,
    domain,
    platform,
  }: {
    advertiserName: string;
    domain?: string;
    platform: AdLibraryPlatform;
  }) {
    const domainClause = domain === undefined ? "" : ` for domain "${domain}"`;
    super(
      `No ${platform} advertiser matched "${advertiserName}"${domainClause} with sufficient confidence.`,
    );
    this.name = "NoMatchedAdvertiserError";
    this.advertiserName = advertiserName;
    this.domain = domain;
    this.platform = platform;
  }
}

const searchApiBaseUrl = "https://www.searchapi.io/api/v1/search";
// Google Ads Transparency Center is global by default, which surfaces foreign
// entities that coincidentally share a short name (e.g. JP "株式会社RAMP" for
// "ramp.com"). Default the region so the probe stays anchored to the company's
// market. US-default fits the (US SaaS) user base; thread per-company later.
const defaultGoogleAdRegion = "US";
const searchApiTimeoutMs = 15_000;

function asRecord(value: unknown): SearchApiRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as SearchApiRecord)
    : null;
}

function getRecord(record: SearchApiRecord | null, key: string): SearchApiRecord | null {
  return asRecord(record?.[key]);
}

function getArray(record: SearchApiRecord | null, key: string): unknown[] {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function getRecordArray(record: SearchApiRecord | null, key: string): SearchApiRecord[] {
  return getArray(record, key).flatMap((item) => {
    const itemRecord = asRecord(item);
    return itemRecord === null ? [] : [itemRecord];
  });
}

function firstString(values: readonly unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function hasTemplateToken(value: string | undefined): boolean {
  return value !== undefined && /\{\{[^}]+\}\}/.test(value);
}

function hasUsableCreativeText(ad: NormalizedAd): boolean {
  return ![
    ad.advertiserName,
    ad.snippet,
    ad.title,
  ].some((value) => hasTemplateToken(value));
}

function normalizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  const candidate = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;

  try {
    return new URL(candidate).toString();
  } catch {
    return undefined;
  }
}

function firstUrl(values: readonly unknown[]): string | undefined {
  for (const value of values) {
    const url = normalizeUrl(value);

    if (url !== undefined) {
      return url;
    }
  }

  return undefined;
}

function readCandidates(
  payload: SearchApiRecord,
  collectionKey: string,
  idKeys: readonly string[],
): Candidate[] {
  return getRecordArray(payload, collectionKey).flatMap((candidate) => {
    const id = firstString(idKeys.map((key) => candidate[key]));
    const name = firstString([
      candidate.name,
      candidate.advertiser_name,
      candidate.page_name,
    ]);

    return id === undefined || name === undefined ? [] : [{ id, name }];
  });
}

function buildSearchApiUrl(
  apiKey: string,
  params: Record<string, string>,
): string {
  const urlParams = new URLSearchParams({ ...params, api_key: apiKey });
  return `${searchApiBaseUrl}?${urlParams.toString()}`;
}

async function fetchSearchApiJson({
  abortSignal,
  apiKey,
  params,
}: {
  abortSignal?: AbortSignal;
  apiKey: string;
  params: Record<string, string>;
}): Promise<SearchApiRecord> {
  const response = await fetchWithRetry(buildSearchApiUrl(apiKey, params), {
    abortSignal,
    timeoutMs: searchApiTimeoutMs,
  });

  if (!response.ok) {
    // A status that survived the retry budget (e.g. a persistent 429) is terminal.
    throw new SearchApiHttpError(response.status);
  }

  const payload = asRecord(await response.json());
  return payload ?? {};
}

function buildLibraryLink(
  platform: AdLibraryPlatform,
  advertiserName: string,
): string {
  const encodedAdvertiser = encodeURIComponent(advertiserName);

  if (platform === "google") {
    return `https://adstransparency.google.com/?region=anywhere&q=${encodedAdvertiser}`;
  }

  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodedAdvertiser}&search_type=keyword_unordered&media_type=all`;
}

function inferFormat({
  body,
  format,
  headline,
  imageUrl,
  videoUrl,
}: {
  body?: string;
  format?: string;
  headline?: string;
  imageUrl?: string;
  videoUrl?: string;
}): string {
  const normalizedFormat = format?.toLowerCase();

  if (normalizedFormat?.includes("video") === true) {
    return "video";
  }

  if (normalizedFormat?.includes("carousel") === true) {
    return "carousel";
  }

  if (normalizedFormat?.includes("image") === true) {
    return "image";
  }

  if (normalizedFormat?.includes("text") === true) {
    return "text";
  }

  if (videoUrl !== undefined) {
    return "video";
  }

  if (imageUrl !== undefined) {
    return "image";
  }

  if (headline !== undefined || body !== undefined) {
    return "text";
  }

  return "unknown";
}

function getSnapshotImageUrl(snapshot: SearchApiRecord | null): string | undefined {
  const firstImage = getArray(snapshot, "images")[0];
  const firstImageRecord = asRecord(firstImage);

  return firstUrl([
    typeof firstImage === "string" ? firstImage : undefined,
    firstImageRecord?.url,
  ]);
}

function normalizeSearchApiRecord({
  advertiserName,
  index,
  platform,
  record,
}: {
  advertiserName: string;
  index: number;
  platform: AdLibraryPlatform;
  record: SearchApiRecord;
}): NormalizedAd {
  const snapshot = getRecord(record, "snapshot");
  const content = getRecord(record, "content");
  const advertiserRecord = getRecord(record, "advertiser");
  const image = getRecord(record, "image");
  const bodyRecord = getRecord(record, "body");
  const snapshotBodyRecord = getRecord(snapshot, "body");
  const firstSnapshotVideo = getRecordArray(snapshot, "videos")[0] ?? null;
  const firstSnapshotCard = getRecordArray(snapshot, "cards")[0] ?? null;
  const previewUrls = getArray(record, "previewUrls").length > 0
    ? getArray(record, "previewUrls")
    : getArray(record, "preview_urls");
  const headline = firstString([
    record.headline,
    record.title,
    snapshot?.title,
    snapshot?.caption,
    firstSnapshotCard?.title,
    content?.headline,
  ]);
  const body = firstString([
    record.description,
    typeof record.body === "string" ? record.body : bodyRecord?.text,
    record.text,
    typeof snapshot?.body === "string" ? snapshot.body : snapshotBodyRecord?.text,
    firstSnapshotCard?.body,
    content?.body,
  ]);
  const imageUrl = firstUrl([
    record.image_url,
    getSnapshotImageUrl(snapshot),
    firstSnapshotCard?.original_image_url,
    firstSnapshotVideo?.video_preview_image_url,
    content?.image,
    advertiserRecord?.thumbnail,
    image?.link,
    firstString(previewUrls),
  ]);
  const videoUrl = firstUrl([
    record.video_url,
    firstSnapshotVideo?.video_hd_url,
  ]);
  const detailsUrl = firstUrl([
    record.details_url,
    record.details_link,
    record.ad_library_url,
    record.adTransparencyUrl,
    record.ad_transparency_url,
    record.link,
  ]) ?? (platform === "meta" && typeof record.ad_archive_id === "string"
    ? `https://www.facebook.com/ads/library/?id=${encodeURIComponent(
        record.ad_archive_id,
      )}`
    : undefined) ?? (platform === "google" && typeof record.advertiser_id === "string"
    ? `https://adstransparency.google.com/advertiser/${encodeURIComponent(
        record.advertiser_id,
      )}`
    : undefined);
  const landingUrl = firstUrl([snapshot?.link_url, record.landing_url]);
  const id = firstString([
    record.ad_id,
    record.ad_archive_id,
    record.creativeId,
    record.creative_id,
    record.id,
  ]) ?? `${platform}-${index}`;
  const displayFormat = firstString([
    record.format,
    record.creative_format,
    record.ad_type,
    snapshot?.display_format,
  ]);
  const normalizedAdvertiserName = firstString([
    record.advertiser_name,
    record.page_name,
    snapshot?.page_name,
    advertiserRecord?.promotor,
    advertiserRecord?.name,
    advertiserName,
  ]);

  return {
    url: detailsUrl ?? landingUrl ?? buildLibraryLink(platform, advertiserName),
    id,
    advertiserName: normalizedAdvertiserName,
    title: headline,
    snippet: body,
    landingUrl,
    imageUrl,
    videoUrl,
    detailsUrl,
    firstSeen: firstString([
      record.first_shown,
      record.start_date_formatted,
      record.startDate,
      record.start_date,
    ]),
    lastSeen: firstString([
      record.last_shown,
      record.end_date_formatted,
      record.endDate,
      record.end_date,
    ]),
    format: inferFormat({
      body,
      format: displayFormat,
      headline,
      imageUrl,
      videoUrl,
    }),
    isActive: typeof record.is_active === "boolean" ? record.is_active : true,
  };
}

function normalizeSearchApiRecords({
  advertiserName,
  domain,
  maxResults,
  platform,
  records,
}: {
  advertiserName: string;
  domain?: string;
  maxResults: number;
  platform: AdLibraryPlatform;
  records: readonly SearchApiRecord[];
}): NormalizedAd[] {
  return records
    .slice(0, maxResults)
    .map((record, index) =>
      normalizeSearchApiRecord({ advertiserName, index, platform, record }),
    )
    .filter((ad) =>
      // Per-ad guard stays on: it catches genuine cross-advertiser leakage (e.g.
      // a different company's ad sharing a name prefix, caught by the short-name
      // URL guard). Over-dropping of valid long-name creatives is addressed by the
      // looser whole-word domain fallback in isAdvertiserMatch, not by skipping.
      isAdvertiserMatch(
        ad.advertiserName,
        advertiserName,
        domain,
        ad.detailsUrl ?? ad.landingUrl ?? ad.url,
      ),
    )
    .filter((ad) => hasUsableCreativeText(ad));
}

async function searchGoogleAds({
  abortSignal,
  advertiserName,
  apiKey,
  domain,
  maxResults,
}: {
  abortSignal?: AbortSignal;
  advertiserName: string;
  apiKey: string;
  domain?: string;
  maxResults: number;
}): Promise<NormalizedAd[]> {
  const advertiserPayload = await fetchSearchApiJson({
    abortSignal,
    apiKey,
    params: {
      engine: "google_ads_transparency_center_advertiser_search",
      q: advertiserName,
      region: defaultGoogleAdRegion,
    },
  });
  const candidates = readCandidates(advertiserPayload, "advertisers", [
    "id",
    "advertiser_id",
  ]);
  const candidateResult = resolveBestCandidate(
    candidates,
    advertiserName,
    domain,
    domain !== undefined,
  );
  const candidate = candidateResult.candidate;

  if (candidateResult.verdict === "rejected" || candidate === undefined) {
    throw new NoMatchedAdvertiserError({
      advertiserName,
      domain,
      platform: "google",
    });
  }

  const adsPayload = await fetchSearchApiJson({
    abortSignal,
    apiKey,
    params: {
      engine: "google_ads_transparency_center",
      advertiser_id: candidate.id,
      region: defaultGoogleAdRegion,
    },
  });

  return normalizeSearchApiRecords({
    advertiserName,
    domain,
    maxResults,
    platform: "google",
    records: getRecordArray(adsPayload, "ad_creatives"),
  });
}

async function searchMetaAds({
  abortSignal,
  advertiserName,
  apiKey,
  domain,
  maxResults,
}: {
  abortSignal?: AbortSignal;
  advertiserName: string;
  apiKey: string;
  domain?: string;
  maxResults: number;
}): Promise<NormalizedAd[]> {
  const pagePayload = await fetchSearchApiJson({
    abortSignal,
    apiKey,
    params: {
      engine: "meta_ad_library_page_search",
      q: advertiserName,
    },
  });
  const candidates = readCandidates(pagePayload, "page_results", ["page_id", "id"]);
  const candidateResult = resolveBestCandidate(
    candidates,
    advertiserName,
    domain,
    domain !== undefined,
  );
  const candidate = candidateResult.candidate;

  if (candidateResult.verdict === "rejected" || candidate === undefined) {
    throw new NoMatchedAdvertiserError({
      advertiserName,
      domain,
      platform: "meta",
    });
  }

  const adsPayload = await fetchSearchApiJson({
    abortSignal,
    apiKey,
    params: {
      engine: "meta_ad_library",
      page_id: candidate.id,
      active_status: "all",
    },
  });

  return normalizeSearchApiRecords({
    advertiserName,
    domain,
    maxResults,
    platform: "meta",
    records: getRecordArray(adsPayload, "ads"),
  });
}

async function fetchNativeAds({
  abortSignal,
  advertiserName,
  apiKey,
  domain,
  maxResults,
  platform,
}: {
  abortSignal?: AbortSignal;
  advertiserName: string;
  apiKey: string;
  domain?: string;
  maxResults: number;
  platform: AdLibraryPlatform;
}): Promise<NormalizedAd[]> {
  if (platform === "google") {
    return searchGoogleAds({
      abortSignal,
      advertiserName,
      apiKey,
      domain,
      maxResults,
    });
  }

  return searchMetaAds({
    abortSignal,
    advertiserName,
    apiKey,
    domain,
    maxResults,
  });
}

function toApiErrorGap(error: unknown): ToolGap {
  if (error instanceof NoMatchedAdvertiserError) {
    return {
      type: "gap",
      reason: "not_implemented",
      message: error.message,
    };
  }

  if (error instanceof SearchApiHttpError) {
    return apiErrorGap(error.message);
  }

  return errorToGap(error, "AdLibrary fetch failed");
}

export const adLibraryAgentTool = tool({
  description:
    "Look up active advertising creative for a brand on Meta Ad Library or Google Ads Transparency.",
  inputSchema: z
    .object({
      advertiser: z.string().min(1),
      platform: adLibraryPlatformSchema.default("meta"),
      max_results: z.number().int().positive().default(8),
      domain: z.string().min(1).optional(),
    })
    .strict(),
  outputSchema: AdLibraryOutputSchema,
  execute: async (
    { advertiser, platform, max_results, domain },
    { abortSignal },
  ): Promise<AdLibraryOutput> => {
    const apiKey = process.env.SEARCHAPI_KEY;

    if (apiKey === undefined || apiKey.trim() === "") {
      return credentialGap("SEARCHAPI_KEY") as ToolGap;
    }

    try {
      const ads = await fetchNativeAds({
        abortSignal,
        advertiserName: advertiser,
        apiKey,
        domain: domain === undefined ? undefined : normalizeDomain(domain),
        maxResults: max_results,
        platform,
      });

      return {
        type: "result",
        advertiser,
        platform,
        ads,
      };
    } catch (error) {
      return toApiErrorGap(error);
    }
  },
});
