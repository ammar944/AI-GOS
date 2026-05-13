// Phase 2 of the orchestrator + artifact UI cycle.
//
// `runPositioningAuditOrchestrator` is the parent runner that drives all six
// positioning section subagents under a single audit run. It replaces the
// browser-side Promise.allSettled fan-out: instead of the UI dispatching six
// independent /run jobs, the frontend hits POST /api/research-v2/orchestrate
// which queues a parent + six children, then this orchestrator picks them up
// and runs them with bounded concurrency.
//
// The pure orchestration loop accepts dependencies so it can be unit-tested
// without standing up Supabase or Anthropic. The express route (in index.ts)
// wires the real deps and exposes POST /orchestrate.

import { createSemaphore } from '../utils/semaphore';

/** Terminal status values for a section child run. */
export type ChildTerminalStatus = 'complete' | 'error' | 'aborted';

/** Parent terminal status rolled up from the children. */
export type ParentTerminalStatus =
  | 'complete'
  | 'partial'
  | 'error'
  | 'aborted';

export interface ChildRow {
  section_run_id: string;
  zone: string;
  /** Includes 'queued' | 'running' | terminal. Only non-terminal rows are run. */
  status: string;
}

export interface SectionRunResult {
  status: 'complete' | 'error';
  markdown?: string;
  title?: string;
  claims?: unknown[];
  sources?: unknown[];
  error?: { code?: string; message: string } | null;
}

export type OrchestratorEventType =
  | 'started'
  | 'searching'
  | 'partial'
  | 'complete'
  | 'error'
  | 'aborted';

export interface OrchestratorDeps {
  /** Load every child section_run for the parent (any status). */
  loadChildren: (parentAuditRunId: string) => Promise<ChildRow[]>;
  /** Transition a child from queued → running. Idempotent. */
  markChildRunning: (sectionRunId: string) => Promise<void>;
  /** Persist a terminal status on a child. */
  markChildTerminal: (
    sectionRunId: string,
    status: ChildTerminalStatus,
    error?: { code?: string; message: string } | null,
  ) => Promise<void>;
  /** Run one section subagent. Throws on transient infra error. */
  runSection: (input: {
    parentAuditRunId: string;
    sectionRunId: string;
    zone: string;
    signal: AbortSignal;
    onProgress: (
      type: 'searching' | 'partial',
      payload?: Record<string, unknown>,
    ) => Promise<void>;
  }) => Promise<SectionRunResult>;
  /** Commit a complete section into research_artifact_sections. */
  commitSection: (input: {
    parentAuditRunId: string;
    sectionRunId: string;
    zone: string;
    result: SectionRunResult;
  }) => Promise<void>;
  /** Emit a row into research_section_events. Best-effort. */
  emitEvent: (input: {
    parentAuditRunId: string;
    sectionRunId: string;
    zone: string;
    type: OrchestratorEventType;
    payload?: Record<string, unknown>;
  }) => Promise<void>;
  /** Update parent rollup (status, children_complete). */
  rollupParent: (input: {
    parentAuditRunId: string;
    status: ParentTerminalStatus | 'running';
    children_complete: number;
  }) => Promise<void>;
  /**
   * Returns true if an explicit parent-level abort was requested.
   * The orchestrator polls this between section starts so aborts propagate
   * cooperatively to in-flight runners via their AbortSignal.
   */
  isParentAborted: (parentAuditRunId: string) => Promise<boolean>;
}

export interface OrchestratorOptions {
  parentAuditRunId: string;
  concurrency?: number;
  parentAbortSignal?: AbortSignal;
}

export interface OrchestratorResult {
  status: ParentTerminalStatus;
  per_child: Array<{ section_run_id: string; zone: string; status: ChildTerminalStatus }>;
}

const TERMINAL_STATES: ReadonlySet<string> = new Set([
  'complete',
  'error',
  'aborted',
]);

function rollupStatus(
  parentAborted: boolean,
  terminals: ChildTerminalStatus[],
): ParentTerminalStatus {
  if (parentAborted) return 'aborted';
  const completes = terminals.filter((t) => t === 'complete').length;
  const errors = terminals.filter((t) => t === 'error').length;
  const aborts = terminals.filter((t) => t === 'aborted').length;
  if (completes === terminals.length) return 'complete';
  if (errors === terminals.length) return 'error';
  if (aborts > 0 && completes === 0 && errors === 0) return 'aborted';
  return 'partial';
}

export async function runPositioningAuditOrchestrator(
  options: OrchestratorOptions,
  deps: OrchestratorDeps,
): Promise<OrchestratorResult> {
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const semaphore = createSemaphore(concurrency);

  const all = await deps.loadChildren(options.parentAuditRunId);
  // Run only non-terminal children. Terminal ones are reflected as-is in
  // the rollup so reruns mid-flight don't redo work that's already complete.
  const eligible = all.filter((c) => !TERMINAL_STATES.has(c.status));

  const childTerminalStatusBySectionRunId = new Map<string, ChildTerminalStatus>();
  // Pre-fill terminals from the DB so the rollup includes them.
  for (const c of all) {
    if (TERMINAL_STATES.has(c.status)) {
      childTerminalStatusBySectionRunId.set(
        c.section_run_id,
        c.status as ChildTerminalStatus,
      );
    }
  }

  let runningCount = 0;
  let peakRunning = 0;
  const peakChecks: number[] = [];

  async function runOneChild(child: ChildRow): Promise<void> {
    const release = await semaphore.acquire();
    runningCount += 1;
    if (runningCount > peakRunning) peakRunning = runningCount;
    peakChecks.push(runningCount);

    const childAbortController = new AbortController();
    const onParentAbort = () => childAbortController.abort();
    if (options.parentAbortSignal) {
      if (options.parentAbortSignal.aborted) childAbortController.abort();
      else options.parentAbortSignal.addEventListener('abort', onParentAbort);
    }

    try {
      // Cooperative parent-abort check before doing work.
      const parentAbortedNow =
        childAbortController.signal.aborted ||
        (await deps.isParentAborted(options.parentAuditRunId));
      if (parentAbortedNow) {
        await deps.emitEvent({
          parentAuditRunId: options.parentAuditRunId,
          sectionRunId: child.section_run_id,
          zone: child.zone,
          type: 'aborted',
        });
        await deps.markChildTerminal(child.section_run_id, 'aborted');
        childTerminalStatusBySectionRunId.set(child.section_run_id, 'aborted');
        return;
      }

      await deps.markChildRunning(child.section_run_id);
      await deps.emitEvent({
        parentAuditRunId: options.parentAuditRunId,
        sectionRunId: child.section_run_id,
        zone: child.zone,
        type: 'started',
      });

      try {
        const result = await deps.runSection({
          parentAuditRunId: options.parentAuditRunId,
          sectionRunId: child.section_run_id,
          zone: child.zone,
          signal: childAbortController.signal,
          onProgress: (type, payload) =>
            deps.emitEvent({
              parentAuditRunId: options.parentAuditRunId,
              sectionRunId: child.section_run_id,
              zone: child.zone,
              type,
              payload,
            }),
        });

        if (result.status === 'complete') {
          await deps.commitSection({
            parentAuditRunId: options.parentAuditRunId,
            sectionRunId: child.section_run_id,
            zone: child.zone,
            result,
          });
          await deps.emitEvent({
            parentAuditRunId: options.parentAuditRunId,
            sectionRunId: child.section_run_id,
            zone: child.zone,
            type: 'complete',
          });
          await deps.markChildTerminal(child.section_run_id, 'complete');
          childTerminalStatusBySectionRunId.set(child.section_run_id, 'complete');
        } else {
          await deps.emitEvent({
            parentAuditRunId: options.parentAuditRunId,
            sectionRunId: child.section_run_id,
            zone: child.zone,
            type: 'error',
            payload: result.error
              ? { code: result.error.code, message: result.error.message }
              : undefined,
          });
          await deps.markChildTerminal(
            child.section_run_id,
            'error',
            result.error ?? null,
          );
          childTerminalStatusBySectionRunId.set(child.section_run_id, 'error');
        }
      } catch (err) {
        const aborted = childAbortController.signal.aborted;
        const message =
          err instanceof Error ? err.message : 'unknown error';
        await deps.emitEvent({
          parentAuditRunId: options.parentAuditRunId,
          sectionRunId: child.section_run_id,
          zone: child.zone,
          type: aborted ? 'aborted' : 'error',
          payload: { message },
        });
        await deps.markChildTerminal(
          child.section_run_id,
          aborted ? 'aborted' : 'error',
          aborted ? null : { message },
        );
        childTerminalStatusBySectionRunId.set(
          child.section_run_id,
          aborted ? 'aborted' : 'error',
        );
      }
    } finally {
      if (options.parentAbortSignal) {
        options.parentAbortSignal.removeEventListener('abort', onParentAbort);
      }
      runningCount -= 1;
      release();
    }
  }

  // Kick off all eligible children — the semaphore bounds true concurrency.
  await Promise.all(eligible.map((c) => runOneChild(c)));

  const terminals: ChildTerminalStatus[] = [];
  for (const child of all) {
    const term = childTerminalStatusBySectionRunId.get(child.section_run_id);
    if (term) terminals.push(term);
  }

  const parentAborted =
    options.parentAbortSignal?.aborted ??
    (await deps.isParentAborted(options.parentAuditRunId).catch(() => false));

  const rollup = rollupStatus(parentAborted, terminals);
  const childrenComplete = terminals.filter((t) => t === 'complete').length;

  await deps.rollupParent({
    parentAuditRunId: options.parentAuditRunId,
    status: rollup,
    children_complete: childrenComplete,
  });

  return {
    status: rollup,
    per_child: all
      .map((c) => {
        const term = childTerminalStatusBySectionRunId.get(c.section_run_id);
        return term
          ? { section_run_id: c.section_run_id, zone: c.zone, status: term }
          : null;
      })
      .filter((v): v is { section_run_id: string; zone: string; status: ChildTerminalStatus } => v !== null),
  };
}

/** Exported for tests so the rollup table is asserted directly. */
export const __testing__ = { rollupStatus };
