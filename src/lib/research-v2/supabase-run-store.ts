import type { SupabaseClient } from '@supabase/supabase-js';

import {
  CROSS_SECTION_REASONING_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
} from '@/lib/ai/prompts/positioning-skills';
import {
  artifactEnvelopeSchema,
  researchInputSchema,
  runRecordSchema,
  type ArtifactEnvelope,
  type ResearchInput,
  type RunRecord,
  type SectionRunRecord,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  reviewModel,
  selectedSectionModelMetadata,
} from '@/lib/lab-engine/ai/models';
import { reviewAndUpgradeSection } from '@/lib/lab-engine/agents/review/agentic-section-review';
import {
  activityEventSchema,
  sectionIds,
  type ActivityEvent,
  type SectionId,
} from '@/lib/lab-engine/events/activity-event';
import type { RunStore } from '@/lib/lab-engine/runs/run-store';
import { assertSectionArtifactPersistable } from '@/lib/lab-engine/sections/section-registry';
import { buildCommitPatch } from '@/lib/research-v2/commit-patch';
import { buildSynthesizedThesisPatch } from '@/lib/research-v2/orchestrate-db';
import { createSupabaseWebhookAdapter } from '@/lib/research-v2/supabase-webhook-adapter';
import {
  buildCommittedSectionProfileInsights,
  persistAuditProfileBestEffort,
} from '@/lib/profiles/section-profile-persistence';
import { patchBusinessProfileInsights } from '@/lib/profiles/business-profiles';
import { refreshV3SharedSessionSnapshotsBestEffort } from '@/lib/research-v2/share-snapshot';
import {
  evaluateLiveQualityGate,
  LIVE_QUALITY_GATE_VERSION,
  renderLiveQualityGateReportMarkdown,
  type LiveQualityGateArtifactRow,
  type LiveQualityGateInput,
  type LiveQualityGateJourneySessionSnapshot,
  type LiveQualityGateProfileSnapshot,
  type LiveQualityGateSectionRow,
  type LiveQualityGateSectionRunRow,
  type LiveQualityGateShareSnapshot,
} from '@/lib/research-v3/live-quality-gate';

export interface CreateSupabaseRunStoreOptions {
  supabase: SupabaseClient;
  userId: string;
  parentAuditRunId: string;
  sectionRunIdByZone: Partial<Record<SectionId, string>>;
  researchInput: ResearchInput;
  env?: Record<string, string | undefined>;
  now?: () => Date;
}

export class SupabaseRunStoreError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SupabaseRunStoreError';
  }
}

const PROFILE_PATCH_SECTION_IDS = [
  ...POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
] as const;

type ProfilePatchSectionId = (typeof PROFILE_PATCH_SECTION_IDS)[number];

interface ResearchArtifactDbRow {
  id: string;
  run_id: string;
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

/**
 * Thrown when commit_artifact_section returns conflict=true (a compare-and-swap
 * loss). `committedRevision` is the revision currently on the section row as
 * reported by the RPC: > 0 means a sibling writer already advanced the revision
 * (e.g. a duplicate dispatch committed the same section), while -1 means the
 * commit was rejected before any revision could be read (an aborted run, or a
 * row lock that was not available). The job layer treats a sibling-win
 * (committedRevision > 0) as non-fatal and an aborted/locked conflict as fatal.
 */
export class SupabaseRunStoreCommitConflictError extends SupabaseRunStoreError {
  public readonly conflict: boolean;
  public readonly committedRevision: number;

  public constructor(
    message: string,
    options: { conflict: boolean; committedRevision: number },
  ) {
    super(message);
    this.name = 'SupabaseRunStoreCommitConflictError';
    this.conflict = options.conflict;
    this.committedRevision = options.committedRevision;
  }
}

function isoNow(now: () => Date): string {
  return now().toISOString();
}

const labReviewTimeoutEnvKey = 'LAB_REVIEW_TIMEOUT_MS';
const defaultLabReviewTimeoutMs = 45_000;

function readLabReviewTimeoutMs(
  env: Record<string, string | undefined>,
): number {
  const rawValue = env[labReviewTimeoutEnvKey]?.trim();

  if (rawValue === undefined || rawValue.length === 0) {
    return defaultLabReviewTimeoutMs;
  }

  const timeoutMs = Number(rawValue);

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new SupabaseRunStoreError(
      `${labReviewTimeoutEnvKey} must be a positive integer number of milliseconds.`,
    );
  }

  return timeoutMs;
}

function elapsedMs(startedAt: string | null, endedAt: string): number | null {
  if (!startedAt) return null;
  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return null;
  return Math.max(0, ended - started);
}

function buildLabSectionTelemetry(input: {
  elapsedMs?: number | null;
  latestActivity: string;
  phase: 'Reading sources' | 'Committed' | 'Needs review';
  phaseStartedAt: string;
  runtimeTimings: Record<string, string>;
}): Record<string, unknown> {
  return {
    executionMode: 'lab',
    phase: input.phase,
    phaseStartedAt: input.phaseStartedAt,
    latestActivity: input.latestActivity,
    provider: selectedSectionModelMetadata.provider,
    model: selectedSectionModelMetadata.modelId,
    modelId: selectedSectionModelMetadata.modelId,
    transport: selectedSectionModelMetadata.transport,
    runtimeTimings: input.runtimeTimings,
    ...(input.elapsedMs === null || input.elapsedMs === undefined
      ? {}
      : { elapsedMs: input.elapsedMs }),
  };
}

function createInitialSections(): Record<SectionId, SectionRunRecord> {
  return Object.fromEntries(
    sectionIds.map((sectionId): [SectionId, SectionRunRecord] => [
      sectionId,
      {
        sectionId,
        status: 'idle',
        artifact: null,
        startedAt: null,
        completedAt: null,
        error: null,
      },
    ]),
  ) as Record<SectionId, SectionRunRecord>;
}

function createInitialRunRecord({
  input,
  now,
  selectedSectionIds,
}: {
  input: ResearchInput;
  now: () => Date;
  selectedSectionIds: readonly SectionId[];
}): RunRecord {
  const createdAt = isoNow(now);

  return runRecordSchema.parse({
    id: input.runId,
    fixtureId: input.fixtureId,
    source: 'live',
    status: 'idle',
    selectedSectionIds,
    createdAt,
    updatedAt: createdAt,
    input,
    sections: createInitialSections(),
    events: [],
  });
}

function deriveRunStatus(record: RunRecord): RunRecord['status'] {
  const selected = record.selectedSectionIds.map(
    (sectionId) => record.sections[sectionId],
  );

  if (selected.some((section) => section?.status === 'failed')) {
    return 'failed';
  }

  if (selected.every((section) => section?.status === 'completed')) {
    return 'completed';
  }

  if (selected.some((section) => section?.status === 'running')) {
    return 'running';
  }

  return 'idle';
}

function withUpdatedRecord(record: RunRecord, now: () => Date): RunRecord {
  return runRecordSchema.parse({
    ...record,
    status: deriveRunStatus(record),
    updatedAt: isoNow(now),
  });
}

function sectionRunIdFor(
  sectionRunIdByZone: Partial<Record<SectionId, string>>,
  sectionId: SectionId,
): string {
  const sectionRunId = sectionRunIdByZone[sectionId];

  if (!sectionRunId) {
    throw new SupabaseRunStoreError(
      `No research_section_runs id found for section ${sectionId}`,
    );
  }

  return sectionRunId;
}

function asRecordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStringValue(
  record: Record<string, unknown> | null,
  key: string,
): string {
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}

function readOptionalStringValue(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeGateArtifact(
  row: ResearchArtifactDbRow | null,
): LiveQualityGateArtifactRow | null {
  if (row === null) return null;

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

function normalizeGateSection(
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

function normalizeGateSectionRun(
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

function normalizeGateJourneySession(
  row: JourneySessionDbRow | null,
): LiveQualityGateJourneySessionSnapshot | null {
  if (row === null) return null;

  return {
    id: row.id,
    profileId: row.profile_id,
    metadata: row.metadata,
    onboardingData: row.onboarding_data,
    updatedAt: row.updated_at,
  };
}

function normalizeGateProfile(
  row: BusinessProfileDbRow | null,
): LiveQualityGateProfileSnapshot | null {
  if (row === null) return null;

  return {
    id: row.id,
    aiInsights: row.ai_insights,
    positioningStrategy: row.positioning_strategy,
    offerScore: row.offer_score,
    updatedAt: row.updated_at,
  };
}

function normalizeGateShare(
  row: SharedSessionDbRow | null,
): LiveQualityGateShareSnapshot | null {
  if (row === null) return null;

  return {
    shareToken: row.share_token,
    researchSnapshot: row.research_snapshot,
    createdAt: row.created_at,
  };
}

function readGateSubjectDomain(
  session: LiveQualityGateJourneySessionSnapshot | null,
): string | null {
  if (session === null) return null;
  const metadata = asRecordValue(session.metadata);
  const onboardingData = asRecordValue(session.onboardingData);

  return (
    readOptionalStringValue(onboardingData, 'websiteUrl') ??
    readOptionalStringValue(metadata, 'websiteUrl') ??
    readOptionalStringValue(metadata, 'companyUrl')
  );
}

async function buildLiveQualityGateInputFromDb(input: {
  supabase: SupabaseClient;
  parentAuditRunId: string;
  runId: string;
  userId: string;
}): Promise<LiveQualityGateInput> {
  const { data: artifactData, error: artifactError } = await input.supabase
    .from('research_artifacts')
    .select(
      'id, run_id, status, children_complete, children_total, profile_persisted_at, created_at, updated_at',
    )
    .eq('id', input.parentAuditRunId)
    .eq('run_id', input.runId)
    .maybeSingle();

  if (artifactError) {
    throw new SupabaseRunStoreError(
      `research_artifacts gate read failed for parent_audit_run_id=${input.parentAuditRunId} run_id=${input.runId}: ${artifactError.message}`,
    );
  }

  const artifact = normalizeGateArtifact(
    (artifactData as ResearchArtifactDbRow | null) ?? null,
  );
  if (artifact === null) {
    throw new SupabaseRunStoreError(
      `research_artifacts gate read returned no row for parent_audit_run_id=${input.parentAuditRunId} run_id=${input.runId}`,
    );
  }

  const [sectionsResponse, runsResponse, sessionResponse] = await Promise.all([
    input.supabase
      .from('research_artifact_sections')
      .select(
        'id, zone, section_run_id, status, title, data, verification_tier, verification_flag, counts_toward_rollup, updated_at',
      )
      .eq('artifact_id', input.parentAuditRunId),
    input.supabase
      .from('research_section_runs')
      .select('id, zone, status, started_at, completed_at, aborted_at, error, telemetry')
      .eq('artifact_id', input.parentAuditRunId),
    input.supabase
      .from('journey_sessions')
      .select('id, profile_id, metadata, onboarding_data, updated_at')
      .eq('run_id', input.runId)
      .eq('user_id', input.userId)
      .maybeSingle(),
  ]);

  if (sectionsResponse.error) {
    throw new SupabaseRunStoreError(
      `research_artifact_sections gate read failed for parent_audit_run_id=${input.parentAuditRunId}: ${sectionsResponse.error.message}`,
    );
  }
  if (runsResponse.error) {
    throw new SupabaseRunStoreError(
      `research_section_runs gate read failed for parent_audit_run_id=${input.parentAuditRunId}: ${runsResponse.error.message}`,
    );
  }
  if (sessionResponse.error) {
    throw new SupabaseRunStoreError(
      `journey_sessions gate read failed for run_id=${input.runId}: ${sessionResponse.error.message}`,
    );
  }

  const journeySession = normalizeGateJourneySession(
    (sessionResponse.data as JourneySessionDbRow | null) ?? null,
  );
  const [profileResponse, shareResponse] = await Promise.all([
    journeySession?.profileId
      ? input.supabase
          .from('business_profiles')
          .select('id, ai_insights, positioning_strategy, offer_score, updated_at')
          .eq('id', journeySession.profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    journeySession
      ? input.supabase
          .from('shared_sessions')
          .select('share_token, research_snapshot, created_at')
          .eq('session_id', journeySession.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (profileResponse.error) {
    throw new SupabaseRunStoreError(
      `business_profiles gate read failed for profile_id=${journeySession?.profileId ?? 'missing'} run_id=${input.runId}: ${profileResponse.error.message}`,
    );
  }
  if (shareResponse.error) {
    throw new SupabaseRunStoreError(
      `shared_sessions gate read failed for session_id=${journeySession?.id ?? 'missing'} run_id=${input.runId}: ${shareResponse.error.message}`,
    );
  }

  return {
    runId: input.runId,
    artifact,
    sections: (
      (sectionsResponse.data as ResearchArtifactSectionDbRow[] | null) ?? []
    ).map(normalizeGateSection),
    sectionRuns: (
      (runsResponse.data as ResearchSectionRunDbRow[] | null) ?? []
    ).map(normalizeGateSectionRun),
    journeySession,
    profile: normalizeGateProfile(
      (profileResponse.data as BusinessProfileDbRow | null) ?? null,
    ),
    share: normalizeGateShare(
      (shareResponse.data as SharedSessionDbRow | null) ?? null,
    ),
    subjectDomain: readGateSubjectDomain(journeySession),
  };
}

async function persistLiveQualityGateBestEffort(input: {
  supabase: SupabaseClient;
  parentAuditRunId: string;
  runId: string;
  userId: string;
  computedAt: string;
}): Promise<void> {
  try {
    const gateInput = await buildLiveQualityGateInputFromDb(input);
    const result = evaluateLiveQualityGate(gateInput);
    const { error } = await input.supabase
      .from('research_quality_gate_results')
      .upsert(
        {
          run_id: input.runId,
          artifact_id: input.parentAuditRunId,
          gate_version: LIVE_QUALITY_GATE_VERSION,
          result,
          report_markdown: renderLiveQualityGateReportMarkdown(result),
          computed_at: input.computedAt,
        },
        { onConflict: 'run_id,gate_version' },
      );

    if (error) {
      throw new SupabaseRunStoreError(
        `research_quality_gate_results upsert failed for run_id=${input.runId} gate_version=${LIVE_QUALITY_GATE_VERSION}: ${error.message}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      '[supabase-run-store] live quality gate persistence failed:',
      message,
    );
  }
}

async function attachAgenticReview(input: {
  artifact: ArtifactEnvelope;
  researchInput: ResearchInput;
  timeoutMs: number;
}): Promise<ArtifactEnvelope> {
  try {
    const review = await reviewAndUpgradeSection({
      artifact: input.artifact,
      model: reviewModel,
      researchInput: input.researchInput,
      sectionId: input.artifact.sectionId,
      timeoutMs: input.timeoutMs,
    });
    const reviewedArtifact = artifactEnvelopeSchema.parse({
      ...input.artifact,
      review,
    });
    assertSectionArtifactPersistable(reviewedArtifact);

    return reviewedArtifact;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      '[supabase-run-store] agentic section review failed; committing original artifact:',
      message,
    );

    return input.artifact;
  }
}

// Best-effort: merge the synthesized positioning wedge into the parent's
// research_artifacts.thesis as a sibling key. Never throws — the section
// artifact is already committed; the thesis is bookkeeping for profile insights,
// so a failure here must not fail the commit.
async function mergeSynthesizedThesisBestEffort(input: {
  supabase: SupabaseClient;
  parentAuditRunId: string;
  artifact: ArtifactEnvelope;
  updatedAt: string;
}): Promise<void> {
  try {
    const artifactRecord = input.artifact as unknown as Record<string, unknown>;
    const body = asRecordValue(artifactRecord.body);
    const strategicThesis = asRecordValue(body?.strategicThesis);
    const contradictionReconciliation = asRecordValue(
      body?.contradictionReconciliation,
    );
    const orderedMoves = asRecordValue(body?.orderedMoves);
    const recommendedMove = asRecordValue(body?.recommendedMove);
    const positioningOptions = asRecordValue(body?.positioningOptions);
    const options = Array.isArray(positioningOptions?.options)
      ? positioningOptions.options
      : [];
    const moves = Array.isArray(orderedMoves?.moves)
      ? orderedMoves.moves
      : [];

    const { data, error } = await input.supabase
      .from('research_artifacts')
      .select('thesis')
      .eq('id', input.parentAuditRunId)
      .maybeSingle();

    if (error) {
      console.warn(
        '[supabase-run-store] synthesis thesis read failed:',
        error.message,
      );
      return;
    }

    const existingThesis = asRecordValue(
      (data as { thesis?: unknown } | null)?.thesis,
    );
    const { thesis } = buildSynthesizedThesisPatch({
      existingThesis,
      headlineWedge: input.artifact.verdict,
      recommendedAngle: readStringValue(recommendedMove, 'optionAngle'),
      rationale: readStringValue(recommendedMove, 'rationale'),
      optionCount: options.length,
      strategicThesis: readStringValue(strategicThesis, 'thesis'),
      strategicSegment: readStringValue(strategicThesis, 'segment'),
      strategicAwareness: readStringValue(strategicThesis, 'awareness'),
      strategicForce: readStringValue(strategicThesis, 'force'),
      defensibleDifferentiator: readStringValue(
        strategicThesis,
        'defensibleDifferentiator',
      ),
      contradiction: readStringValue(
        contradictionReconciliation,
        'contradiction',
      ),
      resolution: readStringValue(contradictionReconciliation, 'resolution'),
      tradeOffAccepted: readStringValue(
        contradictionReconciliation,
        'tradeOffAccepted',
      ),
      ...(orderedMoves === null ? {} : { orderedMoveCount: moves.length }),
      updatedAt: input.updatedAt,
    });

    const { error: updateError } = await input.supabase
      .from('research_artifacts')
      .update({ thesis })
      .eq('id', input.parentAuditRunId);

    if (updateError) {
      console.warn(
        '[supabase-run-store] synthesis thesis update failed:',
        updateError.message,
      );
    }
  } catch (err) {
    console.warn(
      '[supabase-run-store] synthesis thesis merge errored:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

function isProfilePatchSectionId(sectionId: SectionId): sectionId is ProfilePatchSectionId {
  return (PROFILE_PATCH_SECTION_IDS as readonly string[]).includes(sectionId);
}

async function patchProfileSectionBestEffort(input: {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  parentAuditRunId: string;
  artifact: ArtifactEnvelope;
}): Promise<void> {
  if (!isProfilePatchSectionId(input.artifact.sectionId)) {
    return;
  }

  try {
    const { data: sessionData, error: sessionError } = await input.supabase
      .from('journey_sessions')
      .select('profile_id')
      .eq('run_id', input.runId)
      .eq('user_id', input.userId)
      .maybeSingle();

    if (sessionError) {
      console.warn('[supabase-run-store] section profile read failed:', {
        userId: input.userId,
        runId: input.runId,
        parentAuditRunId: input.parentAuditRunId,
        sectionId: input.artifact.sectionId,
        message: sessionError.message,
      });
      return;
    }

    const profileId = (sessionData as { profile_id?: unknown } | null)?.profile_id;
    if (typeof profileId !== 'string' || profileId.trim().length === 0) {
      return;
    }

    const { data: sectionData, error: sectionError } = await input.supabase
      .from('research_artifact_sections')
      .select('verification_tier, verification_flag')
      .eq('artifact_id', input.parentAuditRunId)
      .eq('zone', input.artifact.sectionId)
      .maybeSingle();

    if (sectionError) {
      console.warn('[supabase-run-store] section profile tier read failed:', {
        userId: input.userId,
        runId: input.runId,
        parentAuditRunId: input.parentAuditRunId,
        sectionId: input.artifact.sectionId,
        message: sectionError.message,
      });
      return;
    }

    const sectionRow = sectionData as {
      verification_tier?: unknown;
      verification_flag?: unknown;
    } | null;
    const insights = buildCommittedSectionProfileInsights({
      sectionId: input.artifact.sectionId,
      artifact: input.artifact,
      verificationTier: sectionRow?.verification_tier ?? null,
      verificationFlag: sectionRow?.verification_flag ?? null,
    });

    await patchBusinessProfileInsights({
      supabase: input.supabase,
      userId: input.userId,
      profileId,
      insights,
    });
  } catch (err) {
    console.warn(
      '[supabase-run-store] section profile patch errored:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function claimProfilePersist(input: {
  supabase: SupabaseClient;
  parentAuditRunId: string;
  persistedAt: string;
}): Promise<boolean> {
  const { data, error } = await input.supabase
    .from('research_artifacts')
    .update({
      profile_persisted_at: input.persistedAt,
    })
    .eq('id', input.parentAuditRunId)
    .eq('status', 'complete')
    .is('profile_persisted_at', null)
    .select('id');

  if (error) {
    throw new SupabaseRunStoreError(
      `research_artifacts profile persist claim failed for parent_audit_run_id=${input.parentAuditRunId}: ${error.message}`,
    );
  }

  return (data?.length ?? 0) === 1;
}

async function isParentAuditComplete(input: {
  supabase: SupabaseClient;
  parentAuditRunId: string;
}): Promise<boolean> {
  const { data, error } = await input.supabase
    .from('research_artifacts')
    .select('status')
    .eq('id', input.parentAuditRunId)
    .maybeSingle();

  if (error) {
    throw new SupabaseRunStoreError(
      `research_artifacts status lookup failed for parent_audit_run_id=${input.parentAuditRunId}: ${error.message}`,
    );
  }

  return (data as { status?: unknown } | null)?.status === 'complete';
}

async function markProfileSynced(input: {
  supabase: SupabaseClient;
  parentAuditRunId: string;
  syncedAt: string;
}): Promise<void> {
  const { error } = await input.supabase
    .from('research_artifacts')
    .update({ profile_persisted_at: input.syncedAt })
    .eq('id', input.parentAuditRunId);

  if (error) {
    throw new SupabaseRunStoreError(
      `research_artifacts profile sync timestamp update failed for parent_audit_run_id=${input.parentAuditRunId}: ${error.message}`,
    );
  }
}

async function emitProfilePersistedEvent(input: {
  supabase: SupabaseClient;
  parentAuditRunId: string;
  runId: string;
  profileId: string;
}): Promise<void> {
  const { error } = await input.supabase.from('research_section_events').insert({
    section_run_id: null,
    artifact_id: input.parentAuditRunId,
    zone: null,
    event_type: 'profile_persisted',
    message: 'business profile persisted',
    payload: {
      profile_id: input.profileId,
      run_id: input.runId,
    },
  });

  if (error) {
    throw new SupabaseRunStoreError(
      `research_section_events profile_persisted insert failed for parent_audit_run_id=${input.parentAuditRunId} profile_id=${input.profileId} run_id=${input.runId}: ${error.message}`,
    );
  }
}

function assertRunId(expectedRunId: string, actualRunId: string, action: string): void {
  if (actualRunId !== expectedRunId) {
    throw new SupabaseRunStoreError(
      `${action} received runId ${actualRunId}; expected ${expectedRunId}`,
    );
  }
}

function mergeSection(
  record: RunRecord,
  sectionId: SectionId,
  sectionRecord: SectionRunRecord,
  now: () => Date,
): RunRecord {
  return withUpdatedRecord(
    {
      ...record,
      sections: {
        ...record.sections,
        [sectionId]: sectionRecord,
      },
    },
    now,
  );
}

function getSelectedSectionIds(
  sectionRunIdByZone: Partial<Record<SectionId, string>>,
): SectionId[] {
  const selectedSectionIds = sectionIds.filter((sectionId) => {
    const sectionRunId = sectionRunIdByZone[sectionId];
    return typeof sectionRunId === 'string' && sectionRunId.trim().length > 0;
  });

  return selectedSectionIds.length > 0 ? selectedSectionIds : [...sectionIds];
}

export function createSupabaseRunStore(
  options: CreateSupabaseRunStoreOptions,
): RunStore {
  const now = options.now ?? (() => new Date());
  const input = researchInputSchema.parse(options.researchInput);
  const selectedSectionIds = getSelectedSectionIds(options.sectionRunIdByZone);
  const adapter = createSupabaseWebhookAdapter(options.supabase);
  const reviewTimeoutMs = readLabReviewTimeoutMs(options.env ?? process.env);
  let record = createInitialRunRecord({ input, now, selectedSectionIds });

  return {
    createRun: async (researchInput: ResearchInput): Promise<RunRecord> => {
      const parsedInput = researchInputSchema.parse(researchInput);
      assertRunId(input.runId, parsedInput.runId, 'createRun');
      record = createInitialRunRecord({
        input: parsedInput,
        now,
        selectedSectionIds,
      });
      return record;
    },

    readRun: async (runId: string): Promise<RunRecord> => {
      assertRunId(input.runId, runId, 'readRun');
      return record;
    },

    appendEvent: async (
      runId: string,
      event: ActivityEvent,
    ): Promise<RunRecord> => {
      assertRunId(input.runId, runId, 'appendEvent');
      const parsedEvent = activityEventSchema.parse(event);
      record = withUpdatedRecord(
        {
          ...record,
          events: [...record.events, parsedEvent],
        },
        now,
      );

      if (parsedEvent.sectionId === undefined) {
        return record;
      }

      const sectionRunId = sectionRunIdFor(
        options.sectionRunIdByZone,
        parsedEvent.sectionId,
      );
      const { error } = await options.supabase.rpc('append_section_event', {
        p_section_run_id: sectionRunId,
        p_event_type: parsedEvent.type,
        p_message: parsedEvent.message,
        p_payload: parsedEvent,
      });

      if (error) {
        throw new SupabaseRunStoreError(
          `append_section_event failed for ${parsedEvent.sectionId} section_run_id=${sectionRunId}: ${error.message}`,
        );
      }

      return record;
    },

    saveArtifact: async (
      runId: string,
      artifact: ArtifactEnvelope,
    ): Promise<RunRecord> => {
      assertRunId(input.runId, runId, 'saveArtifact');
      const parsedArtifact = artifactEnvelopeSchema.parse(artifact);
      assertSectionArtifactPersistable(parsedArtifact);
      const sectionRunId = sectionRunIdFor(
        options.sectionRunIdByZone,
        parsedArtifact.sectionId,
      );
      const context = await adapter.loadSectionRunContext(sectionRunId);

      if (!context) {
        throw new SupabaseRunStoreError(
          `No section run context found for section_run_id=${sectionRunId}`,
        );
      }

      if (context.error) {
        throw new SupabaseRunStoreError(
          `Section run context failed for section_run_id=${sectionRunId}: ${context.error}`,
        );
      }

      const artifactToCommit = await attachAgenticReview({
        artifact: parsedArtifact,
        researchInput: input,
        timeoutMs: reviewTimeoutMs,
      });

      // ARI: capstones are dispatched best-effort even when upstream evidence
      // is thin (evidenceCoverage.ready === false). Badge those capstones
      // needs_review rather than dropping them. Core sections never carry
      // evidenceCoverage, so they are unaffected.
      const isCapstoneSection =
        artifactToCommit.sectionId === CROSS_SECTION_REASONING_SECTION_ID ||
        artifactToCommit.sectionId === PAID_MEDIA_PLAN_SECTION_ID ||
        artifactToCommit.sectionId === POSITIONING_SYNTHESIS_SECTION_ID;
      const degradeToNeedsReview =
        isCapstoneSection && input.evidenceCoverage?.ready === false;

      const committed = await adapter.commitArtifactSection({
        artifactId: options.parentAuditRunId,
        zone: artifactToCommit.sectionId,
        sectionRunId,
        expectedRevision: context.expectedRevision,
        patch: buildCommitPatch(artifactToCommit.sectionId, artifactToCommit, {
          degradeToNeedsReview,
        }),
      });

      if (!committed.ok) {
        // A conflict (no RPC error) is a compare-and-swap loss, not a genuine
        // failure. Surface it as a typed error carrying the committed revision
        // so the job layer can classify a sibling-win (revision already
        // advanced past expected) as non-fatal. Genuine RPC errors stay generic
        // and still surface as a real section failure.
        if (committed.error === undefined && committed.conflict) {
          throw new SupabaseRunStoreCommitConflictError(
            `commit_artifact_section conflict for ${artifactToCommit.sectionId} section_run_id=${sectionRunId} expectedRevision=${context.expectedRevision} committedRevision=${committed.revision}`,
            { conflict: true, committedRevision: committed.revision },
          );
        }
        throw new SupabaseRunStoreError(
          `commit_artifact_section failed for ${artifactToCommit.sectionId} section_run_id=${sectionRunId} revision=${context.expectedRevision}: ${committed.error ?? 'conflict=' + String(committed.conflict)}`,
        );
      }

      const completedAt = isoNow(now);
      const existingSection = record.sections[artifactToCommit.sectionId];
      const startedAt = existingSection?.startedAt ?? completedAt;
      const { error: telemetryError } = await options.supabase
        .from('research_section_runs')
        .update({
          error: null,
          telemetry: buildLabSectionTelemetry({
            elapsedMs: elapsedMs(startedAt, completedAt),
            latestActivity: `${artifactToCommit.sectionTitle} committed`,
            phase: 'Committed',
            phaseStartedAt: completedAt,
            runtimeTimings: {
              sectionStartedAt: startedAt,
              commitCompleteAt: completedAt,
              terminalStatusWrittenAt: completedAt,
            },
          }),
        })
        .eq('id', sectionRunId);

      if (telemetryError) {
        throw new SupabaseRunStoreError(
          `research_section_runs telemetry update failed for ${artifactToCommit.sectionId} section_run_id=${sectionRunId}: ${telemetryError.message}`,
        );
      }

      if (artifactToCommit.sectionId === POSITIONING_SYNTHESIS_SECTION_ID) {
        await mergeSynthesizedThesisBestEffort({
          supabase: options.supabase,
          parentAuditRunId: options.parentAuditRunId,
          artifact: artifactToCommit,
          updatedAt: completedAt,
        });
      }

      const profilePersistClaimed = await claimProfilePersist({
        supabase: options.supabase,
        parentAuditRunId: options.parentAuditRunId,
        persistedAt: completedAt,
      });
      const parentAuditComplete =
        profilePersistClaimed ||
        (await isParentAuditComplete({
          supabase: options.supabase,
          parentAuditRunId: options.parentAuditRunId,
        }));

      if (parentAuditComplete) {
        const profileId = await persistAuditProfileBestEffort({
          supabase: options.supabase,
          userId: options.userId,
          runId: input.runId,
          researchInput: input,
          parentAuditRunId: options.parentAuditRunId,
        });

        if (profileId) {
          if (!profilePersistClaimed) {
            await markProfileSynced({
              supabase: options.supabase,
              parentAuditRunId: options.parentAuditRunId,
              syncedAt: completedAt,
            });
          }

          if (profilePersistClaimed) {
            await emitProfilePersistedEvent({
              supabase: options.supabase,
              parentAuditRunId: options.parentAuditRunId,
              runId: input.runId,
              profileId,
            });
          }
        }

        await refreshV3SharedSessionSnapshotsBestEffort({
          supabase: options.supabase,
          userId: options.userId,
          runId: input.runId,
        });

        await persistLiveQualityGateBestEffort({
          supabase: options.supabase,
          parentAuditRunId: options.parentAuditRunId,
          runId: input.runId,
          userId: options.userId,
          computedAt: completedAt,
        });
      } else {
        await patchProfileSectionBestEffort({
          supabase: options.supabase,
          userId: options.userId,
          runId: input.runId,
          parentAuditRunId: options.parentAuditRunId,
          artifact: artifactToCommit,
        });
      }

      record = mergeSection(
        record,
        artifactToCommit.sectionId,
        {
          sectionId: artifactToCommit.sectionId,
          status: 'completed',
          artifact: artifactToCommit,
          startedAt,
          completedAt,
          error: null,
        },
        now,
      );
      return record;
    },

    markSectionRunning: async (
      runId: string,
      sectionId: SectionId,
    ): Promise<RunRecord> => {
      assertRunId(input.runId, runId, 'markSectionRunning');
      const sectionRunId = sectionRunIdFor(options.sectionRunIdByZone, sectionId);
      const startedAt = record.sections[sectionId]?.startedAt ?? isoNow(now);
      const { error } = await options.supabase
        .from('research_section_runs')
        .update({
          status: 'running',
          started_at: startedAt,
          telemetry: buildLabSectionTelemetry({
            latestActivity: `${sectionId} running`,
            phase: 'Reading sources',
            phaseStartedAt: startedAt,
            runtimeTimings: { sectionStartedAt: startedAt },
          }),
        })
        .eq('id', sectionRunId);

      if (error) {
        throw new SupabaseRunStoreError(
          `research_section_runs running update failed for ${sectionId} section_run_id=${sectionRunId}: ${error.message}`,
        );
      }

      record = mergeSection(
        record,
        sectionId,
        {
          sectionId,
          status: 'running',
          artifact: record.sections[sectionId]?.artifact ?? null,
          startedAt,
          completedAt: null,
          error: null,
        },
        now,
      );
      return record;
    },

    markSectionFailed: async (
      runId: string,
      sectionId: SectionId,
      errorMessage: string,
    ): Promise<RunRecord> => {
      assertRunId(input.runId, runId, 'markSectionFailed');
      const sectionRunId = sectionRunIdFor(options.sectionRunIdByZone, sectionId);
      const marked = await adapter.markSectionError({
        sectionRunId,
        error: {
          message: errorMessage,
          source: 'lab_engine',
          sectionId,
        },
      });

      if (!marked.ok) {
        throw new SupabaseRunStoreError(
          `research_section_runs error update failed for ${sectionId} section_run_id=${sectionRunId}: ${marked.error ?? 'unknown error'}`,
        );
      }
      if (!marked.changed) {
        return record;
      }

      const failedAt = isoNow(now);
      const startedAt = record.sections[sectionId]?.startedAt ?? failedAt;
      const { error: telemetryError } = await options.supabase
        .from('research_section_runs')
        .update({
          telemetry: buildLabSectionTelemetry({
            elapsedMs: elapsedMs(startedAt, failedAt),
            latestActivity: `${sectionId} failed`,
            phase: 'Needs review',
            phaseStartedAt: failedAt,
            runtimeTimings: {
              sectionStartedAt: startedAt,
              terminalStatusWrittenAt: failedAt,
            },
          }),
        })
        .eq('id', sectionRunId);

      if (telemetryError) {
        throw new SupabaseRunStoreError(
          `research_section_runs telemetry update failed for ${sectionId} section_run_id=${sectionRunId}: ${telemetryError.message}`,
        );
      }

      record = mergeSection(
        record,
        sectionId,
        {
          sectionId,
          status: 'failed',
          artifact: record.sections[sectionId]?.artifact ?? null,
          startedAt,
          completedAt: failedAt,
          error: errorMessage,
        },
        now,
      );
      return record;
    },
  };
}
