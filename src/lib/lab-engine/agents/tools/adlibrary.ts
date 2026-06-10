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
  type Candidate,
  extractCompanyFromDomain,
  isAdvertiserMatch,
  normalizeDomain,
  resolveBestCandidate,
} from "./advertiser-match";

const adLibraryPlatformSchema = z.enum(["meta", "google", "linkedin"]);

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
    source: z.string().optional(),
    transcript: z.string().optional(),
    cta: z.string().optional(),
    // Advertiser-identity provenance, set from the resolveBestCandidate verdict.
    // identityVerified=false (ambiguous / unresolved) routes the creative to the
    // quarantine instead of the verified wall.
    identityVerified: z.boolean().optional(),
    identityBasis: z.string().min(1).optional(),
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
  source?: string;
  transcript?: string;
  cta?: string;
  identityVerified?: boolean;
  identityBasis?: string;
}

class SearchApiHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`SearchAPI ${status}`);
    this.name = "SearchApiHttpError";
    this.status = status;
  }
}

class ForeplayHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Foreplay ${status}`);
    this.name = "ForeplayHttpError";
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
const foreplayBaseUrl = "https://public.api.foreplay.co";
// Google Ads Transparency Center is global by default, which surfaces foreign
// entities that coincidentally share a short name (e.g. JP "株式会社RAMP" for
// "ramp.com"). Default the region so the probe stays anchored to the company's
// market. US-default fits the (US SaaS) user base; thread per-company later.
const defaultGoogleAdRegion = "US";
const searchApiTimeoutMs = 15_000;
const foreplayTimeoutMs = 8_000;

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
    // Preserve the domain-shaped provenance the identity resolver needs to tell
    // same-name pages apart (e.g. Meta page_alias "gong.hr" vs "gong.io").
    // Only fields that hold the ENTITY's own domain — never platform/profile
    // URLs like page_profile_uri (facebook.com/...) or url, which would falsely
    // contradict every candidate's verified domain.
    const pageAlias = firstString([candidate.page_alias]);
    const website = firstString([candidate.website, candidate.domain]);

    return id === undefined || name === undefined
      ? []
      : [{ id, name, pageAlias, website }];
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

async function fetchForeplayJson({
  abortSignal,
  apiKey,
  endpoint,
  params,
}: {
  abortSignal?: AbortSignal;
  apiKey: string;
  endpoint: string;
  params: Record<string, string>;
}): Promise<SearchApiRecord> {
  const urlParams = new URLSearchParams(params);
  const response = await fetchWithRetry(
    `${foreplayBaseUrl}${endpoint}?${urlParams.toString()}`,
    {
      abortSignal,
      headers: {
        Accept: "application/json",
        Authorization: apiKey,
      },
      timeoutMs: foreplayTimeoutMs,
    },
  );

  if (!response.ok) {
    throw new ForeplayHttpError(response.status);
  }

  const payload = asRecord(await response.json());
  return payload ?? {};
}

function readForeplayCollection(payload: SearchApiRecord): SearchApiRecord[] {
  const dataRecord = asRecord(payload.data);

  if (Array.isArray(payload.data)) {
    return payload.data.flatMap((item) => {
      const record = asRecord(item);
      return record === null ? [] : [record];
    });
  }

  return dataRecord === null ? [] : [dataRecord];
}

function buildLibraryLink(
  platform: AdLibraryPlatform,
  advertiserName: string,
): string {
  const encodedAdvertiser = encodeURIComponent(advertiserName);

  if (platform === "google") {
    return `https://adstransparency.google.com/?region=anywhere&q=${encodedAdvertiser}`;
  }

  if (platform === "linkedin") {
    return `https://www.linkedin.com/ad-library/search?company=${encodedAdvertiser}`;
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
  identityBasis,
  identityVerified,
  maxResults,
  platform,
  records,
}: {
  advertiserName: string;
  domain?: string;
  identityBasis: string;
  identityVerified: boolean;
  maxResults: number;
  platform: AdLibraryPlatform;
  records: readonly SearchApiRecord[];
}): NormalizedAd[] {
  return records
    .map((record, index) =>
      normalizeSearchApiRecord({ advertiserName, index, platform, record }),
    )
    .filter((ad) =>
      // Per-ad guard stays on: it catches genuine cross-advertiser leakage (e.g.
      // a different company's ad sharing a name prefix, caught by the short-name
      // URL guard). Over-dropping of valid long-name creatives is addressed by the
      // looser whole-word domain fallback in isAdvertiserMatch, not by skipping.
      // Filter BEFORE the cap so the kept window is provably the advertiser's,
      // not the first N raw rows (H4 fix).
      //
      // Prefer the real clickthrough (landingUrl) over detailsUrl for the identity
      // check: detailsUrl is usually the ad-library URL itself, which the
      // short-name domain guard deliberately exempts — so passing it first would
      // neuter the guard and let a same-name wrong-company ad (e.g. landing on
      // fathomdem.com while probing fathom.video) reach the verified wall.
      isAdvertiserMatch(
        ad.advertiserName,
        advertiserName,
        domain,
        ad.landingUrl ?? ad.detailsUrl ?? ad.url,
      ),
    )
    .filter((ad) => hasUsableCreativeText(ad))
    .map((ad) => ({ ...ad, identityVerified, identityBasis }))
    .slice(0, maxResults);
}

function mapForeplayPlatform(record: SearchApiRecord): AdLibraryPlatform {
  const rawPlatform = firstString([record.platform, record.source])?.toLowerCase() ?? "";

  if (rawPlatform.includes("linkedin")) {
    return "linkedin";
  }

  return "meta";
}

function normalizeForeplayRecord({
  advertiserName,
  index,
  record,
}: {
  advertiserName: string;
  index: number;
  record: SearchApiRecord;
}): NormalizedAd & { platform: AdLibraryPlatform } {
  const brand = getRecord(record, "brand");
  const copy = getRecord(record, "copy");
  const creative = getRecord(record, "creative");
  const metadata = getRecord(record, "metadata");
  const landingPage = getRecord(metadata, "landing_page");
  const platform = mapForeplayPlatform({
    ...record,
    platform: metadata?.platform ?? record.platform,
  });
  const title = firstString([
    record.headline,
    record.title,
    copy?.headline,
  ]);
  const snippet = firstString([
    record.description,
    typeof record.body === "string" ? record.body : undefined,
    record.primary_text,
    copy?.body,
  ]);
  const landingUrl = firstUrl([
    record.landing_page_url,
    landingPage?.url,
  ]);
  const creativeUrl = firstUrl([
    record.video,
    record.image,
    record.video_url,
    record.image_url,
    record.media_url,
    record.thumbnail,
    record.avatar,
    creative?.url,
  ]);
  const imageUrl = firstUrl([
    record.thumbnail,
    record.image,
    record.avatar,
    record.image_url,
    creative?.thumbnail_url,
  ]);
  const displayFormat = firstString([
    record.display_format,
    record.type,
    creative?.type,
  ]);
  const videoUrl =
    displayFormat?.toLowerCase().includes("video") === true
      ? creativeUrl
      : firstUrl([record.video, record.video_url]);

  return {
    platform,
    url: landingUrl ?? creativeUrl ?? "https://www.foreplay.co/",
    id: firstString([
      record.ad_library_id,
      record.ad_id,
      record.id,
    ]) ?? `foreplay-${index}`,
    advertiserName: firstString([
      brand?.name,
      record.name,
      record.brand_name,
      record.page_name,
      copy?.sponsor_name,
      advertiserName,
    ]),
    title,
    snippet,
    landingUrl,
    imageUrl,
    videoUrl,
    detailsUrl: landingUrl,
    firstSeen: firstString([
      record.first_seen,
      record.created_at,
      record.start_date,
      metadata?.first_seen,
    ]),
    lastSeen: firstString([
      record.last_seen,
      record.updated_at,
      record.end_date,
      metadata?.last_seen,
    ]),
    format: inferFormat({
      body: snippet,
      format: displayFormat,
      headline: title,
      imageUrl,
      videoUrl,
    }),
    isActive:
      typeof record.is_active === "boolean"
        ? record.is_active
        : typeof metadata?.is_active === "boolean"
          ? metadata.is_active
          : true,
    source: "foreplay",
    transcript: firstString([
      record.full_transcription,
      record.transcript,
      record.video_transcript,
      creative?.video_transcript,
    ]),
    cta: firstString([record.cta, record.call_to_action, copy?.cta]),
    identityVerified: true,
    identityBasis: "domain",
  };
}

function foreplayBrandDomainConflicts({
  brand,
  targetDomain,
}: {
  brand: SearchApiRecord;
  targetDomain: string;
}): boolean {
  const websites = getArray(brand, "websites");
  const brandDomain = firstString([
    brand.domain,
    brand.website,
    websites[0],
  ]);

  if (brandDomain === undefined) {
    return false;
  }

  const brandDomainBase = extractCompanyFromDomain(brandDomain);
  const targetDomainBase = extractCompanyFromDomain(targetDomain);

  return (
    brandDomainBase !== undefined &&
    targetDomainBase !== undefined &&
    brandDomainBase !== targetDomainBase
  );
}

function extractForeplayMetaPageId(brand: SearchApiRecord): string | undefined {
  const candidate = firstString([brand.page_id, brand.ad_library_id]);
  return candidate !== undefined && /^\d{6,}$/.test(candidate)
    ? candidate
    : undefined;
}

function normalizeForeplayRecords({
  advertiserName,
  domain,
  maxResults,
  platform,
  records,
}: {
  advertiserName: string;
  domain: string;
  maxResults: number;
  platform: AdLibraryPlatform;
  records: readonly SearchApiRecord[];
}): NormalizedAd[] {
  return records
    .map((record, index) =>
      normalizeForeplayRecord({ advertiserName, index, record }),
    )
    .filter((ad) => ad.platform === platform)
    .filter((ad) =>
      isAdvertiserMatch(
        ad.advertiserName,
        advertiserName,
        domain,
        ad.landingUrl,
      ),
    )
    .filter((ad) => hasUsableCreativeText(ad))
    .map((ad) => {
      const { platform: rawPlatform, ...normalized } = ad;
      void rawPlatform;
      return normalized;
    })
    .slice(0, maxResults);
}

// Map the advertiser-resolution verdict to per-ad provenance. A candidate only
// earns the verified wall when the accepted match was backed by a real domain
// signal; name-only accepted matches are carried through for quarantine.
function identityFromVerdict({
  domainCorroborated,
  verdict,
}: {
  domainCorroborated: boolean;
  verdict: "accepted" | "ambiguous" | "rejected";
}): { identityVerified: boolean; identityBasis: string } {
  if (verdict === "accepted") {
    if (!domainCorroborated) {
      return {
        identityVerified: false,
        identityBasis: "name_only",
      };
    }

    return {
      identityVerified: true,
      identityBasis: "domain",
    };
  }
  return { identityVerified: false, identityBasis: "ambiguous" };
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
    ...identityFromVerdict({
      domainCorroborated: candidateResult.domainCorroborated ?? false,
      verdict: candidateResult.verdict,
    }),
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
    ...identityFromVerdict({
      domainCorroborated: candidateResult.domainCorroborated ?? false,
      verdict: candidateResult.verdict,
    }),
    maxResults,
    platform: "meta",
    records: getRecordArray(adsPayload, "ads"),
  });
}

// Part B — verified-domain recall recovery. When an upstream resolver (the
// Foreplay domain->brand prepass) has already resolved a competitor's REAL Meta
// page id BY DOMAIN, fetch that page's ads directly and tag them domain-verified,
// bypassing the conservative name/alias resolution in searchMetaAds (which
// quarantines legitimate non-domain-shaped aliases like `rampcard`). Safe because
// the page id is domain-anchored upstream; the adapter still re-checks per-ad
// language + advertiser reconciliation before anything reaches the verified wall.
export async function fetchVerifiedMetaPageAds({
  abortSignal,
  advertiser,
  domain,
  maxResults,
  pageId,
}: {
  abortSignal?: AbortSignal;
  advertiser: string;
  domain: string;
  maxResults: number;
  pageId: string;
}): Promise<AdLibraryOutput | ToolGap> {
  const apiKey = process.env.SEARCHAPI_KEY;

  if (apiKey === undefined || apiKey.trim() === "") {
    return credentialGap("SEARCHAPI_KEY") as ToolGap;
  }

  try {
    const adsPayload = await fetchSearchApiJson({
      abortSignal,
      apiKey,
      params: {
        engine: "meta_ad_library",
        page_id: pageId,
        active_status: "all",
      },
    });

    const ads = normalizeSearchApiRecords({
      advertiserName: advertiser,
      domain,
      ...identityFromVerdict({
        domainCorroborated: true,
        verdict: "accepted",
      }),
      maxResults,
      platform: "meta",
      records: getRecordArray(adsPayload, "ads"),
    });

    return { type: "result", advertiser, platform: "meta", ads };
  } catch (error) {
    return toApiErrorGap(error);
  }
}

// LinkedIn link-redirect false-positive guard (ported from the worker, Wave 6e
// Hole 4). LinkedIn omits links on awareness ads and hosts redirect URLs that
// hide the ultimate destination, so the per-ad domain guard cannot rely on a
// clickthrough URL the way Google/Meta can. When we have a verified domain
// (`domain` is set) drop a raw record ONLY when there is strong evidence its
// destination is a different external domain; keep ambiguous records. Short
// names (<=6 chars) require positive domain corroboration to avoid wrong-company
// ads (e.g. fathom.ai vs fathom.com sharing the "Fathom" LinkedIn page name).
function passesLinkedInLinkGuard({
  record,
  normalizedDomain,
  isShortName,
}: {
  record: SearchApiRecord;
  normalizedDomain: string;
  isShortName: boolean;
}): boolean {
  const domainBase = normalizedDomain.split(".")[0] ?? "";
  const domainTld = normalizedDomain.split(".").slice(1).join("").toLowerCase();
  const rawLink = typeof record.link === "string" ? record.link : "";
  const link = rawLink.toLowerCase();

  let decodedLink: string;
  try {
    decodedLink = decodeURIComponent(link);
  } catch {
    decodedLink = link;
  }

  // Link contains our verified domain (raw or URL-decoded inside a redirect).
  // LinkedIn redirect URLs encode dots as %2E (e.g. gong%2Eio vs gong.io), so
  // the decoded form must be checked too.
  if (decodedLink !== "" && decodedLink.includes(normalizedDomain)) {
    return true;
  }

  const host = (() => {
    try {
      return decodedLink !== "" ? new URL(decodedLink).hostname.toLowerCase() : "";
    } catch {
      return "";
    }
  })();

  if (host.endsWith("linkedin.com") || host.endsWith("lnkd.in")) {
    const slugMatch = decodedLink.match(
      /linkedin\.com\/(?:company|showcase|in)\/([a-z0-9-]+)/i,
    );

    if (slugMatch) {
      const slug = slugMatch[1].toLowerCase();
      // Slug contains base AND TLD -> strong match (fathom.ai -> fathom-ai).
      if (
        domainBase !== "" &&
        slug.includes(domainBase) &&
        domainTld !== "" &&
        slug.includes(domainTld)
      ) {
        return true;
      }
      // Slug equals bare base only -> ambiguous. Short-name: drop.
      if (
        slug === domainBase ||
        slug.startsWith(`${domainBase}-`) ||
        slug.endsWith(`-${domainBase}`)
      ) {
        return !isShortName;
      }
      // Slug doesn't corroborate base -> wrong company, drop.
      return false;
    }

    // LinkedIn URL with no extractable slug (feed post, search, etc.).
    // Short-name: drop (can't verify). Long-name: keep.
    return !isShortName;
  }

  // Missing link: short-name can't disambiguate -> drop. Long-name -> keep.
  if (link === "") {
    return !isShortName;
  }

  // Link is a clearly different external URL that doesn't contain our verified
  // domain -> drop.
  return false;
}

async function searchLinkedInAds({
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
  // The LinkedIn Ad Library engine takes the brand name on `advertiser=` and
  // returns ads directly (no advertiser-search step), so there is no candidate
  // resolution / NoMatchedAdvertiserError stage here. A transport failure throws
  // SearchApiHttpError, which the tool's execute() maps to a structured api_error
  // gap; an empty result becomes a zero-row `result` the adapter turns into a
  // documented data gap. Neither path returns a silent [].
  const payload = await fetchSearchApiJson({
    abortSignal,
    apiKey,
    params: {
      engine: "linkedin_ad_library",
      advertiser: advertiserName,
    },
  });
  const records = getRecordArray(payload, "ads");

  const guardedRecords =
    domain === undefined
      ? records
      : records.filter((record) =>
          passesLinkedInLinkGuard({
            record,
            normalizedDomain: normalizeDomain(domain),
            isShortName: advertiserName.trim().length <= 6,
          }),
        );

  // LinkedIn has no advertiser-candidate resolution stage, so identity can only
  // be trusted when a verified domain drove the link guard above. Without a
  // domain the result is carried through as low-confidence (quarantined), never
  // presented as proven.
  return normalizeSearchApiRecords({
    advertiserName,
    domain,
    identityVerified: domain !== undefined,
    identityBasis: domain !== undefined ? "domain" : "name_only",
    maxResults,
    platform: "linkedin",
    records: guardedRecords,
  });
}

async function searchForeplayAds({
  abortSignal,
  advertiserName,
  domain,
  maxResults,
  platform,
  searchApiKey,
}: {
  abortSignal?: AbortSignal;
  advertiserName: string;
  domain?: string;
  maxResults: number;
  platform: AdLibraryPlatform;
  searchApiKey?: string;
}): Promise<NormalizedAd[]> {
  const apiKey = process.env.FOREPLAY_API_KEY;

  if (
    apiKey === undefined ||
    apiKey.trim() === "" ||
    domain === undefined ||
    platform === "google"
  ) {
    return [];
  }

  const normalizedDomain = normalizeDomain(domain);
  const brandPayload = await fetchForeplayJson({
    abortSignal,
    apiKey,
    endpoint: "/api/brand/getBrandsByDomain",
    params: {
      domain: normalizedDomain,
      limit: "1",
      order: "most_ranked",
    },
  });
  const brand = readForeplayCollection(brandPayload).find((candidate) => {
    const brandId = firstString([candidate.id, candidate.brand_id]);
    return brandId !== undefined;
  });
  const brandId = brand === undefined ? undefined : firstString([brand.id, brand.brand_id]);
  const brandName = brand === undefined
    ? undefined
    : firstString([brand.name, brand.brand_name, advertiserName]);

  if (
    brand === undefined ||
    brandId === undefined ||
    brandName === undefined ||
    foreplayBrandDomainConflicts({ brand, targetDomain: normalizedDomain }) ||
    !isAdvertiserMatch(brandName, advertiserName, normalizedDomain)
  ) {
    return [];
  }

  const metaPageId = extractForeplayMetaPageId(brand);
  const [foreplayPayload, metaPageOutput] = await Promise.all([
    fetchForeplayJson({
      abortSignal,
      apiKey,
      endpoint: "/api/brand/getAdsByBrandId",
      params: {
        brand_ids: brandId,
        limit: String(maxResults),
        order: "newest",
      },
    }),
    platform === "meta" &&
    metaPageId !== undefined &&
    searchApiKey !== undefined &&
    searchApiKey.trim() !== ""
      ? fetchVerifiedMetaPageAds({
          abortSignal,
          advertiser: advertiserName,
          domain: normalizedDomain,
          maxResults,
          pageId: metaPageId,
        })
      : Promise.resolve(null),
  ]);

  const foreplayAds = normalizeForeplayRecords({
    advertiserName,
    domain: normalizedDomain,
    maxResults,
    platform,
    records: readForeplayCollection(foreplayPayload),
  });
  const metaPageAds =
    metaPageOutput !== null && metaPageOutput.type === "result"
      ? metaPageOutput.ads
      : [];

  return [...metaPageAds, ...foreplayAds].slice(0, maxResults);
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

  if (platform === "linkedin") {
    return searchLinkedInAds({
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

function adRichnessScore(ad: NormalizedAd): number {
  return [
    ad.title,
    ad.snippet,
    ad.landingUrl,
    ad.imageUrl,
    ad.videoUrl,
    ad.transcript,
    ad.cta,
  ].filter((value) => value !== undefined && value.trim().length > 0).length;
}

function adDedupeKey(ad: NormalizedAd, platform: AdLibraryPlatform): string {
  if (ad.id !== undefined && ad.id.trim().length > 0) {
    return `id:${ad.id.trim()}`;
  }

  return [
    platform,
    ad.advertiserName?.toLowerCase().trim() ?? "",
    ad.title?.toLowerCase().trim().slice(0, 80) ?? "",
    ad.snippet?.toLowerCase().trim().slice(0, 80) ?? "",
    ad.imageUrl ?? "",
    ad.videoUrl ?? "",
    ad.landingUrl ?? "",
  ].join("|");
}

function dedupeAds(
  ads: readonly NormalizedAd[],
  platform: AdLibraryPlatform,
): NormalizedAd[] {
  const byKey = new Map<string, NormalizedAd>();

  for (const ad of ads) {
    const key = adDedupeKey(ad, platform);
    const existing = byKey.get(key);

    if (existing === undefined || adRichnessScore(ad) > adRichnessScore(existing)) {
      byKey.set(key, ad);
    }
  }

  return Array.from(byKey.values());
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
    const apiKey = process.env.SEARCHAPI_KEY?.trim();
    const normalizedDomain = domain === undefined ? undefined : normalizeDomain(domain);
    let nativeGap: ToolGap | undefined;
    let nativeAds: NormalizedAd[] = [];

    if (apiKey === undefined || apiKey === "") {
      nativeGap = credentialGap("SEARCHAPI_KEY") as ToolGap;
    } else {
      try {
        nativeAds = await fetchNativeAds({
          abortSignal,
          advertiserName: advertiser,
          apiKey,
          domain: normalizedDomain,
          maxResults: max_results,
          platform,
        });
      } catch (error) {
        nativeGap = toApiErrorGap(error);
      }
    }

    let foreplayAds: NormalizedAd[] = [];

    try {
      foreplayAds = await searchForeplayAds({
        abortSignal,
        advertiserName: advertiser,
        domain: normalizedDomain,
        maxResults: max_results,
        platform,
        searchApiKey: apiKey,
      });
    } catch {
      foreplayAds = [];
    }

    const ads = dedupeAds([...nativeAds, ...foreplayAds], platform).slice(
      0,
      max_results,
    );

    if (ads.length === 0 && nativeGap !== undefined) {
      return nativeGap;
    }

    return {
      type: "result",
      advertiser,
      platform,
      ads,
    };
  },
});
