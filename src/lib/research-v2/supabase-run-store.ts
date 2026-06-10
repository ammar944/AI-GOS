import type { SupabaseClient } from '@supabase/supabase-js';

import {
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
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
import {
  buildCommitPatch,
  buildReviewCommitPatch,
} from '@/lib/research-v2/commit-patch';
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

export interface SupabaseRunStoreReviewDispatch {
  url: string;
  internalKey: string;
}

export interface CreateSupabaseRunStoreOptions {
  supabase: SupabaseClient;
  userId: string;
  parentAuditRunId: string;
  sectionRunIdByZone: Partial<Record<SectionId, string>>;
  researchInput: ResearchInput;
  schedulePostCommitReview?: ScheduleSupabaseRunStoreTask;
  // True W3 detach: when set, the post-commit agentic review is shipped to the
  // dedicated review route (own invocation, own maxDuration) instead of
  // running inside this invocation's residual clock. Falls back inline when
  // the kickoff cannot be delivered.
  reviewDispatch?: SupabaseRunStoreReviewDispatch;
  env?: Record<string, string | undefined>;
  now?: () => Date;
}

export type ScheduleSupabaseRunStoreTask = (task: () => Promise<void>) => void;

export class SupabaseRunStoreError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SupabaseRunStoreError';
  }
}

const PROFILE_PATCH_SECTION_IDS = [
  ...POSITIONING_SECTION_IDS,
  PAID_MEDIA_PLAN_SECTION_ID,
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
// Detached review budget: the dedicated review route owns its own invocation
// clock, so the review stops racing the section job's residual seconds
// (285s job + 45s review > 300s route maxDuration guaranteed-killed reviews
// on long sections — the Anura run's three `review unavailable` badges).
const detachedReviewTimeoutMs = 90_000;

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
}): Promise<ArtifactEnvelope | null> {
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
      '[supabase-run-store] agentic section review failed; keeping committed original artifact:',
      message,
    );

    return null;
  }
}

export interface RunPostCommitAgenticReviewInput {
  adapter: ReturnType<typeof createSupabaseWebhookAdapter>;
  artifact: ArtifactEnvelope;
  committedRevision: number;
  completedAt: string;
  degradeToNeedsReview: boolean;
  parentAuditRunId: string;
  researchInput: ResearchInput;
  reviewTimeoutMs: number;
  sectionRunId: string;
  supabase: SupabaseClient;
  userId: string;
}

export async function runPostCommitAgenticReview(
  input: RunPostCommitAgenticReviewInput,
): Promise<void> {
  const reviewedArtifact = await attachAgenticReview({
    artifact: input.artifact,
    researchInput: input.researchInput,
    timeoutMs: input.reviewTimeoutMs,
  });

  if (reviewedArtifact === null) {
    return;
  }

  const committed = await input.adapter.commitArtifactSection({
    artifactId: input.parentAuditRunId,
    zone: reviewedArtifact.sectionId,
    sectionRunId: input.sectionRunId,
    expectedRevision: input.committedRevision,
    patch: buildReviewCommitPatch(reviewedArtifact.sectionId, reviewedArtifact, {
      degradeToNeedsReview: input.degradeToNeedsReview,
    }),
  });

  if (!committed.ok) {
    console.warn('[supabase-run-store] agentic section review patch skipped:', {
      runId: input.researchInput.runId,
      sectionId: reviewedArtifact.sectionId,
      sectionRunId: input.sectionRunId,
      revision: input.committedRevision,
      error: committed.error,
      conflict: committed.conflict,
      committedRevision: committed.revision,
    });
    return;
  }

  await runPostCommitProfileFanout({
    supabase: input.supabase,
    userId: input.userId,
    runId: input.researchInput.runId,
    parentAuditRunId: input.parentAuditRunId,
    researchInput: input.researchInput,
    completedAt: input.completedAt,
    artifactToCommit: reviewedArtifact,
  });
}

interface SchedulePostCommitAgenticReviewInput {
  adapter: ReturnType<typeof createSupabaseWebhookAdapter>;
  artifact: ArtifactEnvelope;
  committedRevision: number;
  completedAt: string;
  degradeToNeedsReview: boolean;
  options: CreateSupabaseRunStoreOptions;
  reviewTimeoutMs: number;
  sectionRunId: string;
}

// Ship the review to the dedicated review route so it gets its own invocation
// clock. Returns false (caller runs inline) when no dispatch target is
// configured or the kickoff cannot be delivered.
async function postDetachedReviewKickoff(
  input: SchedulePostCommitAgenticReviewInput,
): Promise<boolean> {
  const dispatch = input.options.reviewDispatch;

  if (dispatch === undefined) {
    return false;
  }

  try {
    const response = await fetch(dispatch.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-key': dispatch.internalKey,
      },
      body: JSON.stringify({
        userId: input.options.userId,
        parentAuditRunId: input.options.parentAuditRunId,
        sectionRunId: input.sectionRunId,
        committedRevision: input.committedRevision,
        completedAt: input.completedAt,
        degradeToNeedsReview: input.degradeToNeedsReview,
        reviewTimeoutMs: detachedReviewTimeoutMs,
        artifact: input.artifact,
        researchInput: researchInputSchema.parse(input.options.researchInput),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(
        '[supabase-run-store] detached review kickoff rejected; running review inline',
        { sectionRunId: input.sectionRunId, status: response.status },
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn(
      '[supabase-run-store] detached review kickoff failed; running review inline',
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

function schedulePostCommitAgenticReview(
  input: SchedulePostCommitAgenticReviewInput,
): void {
  input.options.schedulePostCommitReview?.(async (): Promise<void> => {
    if (await postDetachedReviewKickoff(input)) {
      return;
    }

    try {
      await runPostCommitAgenticReview({
        adapter: input.adapter,
        artifact: input.artifact,
        committedRevision: input.committedRevision,
        completedAt: input.completedAt,
        degradeToNeedsReview: input.degradeToNeedsReview,
        parentAuditRunId: input.options.parentAuditRunId,
        researchInput: researchInputSchema.parse(input.options.researchInput),
        reviewTimeoutMs: input.reviewTimeoutMs,
        sectionRunId: input.sectionRunId,
        supabase: input.options.supabase,
        userId: input.options.userId,
      });
    } catch (error) {
      console.warn(
        '[supabase-run-store] post-commit agentic section review failed:',
        error instanceof Error ? error.message : String(error),
      );
    }
  });
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

/**
 * Post-commit profile fan-out for a single section commit.
 *
 * This runs AFTER `commit_artifact_section` has already returned. That RPC
 * synchronously `PERFORM`s `public.roll_up_research_artifact(...)` inside its
 * own transaction (see supabase/migrations/20260526_rollup_parent_on_section_commit.sql),
 * so by the time the adapter resolves, the parent `research_artifacts.status`
 * row is already ratcheted to `complete` when the final child commits. It is a
 * synchronous SQL function call inside the commit RPC — NOT a row trigger and
 * NOT an app-side poll. `claimProfilePersist` below therefore reads that
 * post-write parent state directly via its `.eq('status', 'complete')` filter:
 * a same-RPC read-after-write, not a re-query loop.
 *
 * Invariants preserved (do not reorder):
 *   1. `claimProfilePersist` (CAS on `status='complete' AND profile_persisted_at IS NULL`)
 *      elects exactly one winner under concurrent committers.
 *   2. `parentAuditComplete = claimed || (await isParentAuditComplete(...))`
 *      short-circuits so only the CAS loser re-reads parent status.
 *   3. The CAS winner (`claimed`) emits the single `profile_persisted` event;
 *      a non-winner that finds the parent already persisted only stamps
 *      `markProfileSynced` (idempotent).
 *   4. The share-snapshot refresh and live quality-gate persist always run once
 *      the parent is complete; the else branch patches the per-section insight
 *      for a non-completing commit.
 *
 * MUST stay awaited by `saveArtifact` so the completing save does not resolve
 * before `persistAuditProfileBestEffort` settles.
 */
async function runPostCommitProfileFanout(input: {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  parentAuditRunId: string;
  researchInput: ResearchInput;
  completedAt: string;
  artifactToCommit: ArtifactEnvelope;
}): Promise<void> {
  const profilePersistClaimed = await claimProfilePersist({
    supabase: input.supabase,
    parentAuditRunId: input.parentAuditRunId,
    persistedAt: input.completedAt,
  });
  const parentAuditComplete =
    profilePersistClaimed ||
    (await isParentAuditComplete({
      supabase: input.supabase,
      parentAuditRunId: input.parentAuditRunId,
    }));

  if (parentAuditComplete) {
    const profileId = await persistAuditProfileBestEffort({
      supabase: input.supabase,
      userId: input.userId,
      runId: input.runId,
      researchInput: input.researchInput,
      parentAuditRunId: input.parentAuditRunId,
    });

    if (profileId) {
      if (!profilePersistClaimed) {
        await markProfileSynced({
          supabase: input.supabase,
          parentAuditRunId: input.parentAuditRunId,
          syncedAt: input.completedAt,
        });
      }

      if (profilePersistClaimed) {
        await emitProfilePersistedEvent({
          supabase: input.supabase,
          parentAuditRunId: input.parentAuditRunId,
          runId: input.runId,
          profileId,
        });
      }
    }

    await refreshV3SharedSessionSnapshotsBestEffort({
      supabase: input.supabase,
      userId: input.userId,
      runId: input.runId,
    });

    await persistLiveQualityGateBestEffort({
      supabase: input.supabase,
      parentAuditRunId: input.parentAuditRunId,
      runId: input.runId,
      userId: input.userId,
      computedAt: input.completedAt,
    });
  } else {
    await patchProfileSectionBestEffort({
      supabase: input.supabase,
      userId: input.userId,
      runId: input.runId,
      parentAuditRunId: input.parentAuditRunId,
      artifact: input.artifactToCommit,
    });
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

      // ARI: paid-media is dispatched best-effort even when upstream evidence
      // is thin (evidenceCoverage.ready === false). Badge paid-media
      // needs_review rather than dropping it. Core sections never carry
      // evidenceCoverage, so they are unaffected.
      const isCapstoneSection =
        parsedArtifact.sectionId === PAID_MEDIA_PLAN_SECTION_ID;
      const degradeToNeedsReview =
        isCapstoneSection && input.evidenceCoverage?.ready === false;

      const committed = await adapter.commitArtifactSection({
        artifactId: options.parentAuditRunId,
        zone: parsedArtifact.sectionId,
        sectionRunId,
        expectedRevision: context.expectedRevision,
        patch: buildCommitPatch(parsedArtifact.sectionId, parsedArtifact, {
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
            `commit_artifact_section conflict for ${parsedArtifact.sectionId} section_run_id=${sectionRunId} expectedRevision=${context.expectedRevision} committedRevision=${committed.revision}`,
            { conflict: true, committedRevision: committed.revision },
          );
        }
        throw new SupabaseRunStoreError(
          `commit_artifact_section failed for ${parsedArtifact.sectionId} section_run_id=${sectionRunId} revision=${context.expectedRevision}: ${committed.error ?? 'conflict=' + String(committed.conflict)}`,
        );
      }

      const completedAt = isoNow(now);
      schedulePostCommitAgenticReview({
        adapter,
        artifact: parsedArtifact,
        committedRevision: committed.revision,
        completedAt,
        degradeToNeedsReview,
        options,
        reviewTimeoutMs,
        sectionRunId,
      });

      const existingSection = record.sections[parsedArtifact.sectionId];
      const startedAt = existingSection?.startedAt ?? completedAt;
      const { error: telemetryError } = await options.supabase
        .from('research_section_runs')
        .update({
          error: null,
          telemetry: buildLabSectionTelemetry({
            elapsedMs: elapsedMs(startedAt, completedAt),
            latestActivity: `${parsedArtifact.sectionTitle} committed`,
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
          `research_section_runs telemetry update failed for ${parsedArtifact.sectionId} section_run_id=${sectionRunId}: ${telemetryError.message}`,
        );
      }

      await runPostCommitProfileFanout({
        supabase: options.supabase,
        userId: options.userId,
        runId: input.runId,
        parentAuditRunId: options.parentAuditRunId,
        researchInput: input,
        completedAt,
        artifactToCommit: parsedArtifact,
      });

      record = mergeSection(
        record,
        parsedArtifact.sectionId,
        {
          sectionId: parsedArtifact.sectionId,
          status: 'completed',
          artifact: parsedArtifact,
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
