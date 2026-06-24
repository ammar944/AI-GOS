import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { RunRecord } from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  activityEventSchema,
  type ActivityEvent,
} from '@/lib/lab-engine/events/activity-event';
import {
  prepareSectionContext,
  runSection,
  type PreparedSectionContext,
  type RunSectionDeps,
  type RunSectionInput,
  type RunSectionResult,
} from '@/lib/lab-engine/agents/run-section';
import type { EvidencePoolStore } from '@/lib/lab-engine/evidence/evidence-pool';
import type { ResearchFactStore } from '@/lib/lab-engine/evidence/research-fact';
import type { RunStore } from '@/lib/lab-engine/runs/run-store';
import {
  isSupportedSectionId,
  type SupportedSectionId,
} from '@/lib/lab-engine/sections/section-registry';
import { withGtmStrategicStandardPreamble } from '@/lib/lab-engine/skills/gtm-strategic-standard';
import { SupabaseRunStoreCommitConflictError } from '@/lib/research-v2/supabase-run-store';

export type LabRunSection = (
  input: RunSectionInput,
  deps: RunSectionDeps,
) => Promise<RunSectionResult>;

export interface RunLabSectionJobInput {
  runId: string;
  sectionId: SupportedSectionId;
  signal?: AbortSignal;
  deadlineAt?: number;
  store: RunStore;
  evidencePoolStore?: EvidencePoolStore;
  factStore?: ResearchFactStore;
  parentAuditRunId?: string;
  preparedContext?: PreparedSectionContext;
  runSectionImpl?: LabRunSection;
  now?: () => Date;
  newId?: () => string;
}

export async function runLabSectionJob(
  input: RunLabSectionJobInput,
): Promise<void> {
  const sectionId = toSupportedSectionId(input.sectionId);
  const runSectionImpl = input.runSectionImpl ?? runSection;

  if (input.signal?.aborted === true) {
    await recordJobFailure({
      input,
      message: getAbortReasonMessage(input.signal),
      sectionId,
    });
    return;
  }

  try {
    const preparedContext =
      input.preparedContext ??
      (await prepareSectionContext(
        {
          runId: input.runId,
          sectionId,
        },
        {
          store: input.store,
          // Defense-in-depth: the dispatch pre-builds preparedContext today, so
          // this fallback rarely fires — but when it does, thread the ledger
          // read path so factRows are populated even without a pre-built ctx.
          ...(input.factStore === undefined
            ? {}
            : { factStore: input.factStore }),
          ...(input.parentAuditRunId === undefined
            ? {}
            : { parentAuditRunId: input.parentAuditRunId }),
        },
      ));
    const sectionPromise = runSectionImpl(
      {
        runId: input.runId,
        sectionId,
        signal: input.signal,
        ...(input.deadlineAt === undefined ? {} : { deadlineAt: input.deadlineAt }),
      },
      {
        store: input.store,
        loadSkill: loadLabSkill,
        allowedTools: getLabEngineAllowedTools(),
        preparedContext,
        ...(input.evidencePoolStore === undefined
          ? {}
          : { evidencePoolStore: input.evidencePoolStore }),
        ...(input.factStore === undefined
          ? {}
          : { factStore: input.factStore }),
        ...(input.parentAuditRunId === undefined
          ? {}
          : { parentAuditRunId: input.parentAuditRunId }),
      },
    );
    await withAbortSignal(
      sectionPromise,
      input.signal,
    );
  } catch (err) {
    // Non-fatal CAS loss (layer 2): a duplicate dispatch can produce a second
    // runLabSectionJob for the same section_run_id. The loser of the
    // compare-and-swap throws a commit conflict AFTER a sibling already
    // committed the artifact (revision advanced past 0). That is a benign
    // sibling-win, not a section failure — swallow it so it never surfaces as a
    // false section-failed. An aborted/locked conflict reports committedRevision
    // = -1 and stays fatal (a deliberate rerun aborts the prior run first, so
    // its conflict must remain terminal and re-runnable).
    if (
      err instanceof SupabaseRunStoreCommitConflictError &&
      err.conflict &&
      err.committedRevision > 0
    ) {
      console.info('[lab-section-job] lost CAS to sibling, section already committed', {
        runId: input.runId,
        sectionId,
        committedRevision: err.committedRevision,
      });
      return;
    }

    const message = getErrorMessage(err);
    console.error('[lab-section-job] section failed', {
      runId: input.runId,
      sectionId,
      message,
    });
    await recordJobFailure({
      input,
      message,
      sectionId,
    });
  }
}

function toSupportedSectionId(sectionId: SupportedSectionId): SupportedSectionId {
  if (!isSupportedSectionId(sectionId)) {
    throw new Error(`Unsupported lab section id ${sectionId}`);
  }

  return sectionId;
}

function getLabEngineAllowedTools(): RunSectionDeps['allowedTools'] {
  return process.env.LAB_ENGINE_LIVE_TOOLS === 'false' ? [] : undefined;
}

async function loadLabSkill(slug: string): Promise<string> {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`Invalid lab skill slug ${slug}`);
  }

  const skillPath = join(
    process.cwd(),
    'src',
    'lib',
    'lab-engine',
    'skills',
    slug,
    'SKILL.md',
  );

  const skillMd = await readFile(skillPath, 'utf8');

  return withGtmStrategicStandardPreamble(skillMd);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function withAbortSignal<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (signal === undefined) {
    return promise;
  }

  let abortListener: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    abortListener = (): void => {
      reject(signal.reason);
    };
    signal.addEventListener('abort', abortListener, { once: true });
  });

  abortPromise.catch((): void => undefined);

  try {
    return await Promise.race([promise, abortPromise]);
  } catch (err) {
    if (signal.aborted) {
      void promise.catch((): void => undefined);
    }
    throw err;
  } finally {
    if (abortListener !== undefined) {
      signal.removeEventListener('abort', abortListener);
    }
  }
}

function getAbortReasonMessage(signal: AbortSignal): string {
  if (signal.reason !== undefined) {
    return getErrorMessage(signal.reason);
  }

  return 'section signal aborted';
}

function createSectionFailedEvent({
  input,
  message,
  sectionId,
}: {
  input: RunLabSectionJobInput;
  message: string;
  sectionId: SupportedSectionId;
}): ActivityEvent {
  return activityEventSchema.parse({
    id: (input.newId ?? randomUUID)(),
    runId: input.runId,
    sectionId,
    type: 'section-failed',
    message: `Lab section ${sectionId} failed`,
    createdAt: (input.now ?? (() => new Date()))().toISOString(),
    metadata: { error: message },
  });
}

async function recordJobFailure({
  input,
  message,
  sectionId,
}: {
  input: RunLabSectionJobInput;
  message: string;
  sectionId: SupportedSectionId;
}): Promise<void> {
  const existingRecord = await readRunForFailureState({
    input,
    sectionId,
  });
  const failureEventExists =
    existingRecord?.events.some(
      (event): boolean =>
        event.type === 'section-failed' && event.sectionId === sectionId,
    ) ?? false;
  const sectionAlreadyFailed =
    existingRecord?.sections[sectionId]?.status === 'failed';

  if (!failureEventExists) {
    await input.store.appendEvent(
      input.runId,
      createSectionFailedEvent({ input, message, sectionId }),
    );
  }

  if (!sectionAlreadyFailed) {
    await input.store.markSectionFailed(input.runId, sectionId, message);
  }
}

async function readRunForFailureState({
  input,
  sectionId,
}: {
  input: RunLabSectionJobInput;
  sectionId: SupportedSectionId;
}): Promise<RunRecord | null> {
  try {
    return await input.store.readRun(input.runId);
  } catch (err) {
    console.warn('[lab-section-job] run read failed before terminal failure write', {
      runId: input.runId,
      sectionId,
      message: getErrorMessage(err),
    });
    return null;
  }
}
