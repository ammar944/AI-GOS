import {
  adCreativeFingerprint,
  type CompetitorAdEvidenceGroup,
} from "../../artifacts/schemas/competitor-landscape";
import type { AgentStep } from "../section-agent";
import { detectAdLanguage } from "./ad-language";
import { AdLibraryOutputSchema } from "./adlibrary";
import { isAdvertiserMatch } from "./advertiser-match";

type AdEvidencePlatform = CompetitorAdEvidenceGroup["platforms"][number];
type PlatformCounts = CompetitorAdEvidenceGroup["rawCounts"];
type LibraryLinks = CompetitorAdEvidenceGroup["libraryLinks"];
type AdEvidenceCreative = CompetitorAdEvidenceGroup["creatives"][number];
type RawSourceSample = CompetitorAdEvidenceGroup["rawSourceSamples"][number];
type DataGap = CompetitorAdEvidenceGroup["dataGaps"][number];
type SourceError = CompetitorAdEvidenceGroup["sourceErrors"][number];
type AdToolName = "adlibrary" | "google_ads" | "meta_ads" | "linkedin_ads";

export interface BuildCompetitorAdEvidenceGroupsArgs {
  steps: readonly AgentStep[];
  observedAt: string;
  returnedCreativeLimit?: number;
  topicContext?: string;
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
  source?: string;
  transcript?: string;
  cta?: string;
  identityVerified?: boolean;
  identityBasis?: string;
}

interface MutableAdEvidenceGroup {
  advertiserName: string;
  domain: string | null;
  platforms: Set<AdEvidencePlatform>;
  rawCounts: PlatformCounts;
  // Unique displayable creatives keyed by adCreativeFingerprint. Cross-provider
  // dedup happens here (richer-wins) BEFORE the returnedCreativeLimit cap, so the
  // cap never locks an image variant and drops the Foreplay video. displayableCounts
  // / returnedCreativeCount / creatives are all derived from this map at finalize
  // time, keeping the "X of Y displayable" copy true per-unique creative.
  creativeByFingerprint: Map<string, AdEvidenceCreative>;
  libraryLinks: LibraryLinks;
  rawSourceSamples: RawSourceSample[];
  sourceErrors: SourceError[];
  observedAt: string;
}

const adToolNames = [
  "adlibrary",
  "google_ads",
  "meta_ads",
  "linkedin_ads",
] as const;
const platformOrder: readonly AdEvidencePlatform[] = [
  "google",
  "meta",
  "linkedin",
];
const defaultReturnedCreativeLimit = 6;
const rawSourceSampleLimit = 4;
const minimumTopicTokenCount = 2;
const minimumCreativeTokenCount = 4;
const topicStopwords: ReadonlySet<string> = new Set([
  "about",
  "across",
  "after",
  "alert",
  "before",
  "best",
  "better",
  "brand",
  "business",
  "company",
  "could",
  "customer",
  "customers",
  "else",
  "every",
  "finest",
  "from",
  "help",
  "helps",
  "into",
  "management",
  "more",
  "platform",
  "product",
  "software",
  "solution",
  "team",
  "teams",
  "that",
  "their",
  "this",
  "tool",
  "tools",
  "with",
  "workflow",
  "workflows",
]);
const topicExpansionRules: readonly {
  anchors: readonly string[];
  tokens: readonly string[];
}[] = [
  {
    anchors: [
      "accounting",
      "budget",
      "card",
      "expense",
      "finance",
      "invoice",
      "payment",
      "payable",
      "procurement",
      "spend",
      "vendor",
    ],
    tokens: [
      "accounting",
      "approval",
      "budget",
      "card",
      "control",
      "corporate",
      "employee",
      "expense",
      "finance",
      "invoice",
      "payable",
      "payment",
      "procurement",
      "purchase",
      "purchasing",
      "spend",
      "supplier",
      "vendor",
    ],
  },
];

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

  if (toolName === "linkedin_ads") {
    return "linkedin";
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
    creativeByFingerprint: new Map<string, AdEvidenceCreative>(),
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

function normalizeTopicToken(value: string): string {
  const lower = value.toLowerCase();

  if (lower.length > 4 && lower.endsWith("ies")) {
    return `${lower.slice(0, -3)}y`;
  }

  if (lower.length > 4 && lower.endsWith("s") && !lower.endsWith("ss")) {
    return lower.slice(0, -1);
  }

  return lower;
}

function tokenizeTopicText(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .map((token) => normalizeTopicToken(token))
    .filter((token) => token.length >= 3 && !topicStopwords.has(token));
}

function buildTopicTokenSet(topicContext: string | undefined): ReadonlySet<string> {
  const topicTokens = new Set(
    topicContext === undefined ? [] : tokenizeTopicText(topicContext),
  );

  for (const rule of topicExpansionRules) {
    if (
      rule.anchors
        .map((anchor) => normalizeTopicToken(anchor))
        .some((anchor) => topicTokens.has(anchor))
    ) {
      rule.tokens
        .map((token) => normalizeTopicToken(token))
        .forEach((token) => topicTokens.add(token));
    }
  }

  return topicTokens;
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
    source: readNullableText(rawAd.source),
    transcript: readNullableText(rawAd.transcript),
    cta: readNullableText(rawAd.cta),
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
  const headline = nonEmptyText(rawAd.title);
  const body = nonEmptyText(rawAd.snippet);
  const transcript = readNullableText(rawAd.transcript);
  // Detect language from the CREATIVE COPY only (headline/body/transcript) — never
  // the advertiserName, which is a brand token that would false-positive.
  const copy = [headline, body, transcript]
    .filter((value): value is string => value !== null)
    .join(" ");
  const language = detectAdLanguage(copy);

  // A creative earns the verified wall only when ALL THREE hold:
  //  1. its advertiser identity was corroborated upstream (identityVerified),
  //  2. its copy is on-language (not a foreign-market creative), and
  //  3. its OWN advertiserName reconciles with the group it is filed under —
  //     this is the cross-attribution check the old pipeline never made (H9).
  const ownAdvertiser = nonEmptyText(rawAd.advertiserName) ?? advertiserName;
  const reconciles = isAdvertiserMatch(ownAdvertiser, advertiserName);
  const verified =
    (rawAd.identityVerified ?? false) && language.isEnglish && reconciles;

  return {
    id: rawAd.id ?? `ad_${platform}_${slugify(advertiserName)}_${index}`,
    platform,
    advertiserName: ownAdvertiser,
    headline,
    body,
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
    source: readNullableText(rawAd.source),
    transcript,
    cta: readNullableText(rawAd.cta),
    language: language.language,
    isEnglish: language.isEnglish,
    verified,
    identityBasis: rawAd.identityBasis ?? null,
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

// Richness score for richer-wins dedup. A Foreplay video variant with a
// transcript must beat the bare-image SearchAPI variant of the same ad so the
// stored creative is the one worth showing.
function creativeRichnessScore(creative: AdEvidenceCreative): number {
  return (
    (creative.videoUrl !== null ? 4 : 0) +
    (creative.transcript !== null ? 3 : 0) +
    (creative.body !== null ? 2 : 0) +
    (creative.detailsUrl !== null ? 1 : 0) +
    (creative.imageUrl !== null ? 0.5 : 0)
  );
}

// Recency bucket relative to the run timestamp. Recent creatives are far more
// useful as competitive intelligence than long-expired ones, and the old
// pipeline never ranked on recency at all (H7).
function recencyBucket(lastSeen: string | null, observedAt: string): number {
  if (lastSeen === null) {
    return 0;
  }
  const last = Date.parse(lastSeen);
  const now = Date.parse(observedAt);
  if (Number.isNaN(last) || Number.isNaN(now)) {
    return 0;
  }
  const days = (now - last) / 86_400_000;
  if (days <= 30) {
    return 3;
  }
  if (days <= 90) {
    return 2;
  }
  if (days <= 365) {
    return 1;
  }
  return 0;
}

// Blended ranking score within an identity tier: media richness + recency, with
// expired creatives pushed down. Identity confidence stays the PRIMARY sort key
// (verified creatives always win cap slots); this blend orders within it so the
// surfaced creatives are the richest, most-current ones — not the first N raw
// rows by media weight alone (H4/H7).
function blendedCreativeScore(
  creative: AdEvidenceCreative,
  observedAt: string,
): number {
  return (
    creativeRichnessScore(creative) +
    recencyBucket(creative.lastSeen, observedAt) +
    (creative.isActive === false ? -3 : 0)
  );
}

function hasLowAdvertiserIdentityConfidence(creative: AdEvidenceCreative): boolean {
  return creative.verified === false && creative.identityBasis !== "domain";
}

function creativeTopicTokens(creative: AdEvidenceCreative): ReadonlySet<string> {
  return new Set(
    [
      creative.headline,
      creative.body,
      creative.transcript,
      creative.cta,
    ]
      .filter((value): value is string => value !== null)
      .flatMap((value) => tokenizeTopicText(value)),
  );
}

function hasAnyTopicOverlap(
  creativeTokens: ReadonlySet<string>,
  topicTokens: ReadonlySet<string>,
): boolean {
  for (const token of creativeTokens) {
    if (topicTokens.has(token)) {
      return true;
    }
  }

  return false;
}

function shouldExcludeLowConfidenceOffTopicCreative({
  creative,
  topicTokens,
}: {
  creative: AdEvidenceCreative;
  topicTokens: ReadonlySet<string>;
}): boolean {
  if (
    !hasLowAdvertiserIdentityConfidence(creative) ||
    topicTokens.size < minimumTopicTokenCount
  ) {
    return false;
  }

  const creativeTokens = creativeTopicTokens(creative);

  return (
    creativeTokens.size >= minimumCreativeTokenCount &&
    !hasAnyTopicOverlap(creativeTokens, topicTokens)
  );
}

// Upsert a unique creative into the per-group fingerprint map. Identity
// confidence is the PRIMARY key (it decides verified-wall membership): a
// verified creative must beat an identical-fingerprint UNVERIFIED duplicate
// regardless of media richness. Otherwise a quarantined name-resolved Meta ad —
// inserted before the Part B domain-verified copy of the SAME ad — would win the
// richness tie and keep it off the wall. Within the same identity tier,
// richer-wins as before so the stored variant is the one worth showing.
function upsertUniqueCreative(
  creativeByFingerprint: Map<string, AdEvidenceCreative>,
  creative: AdEvidenceCreative,
): void {
  const fingerprint = adCreativeFingerprint({
    platform: creative.platform,
    id: creative.id,
    headline: creative.headline,
    body: creative.body,
    imageUrl: creative.imageUrl,
    videoUrl: creative.videoUrl,
  });
  const existing = creativeByFingerprint.get(fingerprint);

  const shouldReplace =
    existing === undefined ||
    (creative.verified && !existing.verified) ||
    (creative.verified === existing.verified &&
      creativeRichnessScore(creative) > creativeRichnessScore(existing));

  if (shouldReplace) {
    creativeByFingerprint.set(fingerprint, creative);
  }
}

function addRawAdResult({
  advertiserName,
  group,
  platform,
  rawAds,
}: {
  advertiserName: string;
  group: MutableAdEvidenceGroup;
  platform: AdEvidencePlatform;
  rawAds: readonly RawAd[];
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

    // Cross-provider dedup BEFORE the returnedCreativeLimit cap (applied at
    // finalize). displayableCounts / returnedCreativeCount are derived per-unique
    // creative so the "X of Y displayable" copy never double-counts the same ad
    // that surfaced on two providers.
    upsertUniqueCreative(
      group.creativeByFingerprint,
      buildCreative({
        advertiserName,
        index,
        platform,
        rawAd,
      }),
    );
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

function buildDataGaps({
  group,
  displayableCounts,
  returnedCreativeCount,
  topicExcludedCounts,
}: {
  group: MutableAdEvidenceGroup;
  displayableCounts: PlatformCounts;
  returnedCreativeCount: number;
  topicExcludedCounts: PlatformCounts;
}): DataGap[] {
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

    if (
      displayableCounts[platform] === 0 &&
      topicExcludedCounts[platform] === 0
    ) {
      return [
        {
          platform,
          reason: `${platform} returned ${group.rawCounts[platform]} raw row${
            group.rawCounts[platform] === 1 ? "" : "s"
          }, but no row had headline, body, image, or video evidence for a unique displayable creative.`,
        },
      ];
    }

    return [];
  });
  const topicExclusionGaps = platformOrder.flatMap((platform) => {
    const excludedCount = topicExcludedCounts[platform];

    if (excludedCount === 0) {
      return [];
    }

    return [
      {
        platform,
        reason: `${platform} excluded ${excludedCount} low-confidence creative${
          excludedCount === 1 ? "" : "s"
        } because the ad copy shared no topic tokens with the category context.`,
      },
    ];
  });
  const displayableTotal = getDisplayableTotal(displayableCounts);
  const truncationGaps =
    displayableTotal > returnedCreativeCount
      ? [
          {
            reason: `Returned ${returnedCreativeCount} of ${displayableTotal} displayable creatives to keep the structured artifact bounded.`,
          },
        ]
      : [];
  // LinkedIn is now a real, agent-callable channel (linkedin_ads -> SearchAPI
  // linkedin_ad_library). When the agent did probe it, linkedin is in
  // group.platforms and rawCountGaps above already documents any empty result,
  // so emitting a "not probed" sentinel would contradict the live data. Only
  // when linkedin was NOT probed this run do we self-document that linkedin=0 is
  // a not-probed sentinel rather than an empty ad-library result.
  const linkedinNotProbedGaps: DataGap[] = group.platforms.has("linkedin")
    ? []
    : [
        {
          platform: "linkedin",
          reason:
            "LinkedIn ad library was not probed this run; LinkedIn counts are structurally 0 and are a not-probed sentinel, not an empty ad-library result.",
        },
      ];

  return uniqueDataGaps([
    ...sourceErrorGaps,
    ...rawCountGaps,
    ...topicExclusionGaps,
    ...linkedinNotProbedGaps,
    ...truncationGaps,
  ]);
}

function finalizeGroup(
  group: MutableAdEvidenceGroup,
  returnedCreativeLimit: number,
  topicTokens: ReadonlySet<string>,
): CompetitorAdEvidenceGroup {
  // Unique displayable creatives (post richer-wins dedup). displayableCounts is
  // recomputed per-unique creative from the winning platform; the cap applies to
  // the unique set so the artifact stays bounded.
  const topicExcludedCounts = emptyCounts();
  const uniqueCreatives = Array.from(group.creativeByFingerprint.values()).filter(
    (creative) => {
      if (
        shouldExcludeLowConfidenceOffTopicCreative({
          creative,
          topicTokens,
        })
      ) {
        incrementCount(topicExcludedCounts, creative.platform, 1);
        return false;
      }

      return true;
    },
  );
  const displayableCounts = emptyCounts();
  for (const creative of uniqueCreatives) {
    incrementCount(displayableCounts, creative.platform, 1);
  }
  // Surface the richest creatives within the cap: rank by richness (video and
  // transcript-bearing Foreplay creatives win slots over thinner SearchAPI
  // images) so the high-value creatives are not truncated by mere insertion
  // order (SearchAPI results insert before the Foreplay prepass). Stable for
  // equal scores. displayableCounts above still counts every unique creative.
  const ranked = [...uniqueCreatives].sort(
    (a, b) =>
      blendedCreativeScore(b, group.observedAt) -
      blendedCreativeScore(a, group.observedAt),
  );
  const verifiedRanked = ranked.filter((creative) => creative.verified === true);
  const quarantinedRanked = ranked.filter(
    (creative) => creative.verified !== true,
  );
  // The displayed set carries up to `returnedCreativeLimit` VERIFIED creatives for
  // the wall PLUS up to the same number of quarantined creatives for the drawer —
  // low-confidence ads are hidden behind a reveal, never silently dropped by the
  // cap. quarantinedCount reflects the FULL quarantined set, not just the sample,
  // so the "N low-confidence hidden" copy is honest even when the sample is capped.
  const creatives = [
    ...verifiedRanked.slice(0, returnedCreativeLimit),
    ...quarantinedRanked.slice(0, returnedCreativeLimit),
  ];
  const quarantinedCount = quarantinedRanked.length;
  const identityConfidence: "verified" | "low" =
    verifiedRanked.length > 0 ? "verified" : "low";

  return {
    advertiserName: group.advertiserName,
    domain: group.domain,
    platforms: platformOrder.filter((platform) => group.platforms.has(platform)),
    rawCounts: group.rawCounts,
    displayableCounts,
    displayableTotal: getDisplayableTotal(displayableCounts),
    returnedCreativeCount: creatives.length,
    creatives,
    libraryLinks: group.libraryLinks,
    rawSourceSamples: group.rawSourceSamples,
    dataGaps: buildDataGaps({
      group,
      displayableCounts,
      returnedCreativeCount: creatives.length,
      topicExcludedCounts,
    }),
    sourceErrors: group.sourceErrors,
    observedAt: group.observedAt,
    identityConfidence,
    quarantinedCount,
    verifiedCount: verifiedRanked.length,
  };
}

export function buildCompetitorAdEvidenceGroups({
  observedAt,
  returnedCreativeLimit = defaultReturnedCreativeLimit,
  steps,
  topicContext,
}: BuildCompetitorAdEvidenceGroupsArgs): CompetitorAdEvidenceGroup[] {
  const groups = new Map<string, MutableAdEvidenceGroup>();
  const topicTokens = buildTopicTokenSet(topicContext);

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
      });
    });
  }

  return Array.from(groups.values()).map((group) =>
    finalizeGroup(group, returnedCreativeLimit, topicTokens),
  );
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

// When no competitor advertisers are identified to probe (e.g. an empty/absent
// competitor seed, or a non-answer seed stripped to null), the normalized wall
// is []. An empty advertiserGroups array cannot satisfy the adEvidence_or_gap
// required-evidence gate: hasAdEvidenceOrGap iterates the groups, so with zero
// groups there is nothing to carry a dataGap and the section hard-fails
// (required_evidence_missing) — stranding the whole run. Emit one explicit gap
// group so the section commits with an honest "no ad evidence observed" wall
// instead of erroring. buildDataGaps always yields >=1 gap for a real probed
// group, so [] is the only path that reaches the gate empty. (prod run
// 0eeebd93, 2026-06-09.)
export function buildEmptyCompetitorAdEvidenceGapGroup(
  observedAt: string,
): CompetitorAdEvidenceGroup {
  return {
    advertiserName: "Competitor ad libraries",
    domain: null,
    platforms: ["google", "meta", "linkedin"],
    rawCounts: emptyCounts(),
    displayableCounts: emptyCounts(),
    displayableTotal: 0,
    returnedCreativeCount: 0,
    creatives: [],
    libraryLinks: {},
    rawSourceSamples: [],
    dataGaps: [
      {
        reason:
          "No competitor advertisers were identified to probe, so no ad-library wall was run for this section.",
      },
    ],
    sourceErrors: [],
    observedAt,
  };
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
