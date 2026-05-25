import type { SupabaseClient } from '@supabase/supabase-js';

import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import { createSupabaseWebhookAdapter } from '@/lib/managed-agents/supabase-adapter';
import { buildCommitPatch } from '@/lib/managed-agents/webhook-handler';
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
  activityEventSchema,
  sectionIds,
  type ActivityEvent,
  type SectionId,
} from '@/lib/lab-engine/events/activity-event';
import type { RunStore } from '@/lib/lab-engine/runs/run-store';

export interface CreateSupabaseRunStoreOptions {
  supabase: SupabaseClient;
  parentAuditRunId: string;
  sectionRunIdByZone: Record<PositioningSectionId, string>;
  researchInput: ResearchInput;
  now?: () => Date;
}

export class SupabaseRunStoreError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SupabaseRunStoreError';
  }
}

function isoNow(now: () => Date): string {
  return now().toISOString();
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

function createInitialRunRecord(input: ResearchInput, now: () => Date): RunRecord {
  const createdAt = isoNow(now);

  return runRecordSchema.parse({
    id: input.runId,
    fixtureId: input.fixtureId,
    source: 'live',
    status: 'idle',
    selectedSectionIds: sectionIds,
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
  sectionRunIdByZone: Record<PositioningSectionId, string>,
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

export function createSupabaseRunStore(
  options: CreateSupabaseRunStoreOptions,
): RunStore {
  const now = options.now ?? (() => new Date());
  const input = researchInputSchema.parse(options.researchInput);
  const adapter = createSupabaseWebhookAdapter(options.supabase);
  let record = createInitialRunRecord(input, now);

  return {
    createRun: async (researchInput: ResearchInput): Promise<RunRecord> => {
      const parsedInput = researchInputSchema.parse(researchInput);
      assertRunId(input.runId, parsedInput.runId, 'createRun');
      record = createInitialRunRecord(parsedInput, now);
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
        throw new SupabaseRunStoreError(
          `commit_artifact_section failed for ${parsedArtifact.sectionId} section_run_id=${sectionRunId} revision=${context.expectedRevision}: ${committed.error ?? 'conflict=' + String(committed.conflict)}`,
        );
      }

      const completedAt = isoNow(now);
      const existingSection = record.sections[parsedArtifact.sectionId];
      record = mergeSection(
        record,
        parsedArtifact.sectionId,
        {
          sectionId: parsedArtifact.sectionId,
          status: 'completed',
          artifact: parsedArtifact,
          startedAt: existingSection?.startedAt ?? null,
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
        .update({ status: 'running', started_at: startedAt })
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
      record = mergeSection(
        record,
        sectionId,
        {
          sectionId,
          status: 'failed',
          artifact: record.sections[sectionId]?.artifact ?? null,
          startedAt: record.sections[sectionId]?.startedAt ?? failedAt,
          completedAt: failedAt,
          error: errorMessage,
        },
        now,
      );
      return record;
    },
  };
}
