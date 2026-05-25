import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

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
  [key: string]: unknown;
}

const TYPED_ARTIFACT_KEYS_BY_ZONE: Record<PositioningSectionId, readonly string[]> = {
  positioningMarketCategory: ['marketCategoryArtifact'],
  positioningBuyerICP: ['buyerIcpArtifact'],
  positioningCompetitorLandscape: ['competitorLandscapeArtifact'],
  positioningVoiceOfCustomer: ['voiceOfCustomerArtifact', 'vocArtifact'],
  positioningDemandIntent: ['demandIntentArtifact'],
  positioningOfferDiagnostic: ['offerPerformanceArtifact', 'offerDiagnosticArtifact'],
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

function isKnownPositioningZone(value: string): value is PositioningSectionId {
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
