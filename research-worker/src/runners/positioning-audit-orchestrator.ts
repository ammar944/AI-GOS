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
import { composeAbortSignals } from '../agent-tools/_shared';
import type { SectionCapabilityGap, SectionToolBudget } from './section-context-pack';
import {
  DEFAULT_INITIAL_POSITIONING_EXECUTION_MODE,
  type PositioningExecutionMode,
} from './positioning-execution-mode';
import type {
  SectionPhase,
  SectionPhaseUpdate,
  SectionRuntimeTimings,
} from './section-phase';

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
  data?: unknown;
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
  /** Build the per-Section Context Pack string before the child runner starts. */
  buildSectionContext: (input: {
    parentAuditRunId: string;
    sectionRunId: string;
    zone: string;
    wave: number;
    concurrency: number;
    executionMode: PositioningExecutionMode;
  }) => Promise<{
    context: string;
    capabilityGaps: SectionCapabilityGap[];
    toolBudget: SectionToolBudget;
  }>;
  /** Persist compact phase state for the product read model. */
  updatePhase: (input: {
    parentAuditRunId: string;
    sectionRunId: string;
    zone: string;
  } & SectionPhaseUpdate) => Promise<void>;
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
    context: string;
    executionMode: PositioningExecutionMode;
    toolBudget: SectionToolBudget;
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
    executionMode: PositioningExecutionMode;
    signal: AbortSignal;
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
  executionMode?: PositioningExecutionMode;
  zones?: readonly string[];
  sectionTimeoutMs?: number;
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

const POSITIONING_DRAFT_TIMEOUT_MS = 180_000;
const POSITIONING_DEEP_TIMEOUT_MS = 240_000;
const POSITIONING_DRAFT_CONCURRENCY = 6;
const POSITIONING_DEEP_CONCURRENCY = 3;

function getWave(index: number, concurrency: number): number {
  return Math.floor(index / concurrency) + 1;
}

function getTotalWaves(total: number, concurrency: number): number {
  return Math.max(1, Math.ceil(total / concurrency));
}

function parseTimeoutMs(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getSectionTimeoutMs(mode: PositioningExecutionMode): number {
  return mode === 'draft'
    ? parseTimeoutMs(process.env.POSITIONING_DRAFT_TIMEOUT_MS, POSITIONING_DRAFT_TIMEOUT_MS)
    : parseTimeoutMs(process.env.POSITIONING_DEEP_TIMEOUT_MS, POSITIONING_DEEP_TIMEOUT_MS);
}

function getDefaultConcurrency(mode: PositioningExecutionMode): number {
  return mode === 'draft' ? POSITIONING_DRAFT_CONCURRENCY : POSITIONING_DEEP_CONCURRENCY;
}

function throwIfAborted(signal: AbortSignal, phase: SectionPhase): void {
  if (!signal.aborted) return;
  const reason = signal.reason;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : `Section aborted during ${phase}`;
  throw new Error(message);
}

function abortError(signal: AbortSignal, phase: SectionPhase): Error {
  const reason = signal.reason;
  if (reason instanceof Error) return reason;
  return new Error(
    typeof reason === 'string' ? reason : `Section aborted during ${phase}`,
  );
}

async function raceWithAbort<T>(
  work: Promise<T>,
  signal: AbortSignal,
  phase: SectionPhase,
): Promise<T> {
  if (signal.aborted) throw abortError(signal, phase);

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(abortError(signal, phase));
    };
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

function nestedRecord(
  value: unknown,
  key: string,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const child = record[key];
  if (!child || typeof child !== 'object' || Array.isArray(child)) return null;
  return child as Record<string, unknown>;
}

function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function phaseFromProgressPayload(payload: Record<string, unknown> | undefined): SectionPhase {
  const wrapper = nestedRecord(payload, 'event');
  const meta = nestedRecord(wrapper ?? payload, 'meta');
  const status = pickString(meta?.status);
  if (status === 'drafting') return 'Drafting';
  if (status === 'validating') return 'Validating';
  return 'Reading sources';
}

function latestToolFromProgressPayload(payload: Record<string, unknown> | undefined): string | null {
  const wrapper = nestedRecord(payload, 'event');
  const meta = nestedRecord(wrapper ?? payload, 'meta');
  const raw = meta?.toolNames;
  if (!Array.isArray(raw)) return null;
  const tool = raw.find((item): item is string => typeof item === 'string' && item.length > 0);
  return tool ?? null;
}

function latestActivityFromProgressPayload(payload: Record<string, unknown> | undefined): string | null {
  const wrapper = nestedRecord(payload, 'event');
  const meta = nestedRecord(wrapper ?? payload, 'meta');
  return (
    pickString(meta?.textPreview) ??
    pickString(wrapper?.message) ??
    pickString(payload?.message) ??
    null
  );
}

function statusFromProgressPayload(payload: Record<string, unknown> | undefined): string | null {
  const wrapper = nestedRecord(payload, 'event');
  const meta = nestedRecord(wrapper ?? payload, 'meta');
  return pickString(meta?.status);
}

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
  const executionMode =
    options.executionMode ?? DEFAULT_INITIAL_POSITIONING_EXECUTION_MODE;
  const concurrency = Math.max(
    1,
    options.concurrency ?? getDefaultConcurrency(executionMode),
  );
  const sectionTimeoutMs =
    options.sectionTimeoutMs ?? getSectionTimeoutMs(executionMode);
  const requestedZones = options.zones ? new Set(options.zones) : null;
  const semaphore = createSemaphore(concurrency);

  const all = await deps.loadChildren(options.parentAuditRunId);
  // Run only non-terminal children. Terminal ones are reflected as-is in
  // the rollup so reruns mid-flight don't redo work that's already complete.
  const eligible = all.filter(
    (c) =>
      !TERMINAL_STATES.has(c.status) &&
      (!requestedZones || requestedZones.has(c.zone)),
  );
  const totalWaves = getTotalWaves(eligible.length, concurrency);
  const waveBySectionRunId = new Map<string, number>();
  eligible.forEach((child, index) => {
    waveBySectionRunId.set(child.section_run_id, getWave(index, concurrency));
  });

  await Promise.all(
    eligible.map((child, index) =>
      deps.updatePhase({
        parentAuditRunId: options.parentAuditRunId,
        sectionRunId: child.section_run_id,
        zone: child.zone,
        phase: 'Queued',
        latestActivity: `Waiting for wave ${getWave(index, concurrency)} of ${totalWaves}`,
        nextStep: 'Compile Section Context Pack',
        wave: getWave(index, concurrency),
        totalWaves,
        concurrency,
        executionMode,
      }),
    ),
  );

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

    const parentAbortController = new AbortController();
    const timeoutController = new AbortController();
    const runtimeTimings: SectionRuntimeTimings = {};
    const stampRuntimeTiming = (key: keyof SectionRuntimeTimings): void => {
      if (!runtimeTimings[key]) runtimeTimings[key] = new Date().toISOString();
    };
    const runtimeTimingSnapshot = (): SectionRuntimeTimings => ({
      ...runtimeTimings,
    });
    const timeoutHandle = setTimeout(() => {
      stampRuntimeTiming('timeoutFiredAt');
      timeoutController.abort(
        new Error(
          `Section timed out after ${sectionTimeoutMs}ms in ${executionMode} mode`,
        ),
      );
    }, sectionTimeoutMs);
    const childSignal = composeAbortSignals([
      parentAbortController.signal,
      timeoutController.signal,
    ]);
    const onChildAbort = () => stampRuntimeTiming('abortSignalObservedAt');
    if (childSignal.aborted) onChildAbort();
    else childSignal.addEventListener('abort', onChildAbort, { once: true });
    const onParentAbort = () => parentAbortController.abort();
    if (options.parentAbortSignal) {
      if (options.parentAbortSignal.aborted) parentAbortController.abort();
      else options.parentAbortSignal.addEventListener('abort', onParentAbort);
    }
    let lastCompletedPhase: SectionPhase = 'Queued';

    try {
      // Cooperative parent-abort check before doing work.
      const parentAbortedNow =
        childSignal.aborted ||
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
      stampRuntimeTiming('sectionStartedAt');
      await deps.emitEvent({
        parentAuditRunId: options.parentAuditRunId,
        sectionRunId: child.section_run_id,
        zone: child.zone,
        type: 'started',
      });
      const wave = waveBySectionRunId.get(child.section_run_id) ?? 1;
      await deps.updatePhase({
        parentAuditRunId: options.parentAuditRunId,
        sectionRunId: child.section_run_id,
        zone: child.zone,
        phase: 'Compiling context',
        latestActivity: 'Building Section Context Pack',
        nextStep: 'Read source excerpts',
        wave,
        totalWaves,
        concurrency,
        executionMode,
        runtimeTimings: runtimeTimingSnapshot(),
      });
      lastCompletedPhase = 'Compiling context';

      let sectionContext: {
        context: string;
        capabilityGaps: SectionCapabilityGap[];
        toolBudget: SectionToolBudget;
      };
      try {
        sectionContext = await raceWithAbort(
          deps.buildSectionContext({
            parentAuditRunId: options.parentAuditRunId,
            sectionRunId: child.section_run_id,
            zone: child.zone,
            wave,
            concurrency,
            executionMode,
          }),
          childSignal,
          lastCompletedPhase,
        );
        throwIfAborted(childSignal, lastCompletedPhase);
      } catch (err) {
        const aborted = childSignal.aborted;
        const timedOut = timeoutController.signal.aborted;
        const message = err instanceof Error ? err.message : 'unknown error';
        await deps.emitEvent({
          parentAuditRunId: options.parentAuditRunId,
          sectionRunId: child.section_run_id,
          zone: child.zone,
          type: aborted ? 'aborted' : 'error',
          payload: {
            message,
            timeout: timedOut,
            lastCompletedPhase,
            executionMode,
            runtimeTimings: runtimeTimingSnapshot(),
          },
        });
        await deps.markChildTerminal(
          child.section_run_id,
          aborted && !timedOut ? 'aborted' : 'error',
          aborted && !timedOut
            ? null
            : {
                code: timedOut ? 'section_timeout' : undefined,
                message,
              },
        );
        stampRuntimeTiming('terminalStatusWrittenAt');
        await deps.updatePhase({
          parentAuditRunId: options.parentAuditRunId,
          sectionRunId: child.section_run_id,
          zone: child.zone,
          phase: 'Needs review',
          latestActivity: timedOut
            ? `Timed out after ${sectionTimeoutMs}ms; last phase: ${lastCompletedPhase}`
            : message,
          nextStep: 'Review error and retry section',
          wave,
          totalWaves,
          concurrency,
          capabilityGaps: [],
          executionMode,
          runtimeTimings: runtimeTimingSnapshot(),
        });
        childTerminalStatusBySectionRunId.set(
          child.section_run_id,
          aborted && !timedOut ? 'aborted' : 'error',
        );
        return;
      }

      try {
        const result = await raceWithAbort(
          deps.runSection({
            parentAuditRunId: options.parentAuditRunId,
            sectionRunId: child.section_run_id,
            zone: child.zone,
            context: sectionContext.context,
            executionMode,
            toolBudget: sectionContext.toolBudget,
            signal: childSignal,
            onProgress: async (type, payload) => {
              if (childSignal.aborted) return;
              const phase = phaseFromProgressPayload(payload);
              const progressStatus = statusFromProgressPayload(payload);
              if (phase === 'Drafting') stampRuntimeTiming('firstPartialAt');
              if (progressStatus === 'complete') stampRuntimeTiming('finalObjectAt');
              await deps.updatePhase({
                parentAuditRunId: options.parentAuditRunId,
                sectionRunId: child.section_run_id,
                zone: child.zone,
                phase,
                latestTool: latestToolFromProgressPayload(payload),
                latestActivity: latestActivityFromProgressPayload(payload),
                nextStep:
                  phase === 'Drafting'
                    ? 'Validate typed Artifact'
                    : phase === 'Validating'
                      ? 'Commit section Artifact'
                      : 'Draft typed Artifact',
                wave,
                totalWaves,
                concurrency,
                capabilityGaps: sectionContext.capabilityGaps,
                executionMode,
                runtimeTimings: runtimeTimingSnapshot(),
              });
              lastCompletedPhase = phase;
              await deps.emitEvent({
                parentAuditRunId: options.parentAuditRunId,
                sectionRunId: child.section_run_id,
                zone: child.zone,
                type,
                payload,
              });
            },
          }),
          childSignal,
          lastCompletedPhase,
        );

        if (result.status === 'complete') {
          stampRuntimeTiming('finalObjectAt');
          stampRuntimeTiming('validationCompleteAt');
          throwIfAborted(childSignal, lastCompletedPhase);
          stampRuntimeTiming('commitStartedAt');
          await raceWithAbort(
            deps.commitSection({
              parentAuditRunId: options.parentAuditRunId,
              sectionRunId: child.section_run_id,
              zone: child.zone,
              result,
              executionMode,
              signal: childSignal,
            }),
            childSignal,
            'Committed',
          );
          stampRuntimeTiming('commitCompleteAt');
          throwIfAborted(childSignal, 'Committed');
          await deps.emitEvent({
            parentAuditRunId: options.parentAuditRunId,
            sectionRunId: child.section_run_id,
            zone: child.zone,
            type: 'complete',
          });
          await deps.markChildTerminal(child.section_run_id, 'complete');
          stampRuntimeTiming('terminalStatusWrittenAt');
          await deps.updatePhase({
            parentAuditRunId: options.parentAuditRunId,
            sectionRunId: child.section_run_id,
            zone: child.zone,
            phase:
              sectionContext.capabilityGaps.length > 0
                ? 'Needs review'
                : 'Committed',
            latestActivity:
              sectionContext.capabilityGaps.length > 0
                ? 'Section committed with capability gaps'
                : 'Section committed',
            nextStep: null,
            wave,
            totalWaves,
            concurrency,
            capabilityGaps: sectionContext.capabilityGaps,
            executionMode,
            runtimeTimings: runtimeTimingSnapshot(),
          });
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
          stampRuntimeTiming('terminalStatusWrittenAt');
          await deps.updatePhase({
            parentAuditRunId: options.parentAuditRunId,
            sectionRunId: child.section_run_id,
            zone: child.zone,
            phase: 'Needs review',
            latestActivity: result.error?.message ?? 'Section failed',
            nextStep: 'Review error and retry section',
            wave,
            totalWaves,
            concurrency,
            capabilityGaps: sectionContext.capabilityGaps,
            executionMode,
            runtimeTimings: runtimeTimingSnapshot(),
          });
          childTerminalStatusBySectionRunId.set(child.section_run_id, 'error');
        }
      } catch (err) {
        const aborted = childSignal.aborted;
        const timedOut = timeoutController.signal.aborted;
        const message =
          err instanceof Error ? err.message : 'unknown error';
        await deps.emitEvent({
          parentAuditRunId: options.parentAuditRunId,
          sectionRunId: child.section_run_id,
          zone: child.zone,
          type: aborted ? 'aborted' : 'error',
          payload: {
            message,
            timeout: timedOut,
            lastCompletedPhase,
            executionMode,
            runtimeTimings: runtimeTimingSnapshot(),
          },
        });
        await deps.markChildTerminal(
          child.section_run_id,
          aborted && !timedOut ? 'aborted' : 'error',
          aborted && !timedOut
            ? null
            : {
                code: timedOut ? 'section_timeout' : undefined,
                message,
              },
        );
        stampRuntimeTiming('terminalStatusWrittenAt');
        await deps.updatePhase({
          parentAuditRunId: options.parentAuditRunId,
          sectionRunId: child.section_run_id,
          zone: child.zone,
          phase: 'Needs review',
          latestActivity: timedOut
            ? `Timed out after ${sectionTimeoutMs}ms; last phase: ${lastCompletedPhase}`
            : message,
          nextStep: 'Review error and retry section',
          wave,
          totalWaves,
          concurrency,
          capabilityGaps: sectionContext.capabilityGaps,
          executionMode,
          runtimeTimings: runtimeTimingSnapshot(),
        });
        childTerminalStatusBySectionRunId.set(
          child.section_run_id,
          aborted && !timedOut ? 'aborted' : 'error',
        );
      }
    } finally {
      if (options.parentAbortSignal) {
        options.parentAbortSignal.removeEventListener('abort', onParentAbort);
      }
      childSignal.removeEventListener('abort', onChildAbort);
      clearTimeout(timeoutHandle);
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
