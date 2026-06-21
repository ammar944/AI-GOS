import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import { getRegistrableDomain } from "../../domain-utils";
import type { ValidationResult } from "./market-category";
import {
  blockCoverageSchema,
  evidenceBlockGapFieldSchema,
  evidenceBlockGapSchema,
  evidenceTierSchema,
  incumbentBlindSpotSchema,
  keyFindingsSchema,
  rowVerificationSchema,
  strategicInsightSchema,
  validateStrategicInsightMinimums,
  validateStrategicText,
  whereToAttackVsConcedeSchema,
} from "./strategic-insight";

const competitorTypes = ["direct", "indirect", "status-quo", "diy"] as const;
const adPlatforms = ["google", "meta", "linkedin"] as const;
const validUrlPattern = /^https?:\/\/\S+\.\S+/;
const adPlatformSchema = z.enum(adPlatforms);
const blockGapFieldSchema = evidenceBlockGapFieldSchema;

// Phase 4 enrichment (§4.7): optional per-row evidence tier + verifier-written
// verification meta. Additive — a row without these behaves exactly as before.
// The reconciler backfills the tier deterministically post-authoring; the model
// never authors these (mirrors the BuyerICP pilot template).
const evidenceTierFieldSchema = evidenceTierSchema
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

const rowVerificationFieldSchema = rowVerificationSchema
  .unwrap()
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

const blockCoverageFieldSchema = blockCoverageSchema
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

const competitorSchema = z
  .object({
    name: z.string().min(1),
    // url = the competitor's homepage, for navigation/display only (authored by
    // the section, NOT a citation). The citation is the sibling sourceUrl below
    // (the real fetched page). The claim-extractor exempts this exact fieldPath
    // from load-bearing url-claim extraction; this field stays required + URL-shaped.
    url: z.string().min(1),
    competitorType: z.enum(competitorTypes),
    oneLinePositioning: z.string().min(1),
    verbatimHeroCopy: z.string().min(1),
    pricingPosition: z.string().min(1),
    sourceUrl: z.string().min(1),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const competitorPositionSchema = z
  .object({
    competitor: z.string().min(1),
    position: z.string().min(1),
  })
  .strict();

const positioningAxisSchema = z
  .object({
    axisName: z.string().min(1),
    ourPosition: z.string().min(1),
    competitorPositions: z.array(competitorPositionSchema),
    evidenceUrl: z.string().min(1),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const pricingDataPointSchema = z
  .object({
    competitor: z.string().min(1),
    tierName: z.string().min(1),
    monthlyPrice: z.string().min(1),
    packagingPattern: z.string().min(1),
    gatedSignals: z.string().min(1),
    sourceUrl: z.string().min(1),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const shareOfVoiceSliceSchema = z
  .object({
    surface: z.string().min(1),
    winner: z.string().min(1),
    evidence: z.string().min(1),
    sourceUrl: z.string().min(1),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const competitorWeaknessSchema = z
  .object({
    competitor: z.string().min(1),
    verbatimQuote: z.string().min(1),
    source: z.string().min(1),
    sourceUrl: z.string().min(1),
    whyItMatters: z.string().min(1),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const narrativeArcSchema = z
  .object({
    competitor: z.string().min(1),
    villain: z.string().min(1),
    hero: z.string().min(1),
    transformationClaim: z.string().min(1),
    sourceUrl: z.string().min(1),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const competitorSetSchema = z
  .object({
    prose: z.string().min(1),
    competitors: z.array(competitorSchema),
    blockGap: blockGapFieldSchema,
    coverage: blockCoverageFieldSchema,
  })
  .strict();

const positioningTaxonomySchema = z
  .object({
    prose: z.string().min(1),
    axes: z.array(positioningAxisSchema),
    blockGap: blockGapFieldSchema,
    coverage: blockCoverageFieldSchema,
  })
  .strict();

const pricingRealitySchema = z
  .object({
    prose: z.string().min(1),
    dataPoints: z.array(pricingDataPointSchema),
    blockGap: blockGapFieldSchema,
    coverage: blockCoverageFieldSchema,
  })
  .strict();

const shareOfVoiceSchema = z
  .object({
    prose: z.string().min(1),
    slices: z.array(shareOfVoiceSliceSchema),
    blockGap: blockGapFieldSchema,
    coverage: blockCoverageFieldSchema,
  })
  .strict();

const publicWeaknessesSchema = z
  .object({
    prose: z.string().min(1),
    items: z.array(competitorWeaknessSchema),
    blockGap: blockGapFieldSchema,
    coverage: blockCoverageFieldSchema,
  })
  .strict();

const narrativeArcsSchema = z
  .object({
    prose: z.string().min(1),
    arcs: z.array(narrativeArcSchema),
    blockGap: blockGapFieldSchema,
    coverage: blockCoverageFieldSchema,
  })
  .strict();

const adPresenceSignalSchema = z
  .object({
    competitor: z.string().min(1),
    platforms: z.array(adPlatformSchema),
    estSpend: z.string().min(1),
    evidence: z.string().min(1),
    sourceUrl: z.string().url(),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const adPresenceSchema = z
  .object({
    prose: z.string().min(1),
    signals: z.array(adPresenceSignalSchema),
    blockGap: blockGapFieldSchema,
    coverage: blockCoverageFieldSchema,
  })
  .strict();

const adPlatformCountsSchema = z
  .object({
    google: z.number().int().nonnegative(),
    meta: z.number().int().nonnegative(),
    linkedin: z.number().int().nonnegative(),
  })
  .strict();

const adEvidenceCreativeSchema = z
  .object({
    id: z.string().min(1),
    platform: adPlatformSchema,
    advertiserName: z.string().min(1),
    headline: z.string().min(1).nullable(),
    body: z.string().min(1).nullable(),
    landingUrl: z.string().url().nullable(),
    creativeUrl: z.string().url().nullable(),
    imageUrl: z.string().url().nullable(),
    videoUrl: z.string().url().nullable(),
    detailsUrl: z.string().url().nullable(),
    sourceUrl: z.string().url(),
    firstSeen: z.string().min(1).nullable(),
    lastSeen: z.string().min(1).nullable(),
    format: z.string().min(1),
    isActive: z.boolean(),
    source: z.string().min(1).nullable(),
    transcript: z.string().min(1).nullable(),
    cta: z.string().min(1).nullable(),
    // Quality metadata (optional for backward-compatibility with artifacts
    // persisted before the ad-engine rebuild). `verified` is the wall/quarantine
    // discriminator: a creative is verified when its advertiser identity is
    // corroborated AND its copy is in the target language AND its own
    // advertiserName reconciles with the group it is filed under.
    language: z.string().min(1).nullable().optional(),
    isEnglish: z.boolean().optional(),
    verified: z.boolean().optional(),
    identityBasis: z.string().min(1).nullable().optional(),
  })
  .strict();

const adEvidenceLibraryLinksSchema = z
  .object({
    google: z.string().url().optional(),
    meta: z.string().url().optional(),
    linkedin: z.string().url().optional(),
  })
  .strict();

const adEvidenceRawSourceSampleSchema = z
  .object({
    id: z.string().min(1),
    platform: adPlatformSchema,
    advertiserName: z.string().min(1).nullable(),
    headline: z.string().min(1).nullable(),
    body: z.string().min(1).nullable(),
    imageUrl: z.string().url().nullable(),
    videoUrl: z.string().url().nullable(),
    detailsUrl: z.string().url().nullable(),
    sourceUrl: z.string().url(),
    format: z.string().min(1).nullable(),
    dataGap: z.string().min(1).nullable(),
    source: z.string().min(1).nullable(),
    transcript: z.string().min(1).nullable(),
    cta: z.string().min(1).nullable(),
  })
  .strict();

const adEvidenceDataGapSchema = z
  .object({
    internalDetail: z.string().min(1).optional(),
    platform: adPlatformSchema.optional(),
    reason: z.string().min(1),
  })
  .strict();

const adEvidenceSourceErrorSchema = z
  .object({
    internalDetail: z.string().min(1).optional(),
    platform: adPlatformSchema,
    message: z.string().min(1),
  })
  .strict();

export const competitorAdEvidenceGroupSchema = z
  .object({
    advertiserName: z.string().min(1),
    domain: z.string().min(1).nullable(),
    platforms: z.array(adPlatformSchema).min(1),
    rawCounts: adPlatformCountsSchema,
    displayableCounts: adPlatformCountsSchema,
    displayableTotal: z.number().int().nonnegative(),
    returnedCreativeCount: z.number().int().nonnegative(),
    creatives: z.array(adEvidenceCreativeSchema),
    libraryLinks: adEvidenceLibraryLinksSchema,
    rawSourceSamples: z.array(adEvidenceRawSourceSampleSchema),
    dataGaps: z.array(adEvidenceDataGapSchema),
    sourceErrors: z.array(adEvidenceSourceErrorSchema),
    observedAt: z.string().min(1),
    // Advertiser-resolution confidence for the whole group, derived from the
    // resolveBestCandidate verdict: "verified" (accepted, identity corroborated)
    // vs "low" (ambiguous / name-only / unresolved). Drives the verified-wall vs
    // quarantine split in the UI. Optional for pre-rebuild artifacts.
    identityConfidence: z.enum(["verified", "low"]).optional(),
    quarantinedCount: z.number().int().nonnegative().optional(),
    // Count of creatives that cleared the verified wall for this group. Paired
    // with quarantinedCount so a downstream run can measure over-quarantine
    // (low verifiedCount + high quarantinedCount) directly from the committed
    // artifact instead of inferring it. Optional for pre-rebuild artifacts.
    verifiedCount: z.number().int().nonnegative().optional(),
    // True when this group is the SUBJECT's own ad presence — the subject is
    // probed alongside competitors so the wall answers "what is the subject
    // running right now". Optional for pre-rebuild artifacts.
    isSubject: z.boolean().optional(),
  })
  .strict();

const adEvidenceSchema = z
  .object({
    prose: z.string().min(1),
    advertiserGroups: z.array(competitorAdEvidenceGroupSchema),
    blockGap: blockGapFieldSchema,
  })
  .strict();

export const competitorLandscapeBodySchema = z
  .object({
    keyFindings: keyFindingsSchema.nullable().transform((value) => value ?? undefined).optional(),
    strategicInsight: strategicInsightSchema,
    whereToAttackVsConcede: whereToAttackVsConcedeSchema,
    incumbentBlindSpot: incumbentBlindSpotSchema,
    competitorSet: competitorSetSchema,
    positioningTaxonomy: positioningTaxonomySchema,
    pricingReality: pricingRealitySchema,
    shareOfVoice: shareOfVoiceSchema,
    publicWeaknesses: publicWeaknessesSchema,
    narrativeArcs: narrativeArcsSchema,
    adPresence: adPresenceSchema,
    adEvidence: adEvidenceSchema,
  })
  .strict();

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
  })
  .strict();

export const competitorLandscapeSectionOutputSchema = z
  .object({
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sources: z.array(modelSourceSchema).min(1),
    body: competitorLandscapeBodySchema,
  })
  .strict();

export type CompetitorLandscapeBody = z.infer<
  typeof competitorLandscapeBodySchema
>;
export type CompetitorAdEvidenceGroup = z.infer<
  typeof competitorAdEvidenceGroupSchema
>;
export type CompetitorLandscapeSectionOutput = z.infer<
  typeof competitorLandscapeSectionOutputSchema
>;
export type CompetitorLandscapeArtifact = ArtifactEnvelope & {
  body: CompetitorLandscapeBody;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizedName(value: string): string {
  return value.trim().toLowerCase();
}

function buildCompetitorDomainMap(
  body: Record<string, unknown>,
): ReadonlyMap<string, string> {
  const competitorSet = isRecord(body.competitorSet)
    ? body.competitorSet
    : null;
  const competitors = Array.isArray(competitorSet?.competitors)
    ? competitorSet.competitors
    : [];
  const domains = new Map<string, string>();

  for (const competitor of competitors) {
    if (!isRecord(competitor)) {
      continue;
    }

    const name = readText(competitor.name);
    const url = readText(competitor.url);
    const domain = url === null ? null : getRegistrableDomain(url);

    if (name === null || domain === null) {
      continue;
    }

    domains.set(normalizedName(name), domain);
  }

  return domains;
}

function hasReporterLabel(value: string): boolean {
  return /\s-\sper\s+[a-z0-9.-]+\b/i.test(value);
}

function normalizePricingDataPointReporter({
  competitorDomains,
  point,
}: {
  competitorDomains: ReadonlyMap<string, string>;
  point: unknown;
}): unknown {
  if (!isRecord(point)) {
    return point;
  }

  const competitor = readText(point.competitor);
  const monthlyPrice = readText(point.monthlyPrice);
  const sourceUrl = readText(point.sourceUrl);
  const sourceDomain =
    sourceUrl === null ? null : getRegistrableDomain(sourceUrl);
  const competitorDomain =
    competitor === null
      ? undefined
      : competitorDomains.get(normalizedName(competitor));

  if (
    competitor === null ||
    monthlyPrice === null ||
    sourceDomain === null ||
    competitorDomain === undefined ||
    sourceDomain === competitorDomain ||
    hasReporterLabel(monthlyPrice)
  ) {
    return point;
  }

  return {
    ...point,
    monthlyPrice: `${monthlyPrice} - per ${sourceDomain}`,
  };
}

// Captured creatives per advertiser, keyed on normalized advertiser identity —
// MUST mirror the buyer-eval COMPETITOR-COUNT cross-check (scripts/zz-buyer-eval.mjs
// buildCapturedCreativeMap): key on the group's advertiserName / its creatives'
// advertiserName / domain first-token, value = the group's creatives.length. The
// captured `creatives` array is the single source of truth for how many ads were
// actually verified for an advertiser; any "N verified" claim in free text must
// not exceed it.
function buildCapturedCreativeCountByAdvertiser(
  body: Record<string, unknown>,
): ReadonlyMap<string, number> {
  const adEvidence = isRecord(body.adEvidence) ? body.adEvidence : null;
  const groups = Array.isArray(adEvidence?.advertiserGroups)
    ? adEvidence.advertiserGroups
    : [];
  const byAdvertiser = new Map<string, number>();

  for (const group of groups) {
    if (!isRecord(group)) {
      continue;
    }
    const creatives = Array.isArray(group.creatives) ? group.creatives : [];
    const captured = creatives.length;
    const keys = new Set<string>();
    const groupName = readText(group.advertiserName);
    if (groupName !== null) {
      keys.add(normalizedName(groupName));
    }
    const creativeAdvertiserName = creatives
      .map((creative) => (isRecord(creative) ? readText(creative.advertiserName) : null))
      .find((name): name is string => name !== null);
    if (creativeAdvertiserName !== undefined && creativeAdvertiserName !== null) {
      keys.add(normalizedName(creativeAdvertiserName));
    }
    const domain = readText(group.domain);
    if (domain !== null) {
      const firstToken = domain
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split(".")[0];
      if (firstToken.length > 0) {
        keys.add(normalizedName(firstToken));
      }
    }
    for (const key of keys) {
      byAdvertiser.set(key, (byAdvertiser.get(key) ?? 0) + captured);
    }
  }

  return byAdvertiser;
}

// Mirror the buyer-eval lookupCapturedForCompetitor: exact normalized-key match
// first, then a substring match either direction ("Zapier Tables" -> "zapier").
function lookupCapturedForAdvertiser(
  byAdvertiser: ReadonlyMap<string, number>,
  advertiserName: string,
): number | null {
  const key = normalizedName(advertiserName);
  if (key.length === 0) {
    return null;
  }
  const exact = byAdvertiser.get(key);
  if (exact !== undefined) {
    return exact;
  }
  for (const [advKey, count] of byAdvertiser) {
    if (advKey.length > 0 && (key.includes(advKey) || advKey.includes(key))) {
      return count;
    }
  }
  return null;
}

// Clamp every "<N> verified" / "<N> total verified" count in a free-text claim
// down to the captured creatives for the attributed advertiser. The model bakes
// inflated counts into adPresence.signals[].evidence and shareOfVoice.slices
// evidence/winner text ("15 verified Google ads" when 12 are captured — run
// 3b568ea0); the structured verifiedCount is already clamped by the ad adapter,
// but these narrative numbers leak past it. Same regex the buyer-eval reads.
const VERIFIED_COUNT_CLAIM_PATTERN = /(\d+)(\s+(?:total\s+)?verified)/gi;

function clampVerifiedClaimText(text: string, capturedCeiling: number): string {
  return text.replace(VERIFIED_COUNT_CLAIM_PATTERN, (match, digits, tail) => {
    const claimed = Number(digits);
    if (!Number.isFinite(claimed) || claimed <= capturedCeiling) {
      return match;
    }
    return `${capturedCeiling}${tail}`;
  });
}

function clampAdPresenceSignalsVerifiedClaims(
  body: Record<string, unknown>,
  byAdvertiser: ReadonlyMap<string, number>,
): Record<string, unknown> {
  const adPresence = isRecord(body.adPresence) ? body.adPresence : null;
  if (adPresence === null || !Array.isArray(adPresence.signals)) {
    return body;
  }
  const signals = adPresence.signals.map((signal) => {
    if (!isRecord(signal)) {
      return signal;
    }
    const competitor = readText(signal.competitor);
    if (competitor === null) {
      return signal;
    }
    const captured = lookupCapturedForAdvertiser(byAdvertiser, competitor);
    if (captured === null) {
      return signal;
    }
    const evidence = readText(signal.evidence);
    if (evidence === null) {
      return signal;
    }
    const clamped = clampVerifiedClaimText(evidence, captured);
    return clamped === evidence ? signal : { ...signal, evidence: clamped };
  });
  return { ...body, adPresence: { ...adPresence, signals } };
}

function clampShareOfVoiceVerifiedClaims(
  body: Record<string, unknown>,
  byAdvertiser: ReadonlyMap<string, number>,
): Record<string, unknown> {
  const shareOfVoice = isRecord(body.shareOfVoice) ? body.shareOfVoice : null;
  if (shareOfVoice === null || !Array.isArray(shareOfVoice.slices)) {
    return body;
  }
  const slices = shareOfVoice.slices.map((slice) => {
    if (!isRecord(slice)) {
      return slice;
    }
    const winner = readText(slice.winner);
    if (winner === null) {
      return slice;
    }
    const captured = lookupCapturedForAdvertiser(byAdvertiser, winner);
    if (captured === null) {
      return slice;
    }
    const evidence = readText(slice.evidence);
    const clampedEvidence =
      evidence === null ? null : clampVerifiedClaimText(evidence, captured);
    const clampedWinner = clampVerifiedClaimText(winner, captured);
    const evidenceChanged =
      clampedEvidence !== null && clampedEvidence !== evidence;
    const winnerChanged = clampedWinner !== winner;
    if (!evidenceChanged && !winnerChanged) {
      return slice;
    }
    return {
      ...slice,
      ...(evidenceChanged ? { evidence: clampedEvidence } : {}),
      ...(winnerChanged ? { winner: clampedWinner } : {}),
    };
  });
  return { ...body, shareOfVoice: { ...shareOfVoice, slices } };
}

export function normalizeCompetitorLandscapeBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  // Single-writer clamp: no claimed/"N verified" ad count anywhere in the
  // committed body may exceed the captured creatives for that advertiser. The
  // ad adapter already clamps the structured verifiedCount; this catches the
  // narrative "15 verified Google ads" claims the model bakes into
  // adPresence.signals + shareOfVoice text that leak past it (run 3b568ea0).
  const capturedByAdvertiser = buildCapturedCreativeCountByAdvertiser(body);
  let workingBody = body;
  if (capturedByAdvertiser.size > 0) {
    workingBody = clampAdPresenceSignalsVerifiedClaims(
      workingBody,
      capturedByAdvertiser,
    );
    workingBody = clampShareOfVoiceVerifiedClaims(
      workingBody,
      capturedByAdvertiser,
    );
  }

  const pricingReality = isRecord(workingBody.pricingReality)
    ? workingBody.pricingReality
    : null;

  if (pricingReality === null || !Array.isArray(pricingReality.dataPoints)) {
    return workingBody;
  }

  const competitorDomains = buildCompetitorDomainMap(workingBody);

  if (competitorDomains.size === 0) {
    return workingBody;
  }

  return {
    ...workingBody,
    pricingReality: {
      ...pricingReality,
      dataPoints: pricingReality.dataPoints.map((point) =>
        normalizePricingDataPointReporter({ competitorDomains, point }),
      ),
    },
  };
}

/**
 * Pricing source-diversity gate (returned as a ValidationResult so the answer-
 * tool repair loop retries on failure). Modeled on checkVoiceOfCustomerSelfSourcing:
 * reject when a single THIRD-PARTY domain (not the subject's own vendor domain and
 * not a competitor's own domain) supplies a majority (> floor(n/2)) of the pricing
 * rows. A vendor or competitor pricing PAGE is legitimate first-party evidence; a
 * single alternatives-listicle/blog monopolizing the pricing table is laundering a
 * lone aggregator as if it were diverse research. Vendor-own and competitor-own
 * rows are excluded from the dominance count entirely. Honors the hasBlockGap
 * escape to match every other competitor minimum.
 */
export function checkCompetitorPricingSourceDiversity({
  artifact,
  subjectDomain,
}: {
  artifact: ArtifactEnvelope;
  subjectDomain: string;
}): ValidationResult {
  const parsed = artifactEnvelopeSchema
    .extend({ body: competitorLandscapeBodySchema })
    .parse(artifact);
  const errors: string[] = [];
  const pricingReality = parsed.body.pricingReality;

  if (hasBlockGap(pricingReality)) {
    return { ok: true, errors };
  }

  const points = pricingReality.dataPoints;

  if (points.length === 0) {
    return { ok: true, errors };
  }

  const subjectRegistrable = getRegistrableDomain(subjectDomain);
  const competitorDomains = buildCompetitorDomainMap(
    parsed.body as unknown as Record<string, unknown>,
  );
  const competitorOwnDomains = new Set(competitorDomains.values());

  // Count only THIRD-PARTY rows: a row sourced from the subject's own domain or a
  // competitor's own domain is first-party pricing evidence and never monopolizes.
  const thirdPartyCounts = new Map<string, number>();
  let thirdPartyRows = 0;

  for (const point of points) {
    const sourceDomain = getRegistrableDomain(point.sourceUrl);

    if (sourceDomain === null) {
      continue;
    }

    if (sourceDomain === subjectRegistrable) {
      continue;
    }

    if (competitorOwnDomains.has(sourceDomain)) {
      continue;
    }

    thirdPartyRows += 1;
    thirdPartyCounts.set(sourceDomain, (thirdPartyCounts.get(sourceDomain) ?? 0) + 1);
  }

  if (thirdPartyRows === 0) {
    return { ok: true, errors };
  }

  const majorityThreshold = Math.floor(points.length / 2);

  for (const [host, count] of thirdPartyCounts) {
    if (count > majorityThreshold) {
      errors.push(
        `body.pricingReality.dataPoints: third-party source ${host} supplies ${count} of ${points.length} pricing rows (a single-source majority); pricing evidence must draw from the competitors' own pages or multiple independent sources, not one aggregator/listicle.`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

function canonicalPlatform(platform: string): string {
  const normalized = platform.toLowerCase().trim();
  if (normalized === "facebook" || normalized === "instagram") {
    return "meta";
  }
  return normalized;
}

function normalizeText(value: string | null | undefined, length: number): string {
  return (value ?? "").trim().toLowerCase().slice(0, length);
}

export function adCreativeFingerprint(creative: {
  platform: string;
  id?: string | null;
  headline?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
}): string {
  // TIER 1: a bare numeric id is a canonical shared id (Meta ad_archive_id,
  // Foreplay ad_library_id). Synthetic ids minted by the adapter (ad_meta_<slug>_0)
  // and the source (meta-0) are NOT numeric-only, so they fall through to content
  // keys and never collapse distinct creatives onto one shared id.
  const id = (creative.id ?? "").trim();
  if (/^[0-9]+$/.test(id)) {
    return "id:" + id;
  }

  // TIER 2: content key from headline + body.
  const headline = normalizeText(creative.headline, 80);
  const body = normalizeText(creative.body, 80);

  // MEDIA-ONLY carve-out: no text evidence, key on the media URL.
  if (headline === "" && body === "") {
    const media = (creative.videoUrl ?? creative.imageUrl ?? "").trim();
    return "media:" + canonicalPlatform(creative.platform) + ":" + media;
  }

  return "c2:" + canonicalPlatform(creative.platform) + ":" + headline + ":" + body;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pushMissingText(
  errors: string[],
  path: string,
  value: unknown,
): void {
  if (!hasText(value)) {
    errors.push(`${path}: required field missing.`);
  }
}

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

function hasBlockGap(block: { blockGap?: unknown }): boolean {
  return block.blockGap !== undefined;
}

// True when ANY core block carries a blockGap — i.e. the body is already an
// honest degraded artifact. Used to waive the section-level sources floor so the
// structural-blockGap injector (run-section.ts) can commit a degraded body
// instead of hard-erroring the whole section when sources fell short too.
function bodyHasAnyBlockGap(body: CompetitorLandscapeBody): boolean {
  return [
    body.competitorSet,
    body.positioningTaxonomy,
    body.pricingReality,
    body.shareOfVoice,
    body.publicWeaknesses,
    body.narrativeArcs,
    body.adPresence,
    body.adEvidence,
  ].some(hasBlockGap);
}

function validateUrl(errors: string[], path: string, url: string): void {
  if (!validUrlPattern.test(url)) {
    errors.push(`${path}: url is not a valid URL.`);
  }
}

function validateRequiredFields(
  artifact: CompetitorLandscapeArtifact,
  errors: string[],
): void {
  pushMissingText(errors, "sectionTitle", artifact.sectionTitle);
  pushMissingText(errors, "verdict", artifact.verdict);
  pushMissingText(errors, "statusSummary", artifact.statusSummary);
  pushMissingText(errors, "body.competitorSet.prose", artifact.body.competitorSet.prose);
  pushMissingText(
    errors,
    "body.positioningTaxonomy.prose",
    artifact.body.positioningTaxonomy.prose,
  );
  pushMissingText(errors, "body.pricingReality.prose", artifact.body.pricingReality.prose);
  pushMissingText(errors, "body.shareOfVoice.prose", artifact.body.shareOfVoice.prose);
  pushMissingText(
    errors,
    "body.publicWeaknesses.prose",
    artifact.body.publicWeaknesses.prose,
  );
  pushMissingText(errors, "body.narrativeArcs.prose", artifact.body.narrativeArcs.prose);
  pushMissingText(errors, "body.adPresence.prose", artifact.body.adPresence.prose);
  pushMissingText(errors, "body.adEvidence.prose", artifact.body.adEvidence.prose);

  artifact.sources.forEach((source, index) => {
    pushMissingText(errors, `sources[${index}].title`, source.title);
    pushMissingText(errors, `sources[${index}].url`, source.url);
    validateUrl(errors, `sources[${index}] (${source.title})`, source.url);
  });

  artifact.body.competitorSet.competitors.forEach((competitor, index) => {
    pushMissingText(errors, `body.competitorSet.competitors[${index}].name`, competitor.name);
    pushMissingText(errors, `body.competitorSet.competitors[${index}].url`, competitor.url);
    pushMissingText(
      errors,
      `body.competitorSet.competitors[${index}].oneLinePositioning`,
      competitor.oneLinePositioning,
    );
    pushMissingText(
      errors,
      `body.competitorSet.competitors[${index}].verbatimHeroCopy`,
      competitor.verbatimHeroCopy,
    );
    pushMissingText(
      errors,
      `body.competitorSet.competitors[${index}].pricingPosition`,
      competitor.pricingPosition,
    );
    pushMissingText(
      errors,
      `body.competitorSet.competitors[${index}].sourceUrl`,
      competitor.sourceUrl,
    );
    if (hasText(competitor.url)) {
      validateUrl(
        errors,
        `body.competitorSet.competitors[${index}] (${competitor.name}).url`,
        competitor.url,
      );
    }
    if (hasText(competitor.sourceUrl)) {
      validateUrl(
        errors,
        `body.competitorSet.competitors[${index}] (${competitor.name}).sourceUrl`,
        competitor.sourceUrl,
      );
    }
  });

  artifact.body.positioningTaxonomy.axes.forEach((axis, index) => {
    pushMissingText(errors, `body.positioningTaxonomy.axes[${index}].axisName`, axis.axisName);
    pushMissingText(errors, `body.positioningTaxonomy.axes[${index}].ourPosition`, axis.ourPosition);
    pushMissingText(errors, `body.positioningTaxonomy.axes[${index}].evidenceUrl`, axis.evidenceUrl);
    if (hasText(axis.evidenceUrl)) {
      validateUrl(errors, `body.positioningTaxonomy.axes[${index}].evidenceUrl`, axis.evidenceUrl);
    }
  });

  artifact.body.pricingReality.dataPoints.forEach((point, index) => {
    pushMissingText(errors, `body.pricingReality.dataPoints[${index}].competitor`, point.competitor);
    pushMissingText(errors, `body.pricingReality.dataPoints[${index}].tierName`, point.tierName);
    pushMissingText(errors, `body.pricingReality.dataPoints[${index}].monthlyPrice`, point.monthlyPrice);
    pushMissingText(errors, `body.pricingReality.dataPoints[${index}].packagingPattern`, point.packagingPattern);
    pushMissingText(errors, `body.pricingReality.dataPoints[${index}].gatedSignals`, point.gatedSignals);
    pushMissingText(errors, `body.pricingReality.dataPoints[${index}].sourceUrl`, point.sourceUrl);
    if (hasText(point.sourceUrl)) {
      validateUrl(errors, `body.pricingReality.dataPoints[${index}].sourceUrl`, point.sourceUrl);
    }
  });

  artifact.body.shareOfVoice.slices.forEach((slice, index) => {
    pushMissingText(errors, `body.shareOfVoice.slices[${index}].surface`, slice.surface);
    pushMissingText(errors, `body.shareOfVoice.slices[${index}].winner`, slice.winner);
    pushMissingText(errors, `body.shareOfVoice.slices[${index}].evidence`, slice.evidence);
    pushMissingText(errors, `body.shareOfVoice.slices[${index}].sourceUrl`, slice.sourceUrl);
    if (hasText(slice.sourceUrl)) {
      validateUrl(errors, `body.shareOfVoice.slices[${index}].sourceUrl`, slice.sourceUrl);
    }
  });

  artifact.body.publicWeaknesses.items.forEach((item, index) => {
    pushMissingText(errors, `body.publicWeaknesses.items[${index}].competitor`, item.competitor);
    pushMissingText(errors, `body.publicWeaknesses.items[${index}].verbatimQuote`, item.verbatimQuote);
    pushMissingText(errors, `body.publicWeaknesses.items[${index}].source`, item.source);
    pushMissingText(errors, `body.publicWeaknesses.items[${index}].sourceUrl`, item.sourceUrl);
    pushMissingText(errors, `body.publicWeaknesses.items[${index}].whyItMatters`, item.whyItMatters);
    if (hasText(item.sourceUrl)) {
      validateUrl(errors, `body.publicWeaknesses.items[${index}].sourceUrl`, item.sourceUrl);
    }
  });

  artifact.body.narrativeArcs.arcs.forEach((arc, index) => {
    pushMissingText(errors, `body.narrativeArcs.arcs[${index}].competitor`, arc.competitor);
    pushMissingText(errors, `body.narrativeArcs.arcs[${index}].villain`, arc.villain);
    pushMissingText(errors, `body.narrativeArcs.arcs[${index}].hero`, arc.hero);
    pushMissingText(
      errors,
      `body.narrativeArcs.arcs[${index}].transformationClaim`,
      arc.transformationClaim,
    );
    pushMissingText(errors, `body.narrativeArcs.arcs[${index}].sourceUrl`, arc.sourceUrl);
    if (hasText(arc.sourceUrl)) {
      validateUrl(errors, `body.narrativeArcs.arcs[${index}].sourceUrl`, arc.sourceUrl);
    }
  });

  artifact.body.adPresence.signals.forEach((signal, index) => {
    pushMissingText(errors, `body.adPresence.signals[${index}].competitor`, signal.competitor);
    pushMissingText(errors, `body.adPresence.signals[${index}].estSpend`, signal.estSpend);
    pushMissingText(errors, `body.adPresence.signals[${index}].evidence`, signal.evidence);
    pushMissingText(errors, `body.adPresence.signals[${index}].sourceUrl`, signal.sourceUrl);
    if (hasText(signal.sourceUrl)) {
      validateUrl(errors, `body.adPresence.signals[${index}].sourceUrl`, signal.sourceUrl);
    }
  });

  artifact.body.adEvidence.advertiserGroups.forEach((group, groupIndex) => {
    pushMissingText(
      errors,
      `body.adEvidence.advertiserGroups[${groupIndex}].advertiserName`,
      group.advertiserName,
    );
    pushMissingText(
      errors,
      `body.adEvidence.advertiserGroups[${groupIndex}].observedAt`,
      group.observedAt,
    );

    Object.entries(group.libraryLinks).forEach(([platform, url]) => {
      if (url !== undefined) {
        validateUrl(
          errors,
          `body.adEvidence.advertiserGroups[${groupIndex}].libraryLinks.${platform}`,
          url,
        );
      }
    });

    group.creatives.forEach((creative, creativeIndex) => {
      pushMissingText(
        errors,
        `body.adEvidence.advertiserGroups[${groupIndex}].creatives[${creativeIndex}].advertiserName`,
        creative.advertiserName,
      );
      validateUrl(
        errors,
        `body.adEvidence.advertiserGroups[${groupIndex}].creatives[${creativeIndex}].sourceUrl`,
        creative.sourceUrl,
      );
      if (creative.landingUrl !== null) {
        validateUrl(
          errors,
          `body.adEvidence.advertiserGroups[${groupIndex}].creatives[${creativeIndex}].landingUrl`,
          creative.landingUrl,
        );
      }
      if (creative.creativeUrl !== null) {
        validateUrl(
          errors,
          `body.adEvidence.advertiserGroups[${groupIndex}].creatives[${creativeIndex}].creativeUrl`,
          creative.creativeUrl,
        );
      }
      if (creative.imageUrl !== null) {
        validateUrl(
          errors,
          `body.adEvidence.advertiserGroups[${groupIndex}].creatives[${creativeIndex}].imageUrl`,
          creative.imageUrl,
        );
      }
      if (creative.videoUrl !== null) {
        validateUrl(
          errors,
          `body.adEvidence.advertiserGroups[${groupIndex}].creatives[${creativeIndex}].videoUrl`,
          creative.videoUrl,
        );
      }
      if (creative.detailsUrl !== null) {
        validateUrl(
          errors,
          `body.adEvidence.advertiserGroups[${groupIndex}].creatives[${creativeIndex}].detailsUrl`,
          creative.detailsUrl,
        );
      }
    });

    group.rawSourceSamples.forEach((sample, sampleIndex) => {
      validateUrl(
        errors,
        `body.adEvidence.advertiserGroups[${groupIndex}].rawSourceSamples[${sampleIndex}].sourceUrl`,
        sample.sourceUrl,
      );
      if (sample.imageUrl !== null) {
        validateUrl(
          errors,
          `body.adEvidence.advertiserGroups[${groupIndex}].rawSourceSamples[${sampleIndex}].imageUrl`,
          sample.imageUrl,
        );
      }
      if (sample.videoUrl !== null) {
        validateUrl(
          errors,
          `body.adEvidence.advertiserGroups[${groupIndex}].rawSourceSamples[${sampleIndex}].videoUrl`,
          sample.videoUrl,
        );
      }
      if (sample.detailsUrl !== null) {
        validateUrl(
          errors,
          `body.adEvidence.advertiserGroups[${groupIndex}].rawSourceSamples[${sampleIndex}].detailsUrl`,
          sample.detailsUrl,
        );
      }
    });

    group.dataGaps.forEach((gap, gapIndex) => {
      pushMissingText(
        errors,
        `body.adEvidence.advertiserGroups[${groupIndex}].dataGaps[${gapIndex}].reason`,
        gap.reason,
      );
    });

    group.sourceErrors.forEach((sourceError, sourceErrorIndex) => {
      pushMissingText(
        errors,
        `body.adEvidence.advertiserGroups[${groupIndex}].sourceErrors[${sourceErrorIndex}].message`,
        sourceError.message,
      );
    });
  });
}

export function validateCompetitorLandscapeMinimums(
  artifact: ArtifactEnvelope & { body: CompetitorLandscapeBody },
): ValidationResult {
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: competitorLandscapeBodySchema })
    .parse(artifact);
  const errors: string[] = [];

  validateRequiredFields(parsedArtifact, errors);
  validateStrategicInsightMinimums(
    errors,
    "body.strategicInsight",
    parsedArtifact.body.strategicInsight,
    {
      comparisonTexts: [parsedArtifact.verdict, parsedArtifact.statusSummary],
    },
  );
  validateStrategicText(
    errors,
    "body.whereToAttackVsConcede.attack",
    parsedArtifact.body.whereToAttackVsConcede.attack,
  );
  validateStrategicText(
    errors,
    "body.whereToAttackVsConcede.concede",
    parsedArtifact.body.whereToAttackVsConcede.concede,
  );
  validateStrategicText(
    errors,
    "body.whereToAttackVsConcede.rationale",
    parsedArtifact.body.whereToAttackVsConcede.rationale,
  );
  validateStrategicText(
    errors,
    "body.incumbentBlindSpot.incumbent",
    parsedArtifact.body.incumbentBlindSpot.incumbent,
  );
  validateStrategicText(
    errors,
    "body.incumbentBlindSpot.blindSpot",
    parsedArtifact.body.incumbentBlindSpot.blindSpot,
  );
  validateStrategicText(
    errors,
    "body.incumbentBlindSpot.whyTheyMissIt",
    parsedArtifact.body.incumbentBlindSpot.whyTheyMissIt,
  );

  if (
    parsedArtifact.sources.length < 5 &&
    !bodyHasAnyBlockGap(parsedArtifact.body)
  ) {
    errors.push(
      `sources: have ${parsedArtifact.sources.length}, need >=5 Section-level sources.`,
    );
  }

  const competitorCount = parsedArtifact.body.competitorSet.competitors.length;
  if (competitorCount < 3 && !hasBlockGap(parsedArtifact.body.competitorSet)) {
    errors.push(
      `body.competitorSet.competitors: have ${competitorCount}, need >=3 competitors.`,
    );
  }

  const axisCount = parsedArtifact.body.positioningTaxonomy.axes.length;
  if (axisCount < 2 && !hasBlockGap(parsedArtifact.body.positioningTaxonomy)) {
    errors.push(`body.positioningTaxonomy.axes: have ${axisCount}, need >=2 axes.`);
  }

  const pricingPointCount = parsedArtifact.body.pricingReality.dataPoints.length;
  if (pricingPointCount < 2 && !hasBlockGap(parsedArtifact.body.pricingReality)) {
    errors.push(
      `body.pricingReality.dataPoints: have ${pricingPointCount}, need >=2 pricing data points.`,
    );
  }
  const distinctPricingCompetitors = uniqueCount(
    parsedArtifact.body.pricingReality.dataPoints.map(
      (point) => point.competitor,
    ),
  );
  if (
    distinctPricingCompetitors < 2 &&
    !hasBlockGap(parsedArtifact.body.pricingReality)
  ) {
    errors.push(
      `body.pricingReality.dataPoints: need pricing evidence for >=2 distinct competitors, have ${distinctPricingCompetitors}.`,
    );
  }

  const shareOfVoiceCount = parsedArtifact.body.shareOfVoice.slices.length;
  if (shareOfVoiceCount < 1 && !hasBlockGap(parsedArtifact.body.shareOfVoice)) {
    errors.push(
      `body.shareOfVoice.slices: have ${shareOfVoiceCount}, need >=1 surface or a blockGap.`,
    );
  }

  const weaknessCount = parsedArtifact.body.publicWeaknesses.items.length;
  if (weaknessCount < 1 && !hasBlockGap(parsedArtifact.body.publicWeaknesses)) {
    errors.push(
      `body.publicWeaknesses.items: have ${weaknessCount}, need >=1 weakness or a blockGap.`,
    );
  }
  const narrativeArcCount = parsedArtifact.body.narrativeArcs.arcs.length;
  if (narrativeArcCount < 1 && !hasBlockGap(parsedArtifact.body.narrativeArcs)) {
    errors.push(
      `body.narrativeArcs.arcs: have ${narrativeArcCount}, need >=1 arc or a blockGap.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
