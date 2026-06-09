import type { AllPositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import type { BuyerICPBody } from '@/lib/lab-engine/artifacts/schemas/buyer-icp';
import type { CompetitorLandscapeBody } from '@/lib/lab-engine/artifacts/schemas/competitor-landscape';
import type { DemandIntentBody } from '@/lib/lab-engine/artifacts/schemas/demand-intent';
import type {
  SectionReviewResult,
  VerificationReportEnvelope,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import type { MarketCategoryBody } from '@/lib/lab-engine/artifacts/schemas/market-category';
import type { OfferDiagnosticBody } from '@/lib/lab-engine/artifacts/schemas/offer-diagnostic';
import type { PaidMediaPlanBody } from '@/lib/lab-engine/artifacts/schemas/paid-media-plan';
import type { VoiceOfCustomerBody } from '@/lib/lab-engine/artifacts/schemas/voice-of-customer';

export interface PositioningArtifactSource {
  title: string;
  url: string;
  whyItMatters?: string;
  accessedAt?: string;
  [key: string]: unknown;
}

export interface PositioningTypedArtifact {
  sectionTitle: string;
  verdict: string;
  statusSummary: string;
  confidence: number;
  sources: PositioningArtifactSource[];
  verification?: VerificationReportEnvelope;
  review?: SectionReviewResult;
  [key: string]: unknown;
}

export type MarketCategoryArtifact = PositioningTypedArtifact & MarketCategoryBody;
export type BuyerICPArtifact = PositioningTypedArtifact & BuyerICPBody;
export type CompetitorLandscapeArtifact = PositioningTypedArtifact &
  CompetitorLandscapeBody;
export type VoiceOfCustomerArtifact = PositioningTypedArtifact &
  VoiceOfCustomerBody;
export type DemandIntentArtifact = PositioningTypedArtifact & DemandIntentBody;
export type OfferPerformanceArtifact = PositioningTypedArtifact &
  OfferDiagnosticBody;
export type PaidMediaPlanArtifact = PositioningTypedArtifact & PaidMediaPlanBody;

const TYPED_ARTIFACT_KEYS_BY_ZONE: Record<AllPositioningSectionId, readonly string[]> = {
  positioningMarketCategory: ['marketCategoryArtifact'],
  positioningBuyerICP: ['buyerIcpArtifact'],
  positioningCompetitorLandscape: ['competitorLandscapeArtifact'],
  positioningVoiceOfCustomer: ['voiceOfCustomerArtifact', 'vocArtifact'],
  positioningDemandIntent: ['demandIntentArtifact'],
  positioningOfferDiagnostic: ['offerPerformanceArtifact', 'offerDiagnosticArtifact'],
  positioningPaidMediaPlan: ['paidMediaPlanArtifact'],
};

const COMMON_TYPED_ARTIFACT_KEYS = [
  'data',
  'typedArtifact',
  'artifact',
  'positioningArtifact',
] as const;

const LAB_ENVELOPE_ONLY_KEYS: ReadonlySet<string> = new Set([
  'id',
  'runId',
  'createdAt',
  'sectionId',
  'body',
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPositioningArtifactSource(
  value: unknown,
): value is PositioningArtifactSource {
  return (
    isRecord(value) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.url)
  );
}

export function isPositioningTypedArtifact(
  value: unknown,
): value is PositioningTypedArtifact {
  // Sources are validated and filtered downstream in pickPositioningTypedArtifact.
  // Keeping this guard tolerant of partial sources prevents the whole artifact from
  // falling back to markdown when a single source entry is missing a field.
  return (
    isRecord(value) &&
    isNonEmptyString(value.sectionTitle) &&
    isNonEmptyString(value.verdict) &&
    isNonEmptyString(value.statusSummary) &&
    typeof value.confidence === 'number' &&
    Number.isFinite(value.confidence) &&
    Array.isArray(value.sources)
  );
}

function isKnownPositioningZone(value: string): value is AllPositioningSectionId {
  return Object.prototype.hasOwnProperty.call(TYPED_ARTIFACT_KEYS_BY_ZONE, value);
}

function artifactCandidateKeys(zoneId: string | null | undefined): string[] {
  const keys = new Set<string>(COMMON_TYPED_ARTIFACT_KEYS);
  if (zoneId && isKnownPositioningZone(zoneId)) {
    for (const key of TYPED_ARTIFACT_KEYS_BY_ZONE[zoneId]) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

function pickNestedPositioningTypedArtifact(
  value: unknown,
  zoneId: string | null | undefined,
  seen: WeakSet<object>,
  depth: number,
): PositioningTypedArtifact | null {
  if (isPositioningTypedArtifact(value)) return value;
  if (!isRecord(value) || depth >= 6) return null;

  if (seen.has(value)) return null;
  seen.add(value);

  for (const key of artifactCandidateKeys(zoneId)) {
    const candidate: unknown = value[key];
    if (candidate === undefined || candidate === value) continue;
    const artifact = pickNestedPositioningTypedArtifact(
      candidate,
      zoneId,
      seen,
      depth + 1,
    );
    if (artifact) return artifact;
  }

  return null;
}

function dropEnvelopeOnlyKeys(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !LAB_ENVELOPE_ONLY_KEYS.has(key)),
  );
}

function normalizePickedArtifact(
  found: PositioningTypedArtifact,
): PositioningTypedArtifact {
  const validSources = found.sources.filter(isPositioningArtifactSource);
  const body = found.body;
  if (!isRecord(body)) {
    return validSources.length === found.sources.length
      ? found
      : { ...found, sources: validSources };
  }

  return {
    ...dropEnvelopeOnlyKeys(body),
    sectionTitle: found.sectionTitle,
    verdict: found.verdict,
    statusSummary: found.statusSummary,
    confidence: found.confidence,
    sources: validSources,
    ...(found.verification === undefined ? {} : { verification: found.verification }),
    ...(found.review === undefined ? {} : { review: found.review }),
    ...(found.needs_review === true ? { needs_review: true } : {}),
    ...(isRecord(found.verifierSummary)
      ? { verifierSummary: found.verifierSummary }
      : {}),
  };
}

export function pickPositioningTypedArtifact(
  value: unknown,
  zoneId?: string | null,
): PositioningTypedArtifact | null {
  const found = pickNestedPositioningTypedArtifact(
    value,
    zoneId,
    new WeakSet<object>(),
    0,
  );
  if (!found) return null;
  return normalizePickedArtifact(found);
}
