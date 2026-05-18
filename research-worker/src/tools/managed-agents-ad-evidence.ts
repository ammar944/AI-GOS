import {
  buildAdInsight,
  buildLibraryLinks,
  searchGoogleAds,
  searchLinkedInAds,
  searchMetaAds,
} from './adlibrary';
import type {
  WorkerAdCreative,
  WorkerAdPlatform,
  WorkerLibraryLinks,
} from './adlibrary-types';

type SearchApiAdRecord = Parameters<typeof buildAdInsight>[0][number];

export type ManagedAgentsAdPlatform = WorkerAdPlatform | 'all';
export type ManagedAgentsAdRegion = 'US' | 'CA' | 'UK' | 'AU' | 'ALL';

export interface ManagedAgentsAdEvidenceInput {
  advertiser_name: string;
  domain?: string | null;
  platform: ManagedAgentsAdPlatform;
  region: ManagedAgentsAdRegion;
  limit: number;
}

export interface ManagedAgentsPlatformCounts {
  google: number;
  linkedin: number;
  meta: number;
}

export interface ManagedAgentsAdCreative {
  platform: WorkerAdPlatform;
  id: string;
  advertiser: string;
  headline: string | null;
  body: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  format: WorkerAdCreative['format'];
  isActive: boolean;
  firstSeen: string | null;
  lastSeen: string | null;
  detailsUrl: string | null;
}

export interface ManagedAgentsRawAdSample {
  platform: WorkerAdPlatform;
  id: string;
  advertiser: string | null;
  headline: string | null;
  body: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  detailsUrl: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  format: string | null;
  dataGap: string | null;
}

export interface ManagedAgentsAdEvidenceResult {
  ok: true;
  advertiser_name: string;
  domain: string | null;
  requested_platform: ManagedAgentsAdPlatform;
  region: ManagedAgentsAdRegion;
  raw_counts: ManagedAgentsPlatformCounts;
  displayable_counts: ManagedAgentsPlatformCounts;
  displayable_total: number;
  returned_creative_count: number;
  adCreatives: ManagedAgentsAdCreative[];
  libraryLinks: WorkerLibraryLinks;
  raw_source_samples: ManagedAgentsRawAdSample[];
  data_gaps: string[];
  source_errors: Partial<Record<WorkerAdPlatform, string>>;
  observed_at: string;
}

export interface ManagedAgentsRawAdEvidenceInput {
  advertiserName: string;
  domain?: string | null;
  requestedPlatform: ManagedAgentsAdPlatform;
  region: ManagedAgentsAdRegion;
  limit: number;
  googleAds: SearchApiAdRecord[];
  linkedInAds: SearchApiAdRecord[];
  metaAds: SearchApiAdRecord[];
  sourceErrors?: Partial<Record<WorkerAdPlatform, string>>;
  observedAt?: string;
}

const PLATFORMS: WorkerAdPlatform[] = ['google', 'linkedin', 'meta'];

function emptyCounts(): ManagedAgentsPlatformCounts {
  return { google: 0, linkedin: 0, meta: 0 };
}

function clampLimit(value: number): number {
  if (!Number.isInteger(value)) return 12;
  return Math.min(Math.max(value, 1), 25);
}

function firstString(values: unknown[]): string | null {
  const value = values.find((candidate) => (
    typeof candidate === 'string' && candidate.trim().length > 0
  ));
  return typeof value === 'string' ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getRecord(value: Record<string, unknown>, key: string): Record<string, unknown> | null {
  return asRecord(value[key]);
}

function getRecordArray(value: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const candidate = value[key];
  return Array.isArray(candidate) ? candidate.flatMap((item) => {
    const record = asRecord(item);
    return record ? [record] : [];
  }) : [];
}

function getPlatformRawAds(
  platform: WorkerAdPlatform,
  input: ManagedAgentsRawAdEvidenceInput,
): SearchApiAdRecord[] {
  if (platform === 'google') return input.googleAds;
  if (platform === 'linkedin') return input.linkedInAds;
  return input.metaAds;
}

function toManagedCreative(creative: WorkerAdCreative): ManagedAgentsAdCreative {
  return {
    platform: creative.platform,
    id: creative.id,
    advertiser: creative.advertiser,
    headline: creative.headline ?? null,
    body: creative.body ?? null,
    imageUrl: creative.imageUrl ?? null,
    videoUrl: creative.videoUrl ?? null,
    format: creative.format,
    isActive: creative.isActive,
    firstSeen: creative.firstSeen ?? null,
    lastSeen: creative.lastSeen ?? null,
    detailsUrl: creative.detailsUrl ?? null,
  };
}

function getDisplayableCounts(creatives: WorkerAdCreative[]): ManagedAgentsPlatformCounts {
  return creatives.reduce<ManagedAgentsPlatformCounts>((counts, creative) => ({
    ...counts,
    [creative.platform]: counts[creative.platform] + 1,
  }), emptyCounts());
}

function getRawCounts(input: ManagedAgentsRawAdEvidenceInput): ManagedAgentsPlatformCounts {
  return {
    google: input.googleAds.length,
    linkedin: input.linkedInAds.length,
    meta: input.metaAds.length,
  };
}

function getRawSample(
  platform: WorkerAdPlatform,
  rawRecord: SearchApiAdRecord,
  index: number,
  advertiserName: string,
): ManagedAgentsRawAdSample {
  const record = rawRecord as Record<string, unknown>;
  const snapshot = getRecord(record, 'snapshot');
  const content = getRecord(record, 'content');
  const advertiser = getRecord(record, 'advertiser');
  const image = getRecord(record, 'image');
  const regionStats = getRecordArray(record, 'regionStats')[0]
    ?? getRecordArray(record, 'region_stats')[0]
    ?? null;
  const snapshotImages = snapshot ? getRecordArray(snapshot, 'images') : [];
  const snapshotVideos = snapshot ? getRecordArray(snapshot, 'videos') : [];
  const snapshotCards = snapshot ? getRecordArray(snapshot, 'cards') : [];
  const previewUrls = Array.isArray(record.previewUrls)
    ? record.previewUrls
    : Array.isArray(record.preview_urls)
      ? record.preview_urls
      : [];
  const firstPreviewUrl = firstString(previewUrls);
  const firstSnapshotImage = firstString([
    snapshotImages[0]?.url,
    typeof snapshot?.images === 'object' && Array.isArray(snapshot.images) ? snapshot.images[0] : null,
  ]);
  const headline = firstString([
    record.headline,
    record.title,
    snapshot?.title,
    snapshot?.caption,
    snapshotCards[0]?.title,
    content?.headline,
  ]);
  const bodyRecord = asRecord(record.body);
  const bodySnapshot = asRecord(snapshot?.body);
  const body = firstString([
    record.description,
    typeof record.body === 'string' ? record.body : bodyRecord?.text,
    record.text,
    typeof snapshot?.body === 'string' ? snapshot.body : bodySnapshot?.text,
    snapshotCards[0]?.body,
    content?.body,
  ]);
  const imageUrl = firstString([
    record.image_url,
    firstSnapshotImage,
    snapshotCards[0]?.original_image_url,
    snapshotVideos[0]?.video_preview_image_url,
    content?.image,
    advertiser?.thumbnail,
    image?.link,
    firstPreviewUrl,
  ]);
  const videoUrl = firstString([
    record.video_url,
    snapshotVideos[0]?.video_hd_url,
  ]);
  const detailsUrl = firstString([
    record.details_url,
    record.details_link,
    record.ad_library_url,
    record.adTransparencyUrl,
    record.ad_transparency_url,
    record.link,
  ]);
  const id = firstString([
    record.ad_id,
    record.ad_archive_id,
    record.creativeId,
    record.creative_id,
    record.id,
  ]) ?? `${platform}-${index}`;
  const hasDisplayableEvidence = Boolean(headline ?? body ?? imageUrl ?? videoUrl);

  return {
    platform,
    id,
    advertiser: firstString([
      record.advertiser_name,
      record.page_name,
      advertiser?.promotor,
      advertiser?.name,
      advertiserName,
    ]),
    headline,
    body,
    imageUrl,
    videoUrl,
    detailsUrl,
    firstSeen: firstString([
      record.first_shown,
      record.start_date_formatted,
      regionStats?.firstShown,
      regionStats?.first_shown,
    ]),
    lastSeen: firstString([
      record.last_shown,
      record.end_date_formatted,
      regionStats?.lastShown,
      regionStats?.last_shown,
    ]),
    format: firstString([
      record.format,
      record.creative_format,
      record.ad_type,
      snapshot?.display_format,
    ]),
    dataGap: hasDisplayableEvidence
      ? null
      : 'Raw library row has no headline, body, image, or video fields.',
  };
}

function getRawSamples(
  input: ManagedAgentsRawAdEvidenceInput,
  sampleLimit: number,
): ManagedAgentsRawAdSample[] {
  return PLATFORMS.flatMap((platform) =>
    getPlatformRawAds(platform, input)
      .slice(0, sampleLimit)
      .map((record, index) => getRawSample(platform, record, index, input.advertiserName)),
  );
}

function getRequestedPlatforms(platform: ManagedAgentsAdPlatform): WorkerAdPlatform[] {
  return platform === 'all' ? PLATFORMS : [platform];
}

function getDataGaps(
  rawCounts: ManagedAgentsPlatformCounts,
  displayableCounts: ManagedAgentsPlatformCounts,
  returnedCreativeCount: number,
  displayableTotal: number,
  requestedPlatforms: WorkerAdPlatform[],
  sourceErrors: Partial<Record<WorkerAdPlatform, string>>,
): string[] {
  const rawCountGaps = requestedPlatforms.flatMap((platform) => {
    if (sourceErrors[platform]) {
      return [`${platform} lookup failed: ${sourceErrors[platform]}`];
    }
    if (rawCounts[platform] === 0) {
      return [`${platform} returned no raw ad-library rows for this advertiser.`];
    }
    if (displayableCounts[platform] === 0) {
      return [
        `${platform} returned ${rawCounts[platform]} raw row${rawCounts[platform] === 1 ? '' : 's'}, but no row had enough copy or media to count as a displayable creative.`,
      ];
    }
    return [];
  });
  const truncationGap = displayableTotal > returnedCreativeCount
    ? [`Returned ${returnedCreativeCount} of ${displayableTotal} displayable creatives to keep the Managed Agents transcript bounded.`]
    : [];

  return [...rawCountGaps, ...truncationGap];
}

export function buildManagedAgentsAdEvidenceFromRaw(
  input: ManagedAgentsRawAdEvidenceInput,
): ManagedAgentsAdEvidenceResult {
  const limit = clampLimit(input.limit);
  const sourceErrors = input.sourceErrors ?? {};
  const insight = buildAdInsight(
    input.googleAds,
    input.linkedInAds,
    input.metaAds,
    [],
    input.advertiserName,
    input.domain ?? undefined,
  );
  const rawCounts = getRawCounts(input);
  const displayableCounts = getDisplayableCounts(insight.adCreatives);
  const requestedPlatforms = getRequestedPlatforms(input.requestedPlatform);
  const returnedCreatives = insight.adCreatives.slice(0, limit).map(toManagedCreative);
  const libraryLinks = insight.libraryLinks ?? buildLibraryLinks(
    input.advertiserName,
    input.domain ?? undefined,
    insight.adCreatives,
  );

  return {
    ok: true,
    advertiser_name: input.advertiserName,
    domain: input.domain ?? null,
    requested_platform: input.requestedPlatform,
    region: input.region,
    raw_counts: rawCounts,
    displayable_counts: displayableCounts,
    displayable_total: insight.adCreatives.length,
    returned_creative_count: returnedCreatives.length,
    adCreatives: returnedCreatives,
    libraryLinks,
    raw_source_samples: getRawSamples(input, Math.min(limit, 4)),
    data_gaps: getDataGaps(
      rawCounts,
      displayableCounts,
      returnedCreatives.length,
      insight.adCreatives.length,
      requestedPlatforms,
      sourceErrors,
    ),
    source_errors: sourceErrors,
    observed_at: input.observedAt ?? new Date().toISOString(),
  };
}

async function fetchPlatform(
  platform: WorkerAdPlatform,
  input: ManagedAgentsAdEvidenceInput,
): Promise<{ platform: WorkerAdPlatform; records: SearchApiAdRecord[]; error?: string }> {
  try {
    if (platform === 'google') {
      return {
        platform,
        records: await searchGoogleAds(input.advertiser_name, input.domain ?? undefined),
      };
    }
    if (platform === 'linkedin') {
      return {
        platform,
        records: await searchLinkedInAds(input.advertiser_name, input.domain ?? undefined),
      };
    }
    return {
      platform,
      records: await searchMetaAds(input.advertiser_name, input.domain ?? undefined),
    };
  } catch (error) {
    return {
      platform,
      records: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchManagedAgentsAdEvidence(
  input: ManagedAgentsAdEvidenceInput,
): Promise<ManagedAgentsAdEvidenceResult> {
  const requestedPlatforms = getRequestedPlatforms(input.platform);
  const platformResults = await Promise.all(
    requestedPlatforms.map((platform) => fetchPlatform(platform, input)),
  );
  const recordsForPlatform = (platform: WorkerAdPlatform): SearchApiAdRecord[] =>
    platformResults.find((result) => result.platform === platform)?.records ?? [];
  const sourceErrors = platformResults.reduce<Partial<Record<WorkerAdPlatform, string>>>(
    (errors, result) => result.error
      ? { ...errors, [result.platform]: result.error }
      : errors,
    {},
  );

  return buildManagedAgentsAdEvidenceFromRaw({
    advertiserName: input.advertiser_name,
    domain: input.domain,
    requestedPlatform: input.platform,
    region: input.region,
    limit: input.limit,
    googleAds: recordsForPlatform('google'),
    linkedInAds: recordsForPlatform('linkedin'),
    metaAds: recordsForPlatform('meta'),
    sourceErrors,
  });
}
