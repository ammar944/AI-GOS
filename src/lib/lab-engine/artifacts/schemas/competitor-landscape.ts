import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";
import {
  evidenceBlockGapSchema,
  incumbentBlindSpotSchema,
  keyFindingsSchema,
  strategicInsightSchema,
  validateStrategicInsightMinimums,
  validateStrategicText,
  whereToAttackVsConcedeSchema,
} from "./strategic-insight";

const competitorTypes = ["direct", "indirect", "status-quo", "diy"] as const;
const adPlatforms = ["google", "meta", "linkedin"] as const;
const validUrlPattern = /^https?:\/\/\S+\.\S+/;
const adPlatformSchema = z.enum(adPlatforms);
const blockGapFieldSchema = evidenceBlockGapSchema
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

const competitorSchema = z
  .object({
    name: z.string().min(1),
    url: z.string().min(1),
    competitorType: z.enum(competitorTypes),
    oneLinePositioning: z.string().min(1),
    verbatimHeroCopy: z.string().min(1),
    pricingPosition: z.string().min(1),
    sourceUrl: z.string().min(1),
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
  })
  .strict();

const shareOfVoiceSliceSchema = z
  .object({
    surface: z.string().min(1),
    winner: z.string().min(1),
    evidence: z.string().min(1),
    sourceUrl: z.string().min(1),
  })
  .strict();

const competitorWeaknessSchema = z
  .object({
    competitor: z.string().min(1),
    verbatimQuote: z.string().min(1),
    source: z.string().min(1),
    sourceUrl: z.string().min(1),
    whyItMatters: z.string().min(1),
  })
  .strict();

const narrativeArcSchema = z
  .object({
    competitor: z.string().min(1),
    villain: z.string().min(1),
    hero: z.string().min(1),
    transformationClaim: z.string().min(1),
    sourceUrl: z.string().min(1),
  })
  .strict();

const competitorSetSchema = z
  .object({
    prose: z.string().min(1),
    competitors: z.array(competitorSchema),
    blockGap: blockGapFieldSchema,
  })
  .strict();

const positioningTaxonomySchema = z
  .object({
    prose: z.string().min(1),
    axes: z.array(positioningAxisSchema),
    blockGap: blockGapFieldSchema,
  })
  .strict();

const pricingRealitySchema = z
  .object({
    prose: z.string().min(1),
    dataPoints: z.array(pricingDataPointSchema),
    blockGap: blockGapFieldSchema,
  })
  .strict();

const shareOfVoiceSchema = z
  .object({
    prose: z.string().min(1),
    slices: z.array(shareOfVoiceSliceSchema),
    blockGap: blockGapFieldSchema,
  })
  .strict();

const publicWeaknessesSchema = z
  .object({
    prose: z.string().min(1),
    items: z.array(competitorWeaknessSchema),
    blockGap: blockGapFieldSchema,
  })
  .strict();

const narrativeArcsSchema = z
  .object({
    prose: z.string().min(1),
    arcs: z.array(narrativeArcSchema),
    blockGap: blockGapFieldSchema,
  })
  .strict();

const adPresenceSignalSchema = z
  .object({
    competitor: z.string().min(1),
    platforms: z.array(adPlatformSchema),
    estSpend: z.string().min(1),
    evidence: z.string().min(1),
    sourceUrl: z.string().url(),
  })
  .strict();

const adPresenceSchema = z
  .object({
    prose: z.string().min(1),
    signals: z.array(adPresenceSignalSchema),
    blockGap: blockGapFieldSchema,
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
    platform: adPlatformSchema.optional(),
    reason: z.string().min(1),
  })
  .strict();

const adEvidenceSourceErrorSchema = z
  .object({
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
    keyFindings: keyFindingsSchema.optional(),
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

  if (parsedArtifact.sources.length < 5) {
    errors.push(
      `sources: have ${parsedArtifact.sources.length}, need >=5 Section-level sources.`,
    );
  }

  const competitorCount = parsedArtifact.body.competitorSet.competitors.length;
  if (competitorCount < 5 && !hasBlockGap(parsedArtifact.body.competitorSet)) {
    errors.push(
      `body.competitorSet.competitors: have ${competitorCount}, need >=5 competitors across direct, indirect, status-quo, and diy.`,
    );
  }

  const observedTypes = parsedArtifact.body.competitorSet.competitors.map(
    (competitor) => competitor.competitorType,
  );
  const requiredCompetitorTypes = ["direct", "status-quo"] as const;
  const missingTypes = requiredCompetitorTypes.filter(
    (competitorType) => !observedTypes.includes(competitorType),
  );
  if (missingTypes.length > 0 && !hasBlockGap(parsedArtifact.body.competitorSet)) {
    errors.push(
      `body.competitorSet.competitors: missing competitor types ${missingTypes.join(", ")}.`,
    );
  }

  const axisCount = parsedArtifact.body.positioningTaxonomy.axes.length;
  if (axisCount < 3 && !hasBlockGap(parsedArtifact.body.positioningTaxonomy)) {
    errors.push(`body.positioningTaxonomy.axes: have ${axisCount}, need >=3 axes.`);
  }

  const pricingPointCount = parsedArtifact.body.pricingReality.dataPoints.length;
  if (pricingPointCount < 3 && !hasBlockGap(parsedArtifact.body.pricingReality)) {
    errors.push(
      `body.pricingReality.dataPoints: have ${pricingPointCount}, need >=3 pricing data points.`,
    );
  }
  const distinctPricingCompetitors = uniqueCount(
    parsedArtifact.body.pricingReality.dataPoints.map(
      (point) => point.competitor,
    ),
  );
  if (
    distinctPricingCompetitors < 3 &&
    !hasBlockGap(parsedArtifact.body.pricingReality)
  ) {
    errors.push(
      `body.pricingReality.dataPoints: need pricing evidence for >=3 distinct competitors, have ${distinctPricingCompetitors}.`,
    );
  }

  const shareOfVoiceCount = parsedArtifact.body.shareOfVoice.slices.length;
  if (shareOfVoiceCount < 3 && !hasBlockGap(parsedArtifact.body.shareOfVoice)) {
    errors.push(
      `body.shareOfVoice.slices: have ${shareOfVoiceCount}, need >=3 surfaces.`,
    );
  }

  const weaknessCount = parsedArtifact.body.publicWeaknesses.items.length;
  if (weaknessCount < 4 && !hasBlockGap(parsedArtifact.body.publicWeaknesses)) {
    errors.push(
      `body.publicWeaknesses.items: have ${weaknessCount}, need >=4 verbatim weaknesses.`,
    );
  }
  const weaknessCompetitorCount = uniqueCount(
    parsedArtifact.body.publicWeaknesses.items.map((item) => item.competitor),
  );
  if (
    weaknessCompetitorCount < 2 &&
    !hasBlockGap(parsedArtifact.body.publicWeaknesses)
  ) {
    errors.push(
      `body.publicWeaknesses.items: need weaknesses across >=2 competitors, have ${weaknessCompetitorCount}.`,
    );
  }

  const narrativeArcCount = parsedArtifact.body.narrativeArcs.arcs.length;
  if (narrativeArcCount < 3 && !hasBlockGap(parsedArtifact.body.narrativeArcs)) {
    errors.push(
      `body.narrativeArcs.arcs: have ${narrativeArcCount}, need >=3 arcs.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
