import type { SupabaseClient } from '@supabase/supabase-js';

import {
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
import { selectedSectionModelMetadata } from '@/lib/lab-engine/ai/models';
import {
  activityEventSchema,
  sectionIds,
  type ActivityEvent,
  type SectionId,
} from '@/lib/lab-engine/events/activity-event';
import type { RunStore } from '@/lib/lab-engine/runs/run-store';
import { assertSectionArtifactPersistable } from '@/lib/lab-engine/sections/section-registry';
import { buildCommitPatch } from '@/lib/research-v2/commit-patch';
import { createSupabaseWebhookAdapter } from '@/lib/research-v2/supabase-webhook-adapter';

export interface CreateSupabaseRunStoreOptions {
  supabase: SupabaseClient;
  parentAuditRunId: string;
  sectionRunIdByZone: Partial<Record<SectionId, string>>;
  researchInput: ResearchInput;
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

const POSITIONING_SECTION_ID_SET: ReadonlySet<string> = new Set(
  POSITIONING_SECTION_IDS,
);

function countCompletePositioningZones(data: unknown): number {
  if (!Array.isArray(data)) return 0;

  const zones = new Set<string>();
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const zone = (row as { zone?: unknown }).zone;
    if (typeof zone !== 'string') continue;
    if (!POSITIONING_SECTION_ID_SET.has(zone)) continue;
    zones.add(zone);
  }

  return zones.size;
}

async function markParentCompleteWhenAllSectionsCommit(input: {
  supabase: SupabaseClient;
  parentAuditRunId: string;
  now: () => Date;
}): Promise<void> {
  const { data, error } = await input.supabase
    .from('research_artifact_sections')
    .select('zone')
    .eq('artifact_id', input.parentAuditRunId)
    .eq('status', 'complete')
    .in('zone', [...POSITIONING_SECTION_IDS]);

  if (error) {
    throw new SupabaseRunStoreError(
      `research_artifact_sections rollup read failed for parent_audit_run_id=${input.parentAuditRunId}: ${error.message}`,
    );
  }

  const childrenComplete = countCompletePositioningZones(data);
  if (childrenComplete < POSITIONING_SECTION_IDS.length) {
    return;
  }

  const { error: updateError } = await input.supabase
    .from('research_artifacts')
    .update({
      status: 'complete',
      children_total: POSITIONING_SECTION_IDS.length,
      children_complete: childrenComplete,
      updated_at: isoNow(input.now),
    })
    .eq('id', input.parentAuditRunId);

  if (updateError) {
    throw new SupabaseRunStoreError(
      `research_artifacts rollup update failed for parent_audit_run_id=${input.parentAuditRunId} children_complete=${childrenComplete}: ${updateError.message}`,
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

      const committed = await adapter.commitArtifactSection({
        artifactId: options.parentAuditRunId,
        zone: parsedArtifact.sectionId,
        sectionRunId,
        expectedRevision: context.expectedRevision,
        patch: buildCommitPatch(parsedArtifact.sectionId, parsedArtifact),
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
      const existingSection = record.sections[parsedArtifact.sectionId];
      const startedAt = existingSection?.startedAt ?? completedAt;
      const { error: telemetryError } = await options.supabase
        .from('research_section_runs')
        .update({
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

      await markParentCompleteWhenAllSectionsCommit({
        supabase: options.supabase,
        parentAuditRunId: options.parentAuditRunId,
        now,
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
