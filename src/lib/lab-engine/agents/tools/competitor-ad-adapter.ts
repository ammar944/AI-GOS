import type { CompetitorAdEvidenceGroup } from "../../artifacts/schemas/competitor-landscape";
import type { AgentStep } from "../section-agent";
import { AdLibraryOutputSchema } from "./adlibrary";

type AdEvidencePlatform = CompetitorAdEvidenceGroup["platforms"][number];
type PlatformCounts = CompetitorAdEvidenceGroup["rawCounts"];
type LibraryLinks = CompetitorAdEvidenceGroup["libraryLinks"];
type AdEvidenceCreative = CompetitorAdEvidenceGroup["creatives"][number];
type RawSourceSample = CompetitorAdEvidenceGroup["rawSourceSamples"][number];
type DataGap = CompetitorAdEvidenceGroup["dataGaps"][number];
type SourceError = CompetitorAdEvidenceGroup["sourceErrors"][number];
type AdToolName = "adlibrary" | "google_ads" | "meta_ads";

export interface BuildCompetitorAdEvidenceGroupsArgs {
  steps: readonly AgentStep[];
  observedAt: string;
  returnedCreativeLimit?: number;
}

interface RawAd {
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

interface MutableAdEvidenceGroup {
  advertiserName: string;
  domain: string | null;
  platforms: Set<AdEvidencePlatform>;
  rawCounts: PlatformCounts;
  displayableCounts: PlatformCounts;
  creatives: AdEvidenceCreative[];
  libraryLinks: LibraryLinks;
  rawSourceSamples: RawSourceSample[];
  sourceErrors: SourceError[];
  observedAt: string;
}

const adToolNames = ["adlibrary", "google_ads", "meta_ads"] as const;
const platformOrder: readonly AdEvidencePlatform[] = [
  "google",
  "meta",
  "linkedin",
];
const defaultReturnedCreativeLimit = 4;
const rawSourceSampleLimit = 4;

function isAdToolName(value: string): value is AdToolName {
  return adToolNames.includes(value as AdToolName);
}

function emptyCounts(): PlatformCounts {
  return { google: 0, meta: 0, linkedin: 0 };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizePlatform(value: unknown): AdEvidencePlatform | null {
  return value === "google" || value === "meta" || value === "linkedin"
    ? value
    : null;
}

function platformFromToolName(toolName: AdToolName): AdEvidencePlatform {
  if (toolName === "google_ads") {
    return "google";
  }

  return "meta";
}

function readRequestedPlatform({
  input,
  toolName,
}: {
  input: unknown;
  toolName: AdToolName;
}): AdEvidencePlatform {
  const inputRecord = asRecord(input);
  return (
    normalizePlatform(readString(inputRecord, "platform")) ??
    platformFromToolName(toolName)
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function encodeQuery(value: string): string {
  return encodeURIComponent(value);
}

function buildLibraryLink(
  platform: AdEvidencePlatform,
  advertiserName: string,
): string {
  if (platform === "google") {
    return `https://adstransparency.google.com/?region=US&query=${encodeQuery(
      advertiserName,
    )}`;
  }

  if (platform === "linkedin") {
    return `https://www.linkedin.com/ad-library/search?company=${encodeQuery(
      advertiserName,
    )}`;
  }

  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${encodeQuery(
    advertiserName,
  )}`;
}

function ensureGroup({
  domain,
  groups,
  advertiserName,
  observedAt,
}: {
  domain: string | null;
  groups: Map<string, MutableAdEvidenceGroup>;
  advertiserName: string;
  observedAt: string;
}): MutableAdEvidenceGroup {
  const key = advertiserName.toLowerCase();
  const existingGroup = groups.get(key);

  if (existingGroup !== undefined) {
    if (existingGroup.domain === null && domain !== null) {
      existingGroup.domain = domain;
    }

    return existingGroup;
  }

  const group: MutableAdEvidenceGroup = {
    advertiserName,
    domain,
    platforms: new Set<AdEvidencePlatform>(),
    rawCounts: emptyCounts(),
    displayableCounts: emptyCounts(),
    creatives: [],
    libraryLinks: {},
    rawSourceSamples: [],
    sourceErrors: [],
    observedAt,
  };

  groups.set(key, group);
  return group;
}

function nonEmptyText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}

function readNullableText(value: string | undefined): string | null {
  return nonEmptyText(value);
}

function incrementCount(
  counts: PlatformCounts,
  platform: AdEvidencePlatform,
  amount: number,
): void {
  counts[platform] += amount;
}

function addLibraryLink(
  libraryLinks: LibraryLinks,
  platform: AdEvidencePlatform,
  advertiserName: string,
): void {
  if (libraryLinks[platform] === undefined) {
    libraryLinks[platform] = buildLibraryLink(platform, advertiserName);
  }
}

function buildRawSourceSample({
  advertiserName,
  index,
  platform,
  rawAd,
}: {
  advertiserName: string;
  platform: AdEvidencePlatform;
  rawAd: RawAd;
  index: number;
}): RawSourceSample {
  const headline = nonEmptyText(rawAd.title);
  const body = nonEmptyText(rawAd.snippet);
  const imageUrl = readNullableText(rawAd.imageUrl);
  const videoUrl = readNullableText(rawAd.videoUrl);

  return {
    id: rawAd.id ?? `raw_${platform}_${slugify(advertiserName)}_${index}`,
    platform,
    advertiserName: nonEmptyText(rawAd.advertiserName) ?? advertiserName,
    headline,
    body,
    imageUrl,
    videoUrl,
    detailsUrl: readNullableText(rawAd.detailsUrl),
    sourceUrl: rawAd.url,
    format: readNullableText(rawAd.format),
    dataGap:
      headline === null && body === null && imageUrl === null && videoUrl === null
        ? "Raw library row has no headline, body, image, or video fields."
        : null,
  };
}

function inferCreativeFormat(rawAd: RawAd): string {
  const format = nonEmptyText(rawAd.format);

  if (format !== null) {
    return format;
  }

  if (nonEmptyText(rawAd.videoUrl) !== null) {
    return "video";
  }

  if (nonEmptyText(rawAd.imageUrl) !== null) {
    return "image";
  }

  return "text";
}

function buildCreative({
  advertiserName,
  index,
  platform,
  rawAd,
}: {
  advertiserName: string;
  platform: AdEvidencePlatform;
  rawAd: RawAd;
  index: number;
}): AdEvidenceCreative {
  const imageUrl = readNullableText(rawAd.imageUrl);
  const videoUrl = readNullableText(rawAd.videoUrl);
  const sourceUrl = readNullableText(rawAd.detailsUrl) ?? rawAd.url;

  return {
    id: rawAd.id ?? `ad_${platform}_${slugify(advertiserName)}_${index}`,
    platform,
    advertiserName: nonEmptyText(rawAd.advertiserName) ?? advertiserName,
    headline: nonEmptyText(rawAd.title),
    body: nonEmptyText(rawAd.snippet),
    landingUrl: readNullableText(rawAd.landingUrl),
    creativeUrl: imageUrl ?? videoUrl,
    imageUrl,
    videoUrl,
    detailsUrl: readNullableText(rawAd.detailsUrl),
    sourceUrl,
    firstSeen: readNullableText(rawAd.firstSeen),
    lastSeen: readNullableText(rawAd.lastSeen),
    format: inferCreativeFormat(rawAd),
    isActive: rawAd.isActive ?? true,
  };
}

function hasDisplayableCreative(rawAd: RawAd): boolean {
  return (
    nonEmptyText(rawAd.title) !== null ||
    nonEmptyText(rawAd.snippet) !== null ||
    nonEmptyText(rawAd.imageUrl) !== null ||
    nonEmptyText(rawAd.videoUrl) !== null
  );
}

function addRawAdResult({
  advertiserName,
  group,
  platform,
  rawAds,
  returnedCreativeLimit,
}: {
  advertiserName: string;
  group: MutableAdEvidenceGroup;
  platform: AdEvidencePlatform;
  rawAds: readonly RawAd[];
  returnedCreativeLimit: number;
}): void {
  group.platforms.add(platform);
  addLibraryLink(group.libraryLinks, platform, advertiserName);
  incrementCount(group.rawCounts, platform, rawAds.length);

  for (const [index, rawAd] of rawAds.entries()) {
    if (group.rawSourceSamples.length < rawSourceSampleLimit) {
      group.rawSourceSamples.push(
        buildRawSourceSample({
          advertiserName,
          index,
          platform,
          rawAd,
        }),
      );
    }

    if (!hasDisplayableCreative(rawAd)) {
      continue;
    }

    incrementCount(group.displayableCounts, platform, 1);

    if (group.creatives.length < returnedCreativeLimit) {
      group.creatives.push(
        buildCreative({
          advertiserName,
          index,
          platform,
          rawAd,
        }),
      );
    }
  }
}

function addSourceError({
  advertiserName,
  group,
  message,
  platform,
}: {
  advertiserName: string;
  group: MutableAdEvidenceGroup;
  platform: AdEvidencePlatform;
  message: string;
}): void {
  group.platforms.add(platform);
  addLibraryLink(group.libraryLinks, platform, advertiserName);
  group.sourceErrors.push({ platform, message });
}

function readAdvertiserName({
  fallback,
  input,
}: {
  input: unknown;
  fallback?: string;
}): string {
  const inputAdvertiser = readString(asRecord(input), "advertiser");
  return inputAdvertiser ?? fallback ?? "unknown advertiser";
}

function readAdvertiserDomain(input: unknown): string | null {
  return readString(asRecord(input), "domain");
}

function getDisplayableTotal(counts: PlatformCounts): number {
  return counts.google + counts.meta + counts.linkedin;
}

function hasSourceErrorForPlatform(
  sourceErrors: readonly SourceError[],
  platform: AdEvidencePlatform,
): boolean {
  return sourceErrors.some((sourceError) => sourceError.platform === platform);
}

function uniqueDataGaps(gaps: readonly DataGap[]): DataGap[] {
  const seen = new Set<string>();
  const dedupedGaps: DataGap[] = [];

  for (const gap of gaps) {
    const key = `${gap.platform ?? "all"}:${gap.reason}`;

    if (!seen.has(key)) {
      seen.add(key);
      dedupedGaps.push(gap);
    }
  }

  return dedupedGaps;
}

function buildDataGaps(group: MutableAdEvidenceGroup): DataGap[] {
  const requestedPlatforms = platformOrder.filter((platform) =>
    group.platforms.has(platform),
  );
  const sourceErrorGaps = group.sourceErrors.map((sourceError) => ({
    platform: sourceError.platform,
    reason: `${sourceError.platform} lookup failed: ${sourceError.message}`,
  }));
  const rawCountGaps = requestedPlatforms.flatMap((platform) => {
    if (hasSourceErrorForPlatform(group.sourceErrors, platform)) {
      return [];
    }

    if (group.rawCounts[platform] === 0) {
      return [
        {
          platform,
          reason: `${platform} returned no raw ad-library rows for this advertiser.`,
        },
      ];
    }

    if (group.displayableCounts[platform] === 0) {
      return [
        {
          platform,
          reason: `${platform} returned ${group.rawCounts[platform]} raw row${
            group.rawCounts[platform] === 1 ? "" : "s"
          }, but no row had headline, body, image, or video evidence for a displayable creative.`,
        },
      ];
    }

    return [];
  });
  const displayableTotal = getDisplayableTotal(group.displayableCounts);
  const truncationGaps =
    displayableTotal > group.creatives.length
      ? [
          {
            reason: `Returned ${group.creatives.length} of ${displayableTotal} displayable creatives to keep the structured artifact bounded.`,
          },
        ]
      : [];
  // LinkedIn is a phantom channel in the schema: the probe only fires google_ads
  // and meta_ads, and SearchAPI exposes no LinkedIn engine, so linkedin is never
  // added to group.platforms and its counts are structurally 0. Emit one explicit
  // gap per group so the artifact self-documents that linkedin=0 is a not-probed
  // sentinel, not an empty ad-library result.
  const linkedinNotProbedGaps: DataGap[] = [
    {
      platform: "linkedin",
      reason:
        "LinkedIn ad library is not queryable via the current SearchAPI integration; LinkedIn counts are structurally 0 and were not probed this run.",
    },
  ];

  return uniqueDataGaps([
    ...sourceErrorGaps,
    ...rawCountGaps,
    ...linkedinNotProbedGaps,
    ...truncationGaps,
  ]);
}

function finalizeGroup(
  group: MutableAdEvidenceGroup,
): CompetitorAdEvidenceGroup {
  return {
    advertiserName: group.advertiserName,
    domain: group.domain,
    platforms: platformOrder.filter((platform) => group.platforms.has(platform)),
    rawCounts: group.rawCounts,
    displayableCounts: group.displayableCounts,
    displayableTotal: getDisplayableTotal(group.displayableCounts),
    returnedCreativeCount: group.creatives.length,
    creatives: group.creatives,
    libraryLinks: group.libraryLinks,
    rawSourceSamples: group.rawSourceSamples,
    dataGaps: buildDataGaps(group),
    sourceErrors: group.sourceErrors,
    observedAt: group.observedAt,
  };
}

export function buildCompetitorAdEvidenceGroups({
  observedAt,
  returnedCreativeLimit = defaultReturnedCreativeLimit,
  steps,
}: BuildCompetitorAdEvidenceGroupsArgs): CompetitorAdEvidenceGroup[] {
  const groups = new Map<string, MutableAdEvidenceGroup>();

  for (const step of steps) {
    step.toolResults.forEach((toolResult, index) => {
      if (!isAdToolName(toolResult.toolName)) {
        return;
      }

      const matchingToolCall = step.toolCalls[index];
      const requestedPlatform = readRequestedPlatform({
        input: matchingToolCall?.input,
        toolName: toolResult.toolName,
      });
      const parsedOutput = AdLibraryOutputSchema.safeParse(toolResult.output);

      if (!parsedOutput.success) {
        return;
      }

      if (parsedOutput.data.type === "gap") {
        const advertiserName = readAdvertiserName({
          input: matchingToolCall?.input,
        });
        const group = ensureGroup({
          domain: readAdvertiserDomain(matchingToolCall?.input),
          groups,
          advertiserName,
          observedAt,
        });
        addSourceError({
          advertiserName,
          group,
          message: parsedOutput.data.message,
          platform: requestedPlatform,
        });
        return;
      }

      const advertiserName = readAdvertiserName({
        input: matchingToolCall?.input,
        fallback: parsedOutput.data.advertiser,
      });
      const group = ensureGroup({
        domain: readAdvertiserDomain(matchingToolCall?.input),
        groups,
        advertiserName,
        observedAt,
      });
      addRawAdResult({
        advertiserName,
        group,
        platform: parsedOutput.data.platform,
        rawAds: parsedOutput.data.ads,
        returnedCreativeLimit,
      });
    });
  }

  return Array.from(groups.values()).map((group) => finalizeGroup(group));
}

function sumCounts(
  groups: readonly CompetitorAdEvidenceGroup[],
  countKey: "rawCounts" | "displayableCounts",
): PlatformCounts {
  return groups.reduce<PlatformCounts>(
    (totals, group) => ({
      google: totals.google + group[countKey].google,
      meta: totals.meta + group[countKey].meta,
      linkedin: totals.linkedin + group[countKey].linkedin,
    }),
    emptyCounts(),
  );
}

function formatCounts(counts: PlatformCounts): string {
  return `google ${counts.google}, meta ${counts.meta}, linkedin ${counts.linkedin}`;
}

export function summarizeCompetitorAdEvidenceGroups(
  groups: readonly CompetitorAdEvidenceGroup[],
): string {
  if (groups.length === 0) {
    return "No live ad-library tool results were normalized for this section. Do not use fixture competitor ads as live ad evidence.";
  }

  const rawCounts = sumCounts(groups, "rawCounts");
  const displayableCounts = sumCounts(groups, "displayableCounts");
  const returnedCreativeCount = groups.reduce(
    (total, group) => total + group.returnedCreativeCount,
    0,
  );
  const gapCount = groups.reduce(
    (total, group) => total + group.dataGaps.length + group.sourceErrors.length,
    0,
  );

  return [
    `Live ad-library evidence was normalized for ${groups.length} advertiser group${
      groups.length === 1 ? "" : "s"
    }.`,
    `Raw rows by platform: ${formatCounts(rawCounts)}.`,
    `Displayable creatives by platform: ${formatCounts(displayableCounts)}.`,
    `Returned creative count: ${returnedCreativeCount}.`,
    gapCount > 0
      ? `Evidence gaps are preserved in advertiserGroups.dataGaps and advertiserGroups.sourceErrors.`
      : "No ad-library data gaps were reported by the normalized tool results.",
  ].join(" ");
}
