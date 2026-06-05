import type { SupabaseClient } from '@supabase/supabase-js';

import {
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
import { patchBusinessProfileSynthesis } from '@/lib/profiles/business-profiles';

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

async function patchProfileSynthesisBestEffort(input: {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  parentAuditRunId: string;
  artifact: ArtifactEnvelope;
}): Promise<void> {
  try {
    const { data: sessionData, error: sessionError } = await input.supabase
      .from('journey_sessions')
      .select('profile_id')
      .eq('run_id', input.runId)
      .eq('user_id', input.userId)
      .maybeSingle();

    if (sessionError) {
      console.warn('[supabase-run-store] synthesis profile read failed:', {
        userId: input.userId,
        runId: input.runId,
        parentAuditRunId: input.parentAuditRunId,
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
      .eq('zone', POSITIONING_SYNTHESIS_SECTION_ID)
      .maybeSingle();

    if (sectionError) {
      console.warn('[supabase-run-store] synthesis profile tier read failed:', {
        userId: input.userId,
        runId: input.runId,
        parentAuditRunId: input.parentAuditRunId,
        message: sectionError.message,
      });
      return;
    }

    const sectionRow = sectionData as {
      verification_tier?: unknown;
      verification_flag?: unknown;
    } | null;
    const insights = buildCommittedSectionProfileInsights({
      sectionId: POSITIONING_SYNTHESIS_SECTION_ID,
      artifact: input.artifact,
      verificationTier: sectionRow?.verification_tier ?? null,
      verificationFlag: sectionRow?.verification_flag ?? null,
    });
    const positioningStrategy = asRecordValue(insights.positioningStrategy);
    if (!positioningStrategy) {
      console.warn('[supabase-run-store] synthesis profile patch missing strategy', {
        userId: input.userId,
        runId: input.runId,
        parentAuditRunId: input.parentAuditRunId,
        profileId,
      });
      return;
    }

    await patchBusinessProfileSynthesis({
      supabase: input.supabase,
      userId: input.userId,
      profileId,
      insights,
      positioningStrategy,
    });
  } catch (err) {
    console.warn(
      '[supabase-run-store] synthesis profile patch errored:',
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

      const committed = await adapter.commitArtifactSection({
        artifactId: options.parentAuditRunId,
        zone: artifactToCommit.sectionId,
        sectionRunId,
        expectedRevision: context.expectedRevision,
        patch: buildCommitPatch(artifactToCommit.sectionId, artifactToCommit),
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
        await patchProfileSynthesisBestEffort({
          supabase: options.supabase,
          userId: options.userId,
          runId: input.runId,
          parentAuditRunId: options.parentAuditRunId,
          artifact: artifactToCommit,
        });
      }

      if (
        await claimProfilePersist({
          supabase: options.supabase,
          parentAuditRunId: options.parentAuditRunId,
          persistedAt: completedAt,
        })
      ) {
        const profileId = await persistAuditProfileBestEffort({
          supabase: options.supabase,
          userId: options.userId,
          runId: input.runId,
          researchInput: input,
          parentAuditRunId: options.parentAuditRunId,
        });

        if (profileId) {
          await emitProfilePersistedEvent({
            supabase: options.supabase,
            parentAuditRunId: options.parentAuditRunId,
            runId: input.runId,
            profileId,
          });
        }
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
