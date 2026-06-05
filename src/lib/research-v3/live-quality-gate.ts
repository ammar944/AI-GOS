import {
  CROSS_SECTION_REASONING_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
} from '@/lib/ai/prompts/positioning-skills';
import {
  READER_SECTION_IDS,
  type ReaderSectionId,
} from '@/components/research-v3/reader-sections';
import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import type { CrossSectionReasoningArtifact } from '@/lib/lab-engine/artifacts/schemas/cross-section-reasoning';
import type { PaidMediaPlanArtifact } from '@/lib/lab-engine/artifacts/schemas/paid-media-plan';
import type { PositioningSynthesisArtifact } from '@/lib/lab-engine/artifacts/schemas/positioning-synthesis';
import {
  scoreStrategicRubricArtifacts,
  type StrategicRubricScore,
} from '@/lib/lab-engine/artifacts/strategic-rubric';
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
  type VerificationFlag,
  type VerificationTier,
} from '@/lib/research-v2/verification-tier';

export type LiveQualityGateVerdict =
  | 'pipeline_not_recovered'
  | 'pipeline_recovered_quality_limited'
  | 'below_9_of_10_gate'
  | 'nine_of_ten_research_achieved';

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
  reviewTier: VerificationTier | null;
  evidenceGap: boolean;
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
  failures: string[];
  warnings: string[];
  completion: LiveQualityGateCompletionRow[];
  sectionEvidence: LiveQualityGateSectionEvidence[];
  vocAudit: LiveQualityGateVocAudit;
  rubricScore: StrategicRubricScore;
  profileTrust: LiveQualityGateTrustCheck;
  shareTrust: LiveQualityGateTrustCheck;
}

interface ParsedSection {
  row: LiveQualityGateSectionRow;
  zone: ReaderSectionId;
  artifact: ArtifactEnvelope | null;
  schemaErrors: string[];
}

const PROFILE_TRUST_SECTION_IDS = [
  ...POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
] as const satisfies readonly ReaderSectionId[];

const CORE_SECTION_SET: ReadonlySet<string> = new Set(POSITIONING_SECTION_IDS);

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

function buildSectionEvidence(
  parsedSections: readonly ParsedSection[],
): LiveQualityGateSectionEvidence[] {
  const parsedByZone = new Map(parsedSections.map((section) => [section.zone, section]));

  return READER_SECTION_IDS.map((zone) => {
    const parsed = parsedByZone.get(zone) ?? null;
    const artifact = parsed?.artifact ?? null;
    const counts = countVerificationClaims(artifact);

    return {
      zone,
      artifactPresent: artifact !== null,
      schemaValid: parsed !== null && parsed.schemaErrors.length === 0,
      schemaErrors: parsed?.schemaErrors ?? ['missing section artifact row'],
      verificationTier: readVerificationTier(parsed?.row.verificationTier),
      verificationFlag: readVerificationFlag(parsed?.row.verificationFlag),
      reviewTier: readVerificationTier(artifact?.review?.tier),
      evidenceGap:
        isRecord(artifact?.body) && artifact.body.evidenceGap === true,
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

function collectGapReasons(artifact: ArtifactEnvelope | null): string[] {
  const body = isRecord(artifact?.body) ? artifact.body : {};
  const report = isRecord(body.evidenceGapReport) ? body.evidenceGapReport : {};
  const reasons: string[] = [];

  if (asString(report.reason)) reasons.push(asString(report.reason) as string);
  if (Array.isArray(report.attempts)) {
    for (const attempt of report.attempts) {
      if (isRecord(attempt)) {
        const reason = asString(attempt.gapReason) ?? asString(attempt.reason);
        if (reason) reasons.push(reason);
      }
    }
  }

  return uniqueStrings(reasons);
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
      [...painQuotes, ...successQuotes].map((quote) =>
        asString(quote.acquisitionMode),
      ),
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

function buildRubricScore(
  parsedSections: readonly ParsedSection[],
): StrategicRubricScore {
  const crossSectionReasoning = getArtifactByZone(
    parsedSections,
    CROSS_SECTION_REASONING_SECTION_ID,
  ) as CrossSectionReasoningArtifact | null;
  const positioningSynthesis = getArtifactByZone(
    parsedSections,
    POSITIONING_SYNTHESIS_SECTION_ID,
  ) as PositioningSynthesisArtifact | null;
  const positioningPaidMediaPlan = getArtifactByZone(
    parsedSections,
    PAID_MEDIA_PLAN_SECTION_ID,
  ) as PaidMediaPlanArtifact | null;

  return scoreStrategicRubricArtifacts({
    crossSectionReasoning,
    positioningSynthesis,
    positioningPaidMediaPlan,
  });
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

    if (zone === POSITIONING_SYNTHESIS_SECTION_ID) {
      const strategyTier = readVerificationTier(
        input.profile.positioningStrategy?.verificationTier,
      );
      if (strategyTier !== evidence.verificationTier) {
        failures.push(
          `profile positioning_strategy.verificationTier=${strategyTier ?? 'missing'} does not match committed ${evidence.verificationTier}`,
        );
      }
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
  return sectionEvidence
    .filter((evidence) => evidence.verificationTier === 'needs_review')
    .map((evidence) => `${evidence.zone} verification_tier is needs_review`);
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
  const rubricScore = buildRubricScore(parsedSections);
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
  const verdict: LiveQualityGateVerdict = !pipelineRecovered
    ? 'pipeline_not_recovered'
    : qualityFailures.length > 0
      ? 'pipeline_recovered_quality_limited'
      : rubricScore.score < 9
        ? 'below_9_of_10_gate'
        : 'nine_of_ten_research_achieved';

  return {
    runId: input.runId,
    verdict,
    failures,
    warnings,
    completion,
    sectionEvidence,
    vocAudit,
    rubricScore,
    profileTrust,
    shareTrust,
  };
}
