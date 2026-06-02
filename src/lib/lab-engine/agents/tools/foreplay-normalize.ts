import type { ForeplayAdDetails } from "@/lib/foreplay/types";

// The competitor ad adapter (competitor-ad-adapter.ts) ingests ad rows that must
// validate against adLibraryAdSchema (adlibrary.ts): a .strict() object whose
// `url` is a required valid URL and whose imageUrl/videoUrl/landingUrl/detailsUrl
// must be valid URLs when present. The Foreplay platform enum maps onto the
// artifact ad-platform enum (google | meta | linkedin); facebook/instagram/tiktok
// all collapse to "meta", linkedin stays "linkedin". `platform` is a discriminator
// the prepass uses to bucket ads into a synthetic per-platform toolResult; it is
// stripped before the row is validated by adLibraryAdSchema.
export type NormalizedAdPlatform = "meta" | "linkedin";

export interface NormalizedAd {
  platform: NormalizedAdPlatform;
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
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

// Only emit a url-shaped field when it parses as an absolute URL. adLibraryAdSchema
// rejects non-URL strings on these fields, so an unparseable value must become
// `undefined` (the field is optional) rather than poison the strict parse.
function asUrl(value: string | undefined): string | undefined {
  const trimmed = nonEmpty(value);

  if (trimmed === undefined) {
    return undefined;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return undefined;
  }
}

function mapPlatform(
  platform: ForeplayAdDetails["metadata"]["platform"],
): NormalizedAdPlatform {
  return platform === "linkedin" ? "linkedin" : "meta";
}

/**
 * Pure mapping from a Foreplay ad to the adapter's ad-row shape (+ a platform
 * discriminator for bucketing). The shared numeric `ad_library_id` is preferred
 * for `id` so the server-merge dedup (adCreativeFingerprint TIER 1) collapses the
 * Foreplay row onto the same Meta `ad_archive_id` SearchAPI returns.
 */
export function normalizeForeplayAd(ad: ForeplayAdDetails): NormalizedAd {
  const landingPageUrl = asUrl(ad.metadata.landing_page?.url);
  const creativeUrl = asUrl(ad.creative.url);
  // sourceUrl downstream is derived by buildCreative as `detailsUrl ?? url`, and
  // adEvidenceCreativeSchema requires a non-null URL. The landing page (or, when
  // absent, the r2.foreplay.co creative asset) is always a valid absolute URL.
  const url =
    landingPageUrl ??
    creativeUrl ??
    asUrl(ad.metadata.landing_page?.screenshot_url) ??
    `https://www.foreplay.co/`;

  const isVideo = ad.creative.type === "video";

  return {
    platform: mapPlatform(ad.metadata.platform),
    url,
    id: nonEmpty(ad.ad_library_id) ?? nonEmpty(ad.ad_id),
    advertiserName: nonEmpty(ad.brand.name) ?? nonEmpty(ad.copy.sponsor_name),
    title: nonEmpty(ad.copy.headline),
    snippet: nonEmpty(ad.copy.body),
    landingUrl: landingPageUrl,
    imageUrl: asUrl(ad.creative.thumbnail_url),
    videoUrl: isVideo ? creativeUrl : undefined,
    detailsUrl: landingPageUrl,
    firstSeen: nonEmpty(ad.metadata.first_seen),
    lastSeen: nonEmpty(ad.metadata.last_seen),
    format: nonEmpty(ad.creative.type),
    isActive: ad.metadata.is_active,
    source: "foreplay",
    transcript: nonEmpty(ad.creative.video_transcript),
    cta: nonEmpty(ad.copy.cta),
  };
}
