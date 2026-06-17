import {
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
} from '@/lib/ai/prompts/positioning-skills';
import {
  READER_SECTION_IDS,
  type ReaderSectionId,
} from '@/components/research-v3/reader-sections';
import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  isHttpUrl,
  isLikelyNamedBuyerIdentity,
} from '@/lib/lab-engine/artifacts/schemas/buyer-icp';
import {
  SectionArtifactValidationError,
  assertSectionArtifactPersistable,
} from '@/lib/lab-engine/sections/section-registry';
import {
  isV3ShareResearchSnapshot,
  type V3ShareResearchSnapshot,
} from '@/lib/research-v2/share-snapshot';
import {
  readVerificationFlag,
  readVerificationTier,
  type ReviewTier,
  type VerificationFlag,
  type VerificationTier,
} from '@/lib/research-v2/verification-tier';

export type LiveQualityGateVerdict =
  | 'pipeline_not_recovered'
  | 'pipeline_recovered_quality_limited'
  | 'below_9_of_10_gate'
  | 'nine_of_ten_research_achieved';

export const LIVE_QUALITY_GATE_VERSION = 'research-quality-gates-v1';

export type LiveResearchQualityStatus =
  | 'failed'
  | 'insufficient'
  | 'research_grade_with_gaps'
  | 'verified';

export type LivePipelineGateStatus = 'recovered' | 'not_recovered';

export type LiveActionabilityStatus =
  | 'verified'
  | 'usable_with_caveats'
  | 'not_verified';

export type LiveProjectionTrustStatus =
  | 'verified'
  | 'mismatch'
  | 'missing'
  | 'not_checked';

export interface LiveQualityGateReadout<TStatus extends string> {
  status: TStatus;
  reasons: string[];
}

export interface LiveQualityGateGates {
  pipeline: LiveQualityGateReadout<LivePipelineGateStatus>;
  researchQuality: LiveQualityGateReadout<LiveResearchQualityStatus>;
  actionability: LiveQualityGateReadout<LiveActionabilityStatus>;
  projectionSync: LiveQualityGateReadout<LiveProjectionTrustStatus>;
  projectionTrust: LiveQualityGateReadout<LiveProjectionTrustStatus>;
}

export interface LiveQualityGateArtifactRow {
  id: string;
  runId: string;
  status: string | null;
  childrenComplete: number;
  childrenTotal: number;
  profilePersistedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface LiveQualityGateSectionRow {
  id?: string;
  zone: string | null;
  sectionRunId?: string | null;
  status: string | null;
  title?: string | null;
  data: unknown;
  verificationTier: unknown;
  verificationFlag: unknown;
  countsTowardRollup?: boolean | null;
  updatedAt?: string | null;
}

export interface LiveQualityGateSectionRunRow {
  id?: string;
  zone: string | null;
  status: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  abortedAt?: string | null;
  error?: unknown;
  telemetry?: unknown;
}

export interface LiveQualityGateJourneySessionSnapshot {
  id: string;
  profileId: string | null;
  metadata?: Record<string, unknown> | null;
  onboardingData?: Record<string, unknown> | null;
  updatedAt?: string | null;
}

export interface LiveQualityGateProfileSnapshot {
  id: string;
  aiInsights: Record<string, unknown> | null;
  positioningStrategy: Record<string, unknown> | null;
  offerScore?: Record<string, unknown> | null;
  updatedAt?: string | null;
}

export interface LiveQualityGateShareSnapshot {
  shareToken: string | null;
  researchSnapshot: unknown;
  createdAt?: string | null;
}

export interface LiveQualityGateInput {
  runId: string;
  artifact: LiveQualityGateArtifactRow | null;
  sections: LiveQualityGateSectionRow[];
  sectionRuns: LiveQualityGateSectionRunRow[];
  journeySession?: LiveQualityGateJourneySessionSnapshot | null;
  profile?: LiveQualityGateProfileSnapshot | null;
  share?: LiveQualityGateShareSnapshot | null;
  subjectDomain?: string | null;
}

export interface LiveQualityGateCompletionRow {
  zone: ReaderSectionId;
  sectionStatus: string | null;
  sectionRunStatus: string | null;
  countsTowardRollup: boolean | null;
  updatedAt: string | null;
}

export interface LiveQualityGateSectionEvidence {
  zone: ReaderSectionId;
  artifactPresent: boolean;
  schemaValid: boolean;
  schemaErrors: string[];
  verificationTier: VerificationTier | null;
  verificationFlag: VerificationFlag | null;
  reviewTier: ReviewTier | null;
  evidenceGap: boolean;
  evidenceGapReasons: string[];
  qualityStatus: LiveResearchQualityStatus;
  qualityReasons: string[];
  actionabilityStatus: LiveActionabilityStatus;
  actionabilityReasons: string[];
  verifiedCount: number | null;
  unsupportedCount: number | null;
  totalClaims: number | null;
}

export interface LiveQualityGateVocAudit {
  painQuoteCount: number;
  successQuoteCount: number;
  painSourceDomains: string[];
  painSourceUrls: string[];
  acquisitionModes: string[];
  gapReasons: string[];
  subjectDomain: string | null;
  selfSourcedPainQuoteCount: number;
  passesQuoteFloor: boolean;
  passesSourceDiversity: boolean;
  passesSourceUrlFloor: boolean;
  passesSubjectDomainExclusion: boolean;
}

export interface LiveQualityGateTrustCheck {
  present: boolean;
  matched: boolean;
  checkedZones: ReaderSectionId[];
  failures: string[];
}

export interface LiveQualityGateResult {
  runId: string;
  verdict: LiveQualityGateVerdict;
  researchQualityStatus: LiveResearchQualityStatus;
  gates: LiveQualityGateGates;
  blockedBy: string[];
  researchQualityReasons: string[];
  failures: string[];
  warnings: string[];
  completion: LiveQualityGateCompletionRow[];
  sectionEvidence: LiveQualityGateSectionEvidence[];
  vocAudit: LiveQualityGateVocAudit;
  profileTrust: LiveQualityGateTrustCheck;
  shareTrust: LiveQualityGateTrustCheck;
}

interface ParsedSection {
  row: LiveQualityGateSectionRow;
  zone: ReaderSectionId;
  artifact: ArtifactEnvelope | null;
  schemaErrors: string[];
}

const PROFILE_TRUST_SECTION_IDS =
  POSITIONING_SECTION_IDS satisfies readonly ReaderSectionId[];

const CORE_SECTION_SET: ReadonlySet<string> = new Set(POSITIONING_SECTION_IDS);
const RESEARCH_QUALITY_SEVERITY: Record<LiveResearchQualityStatus, number> = {
  verified: 0,
  research_grade_with_gaps: 1,
  insufficient: 2,
  failed: 3,
};
const ACTIONABILITY_SEVERITY: Record<LiveActionabilityStatus, number> = {
  verified: 0,
  usable_with_caveats: 1,
  not_verified: 2,
};

type SectionGateClassification = {
  qualityStatus: LiveResearchQualityStatus;
  qualityReasons: string[];
  actionabilityStatus: LiveActionabilityStatus;
  actionabilityReasons: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isReaderZone(value: unknown): value is ReaderSectionId {
  return (
    typeof value === 'string' &&
    (READER_SECTION_IDS as readonly string[]).includes(value)
  );
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function getRegistrableDomain(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;

  let host = raw;
  try {
    host = new URL(raw).hostname;
  } catch {
    host = raw.replace(/^[a-z]+:\/\//i, '').split('/')[0] ?? '';
  }

  const labels = host
    .replace(/^www\./i, '')
    .toLowerCase()
    .split('.')
    .filter((label) => label.length > 0);

  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0] ?? null;
  return labels.slice(-2).join('.');
}

function uniqueStrings(values: readonly (string | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function mapByZone<T extends { zone: string | null }>(
  rows: readonly T[],
): Map<ReaderSectionId, T> {
  const result = new Map<ReaderSectionId, T>();

  for (const row of rows) {
    if (!isReaderZone(row.zone)) continue;
    result.set(row.zone, row);
  }

  return result;
}

function latestRunForZone(
  rows: readonly LiveQualityGateSectionRunRow[],
  zone: ReaderSectionId,
): LiveQualityGateSectionRunRow | null {
  const matches = rows.filter((row) => row.zone === zone);
  return (
    matches.find((row) => row.status === 'complete') ??
    matches[matches.length - 1] ??
    null
  );
}

function validationErrorsForArtifact(artifact: ArtifactEnvelope): string[] {
  try {
    assertSectionArtifactPersistable(artifact);
    return [];
  } catch (error) {
    if (error instanceof SectionArtifactValidationError) {
      return error.errors;
    }

    return [error instanceof Error ? error.message : String(error)];
  }
}

function parseSection(row: LiveQualityGateSectionRow): ParsedSection | null {
  if (!isReaderZone(row.zone)) return null;

  const parsed = artifactEnvelopeSchema.safeParse(row.data);
  if (!parsed.success) {
    return {
      row,
      zone: row.zone,
      artifact: null,
      schemaErrors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  if (parsed.data.sectionId !== row.zone) {
    return {
      row,
      zone: row.zone,
      artifact: parsed.data,
      schemaErrors: [
        `sectionId mismatch: row zone=${row.zone} artifact sectionId=${parsed.data.sectionId}`,
      ],
    };
  }

  return {
    row,
    zone: row.zone,
    artifact: parsed.data,
    schemaErrors: validationErrorsForArtifact(parsed.data),
  };
}

function buildCompletionRows(
  sectionsByZone: Map<ReaderSectionId, LiveQualityGateSectionRow>,
  sectionRuns: readonly LiveQualityGateSectionRunRow[],
): LiveQualityGateCompletionRow[] {
  return READER_SECTION_IDS.map((zone) => {
    const section = sectionsByZone.get(zone) ?? null;
    const run = latestRunForZone(sectionRuns, zone);

    return {
      zone,
      sectionStatus: section?.status ?? null,
      sectionRunStatus: run?.status ?? null,
      countsTowardRollup: section?.countsTowardRollup ?? null,
      updatedAt: section?.updatedAt ?? run?.completedAt ?? run?.startedAt ?? null,
    };
  });
}

function countVerificationClaims(
  artifact: ArtifactEnvelope | null,
): {
  verifiedCount: number | null;
  unsupportedCount: number | null;
  totalClaims: number | null;
} {
  if (!artifact?.verification) {
    return {
      verifiedCount: null,
      unsupportedCount: null,
      totalClaims: null,
    };
  }

  return {
    verifiedCount: artifact.verification.verifiedCount,
    unsupportedCount: artifact.verification.unsupportedCount,
    totalClaims:
      artifact.verification.verifiedCount +
      artifact.verification.unsupportedCount,
  };
}

function readReviewTier(value: unknown): ReviewTier | null {
  if (value === 'unavailable') return 'unavailable';
  return readVerificationTier(value);
}

function strictestResearchQualityStatus(
  first: LiveResearchQualityStatus,
  second: LiveResearchQualityStatus,
): LiveResearchQualityStatus {
  return RESEARCH_QUALITY_SEVERITY[first] >=
    RESEARCH_QUALITY_SEVERITY[second]
    ? first
    : second;
}

function strictestActionabilityStatus(
  first: LiveActionabilityStatus,
  second: LiveActionabilityStatus,
): LiveActionabilityStatus {
  return ACTIONABILITY_SEVERITY[first] >= ACTIONABILITY_SEVERITY[second]
    ? first
    : second;
}

function getEvidenceGapReport(
  artifact: ArtifactEnvelope | null,
): Record<string, unknown> | null {
  const body = isRecord(artifact?.body) ? artifact.body : {};
  const report = isRecord(body.evidenceGapReport) ? body.evidenceGapReport : null;

  return report;
}

function hasStructuredEvidenceGapReport(
  artifact: ArtifactEnvelope | null,
): boolean {
  const report = getEvidenceGapReport(artifact);
  if (!report) return false;

  const sourcingPlan = Array.isArray(report.sourcingPlan)
    ? report.sourcingPlan
    : [];

  return (
    asString(report.reason) !== null ||
    asString(report.summary) !== null ||
    getEvidenceGapAttempts(report).length > 0 ||
    sourcingPlan.some((item) => asString(item) !== null)
  );
}

function hasSpecificEvidenceGapReport(
  artifact: ArtifactEnvelope | null,
  reason: string,
): boolean {
  const report = getEvidenceGapReport(artifact);
  if (!report || asString(report.reason) !== reason) return false;

  const sourcingPlan = Array.isArray(report.sourcingPlan)
    ? report.sourcingPlan
    : [];

  return (
    asString(report.summary) !== null &&
    sourcingPlan.some((item) => asString(item) !== null)
  );
}

function genericResearchGateClassification(input: {
  zone: ReaderSectionId;
  artifact: ArtifactEnvelope | null;
  schemaValid: boolean;
  schemaErrors: readonly string[];
  verificationTier: VerificationTier | null;
  verificationFlag: VerificationFlag | null;
  reviewTier: ReviewTier | null;
  evidenceGap: boolean;
  evidenceGapReasons: readonly string[];
  unsupportedCount: number | null;
}): SectionGateClassification {
  if (!input.artifact) {
    return {
      qualityStatus: 'failed',
      qualityReasons: ['section artifact row is missing'],
      actionabilityStatus: 'not_verified',
      actionabilityReasons: ['section artifact row is missing'],
    };
  }

  if (!input.schemaValid) {
    const reason = `schema/minimum validation failed: ${input.schemaErrors.join('; ')}`;

    return {
      qualityStatus: 'failed',
      qualityReasons: [reason],
      actionabilityStatus: 'not_verified',
      actionabilityReasons: [reason],
    };
  }

  const reasons: string[] = [];
  const flagEvidenceGap = input.verificationFlag?.evidenceGap === true;
  const hasEvidenceGap = input.evidenceGap || flagEvidenceGap;
  const hasStructuredGapReport = hasStructuredEvidenceGapReport(input.artifact);
  const verificationTier =
    input.verificationTier ?? input.verificationFlag?.tier ?? null;

  if (verificationTier === 'insufficient') {
    reasons.push(`${input.zone} verification_tier is insufficient`);
  }
  if (verificationTier === 'needs_review') {
    reasons.push(`${input.zone} verification_tier is needs_review`);
  }
  if (input.reviewTier === 'insufficient') {
    reasons.push(`${input.zone} review tier is insufficient`);
  }
  if (input.reviewTier === 'needs_review') {
    reasons.push(`${input.zone} review tier is needs_review`);
  }
  if (input.evidenceGap) {
    reasons.push(`${input.zone} body.evidenceGap=true`);
  }
  if (flagEvidenceGap) {
    reasons.push(`${input.zone} verification_flag.evidenceGap=true`);
  }
  if (input.evidenceGapReasons.length > 0) {
    reasons.push(`gap reasons: ${input.evidenceGapReasons.join(', ')}`);
  }
  if (hasEvidenceGap && hasStructuredGapReport) {
    reasons.push('structured evidence-gap report is present');
  }
  if (input.unsupportedCount !== null && input.unsupportedCount > 0) {
    reasons.push(`unsupported claims=${input.unsupportedCount}`);
  }

  if (
    verificationTier === 'insufficient' ||
    input.reviewTier === 'insufficient' ||
    hasEvidenceGap
  ) {
    const qualityStatus: LiveResearchQualityStatus =
      hasEvidenceGap && hasStructuredGapReport
        ? 'research_grade_with_gaps'
        : 'insufficient';
    const qualityReasons = uniqueStrings(
      reasons.length > 0
        ? reasons
        : ['insufficient verification without structured evidence-gap report'],
    );

    return {
      qualityStatus,
      qualityReasons,
      actionabilityStatus:
        qualityStatus === 'research_grade_with_gaps'
          ? 'usable_with_caveats'
          : 'not_verified',
      actionabilityReasons: qualityReasons,
    };
  }

  if (
    verificationTier === 'needs_review' ||
    input.reviewTier === 'needs_review'
  ) {
    const qualityReasons = uniqueStrings(reasons);

    return {
      qualityStatus: 'research_grade_with_gaps',
      qualityReasons,
      actionabilityStatus: 'usable_with_caveats',
      actionabilityReasons: qualityReasons,
    };
  }

  if (!verificationTier) {
    const qualityReasons = ['verification_tier is missing'];

    return {
      qualityStatus: 'research_grade_with_gaps',
      qualityReasons,
      actionabilityStatus: 'usable_with_caveats',
      actionabilityReasons: qualityReasons,
    };
  }

  return {
    qualityStatus: 'verified',
    qualityReasons: [],
    actionabilityStatus: 'verified',
    actionabilityReasons: [],
  };
}

function countRealBuyerQuoteRecords(artifact: ArtifactEnvelope | null): number {
  return [
    ...getQuoteRecords(artifact, 'painLanguage'),
    ...getQuoteRecords(artifact, 'successLanguage'),
  ].filter((quote) => asString(quote.verbatimText) !== null).length;
}

// evidenceGapReport.acquisitionLedger rejectionReasons that mean a PROMOTABLE
// candidate was dropped for COUNT / SELECTION reasons (not a quality failure).
const VOC_COUNT_SELECTION_REJECTION_REASONS: ReadonlySet<string> = new Set([
  'insufficient_candidates',
  'insufficient_independent_domains',
  'not_selected',
]);

// Reads the VoC acquisitionLedger to distinguish "empty DESPITE evidence" (the
// scrape+parser actually succeeded) from an honest evidence desert. acquiredCount
// counts rows where BOTH scrape and parser succeeded; countSelectionRejectedCount
// counts those that were then rejected for count/selection (not quality) reasons.
function summarizeVocAcquisition(artifact: ArtifactEnvelope | null): {
  acquiredCount: number;
  countSelectionRejectedCount: number;
} {
  const body = isRecord(artifact?.body) ? artifact.body : {};
  const report = isRecord(body.evidenceGapReport) ? body.evidenceGapReport : {};
  const rows = Array.isArray(report.acquisitionLedger)
    ? report.acquisitionLedger.filter(isRecord)
    : [];

  let acquiredCount = 0;
  let countSelectionRejectedCount = 0;
  for (const row of rows) {
    if (asString(row.scrapeStatus) !== 'succeeded') continue;
    if (asString(row.parserStatus) !== 'succeeded') continue;
    acquiredCount += 1;
    if (
      asString(row.promotionStatus) === 'rejected' &&
      VOC_COUNT_SELECTION_REJECTION_REASONS.has(asString(row.rejectionReason) ?? '')
    ) {
      countSelectionRejectedCount += 1;
    }
  }

  return { acquiredCount, countSelectionRejectedCount };
}

function getBuyerPersonaRecords(
  artifact: ArtifactEnvelope | null,
): Record<string, unknown>[] {
  const body = isRecord(artifact?.body) ? artifact.body : {};
  const personaReality = isRecord(body.personaReality)
    ? body.personaReality
    : {};

  return Array.isArray(personaReality.personas)
    ? personaReality.personas.filter(isRecord)
    : [];
}

function getNamedBuyerIdentityLabels(artifact: ArtifactEnvelope | null): string[] {
  return uniqueStrings(
    getBuyerPersonaRecords(artifact).map((persona) => {
      const name = asString(persona.name);
      if (!name) return null;
      const sourceUrl = asString(persona.sourceUrl);
      if (!sourceUrl || !isHttpUrl(sourceUrl)) return null;

      return isLikelyNamedBuyerIdentity(name, {
        company: asString(persona.company) ?? undefined,
        role: asString(persona.role) ?? undefined,
        seniority: asString(persona.seniority) ?? undefined,
        title: asString(persona.title) ?? undefined,
      })
        ? name
        : null;
    }),
  );
}

function getRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function getNestedRecord(
  root: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return isRecord(root[key]) ? root[key] : {};
}

function getMarketCategoryTamGapReasons(
  artifact: ArtifactEnvelope | null,
): string[] {
  const body = isRecord(artifact?.body) ? artifact.body : {};
  const marketSize = getNestedRecord(body, 'marketSize');
  const bottomUpTam = getNestedRecord(marketSize, 'bottomUpTam');
  const inputs = getRecordArray(bottomUpTam.inputs);

  return inputs
    .filter((input) => asString(input.status) === 'evidence-gap')
    .map((input) => {
      const label =
        asString(input.label) ?? asString(input.inputType) ?? 'unknown';

      return `bottom-up TAM input ${label} is evidence-gap`;
    });
}

function hasLabeledMarketCategoryTamGaps(
  artifact: ArtifactEnvelope | null,
): boolean {
  const body = isRecord(artifact?.body) ? artifact.body : {};
  const marketSize = getNestedRecord(body, 'marketSize');
  const bottomUpTam = getNestedRecord(marketSize, 'bottomUpTam');
  const inputs = getRecordArray(bottomUpTam.inputs).filter(
    (input) => asString(input.status) === 'evidence-gap',
  );

  return (
    inputs.length > 0 &&
    inputs.every((input) =>
      /evidence\s+gap/i.test(asString(input.value) ?? ''),
    ) &&
    /evidence\s+gap/i.test(asString(bottomUpTam.reachableRevenueEstimate) ?? '')
  );
}

function hasUsefulSourcedMarketCategoryResearch(
  artifact: ArtifactEnvelope | null,
): boolean {
  const body = isRecord(artifact?.body) ? artifact.body : {};
  const categoryDefinition = getNestedRecord(body, 'categoryDefinition');
  const marketSize = getNestedRecord(body, 'marketSize');
  const structuralForces = getNestedRecord(body, 'structuralForces');
  const categoryMaturity = getNestedRecord(body, 'categoryMaturity');
  const maturityClassification = getNestedRecord(
    categoryMaturity,
    'classification',
  );
  const adjacentCategories = getRecordArray(categoryDefinition.adjacentCategories);
  const marketSignals = getRecordArray(marketSize.signals);
  const forces = getRecordArray(structuralForces.forces);
  const maturitySignals = getRecordArray(
    maturityClassification.supportingSignals,
  );
  const sourcedMarketSignals = marketSignals.filter(
    (signal) => asString(signal.sourceUrl) !== null,
  );
  const sourcedForces = forces.filter(
    (force) => asString(force.sourceUrl) !== null,
  );

  return (
    adjacentCategories.length >= 1 &&
    sourcedMarketSignals.length >= 2 &&
    sourcedForces.length >= 1 &&
    maturitySignals.length >= 1 &&
    asString(categoryDefinition.prose) !== null
  );
}

function classifySectionResearchQuality(input: {
  zone: ReaderSectionId;
  artifact: ArtifactEnvelope | null;
  schemaValid: boolean;
  schemaErrors: readonly string[];
  verificationTier: VerificationTier | null;
  verificationFlag: VerificationFlag | null;
  reviewTier: ReviewTier | null;
  evidenceGap: boolean;
  evidenceGapReasons: readonly string[];
  unsupportedCount: number | null;
}): SectionGateClassification {
  const generic = genericResearchGateClassification(input);
  if (!input.artifact) return generic;

  if (input.zone === 'positioningVoiceOfCustomer') {
    const realBuyerQuoteCount = countRealBuyerQuoteRecords(input.artifact);
    const hasSpecificGapReport = hasSpecificEvidenceGapReport(
      input.artifact,
      'insufficient_voice_of_customer_sources',
    );

    if (realBuyerQuoteCount === 0) {
      // Empty-despite-evidence: only assert it when the acquisitionLedger PROVES
      // scrape+parser success. A true evidence desert keeps the plain reason and is
      // not labelled empty-despite-evidence (decision #2: don't punish honest gaps).
      const acquisition = summarizeVocAcquisition(input.artifact);
      const reasons = uniqueStrings([
        ...generic.qualityReasons,
        'positioningVoiceOfCustomer has zero real buyer quotes',
        ...(acquisition.acquiredCount > 0
          ? [
              `positioningVoiceOfCustomer is empty despite ${acquisition.acquiredCount} successfully acquired candidate(s) (empty-despite-evidence)`,
            ]
          : []),
        ...(acquisition.countSelectionRejectedCount > 0
          ? [
              `positioningVoiceOfCustomer rejected ${acquisition.countSelectionRejectedCount} promotable candidate(s) for count/selection reasons`,
            ]
          : []),
      ]);

      return {
        qualityStatus: 'insufficient',
        qualityReasons: reasons,
        actionabilityStatus: 'not_verified',
        actionabilityReasons: reasons,
      };
    }

    if (generic.qualityStatus === 'failed') return generic;

    if (
      generic.qualityStatus !== 'verified' &&
      hasSpecificGapReport &&
      realBuyerQuoteCount > 0
    ) {
      const reasons = uniqueStrings([
        ...generic.qualityReasons,
        `real buyer quote count=${realBuyerQuoteCount}`,
        'specific insufficient_voice_of_customer_sources gap report is present',
      ]);

      return {
        qualityStatus: 'research_grade_with_gaps',
        qualityReasons: reasons,
        actionabilityStatus: 'usable_with_caveats',
        actionabilityReasons: reasons,
      };
    }

    return generic;
  }

  if (input.zone === 'positioningBuyerICP') {
    const namedBuyerIdentities = getNamedBuyerIdentityLabels(input.artifact);
    const hasSpecificGapReport = hasSpecificEvidenceGapReport(
      input.artifact,
      'insufficient_named_buyer_personas',
    );

    if (namedBuyerIdentities.length < 2) {
      const reasons = uniqueStrings([
        ...generic.qualityReasons,
        `positioningBuyerICP named buyer identities=${namedBuyerIdentities.length}; need >=2`,
      ]);

      return {
        qualityStatus: 'insufficient',
        qualityReasons: reasons,
        actionabilityStatus: 'not_verified',
        actionabilityReasons: reasons,
      };
    }

    if (generic.qualityStatus === 'failed') return generic;

    if (generic.qualityStatus !== 'verified' && hasSpecificGapReport) {
      const reasons = uniqueStrings([
        ...generic.qualityReasons,
        `positioningBuyerICP named buyer identities=${namedBuyerIdentities.length}`,
        'specific insufficient_named_buyer_personas gap report is present',
      ]);

      return {
        qualityStatus: 'research_grade_with_gaps',
        qualityReasons: reasons,
        actionabilityStatus: 'usable_with_caveats',
        actionabilityReasons: reasons,
      };
    }

    return generic;
  }

  if (generic.qualityStatus === 'failed') return generic;

  if (input.zone === 'positioningMarketCategory') {
    const tamGapReasons = getMarketCategoryTamGapReasons(input.artifact);
    if (tamGapReasons.length === 0) return generic;

    const reasons = uniqueStrings([...generic.qualityReasons, ...tamGapReasons]);
    if (
      hasUsefulSourcedMarketCategoryResearch(input.artifact) &&
      hasLabeledMarketCategoryTamGaps(input.artifact)
    ) {
      return {
        qualityStatus: 'research_grade_with_gaps',
        qualityReasons: reasons,
        actionabilityStatus: 'usable_with_caveats',
        actionabilityReasons: reasons,
      };
    }

    return {
      qualityStatus: 'insufficient',
      qualityReasons: reasons,
      actionabilityStatus: 'not_verified',
      actionabilityReasons: reasons,
    };
  }

  return generic;
}

function buildSectionEvidence(
  parsedSections: readonly ParsedSection[],
): LiveQualityGateSectionEvidence[] {
  const parsedByZone = new Map(parsedSections.map((section) => [section.zone, section]));

  return READER_SECTION_IDS.map((zone) => {
    const parsed = parsedByZone.get(zone) ?? null;
    const artifact = parsed?.artifact ?? null;
    const schemaValid = parsed !== null && parsed.schemaErrors.length === 0;
    const schemaErrors = parsed?.schemaErrors ?? ['missing section artifact row'];
    const verificationTier = readVerificationTier(parsed?.row.verificationTier);
    const verificationFlag = readVerificationFlag(parsed?.row.verificationFlag);
    const reviewTier = readReviewTier(artifact?.review?.tier);
    const evidenceGap =
      isRecord(artifact?.body) && artifact.body.evidenceGap === true;
    const evidenceGapReasons = collectGapReasons(artifact);
    const counts = countVerificationClaims(artifact);
    const quality = classifySectionResearchQuality({
      zone,
      artifact,
      schemaValid,
      schemaErrors,
      verificationTier,
      verificationFlag,
      reviewTier,
      evidenceGap,
      evidenceGapReasons,
      unsupportedCount: counts.unsupportedCount,
    });

    return {
      zone,
      artifactPresent: artifact !== null,
      schemaValid,
      schemaErrors,
      verificationTier,
      verificationFlag,
      reviewTier,
      evidenceGap,
      evidenceGapReasons,
      ...quality,
      ...counts,
    };
  });
}

function getQuoteRecords(
  artifact: ArtifactEnvelope | null,
  path: 'painLanguage' | 'successLanguage',
): Record<string, unknown>[] {
  const group = isRecord(artifact?.body) ? artifact.body[path] : null;
  if (!isRecord(group) || !Array.isArray(group.quotes)) return [];
  return group.quotes.filter(isRecord);
}

function getEvidenceGapAttempts(
  report: Record<string, unknown>,
): Record<string, unknown>[] {
  return [
    report.acquisitionLedger,
    report.acquisitionAttempts,
    report.attempts,
  ].flatMap((attempts) =>
    Array.isArray(attempts) ? attempts.filter(isRecord) : [],
  );
}

function collectGapReasons(artifact: ArtifactEnvelope | null): string[] {
  const body = isRecord(artifact?.body) ? artifact.body : {};
  const report = isRecord(body.evidenceGapReport) ? body.evidenceGapReport : {};
  const reasons: string[] = [];

  if (asString(report.reason)) reasons.push(asString(report.reason) as string);
  for (const attempt of getEvidenceGapAttempts(report)) {
    const reason =
      asString(attempt.toolGapReason) ??
      asString(attempt.gapReason) ??
      asString(attempt.rejectionReason) ??
      asString(attempt.reason);
    if (reason) reasons.push(reason);
  }

  return uniqueStrings(reasons);
}

function collectEvidenceGapAcquisitionModes(
  artifact: ArtifactEnvelope | null,
): string[] {
  const body = isRecord(artifact?.body) ? artifact.body : {};
  const report = isRecord(body.evidenceGapReport) ? body.evidenceGapReport : {};

  return uniqueStrings(
    getEvidenceGapAttempts(report).map(
      (attempt) =>
        asString(attempt.acquisitionMode) ??
        asString(attempt.mode) ??
        asString(attempt.type),
    ),
  );
}

function buildVocAudit(input: {
  artifact: ArtifactEnvelope | null;
  subjectDomain: string | null | undefined;
}): LiveQualityGateVocAudit {
  const painQuotes = getQuoteRecords(input.artifact, 'painLanguage');
  const successQuotes = getQuoteRecords(input.artifact, 'successLanguage');
  const painSourceUrls = uniqueStrings(
    painQuotes.map((quote) => asString(quote.sourceUrl)),
  );
  const painSourceDomains = uniqueStrings(
    painSourceUrls.map((sourceUrl) => getRegistrableDomain(sourceUrl)),
  );
  const subjectDomain = getRegistrableDomain(input.subjectDomain);
  const selfSourcedPainQuoteCount =
    subjectDomain === null
      ? 0
      : painSourceUrls.filter(
          (sourceUrl) => getRegistrableDomain(sourceUrl) === subjectDomain,
        ).length;

  return {
    painQuoteCount: painQuotes.length,
    successQuoteCount: successQuotes.length,
    painSourceDomains,
    painSourceUrls,
    acquisitionModes: uniqueStrings(
      [
        ...[...painQuotes, ...successQuotes].map((quote) =>
          asString(quote.acquisitionMode),
        ),
        ...collectEvidenceGapAcquisitionModes(input.artifact),
      ],
    ),
    gapReasons: collectGapReasons(input.artifact),
    subjectDomain,
    selfSourcedPainQuoteCount,
    passesQuoteFloor: painQuotes.length >= 10 && successQuotes.length >= 5,
    passesSourceDiversity: painSourceDomains.length >= 3,
    passesSourceUrlFloor: painSourceUrls.length >= 5,
    passesSubjectDomainExclusion: selfSourcedPainQuoteCount === 0,
  };
}

function getArtifactByZone(
  parsedSections: readonly ParsedSection[],
  zone: ReaderSectionId,
): ArtifactEnvelope | null {
  return parsedSections.find((section) => section.zone === zone)?.artifact ?? null;
}

function readNestedTier(
  root: Record<string, unknown> | null | undefined,
  key: string,
): VerificationTier | null {
  const value = isRecord(root?.[key]) ? root[key] : null;
  return isRecord(value) ? readVerificationTier(value.verificationTier) : null;
}

function buildProfileTrust(input: {
  profile: LiveQualityGateProfileSnapshot | null | undefined;
  sectionEvidence: readonly LiveQualityGateSectionEvidence[];
}): LiveQualityGateTrustCheck {
  if (!input.profile) {
    return {
      present: false,
      matched: false,
      checkedZones: [],
      failures: ['business profile snapshot is missing'],
    };
  }

  const failures: string[] = [];
  const checkedZones: ReaderSectionId[] = [];

  for (const zone of PROFILE_TRUST_SECTION_IDS) {
    const evidence = input.sectionEvidence.find((item) => item.zone === zone);
    if (!evidence?.verificationTier) continue;

    checkedZones.push(zone);
    const insightTier = readNestedTier(input.profile.aiInsights, zone);
    if (insightTier !== evidence.verificationTier) {
      failures.push(
        `profile ai_insights.${zone}.verificationTier=${insightTier ?? 'missing'} does not match committed ${evidence.verificationTier}`,
      );
    }
  }

  return {
    present: true,
    matched: failures.length === 0,
    checkedZones,
    failures,
  };
}

function buildShareTrust(input: {
  share: LiveQualityGateShareSnapshot | null | undefined;
  sectionEvidence: readonly LiveQualityGateSectionEvidence[];
}): LiveQualityGateTrustCheck {
  if (!input.share || !isV3ShareResearchSnapshot(input.share.researchSnapshot)) {
    return {
      present: false,
      matched: false,
      checkedZones: [],
      failures: ['v3 shared session snapshot is missing'],
    };
  }

  const snapshot = input.share.researchSnapshot as V3ShareResearchSnapshot;
  const shareSectionsByZone = new Map(
    snapshot.sections.map((section) => [section.zone, section]),
  );
  const failures: string[] = [];
  const checkedZones: ReaderSectionId[] = [];

  for (const evidence of input.sectionEvidence) {
    if (!evidence.verificationTier) continue;

    checkedZones.push(evidence.zone);
    const shareSection = shareSectionsByZone.get(evidence.zone);
    if (!shareSection) {
      failures.push(`share snapshot missing ${evidence.zone}`);
      continue;
    }

    if (shareSection.verificationTier !== evidence.verificationTier) {
      failures.push(
        `share ${evidence.zone}.verificationTier=${shareSection.verificationTier ?? 'missing'} does not match committed ${evidence.verificationTier}`,
      );
    }

    const shareFlagTier = shareSection.verificationFlag?.tier ?? null;
    const committedFlagTier = evidence.verificationFlag?.tier ?? null;
    if (committedFlagTier !== null && shareFlagTier !== committedFlagTier) {
      failures.push(
        `share ${evidence.zone}.verificationFlag.tier=${shareFlagTier ?? 'missing'} does not match committed ${committedFlagTier}`,
      );
    }
  }

  return {
    present: true,
    matched: failures.length === 0,
    checkedZones,
    failures,
  };
}

function hasCompleteCoreSections(
  sectionsByZone: Map<ReaderSectionId, LiveQualityGateSectionRow>,
): boolean {
  return POSITIONING_SECTION_IDS.every(
    (zone) => sectionsByZone.get(zone)?.status === 'complete',
  );
}

function collectPipelineFailures(input: {
  artifact: LiveQualityGateArtifactRow | null;
  sectionsByZone: Map<ReaderSectionId, LiveQualityGateSectionRow>;
}): string[] {
  const failures: string[] = [];

  if (!input.artifact) {
    failures.push('research_artifacts parent row is missing');
    return failures;
  }

  if (input.artifact.status !== 'complete') {
    failures.push(`parent artifact status is ${input.artifact.status ?? 'missing'}`);
  }
  if (input.artifact.childrenComplete < input.artifact.childrenTotal) {
    failures.push(
      `parent children_complete=${input.artifact.childrenComplete} is below children_total=${input.artifact.childrenTotal}`,
    );
  }

  for (const zone of POSITIONING_SECTION_IDS) {
    const section = input.sectionsByZone.get(zone);
    if (section?.status !== 'complete') {
      failures.push(
        `${zone} core section status is ${section?.status ?? 'missing'}`,
      );
    }
  }

  return failures;
}

function collectQualityFailures(input: {
  completion: readonly LiveQualityGateCompletionRow[];
  sectionEvidence: readonly LiveQualityGateSectionEvidence[];
  vocAudit: LiveQualityGateVocAudit;
  profileTrust: LiveQualityGateTrustCheck;
  shareTrust: LiveQualityGateTrustCheck;
}): string[] {
  const failures: string[] = [];

  for (const row of input.completion) {
    if (row.sectionStatus !== 'complete') {
      failures.push(`${row.zone} artifact row is ${row.sectionStatus ?? 'missing'}`);
    }
    if (row.sectionRunStatus !== 'complete') {
      failures.push(
        `${row.zone} section run is ${row.sectionRunStatus ?? 'missing'}`,
      );
    }
  }

  for (const evidence of input.sectionEvidence) {
    if (!evidence.schemaValid) {
      failures.push(
        `${evidence.zone} artifact failed schema/minimum validation: ${evidence.schemaErrors.join('; ')}`,
      );
    }
    if (evidence.verificationTier === 'insufficient') {
      failures.push(`${evidence.zone} verification_tier is insufficient`);
    }
    if (CORE_SECTION_SET.has(evidence.zone) && evidence.evidenceGap) {
      failures.push(`${evidence.zone} has body.evidenceGap=true`);
    }
  }

  if (!input.vocAudit.passesQuoteFloor) {
    failures.push(
      `VoC quote floor failed: pain=${input.vocAudit.painQuoteCount}, success=${input.vocAudit.successQuoteCount}`,
    );
  }
  if (!input.vocAudit.passesSourceDiversity) {
    failures.push(
      `VoC pain source-domain floor failed: domains=${input.vocAudit.painSourceDomains.length}`,
    );
  }
  if (!input.vocAudit.passesSourceUrlFloor) {
    failures.push(
      `VoC distinct source URL floor failed: urls=${input.vocAudit.painSourceUrls.length}`,
    );
  }
  if (!input.vocAudit.passesSubjectDomainExclusion) {
    failures.push(
      `VoC has ${input.vocAudit.selfSourcedPainQuoteCount} pain quote URLs from the audited company domain`,
    );
  }

  failures.push(...input.profileTrust.failures, ...input.shareTrust.failures);

  return failures;
}

function buildWarnings(
  sectionEvidence: readonly LiveQualityGateSectionEvidence[],
): string[] {
  return sectionEvidence.flatMap((evidence) => {
    const warnings: string[] = [];

    if (evidence.verificationTier === 'needs_review') {
      warnings.push(`${evidence.zone} verification_tier is needs_review`);
    }
    if (evidence.reviewTier === 'unavailable') {
      warnings.push(`${evidence.zone} review coverage unavailable`);
    }

    return warnings;
  });
}

function buildBlockedBy(input: {
  gates: LiveQualityGateGates;
  sectionEvidence: readonly LiveQualityGateSectionEvidence[];
}): string[] {
  const blockers: string[] = [];

  if (input.gates.pipeline.status !== 'recovered') {
    blockers.push('pipeline');
  }

  for (const evidence of input.sectionEvidence) {
    if (
      evidence.qualityStatus === 'failed' ||
      evidence.qualityStatus === 'insufficient' ||
      evidence.actionabilityStatus === 'not_verified'
    ) {
      blockers.push(evidence.zone);
    }
  }

  if (
    input.gates.projectionTrust.status === 'mismatch' ||
    input.gates.projectionTrust.status === 'missing'
  ) {
    blockers.push('projectionTrust');
  }

  return uniqueStrings(blockers);
}

function buildResearchQualityGate(input: {
  pipelineFailures: readonly string[];
  sectionEvidence: readonly LiveQualityGateSectionEvidence[];
  vocAudit: LiveQualityGateVocAudit;
}): LiveQualityGateReadout<LiveResearchQualityStatus> {
  let status: LiveResearchQualityStatus =
    input.pipelineFailures.length > 0 ? 'failed' : 'verified';
  const reasons: string[] = input.pipelineFailures.map(
    (failure) => `pipeline: ${failure}`,
  );

  for (const evidence of input.sectionEvidence) {
    status = strictestResearchQualityStatus(status, evidence.qualityStatus);
    if (evidence.qualityStatus === 'verified') continue;

    reasons.push(
      `${evidence.zone}: ${
        evidence.qualityReasons.length > 0
          ? evidence.qualityReasons.join('; ')
          : evidence.qualityStatus
      }`,
    );
  }

  const vocEvidence = input.sectionEvidence.find(
    (evidence) => evidence.zone === 'positioningVoiceOfCustomer',
  );
  const vocFloorFailures = [
    input.vocAudit.passesQuoteFloor
      ? null
      : `quote floor pain=${input.vocAudit.painQuoteCount}, success=${input.vocAudit.successQuoteCount}`,
    input.vocAudit.passesSourceDiversity
      ? null
      : `source-domain floor domains=${input.vocAudit.painSourceDomains.length}`,
    input.vocAudit.passesSourceUrlFloor
      ? null
      : `source URL floor urls=${input.vocAudit.painSourceUrls.length}`,
    input.vocAudit.passesSubjectDomainExclusion
      ? null
      : `self-sourced pain quote URLs=${input.vocAudit.selfSourcedPainQuoteCount}`,
  ].filter((reason): reason is string => reason !== null);

  if (vocFloorFailures.length > 0) {
    reasons.push(
      `positioningVoiceOfCustomer floors: ${vocFloorFailures.join('; ')}`,
    );
    if (vocEvidence?.qualityStatus !== 'research_grade_with_gaps') {
      status = strictestResearchQualityStatus(status, 'insufficient');
    }
  }

  return {
    status,
    reasons: uniqueStrings(reasons),
  };
}

function buildResearchQualitySummary(input: {
  researchQualityGate: LiveQualityGateReadout<LiveResearchQualityStatus>;
}): {
  researchQualityStatus: LiveResearchQualityStatus;
  researchQualityReasons: string[];
} {
  const status = input.researchQualityGate.status;
  const reasons = [...input.researchQualityGate.reasons];

  return {
    researchQualityStatus: status,
    researchQualityReasons: uniqueStrings(reasons),
  };
}

function buildActionabilityGate(
  sectionEvidence: readonly LiveQualityGateSectionEvidence[],
): LiveQualityGateReadout<LiveActionabilityStatus> {
  let status: LiveActionabilityStatus = 'verified';
  const reasons: string[] = [];

  for (const evidence of sectionEvidence) {
    status = strictestActionabilityStatus(status, evidence.actionabilityStatus);
    if (evidence.actionabilityStatus === 'verified') continue;

    reasons.push(
      `${evidence.zone}: ${
        evidence.actionabilityReasons.length > 0
          ? evidence.actionabilityReasons.join('; ')
          : evidence.actionabilityStatus
      }`,
    );
  }

  return {
    status,
    reasons: uniqueStrings(reasons),
  };
}

function buildProjectionTrustGate(input: {
  profileTrust: LiveQualityGateTrustCheck;
  shareTrust: LiveQualityGateTrustCheck;
}): LiveQualityGateReadout<LiveProjectionTrustStatus> {
  const missingReasons = [
    input.profileTrust.present ? null : 'business profile snapshot is missing',
    input.shareTrust.present ? null : 'v3 shared session snapshot is missing',
  ].filter((reason): reason is string => reason !== null);

  if (missingReasons.length > 0) {
    return {
      status: 'missing',
      reasons: uniqueStrings(missingReasons),
    };
  }

  const mismatchReasons = [
    ...input.profileTrust.failures,
    ...input.shareTrust.failures,
  ];
  if (mismatchReasons.length > 0) {
    return {
      status: 'mismatch',
      reasons: uniqueStrings(mismatchReasons),
    };
  }

  if (
    input.profileTrust.checkedZones.length === 0 &&
    input.shareTrust.checkedZones.length === 0
  ) {
    return {
      status: 'not_checked',
      reasons: ['no committed section tiers were available to compare'],
    };
  }

  return {
    status: 'verified',
    reasons: [],
  };
}

function buildLiveQualityGates(input: {
  pipelineRecovered: boolean;
  pipelineFailures: readonly string[];
  sectionEvidence: readonly LiveQualityGateSectionEvidence[];
  vocAudit: LiveQualityGateVocAudit;
  profileTrust: LiveQualityGateTrustCheck;
  shareTrust: LiveQualityGateTrustCheck;
}): LiveQualityGateGates {
  const projectionTrust = buildProjectionTrustGate({
    profileTrust: input.profileTrust,
    shareTrust: input.shareTrust,
  });

  return {
    pipeline: {
      status: input.pipelineRecovered ? 'recovered' : 'not_recovered',
      reasons:
        input.pipelineFailures.length > 0 ? [...input.pipelineFailures] : [],
    },
    researchQuality: buildResearchQualityGate({
      pipelineFailures: input.pipelineFailures,
      sectionEvidence: input.sectionEvidence,
      vocAudit: input.vocAudit,
    }),
    actionability: buildActionabilityGate(input.sectionEvidence),
    projectionTrust,
    // Back-compat alias for older reports/JSON readers. Projection trust is the
    // single computed signal; projectionSync must never be evaluated separately.
    projectionSync: projectionTrust,
  };
}

export function evaluateLiveQualityGate(
  input: LiveQualityGateInput,
): LiveQualityGateResult {
  const sectionsByZone = mapByZone(input.sections);
  const parsedSections = input.sections
    .map(parseSection)
    .filter((section): section is ParsedSection => section !== null);
  const completion = buildCompletionRows(sectionsByZone, input.sectionRuns);
  const sectionEvidence = buildSectionEvidence(parsedSections);
  const vocArtifact = getArtifactByZone(
    parsedSections,
    'positioningVoiceOfCustomer',
  );
  const vocAudit = buildVocAudit({
    artifact: vocArtifact,
    subjectDomain: input.subjectDomain,
  });
  const profileTrust = buildProfileTrust({
    profile: input.profile,
    sectionEvidence,
  });
  const shareTrust = buildShareTrust({
    share: input.share,
    sectionEvidence,
  });
  const pipelineFailures = collectPipelineFailures({
    artifact: input.artifact,
    sectionsByZone,
  });
  const qualityFailures = collectQualityFailures({
    completion,
    sectionEvidence,
    vocAudit,
    profileTrust,
    shareTrust,
  });
  const warnings = buildWarnings(sectionEvidence);
  const failures = [...pipelineFailures, ...qualityFailures];
  const pipelineRecovered =
    pipelineFailures.length === 0 &&
    input.artifact !== null &&
    hasCompleteCoreSections(sectionsByZone);
  const gates = buildLiveQualityGates({
    pipelineRecovered,
    pipelineFailures,
    sectionEvidence,
    vocAudit,
    profileTrust,
    shareTrust,
  });
  const researchQuality = buildResearchQualitySummary({
    researchQualityGate: gates.researchQuality,
  });
  const blockedBy = buildBlockedBy({
    gates,
    sectionEvidence,
  });
  const verdict: LiveQualityGateVerdict = !pipelineRecovered
    ? 'pipeline_not_recovered'
    : qualityFailures.length > 0
      ? 'pipeline_recovered_quality_limited'
      : 'nine_of_ten_research_achieved';

  return {
    runId: input.runId,
    verdict,
    ...researchQuality,
    gates,
    blockedBy,
    failures,
    warnings,
    completion,
    sectionEvidence,
    vocAudit,
    profileTrust,
    shareTrust,
  };
}

function formatReasons(reasons: readonly string[]): string {
  return reasons.length === 0 ? 'none' : reasons.join('; ');
}

function formatGateLine(
  label: string,
  gate: LiveQualityGateReadout<string>,
): string {
  return `- ${label}: ${gate.status} (${formatReasons(gate.reasons)})`;
}

export function renderLiveQualityGateReportMarkdown(
  result: LiveQualityGateResult,
): string {
  return [
    '# Research Quality Gate Report',
    '',
    `Run id: \`${result.runId}\``,
    `Gate version: \`${LIVE_QUALITY_GATE_VERSION}\``,
    '',
    '## Final verdict',
    `Legacy verdict: \`${result.verdict}\``,
    `Blocked by: ${formatReasons(result.blockedBy)}`,
    '',
    '## Gate readout',
    formatGateLine('Pipeline', result.gates.pipeline),
    formatGateLine('Research quality', result.gates.researchQuality),
    formatGateLine('Actionability', result.gates.actionability),
    formatGateLine('Projection trust', result.gates.projectionTrust),
    '',
    '## Failures',
    result.failures.length === 0
      ? 'none'
      : result.failures.map((failure) => `- ${failure}`).join('\n'),
    '',
    '## Warnings',
    result.warnings.length === 0
      ? 'none'
      : result.warnings.map((warning) => `- ${warning}`).join('\n'),
    '',
  ].join('\n');
}
