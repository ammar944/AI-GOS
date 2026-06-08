// Client hook: polls /api/research-v2/audit-state every POLL_MS while the
// run has any non-terminal worker. Stops polling once every chip is terminal
// so an idle page doesn't burn API calls.

'use client';

import { useEffect, useRef, useState } from 'react';

import type { AuditStateResponse, WorkerStatus } from '@/app/api/research-v2/audit-state/route';
import {
  CROSS_SECTION_REASONING_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
} from '@/lib/ai/prompts/positioning-skills';

const POLL_MS = 2500;
const TERMINAL: ReadonlySet<WorkerStatus> = new Set(['complete', 'error', 'aborted']);

const EMPTY: AuditStateResponse = {
  parent_audit_run_id: null,
  parent_status: null,
  children_complete: 0,
  children_total: 0,
  workerStates: [],
  sectionsByZone: {},
  eventsByZone: {},
};

function hasSixPositioningSectionsComplete(state: AuditStateResponse): boolean {
  if (state.children_complete >= POSITIONING_SECTION_IDS.length) {
    return true;
  }

  return POSITIONING_SECTION_IDS.every((sectionId) => {
    const worker = state.workerStates.find(
      (workerState) => workerState.section_id === sectionId,
    );
    return (
      worker?.status === 'complete' ||
      state.sectionsByZone[sectionId] !== undefined
    );
  });
}

function hasPaidMediaPlanStarted(state: AuditStateResponse): boolean {
  return (
    state.sectionsByZone[PAID_MEDIA_PLAN_SECTION_ID] !== undefined ||
    state.workerStates.some(
      (workerState) => workerState.section_id === PAID_MEDIA_PLAN_SECTION_ID,
    )
  );
}

function hasCrossSectionReasoningStarted(state: AuditStateResponse): boolean {
  return (
    state.sectionsByZone[CROSS_SECTION_REASONING_SECTION_ID] !== undefined ||
    state.workerStates.some(
      (workerState) => workerState.section_id === CROSS_SECTION_REASONING_SECTION_ID,
    )
  );
}

function isCrossSectionReasoningComplete(state: AuditStateResponse): boolean {
  const worker = state.workerStates.find(
    (workerState) => workerState.section_id === CROSS_SECTION_REASONING_SECTION_ID,
  );

  return (
    state.sectionsByZone[CROSS_SECTION_REASONING_SECTION_ID] !== undefined ||
    worker?.status === 'complete'
  );
}

function isCrossSectionReasoningTerminal(state: AuditStateResponse): boolean {
  const worker = state.workerStates.find(
    (workerState) => workerState.section_id === CROSS_SECTION_REASONING_SECTION_ID,
  );

  return (
    state.sectionsByZone[CROSS_SECTION_REASONING_SECTION_ID] !== undefined ||
    (worker !== undefined && TERMINAL.has(worker.status))
  );
}

function isPaidMediaPlanTerminal(state: AuditStateResponse): boolean {
  const paidMediaWorker = state.workerStates.find(
    (workerState) => workerState.section_id === PAID_MEDIA_PLAN_SECTION_ID,
  );

  return (
    state.sectionsByZone[PAID_MEDIA_PLAN_SECTION_ID] !== undefined ||
    (paidMediaWorker !== undefined && TERMINAL.has(paidMediaWorker.status))
  );
}

// Thrown by the dispatch helpers when the worker returns a non-ok status, so
// the caller can branch on the HTTP code (409 = transient race vs 5xx = real).
class DispatchHttpError extends Error {
  status: number;
  errorCode: string | null;
  constructor(status: number, message: string, errorCode: string | null) {
    super(message);
    this.name = 'DispatchHttpError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readDispatchErrorCode(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  const payload = (await response.json()) as unknown;
  return isRecord(payload) && typeof payload.error === 'string'
    ? payload.error
    : null;
}

async function throwIfDispatchFailed({
  label,
  response,
  runId,
}: {
  label: string;
  response: Response;
  runId: string;
}): Promise<void> {
  if (response.ok) {
    return;
  }

  throw new DispatchHttpError(
    response.status,
    `${label} dispatch failed for runId=${runId} status=${response.status}`,
    await readDispatchErrorCode(response),
  );
}

async function dispatchPaidMediaPlan(
  runId: string,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/research-v2/run-lab-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      run_id: runId,
      section_id: PAID_MEDIA_PLAN_SECTION_ID,
    }),
    signal,
  });

  await throwIfDispatchFailed({ label: 'Paid media plan', response, runId });
}

async function dispatchCrossSectionReasoning(
  runId: string,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/research-v2/run-lab-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      run_id: runId,
      section_id: CROSS_SECTION_REASONING_SECTION_ID,
    }),
    signal,
  });

  await throwIfDispatchFailed({
    label: 'Cross-section reasoning',
    response,
    runId,
  });
}

function hasPositioningSynthesisStarted(state: AuditStateResponse): boolean {
  return (
    state.sectionsByZone[POSITIONING_SYNTHESIS_SECTION_ID] !== undefined ||
    state.workerStates.some(
      (workerState) => workerState.section_id === POSITIONING_SYNTHESIS_SECTION_ID,
    )
  );
}

function isPositioningSynthesisTerminal(state: AuditStateResponse): boolean {
  const synthesisWorker = state.workerStates.find(
    (workerState) => workerState.section_id === POSITIONING_SYNTHESIS_SECTION_ID,
  );

  return (
    state.sectionsByZone[POSITIONING_SYNTHESIS_SECTION_ID] !== undefined ||
    (synthesisWorker !== undefined && TERMINAL.has(synthesisWorker.status))
  );
}

async function dispatchPositioningSynthesis(
  runId: string,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/research-v2/run-lab-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      run_id: runId,
      section_id: POSITIONING_SYNTHESIS_SECTION_ID,
    }),
    signal,
  });

  await throwIfDispatchFailed({ label: 'Positioning synthesis', response, runId });
}

// Quietly swallow the benign rejections we get when a dispatch fetch is
// aborted on unmount / runId change / StrictMode double-mount: AbortError, or
// a TypeError/DOMException with an empty message. 409 = transient
// corpus/sections-not-ready race → console.debug (self-heals). Anything else
// stays a real console.error so genuine 5xx failures stay visible.
function logDispatchError(label: string, runId: string, error: unknown): void {
  const aborted =
    (error instanceof Error && error.name === 'AbortError') ||
    !(error instanceof Error) ||
    error.message === '';
  if (aborted) {
    return;
  }

  if (error instanceof DispatchHttpError && error.status === 409) {
    console.debug(`[use-audit-state] ${label} not ready yet (409, retrying)`, {
      runId,
    });
    return;
  }

  console.error(`[use-audit-state] ${label} dispatch failed`, {
    runId,
    message: error.message,
  });
}

export function useAuditState(
  runId: string,
  refreshKey = 0,
): AuditStateResponse {
  const [state, setState] = useState<AuditStateResponse>(EMPTY);
  const cancelled = useRef(false);
  const dispatchedCrossSectionReasoningRunIds = useRef<Set<string>>(new Set());
  const dispatchedMediaPlanRunIds = useRef<Set<string>>(new Set());
  const dispatchedSynthesisRunIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    cancelled.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Aborts any in-flight dispatch fetch on unmount / runId change so it can't
    // reject with an empty-message DOMException after the effect tears down.
    const dispatchAbort = new AbortController();

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/research-v2/audit-state?run_id=${encodeURIComponent(runId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          schedule();
          return;
        }
        const next = (await res.json()) as AuditStateResponse;
        if (cancelled.current) return;
        setState(next);

        const sixComplete = hasSixPositioningSectionsComplete(next);
        const crossSectionReasoningComplete =
          isCrossSectionReasoningComplete(next);

        const shouldDispatchCrossSectionReasoning =
          sixComplete &&
          !hasCrossSectionReasoningStarted(next) &&
          !dispatchedCrossSectionReasoningRunIds.current.has(runId);
        if (shouldDispatchCrossSectionReasoning) {
          dispatchedCrossSectionReasoningRunIds.current.add(runId);
          try {
            await dispatchCrossSectionReasoning(runId, dispatchAbort.signal);
          } catch (error) {
            dispatchedCrossSectionReasoningRunIds.current.delete(runId);
            logDispatchError('cross-section reasoning', runId, error);
          }
        }

        // Synthesis and paid media gate on the thinker stage, not just 6/6.
        // They still dispatch in parallel once the cross-section reasoning
        // artifact commits.
        const shouldDispatchPaidMediaPlan =
          crossSectionReasoningComplete &&
          !hasPaidMediaPlanStarted(next) &&
          !dispatchedMediaPlanRunIds.current.has(runId);
        if (shouldDispatchPaidMediaPlan) {
          dispatchedMediaPlanRunIds.current.add(runId);
          try {
            await dispatchPaidMediaPlan(runId, dispatchAbort.signal);
          } catch (error) {
            dispatchedMediaPlanRunIds.current.delete(runId);
            logDispatchError('paid media plan', runId, error);
          }
        }

        const shouldDispatchSynthesis =
          crossSectionReasoningComplete &&
          !hasPositioningSynthesisStarted(next) &&
          !dispatchedSynthesisRunIds.current.has(runId);
        if (shouldDispatchSynthesis) {
          dispatchedSynthesisRunIds.current.add(runId);
          try {
            await dispatchPositioningSynthesis(runId, dispatchAbort.signal);
          } catch (error) {
            dispatchedSynthesisRunIds.current.delete(runId);
            logDispatchError('positioning synthesis', runId, error);
          }
        }

        if (
          shouldDispatchCrossSectionReasoning ||
          shouldDispatchPaidMediaPlan ||
          shouldDispatchSynthesis
        ) {
          schedule();
          return;
        }

        const allTerminal =
          next.workerStates.length > 0 &&
          next.workerStates.every((w) => TERMINAL.has(w.status));
        const waitingForPostSix =
          sixComplete &&
          (!isCrossSectionReasoningTerminal(next) ||
            (crossSectionReasoningComplete &&
              (!isPaidMediaPlanTerminal(next) ||
                !isPositioningSynthesisTerminal(next))));
        if (!allTerminal || waitingForPostSix) schedule();
      } catch {
        schedule();
      }
    };

    const schedule = () => {
      if (cancelled.current) return;
      timer = setTimeout(tick, POLL_MS);
    };

    void tick();

    return () => {
      cancelled.current = true;
      if (timer) clearTimeout(timer);
      dispatchAbort.abort();
    };
  }, [refreshKey, runId]);

  return state;
}
