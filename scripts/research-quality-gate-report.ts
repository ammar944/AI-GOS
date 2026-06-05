#!/usr/bin/env tsx
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadEnvConfig } from '@next/env';

import { createAdminClient } from '../src/lib/supabase/server';
import {
  evaluateLiveQualityGate,
  type LiveQualityGateArtifactRow,
  type LiveQualityGateInput,
  type LiveQualityGateJourneySessionSnapshot,
  type LiveQualityGateProfileSnapshot,
  type LiveQualityGateResult,
  type LiveQualityGateSectionRow,
  type LiveQualityGateSectionRunRow,
  type LiveQualityGateShareSnapshot,
} from '../src/lib/research-v3/live-quality-gate';

loadEnvConfig(process.cwd());

interface ReportOptions {
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

interface DbSnapshot {
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

function parseOptions(args: string[]): ReportOptions {
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

async function readDbSnapshot(runId: string): Promise<DbSnapshot> {
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
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function boolText(value: boolean): string {
  return value ? 'yes' : 'no';
}

function listOrNone(values: readonly string[]): string {
  return values.length > 0 ? values.join('; ') : 'none';
}

function renderReport(result: LiveQualityGateResult): string {
  const completionRows = result.completion.map((row) => [
    row.zone,
    row.sectionRunStatus ?? 'missing',
    row.sectionStatus ?? 'missing',
    row.countsTowardRollup === null ? 'unknown' : boolText(row.countsTowardRollup),
    row.updatedAt ?? 'missing',
  ]);
  const verificationRows = result.sectionEvidence.map((row) => [
    row.zone,
    row.qualityStatus,
    row.verificationTier ?? 'missing',
    row.reviewTier ?? 'missing',
    boolText(row.evidenceGap),
    listOrNone(row.evidenceGapReasons),
    row.verifiedCount === null ? 'missing' : String(row.verifiedCount),
    row.unsupportedCount === null ? 'missing' : String(row.unsupportedCount),
    row.schemaValid ? 'valid' : row.schemaErrors.join('; '),
    listOrNone(row.qualityReasons),
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
    `Final verdict: \`${result.verdict}\``,
    `Research quality: \`${result.researchQualityStatus}\``,
    '',
    '## Research Quality Reasons',
    result.researchQualityReasons.length > 0
      ? result.researchQualityReasons.map((reason) => `- ${reason}`).join('\n')
      : 'none',
    '',
    '## Completion',
    markdownTable(
      ['Zone', 'Section run', 'Artifact row', 'Counts toward rollup', 'Updated at'],
      completionRows,
    ),
    '',
    '## Verification',
    markdownTable(
      [
        'Zone',
        'Research quality',
        'Persisted tier',
        'Review tier',
        'Evidence gap',
        'Gap reasons',
        'Verified',
        'Unsupported',
        'Schema/minimums',
        'Quality reasons',
      ],
      verificationRows,
    ),
    '',
    '## Voice Of Customer',
    `Pain quotes: ${result.vocAudit.painQuoteCount}`,
    `Success quotes: ${result.vocAudit.successQuoteCount}`,
    `Pain domains: ${listOrNone(result.vocAudit.painSourceDomains)}`,
    `Pain URLs: ${result.vocAudit.painSourceUrls.length}`,
    `Acquisition modes: ${listOrNone(result.vocAudit.acquisitionModes)}`,
    `Gap reasons: ${listOrNone(result.vocAudit.gapReasons)}`,
    `Self-sourced pain quote URLs: ${result.vocAudit.selfSourcedPainQuoteCount}`,
    '',
    '## Strategic Rubric',
    `Score: ${result.rubricScore.score}/10`,
    `Gate: ${result.rubricScore.gate}`,
    `Active disqualifiers: ${listOrNone(
      result.rubricScore.activeDisqualifiers.map((item) => item.label),
    )}`,
    '',
    markdownTable(['Property', 'Passed', 'Evidence pointers'], rubricRows),
    '',
    '## Profile And Share',
    `Profile present: ${boolText(result.profileTrust.present)}`,
    `Profile trust match: ${boolText(result.profileTrust.matched)}`,
    `Profile failures: ${listOrNone(result.profileTrust.failures)}`,
    `Share present: ${boolText(result.shareTrust.present)}`,
    `Share trust match: ${boolText(result.shareTrust.matched)}`,
    `Share failures: ${listOrNone(result.shareTrust.failures)}`,
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
  const gateInput: LiveQualityGateInput = {
    runId: options.runId,
    artifact: snapshot.artifact,
    sections: snapshot.sections,
    sectionRuns: snapshot.sectionRuns,
    journeySession: snapshot.journeySession,
    profile: snapshot.profile,
    share: snapshot.share,
    subjectDomain: snapshot.subjectDomain,
  };
  const result = evaluateLiveQualityGate(gateInput);
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
      failures: result.failures.length,
      warnings: result.warnings.length,
      out: options.out,
      jsonOut: options.jsonOut,
    }),
  );
}

main().catch((error: unknown): void => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
