#!/usr/bin/env tsx
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnvConfig } from '@next/env';

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from '../src/lib/lab-engine/artifacts/artifact-envelope';
import {
  isHttpUrl,
  isLikelyNamedBuyerIdentity,
} from '../src/lib/lab-engine/artifacts/schemas/buyer-icp';
import { createAdminClient } from '../src/lib/supabase/server';
import {
  LIVE_QUALITY_GATE_VERSION,
  evaluateLiveQualityGate,
  type LiveActionabilityStatus,
  type LiveQualityGateArtifactRow,
  type LiveQualityGateGates,
  type LiveQualityGateInput,
  type LiveQualityGateJourneySessionSnapshot,
  type LiveQualityGateProfileSnapshot,
  type LiveQualityGateReadout,
  type LiveQualityGateResult,
  type LiveQualityGateSectionRow,
  type LiveQualityGateSectionRunRow,
  type LiveQualityGateShareSnapshot,
  type LivePipelineGateStatus,
  type LiveProjectionTrustStatus,
  type LiveResearchQualityStatus,
  type LiveStrategyQualityStatus,
} from '../src/lib/research-v3/live-quality-gate';

loadEnvConfig(process.cwd());

export const RESEARCH_QUALITY_GATE_VERSION = LIVE_QUALITY_GATE_VERSION;

export type PipelineGateStatus = LivePipelineGateStatus;
export type ActionabilityGateStatus = LiveActionabilityStatus;
export type ProjectionTrustGateStatus = LiveProjectionTrustStatus;
export type StrategyQualityGateStatus = LiveStrategyQualityStatus;
export type ResearchQualityGate<TStatus extends string> =
  LiveQualityGateReadout<TStatus>;
export type ResearchQualityGates = LiveQualityGateGates;

export interface ResearchQualityGateSectionRuleRow {
  zone: string;
  researchQuality: LiveResearchQualityStatus;
  actionability: ActionabilityGateStatus;
  verificationTier: string;
  reviewTier: string;
  evidenceGap: boolean;
  rule: string;
  reasons: string[];
}

export interface BuyerIcpDiagnostics {
  artifactPresent: boolean;
  personaCount: number;
  namedPersonaCount: number;
  rejectedPersonaLabels: string[];
  gapReason: string | null;
  hasSpecificNamedPersonaGap: boolean;
  actionability: ActionabilityGateStatus;
  reasons: string[];
}

export interface ResearchQualityGateReportResult extends LiveQualityGateResult {
  artifactId: string | null;
  gateVersion: string;
  gates: ResearchQualityGates;
  sectionRules: ResearchQualityGateSectionRuleRow[];
  buyerIcpDiagnostics: BuyerIcpDiagnostics;
}

export interface ReportOptions {
  runId: string;
  out: string | null;
  jsonOut: string | null;
}

interface ResearchArtifactDbRow {
  id: string;
  run_id: string;
  user_id: string | null;
  status: string | null;
  children_complete: number | null;
  children_total: number | null;
  profile_persisted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ResearchArtifactSectionDbRow {
  id: string;
  zone: string | null;
  section_run_id: string | null;
  status: string | null;
  title: string | null;
  data: unknown;
  verification_tier: unknown;
  verification_flag: unknown;
  counts_toward_rollup: boolean | null;
  updated_at: string | null;
}

interface ResearchSectionRunDbRow {
  id: string;
  zone: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  aborted_at: string | null;
  error: unknown;
  telemetry: unknown;
}

interface JourneySessionDbRow {
  id: string;
  profile_id: string | null;
  metadata: Record<string, unknown> | null;
  onboarding_data: Record<string, unknown> | null;
  updated_at: string | null;
}

interface BusinessProfileDbRow {
  id: string;
  ai_insights: Record<string, unknown> | null;
  positioning_strategy: Record<string, unknown> | null;
  offer_score: Record<string, unknown> | null;
  updated_at: string | null;
}

interface SharedSessionDbRow {
  share_token: string | null;
  research_snapshot: unknown;
  created_at: string | null;
}

export interface DbSnapshot {
  artifact: LiveQualityGateArtifactRow | null;
  sections: LiveQualityGateSectionRow[];
  sectionRuns: LiveQualityGateSectionRunRow[];
  journeySession: LiveQualityGateJourneySessionSnapshot | null;
  profile: LiveQualityGateProfileSnapshot | null;
  share: LiveQualityGateShareSnapshot | null;
  subjectDomain: string | null;
}

function readStringFlag(
  args: string[],
  name: string,
  fallback: string | null,
): string {
  const index = args.indexOf(name);
  if (index === -1) {
    if (fallback !== null) return fallback;
    throw new Error(`${name} is required`);
  }

  const value = args[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function readOptionalStringFlag(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) return null;

  const value = args[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

export function parseOptions(args: string[]): ReportOptions {
  return {
    runId: readStringFlag(args, '--run-id', null),
    out: readOptionalStringFlag(args, '--out'),
    jsonOut: readOptionalStringFlag(args, '--json-out'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(readString)
    .filter((item): item is string => item !== null);
}

function normalizeArtifact(
  row: ResearchArtifactDbRow | null,
): LiveQualityGateArtifactRow | null {
  if (!row) return null;

  return {
    id: row.id,
    runId: row.run_id,
    status: row.status,
    childrenComplete: row.children_complete ?? 0,
    childrenTotal: row.children_total ?? 6,
    profilePersistedAt: row.profile_persisted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeSection(
  row: ResearchArtifactSectionDbRow,
): LiveQualityGateSectionRow {
  return {
    id: row.id,
    zone: row.zone,
    sectionRunId: row.section_run_id,
    status: row.status,
    title: row.title,
    data: row.data,
    verificationTier: row.verification_tier,
    verificationFlag: row.verification_flag,
    countsTowardRollup: row.counts_toward_rollup,
    updatedAt: row.updated_at,
  };
}

function normalizeSectionRun(
  row: ResearchSectionRunDbRow,
): LiveQualityGateSectionRunRow {
  return {
    id: row.id,
    zone: row.zone,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    abortedAt: row.aborted_at,
    error: row.error,
    telemetry: row.telemetry,
  };
}

function normalizeJourneySession(
  row: JourneySessionDbRow | null,
): LiveQualityGateJourneySessionSnapshot | null {
  if (!row) return null;

  return {
    id: row.id,
    profileId: row.profile_id,
    metadata: row.metadata,
    onboardingData: row.onboarding_data,
    updatedAt: row.updated_at,
  };
}

function normalizeProfile(
  row: BusinessProfileDbRow | null,
): LiveQualityGateProfileSnapshot | null {
  if (!row) return null;

  return {
    id: row.id,
    aiInsights: row.ai_insights,
    positioningStrategy: row.positioning_strategy,
    offerScore: row.offer_score,
    updatedAt: row.updated_at,
  };
}

function normalizeShare(
  row: SharedSessionDbRow | null,
): LiveQualityGateShareSnapshot | null {
  if (!row) return null;

  return {
    shareToken: row.share_token,
    researchSnapshot: row.research_snapshot,
    createdAt: row.created_at,
  };
}

function getSubjectDomain(
  session: LiveQualityGateJourneySessionSnapshot | null,
): string | null {
  if (!session) return null;
  const metadata = isRecord(session.metadata) ? session.metadata : {};
  const onboarding = isRecord(session.onboardingData) ? session.onboardingData : {};

  return (
    readString(onboarding.websiteUrl) ??
    readString(metadata.websiteUrl) ??
    readString(metadata.companyUrl) ??
    null
  );
}

export async function readDbSnapshot(runId: string): Promise<DbSnapshot> {
  const supabase = createAdminClient();
  const { data: artifactData, error: artifactError } = await supabase
    .from('research_artifacts')
    .select(
      'id, run_id, user_id, status, children_complete, children_total, profile_persisted_at, created_at, updated_at',
    )
    .eq('run_id', runId)
    .maybeSingle();

  if (artifactError) {
    throw new Error(
      `research_artifacts read failed for runId=${runId}: ${artifactError.message}`,
    );
  }

  const artifactRow = (artifactData as ResearchArtifactDbRow | null) ?? null;
  const artifact = normalizeArtifact(artifactRow);
  if (!artifact || !artifactRow?.user_id) {
    return {
      artifact,
      sections: [],
      sectionRuns: [],
      journeySession: null,
      profile: null,
      share: null,
      subjectDomain: null,
    };
  }

  const [sectionsResponse, runsResponse, sessionResponse] = await Promise.all([
    supabase
      .from('research_artifact_sections')
      .select(
        'id, zone, section_run_id, status, title, data, verification_tier, verification_flag, counts_toward_rollup, updated_at',
      )
      .eq('artifact_id', artifact.id),
    supabase
      .from('research_section_runs')
      .select('id, zone, status, started_at, completed_at, aborted_at, error, telemetry')
      .eq('artifact_id', artifact.id),
    supabase
      .from('journey_sessions')
      .select('id, profile_id, metadata, onboarding_data, updated_at')
      .eq('run_id', runId)
      .eq('user_id', artifactRow.user_id)
      .maybeSingle(),
  ]);

  if (sectionsResponse.error) {
    throw new Error(
      `research_artifact_sections read failed for runId=${runId} artifactId=${artifact.id}: ${sectionsResponse.error.message}`,
    );
  }
  if (runsResponse.error) {
    throw new Error(
      `research_section_runs read failed for runId=${runId} artifactId=${artifact.id}: ${runsResponse.error.message}`,
    );
  }
  if (sessionResponse.error) {
    throw new Error(
      `journey_sessions read failed for runId=${runId}: ${sessionResponse.error.message}`,
    );
  }

  const session = normalizeJourneySession(
    (sessionResponse.data as JourneySessionDbRow | null) ?? null,
  );
  const [profileResponse, shareResponse] = await Promise.all([
    session?.profileId
      ? supabase
          .from('business_profiles')
          .select('id, ai_insights, positioning_strategy, offer_score, updated_at')
          .eq('id', session.profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    session
      ? supabase
          .from('shared_sessions')
          .select('share_token, research_snapshot, created_at')
          .eq('session_id', session.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (profileResponse.error) {
    throw new Error(
      `business_profiles read failed for runId=${runId} profileId=${session?.profileId ?? 'missing'}: ${profileResponse.error.message}`,
    );
  }
  if (shareResponse.error) {
    throw new Error(
      `shared_sessions read failed for runId=${runId} sessionId=${session?.id ?? 'missing'}: ${shareResponse.error.message}`,
    );
  }

  return {
    artifact,
    sections: ((sectionsResponse.data as ResearchArtifactSectionDbRow[] | null) ?? [])
      .map(normalizeSection),
    sectionRuns: ((runsResponse.data as ResearchSectionRunDbRow[] | null) ?? [])
      .map(normalizeSectionRun),
    journeySession: session,
    profile: normalizeProfile(
      (profileResponse.data as BusinessProfileDbRow | null) ?? null,
    ),
    share: normalizeShare(
      (shareResponse.data as SharedSessionDbRow | null) ?? null,
    ),
    subjectDomain: getSubjectDomain(session),
  };
}

function markdownTable(headers: readonly string[], rows: readonly string[][]): string {
  const normalizeCell = (value: string): string =>
    value.replace(/\|/g, '\\|').replace(/\n/g, '<br>');

  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(normalizeCell).join(' | ')} |`),
  ].join('\n');
}

function boolText(value: boolean): string {
  return value ? 'yes' : 'no';
}

function listOrNone(values: readonly string[]): string {
  return values.length > 0 ? values.join('; ') : 'none';
}

function sectionQualitySeverity(
  first: LiveResearchQualityStatus,
  second: LiveResearchQualityStatus,
): LiveResearchQualityStatus {
  const severity: Record<LiveResearchQualityStatus, number> = {
    verified: 0,
    research_grade_with_gaps: 1,
    insufficient: 2,
    failed: 3,
  };

  return severity[first] >= severity[second] ? first : second;
}

function sectionActionability(
  status: LiveResearchQualityStatus,
): ActionabilityGateStatus {
  if (status === 'verified') return 'verified';
  if (status === 'research_grade_with_gaps') return 'usable_with_caveats';
  return 'not_verified';
}

function gateReasonsOrPass(
  reasons: readonly string[],
  passReason: string,
): string[] {
  return reasons.length > 0 ? [...reasons] : [passReason];
}

function parseArtifactFromSection(
  section: LiveQualityGateSectionRow | null,
): ArtifactEnvelope | null {
  if (!section) return null;

  const parsed = artifactEnvelopeSchema.safeParse(section.data);
  return parsed.success ? parsed.data : null;
}

function findSection(
  input: LiveQualityGateInput,
  zone: string,
): LiveQualityGateSectionRow | null {
  return input.sections.find((section) => section.zone === zone) ?? null;
}

function buildBuyerIcpDiagnostics(input: LiveQualityGateInput): BuyerIcpDiagnostics {
  const section = findSection(input, 'positioningBuyerICP');
  const artifact = parseArtifactFromSection(section);
  const body = isRecord(artifact?.body) ? artifact.body : {};
  const personaReality = isRecord(body.personaReality)
    ? body.personaReality
    : {};
  const personas = Array.isArray(personaReality.personas)
    ? personaReality.personas.filter(isRecord)
    : [];
  const namedPersonas = personas.filter((persona) => {
    const name = readString(persona.name);
    if (!name) return false;
    const sourceUrl = readString(persona.sourceUrl);
    if (!sourceUrl || !isHttpUrl(sourceUrl)) return false;

    return isLikelyNamedBuyerIdentity(name, {
      company: readString(persona.company) ?? undefined,
      role: readString(persona.role) ?? undefined,
      seniority: readString(persona.seniority) ?? undefined,
      title: readString(persona.title) ?? undefined,
    });
  });
  const evidenceGapReport = isRecord(body.evidenceGapReport)
    ? body.evidenceGapReport
    : {};
  const gapReason = readString(evidenceGapReport.reason);
  const hasSpecificNamedPersonaGap =
    body.evidenceGap === true &&
    gapReason === 'insufficient_named_buyer_personas' &&
    readString(evidenceGapReport.summary) !== null;
  const reportedFoundCount = readNumber(evidenceGapReport.foundNamedPersonaCount);
  const namedPersonaCount = namedPersonas.length;
  const rejectedPersonaLabels = readStringArray(
    evidenceGapReport.rejectedPersonaLabels,
  );
  const reasons: string[] = [];

  if (!artifact) {
    reasons.push('BuyerICP artifact is missing or invalid');
  }
  if (namedPersonaCount < 2) {
    reasons.push(
      `fewer than two real named buyer identities found (${namedPersonaCount})`,
    );
  }
  if (namedPersonaCount >= 2 && namedPersonaCount < 5) {
    reasons.push(
      `named buyer identities below verified floor (${namedPersonaCount}/5)`,
    );
  }
  if (hasSpecificNamedPersonaGap) {
    reasons.push('specific insufficient_named_buyer_personas gap is reported');
  }
  if (reportedFoundCount !== null && reportedFoundCount !== namedPersonaCount) {
    reasons.push(
      `reported named buyer count ${reportedFoundCount} differs from validated count ${namedPersonaCount}`,
    );
  }
  if (rejectedPersonaLabels.length > 0) {
    reasons.push(`rejected generic labels: ${rejectedPersonaLabels.join(', ')}`);
  }

  const actionability: ActionabilityGateStatus =
    namedPersonaCount < 2
      ? 'not_verified'
      : namedPersonaCount < 5
        ? hasSpecificNamedPersonaGap
          ? 'usable_with_caveats'
          : 'not_verified'
        : 'verified';

  return {
    artifactPresent: artifact !== null,
    personaCount: personas.length,
    namedPersonaCount,
    rejectedPersonaLabels,
    gapReason,
    hasSpecificNamedPersonaGap,
    actionability,
    reasons: gateReasonsOrPass(reasons, 'BuyerICP named-identity diagnostics passed'),
  };
}

function buildSectionRules(input: {
  result: LiveQualityGateResult;
  buyerIcpDiagnostics: BuyerIcpDiagnostics;
}): ResearchQualityGateSectionRuleRow[] {
  return input.result.sectionEvidence.map((evidence) => {
    let researchQuality = evidence.qualityStatus;
    let actionability = evidence.actionabilityStatus;
    const reasons = [
      ...evidence.qualityReasons,
      ...evidence.actionabilityReasons,
    ];
    let rule = 'general evidence and schema rule';

    if (evidence.zone === 'positioningVoiceOfCustomer') {
      const totalQuotes =
        input.result.vocAudit.painQuoteCount +
        input.result.vocAudit.successQuoteCount;
      rule = 'VoC buyer-language quote, diversity, source URL, and self-domain rule';

      if (totalQuotes === 0) {
        researchQuality = 'insufficient';
        actionability = 'not_verified';
        reasons.push('zero real buyer-language quotes');
      } else if (
        !input.result.vocAudit.passesQuoteFloor ||
        !input.result.vocAudit.passesSourceDiversity ||
        !input.result.vocAudit.passesSourceUrlFloor ||
        !input.result.vocAudit.passesSubjectDomainExclusion
      ) {
        researchQuality = sectionQualitySeverity(
          researchQuality,
          evidence.evidenceGap ? 'research_grade_with_gaps' : 'insufficient',
        );
        actionability = sectionActionability(researchQuality);
        reasons.push('VoC evidence floors did not all pass');
      }
    }

    if (evidence.zone === 'positioningBuyerICP') {
      rule = 'BuyerICP named-identity floor and specific gap rule';

      if (input.buyerIcpDiagnostics.namedPersonaCount < 2) {
        researchQuality = 'insufficient';
        actionability = 'not_verified';
      } else if (input.buyerIcpDiagnostics.actionability === 'usable_with_caveats') {
        researchQuality = sectionQualitySeverity(
          researchQuality,
          'research_grade_with_gaps',
        );
        actionability = 'usable_with_caveats';
      }

      reasons.push(...input.buyerIcpDiagnostics.reasons);
    }

    if (!evidence.schemaValid) {
      researchQuality = 'failed';
      actionability = 'not_verified';
    }

    return {
      zone: evidence.zone,
      researchQuality,
      actionability,
      verificationTier: evidence.verificationTier ?? 'missing',
      reviewTier: evidence.reviewTier ?? 'missing',
      evidenceGap: evidence.evidenceGap,
      rule,
      reasons: gateReasonsOrPass(
        [...new Set(reasons)],
        'section satisfies the current deterministic rule',
      ),
    };
  });
}

export function buildReportResult(input: {
  gateInput: LiveQualityGateInput;
  result: LiveQualityGateResult;
}): ResearchQualityGateReportResult {
  const buyerIcpDiagnostics = buildBuyerIcpDiagnostics(input.gateInput);
  const sectionRules = buildSectionRules({
    result: input.result,
    buyerIcpDiagnostics,
  });

  return {
    ...input.result,
    artifactId: input.gateInput.artifact?.id ?? null,
    gateVersion: RESEARCH_QUALITY_GATE_VERSION,
    gates: input.result.gates,
    sectionRules,
    buyerIcpDiagnostics,
  };
}

export function buildGateInput(input: {
  runId: string;
  snapshot: DbSnapshot;
}): LiveQualityGateInput {
  return {
    runId: input.runId,
    artifact: input.snapshot.artifact,
    sections: input.snapshot.sections,
    sectionRuns: input.snapshot.sectionRuns,
    journeySession: input.snapshot.journeySession,
    profile: input.snapshot.profile,
    share: input.snapshot.share,
    subjectDomain: input.snapshot.subjectDomain,
  };
}

export function evaluateGateInput(
  gateInput: LiveQualityGateInput,
): ResearchQualityGateReportResult {
  return buildReportResult({
    gateInput,
    result: evaluateLiveQualityGate(gateInput),
  });
}

export async function evaluateRunQualityGate(
  runId: string,
): Promise<ResearchQualityGateReportResult> {
  const snapshot = await readDbSnapshot(runId);
  return evaluateGateInput(buildGateInput({ runId, snapshot }));
}

export function renderReport(result: ResearchQualityGateReportResult): string {
  const completionRows = result.completion.map((row) => [
    row.zone,
    row.sectionRunStatus ?? 'missing',
    row.sectionStatus ?? 'missing',
    row.countsTowardRollup === null ? 'unknown' : boolText(row.countsTowardRollup),
    row.updatedAt ?? 'missing',
  ]);
  const gateRows = [
    [
      'Pipeline',
      result.gates.pipeline.status,
      listOrNone(result.gates.pipeline.reasons),
    ],
    [
      'Research quality',
      result.gates.researchQuality.status,
      listOrNone(result.gates.researchQuality.reasons),
    ],
    [
      'Actionability',
      result.gates.actionability.status,
      listOrNone(result.gates.actionability.reasons),
    ],
    [
      'Projection trust',
      result.gates.projectionTrust.status,
      listOrNone(result.gates.projectionTrust.reasons),
    ],
    [
      'Strategy quality',
      result.gates.strategyQuality.status,
      listOrNone(result.gates.strategyQuality.reasons),
    ],
  ];
  const sectionRuleRows = result.sectionRules.map((row) => [
    row.zone,
    row.researchQuality,
    row.actionability,
    row.verificationTier ?? 'missing',
    row.reviewTier ?? 'missing',
    boolText(row.evidenceGap),
    row.rule,
    listOrNone(row.reasons),
  ]);
  const rubricRows = result.rubricScore.propertyResults.map((property) => [
    property.label,
    boolText(property.passed),
    property.evidencePointers.join(', ') || 'none',
  ]);

  return [
    `# Research Quality Gate Report`,
    '',
    `Run id: \`${result.runId}\``,
    `Gate version: \`${result.gateVersion}\``,
    '',
    '## Final verdict',
    `Legacy verdict: \`${result.verdict}\``,
    `Blocked by: ${listOrNone(result.blockedBy)}`,
    `Research quality gate: \`${result.gates.researchQuality.status}\``,
    `Actionability gate: \`${result.gates.actionability.status}\``,
    `Projection trust gate: \`${result.gates.projectionTrust.status}\``,
    `Strategy quality gate: \`${result.gates.strategyQuality.status}\``,
    '',
    '## Gate readout',
    markdownTable(['Gate', 'Status', 'Reasons'], gateRows),
    '',
    'Completion detail:',
    '',
    markdownTable(
      ['Zone', 'Section run', 'Artifact row', 'Counts toward rollup', 'Updated at'],
      completionRows,
    ),
    '',
    '## Research quality reasons',
    result.gates.researchQuality.reasons.length > 0
      ? result.gates.researchQuality.reasons
          .map((reason) => `- ${reason}`)
          .join('\n')
      : 'none',
    '',
    '## Actionability',
    `Status: \`${result.gates.actionability.status}\``,
    result.gates.actionability.reasons.length > 0
      ? result.gates.actionability.reasons.map((reason) => `- ${reason}`).join('\n')
      : 'none',
    '',
    '## Projection trust',
    `Status: \`${result.gates.projectionTrust.status}\``,
    `Profile present: ${boolText(result.profileTrust.present)}`,
    `Profile trust match: ${boolText(result.profileTrust.matched)}`,
    `Profile failures: ${listOrNone(result.profileTrust.failures)}`,
    `Share present: ${boolText(result.shareTrust.present)}`,
    `Share trust match: ${boolText(result.shareTrust.matched)}`,
    `Share failures: ${listOrNone(result.shareTrust.failures)}`,
    '',
    '## Strategy quality',
    `Status: \`${result.gates.strategyQuality.status}\``,
    `Score: ${result.rubricScore.score}/10`,
    `Gate: ${result.rubricScore.gate}`,
    `Active disqualifiers: ${listOrNone(
      result.rubricScore.activeDisqualifiers.map((item) => item.label),
    )}`,
    '',
    markdownTable(['Property', 'Passed', 'Evidence pointers'], rubricRows),
    '',
    '## Section rules table',
    markdownTable(
      [
        'Zone',
        'Research quality',
        'Actionability',
        'Persisted tier',
        'Review tier',
        'Evidence gap',
        'Rule',
        'Reasons',
      ],
      sectionRuleRows,
    ),
    '',
    '## Voice of Customer diagnostics',
    `Pain quotes: ${result.vocAudit.painQuoteCount}`,
    `Success quotes: ${result.vocAudit.successQuoteCount}`,
    `Pain domains: ${listOrNone(result.vocAudit.painSourceDomains)}`,
    `Pain URLs: ${result.vocAudit.painSourceUrls.length}`,
    `Acquisition modes: ${listOrNone(result.vocAudit.acquisitionModes)}`,
    `Gap reasons: ${listOrNone(result.vocAudit.gapReasons)}`,
    `Self-sourced pain quote URLs: ${result.vocAudit.selfSourcedPainQuoteCount}`,
    '',
    '## BuyerICP diagnostics',
    `Artifact present: ${boolText(result.buyerIcpDiagnostics.artifactPresent)}`,
    `Persona rows: ${result.buyerIcpDiagnostics.personaCount}`,
    `Named buyer identities: ${result.buyerIcpDiagnostics.namedPersonaCount}`,
    `Specific gap: ${boolText(result.buyerIcpDiagnostics.hasSpecificNamedPersonaGap)}`,
    `Gap reason: ${result.buyerIcpDiagnostics.gapReason ?? 'none'}`,
    `Actionability: ${result.buyerIcpDiagnostics.actionability}`,
    `Rejected labels: ${listOrNone(result.buyerIcpDiagnostics.rejectedPersonaLabels)}`,
    `Diagnostic reasons: ${listOrNone(result.buyerIcpDiagnostics.reasons)}`,
    '',
    '## Failures',
    result.failures.length > 0
      ? result.failures.map((failure) => `- ${failure}`).join('\n')
      : 'none',
    '',
    '## Warnings',
    result.warnings.length > 0
      ? result.warnings.map((warning) => `- ${warning}`).join('\n')
      : 'none',
    '',
  ].join('\n');
}

async function writeOutput(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const snapshot = await readDbSnapshot(options.runId);
  const gateInput = buildGateInput({
    runId: options.runId,
    snapshot,
  });
  const result = evaluateGateInput(gateInput);
  const markdown = renderReport(result);

  if (options.out) {
    await writeOutput(options.out, markdown);
  } else {
    console.log(markdown);
  }

  if (options.jsonOut) {
    await writeOutput(options.jsonOut, `${JSON.stringify(result, null, 2)}\n`);
  }

  console.log(
    JSON.stringify({
      runId: options.runId,
      verdict: result.verdict,
      researchQualityStatus: result.researchQualityStatus,
      gates: {
        pipeline: result.gates.pipeline.status,
        researchQuality: result.gates.researchQuality.status,
        actionability: result.gates.actionability.status,
        projectionSync: result.gates.projectionSync.status,
        projectionTrust: result.gates.projectionTrust.status,
        strategyQuality: result.gates.strategyQuality.status,
      },
      failures: result.failures.length,
      warnings: result.warnings.length,
      out: options.out,
      jsonOut: options.jsonOut,
    }),
  );
}

function isDirectExecution(metaUrl: string, argv: readonly string[]): boolean {
  const scriptPath = argv[1];
  return scriptPath ? metaUrl === pathToFileURL(scriptPath).href : false;
}

if (isDirectExecution(import.meta.url, process.argv)) {
  main().catch((error: unknown): void => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
