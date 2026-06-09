// Client hook: polls /api/research-v2/audit-state every POLL_MS while the
// run has any non-terminal worker. Stops polling once every chip is terminal
// so an idle page doesn't burn API calls.

'use client';

import { useEffect, useRef, useState } from 'react';

import type { AuditStateResponse, WorkerStatus } from '@/app/api/research-v2/audit-state/route';
import {
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';

const POLL_MS = 2500;
const TERMINAL: ReadonlySet<WorkerStatus> = new Set(['complete', 'error', 'aborted']);
// Bounded client-side retry for a paid-media row that committed as `error`. Cap
// is per-runId: a deterministic failure (e.g. a schema the model can't fill)
// must stop after this many re-dispatches so we never loop a paid-API call. The
// server fans out paid-media off 6/6 once; this only re-fires on an observed
// `error` row, and claimSectionRun CAS dedups.
const CAPSTONE_ERROR_RETRY_CAP = 1;

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

// A capstone row that committed as `error` and has no artifact in
// sectionsByZone is eligible for a bounded re-dispatch: the prior attempt
// genuinely failed (timeout / decode), so re-firing is not a duplicate.
function isSectionErrored(
  state: AuditStateResponse,
  sectionId: AllPositioningSectionId,
): boolean {
  if (state.sectionsByZone[sectionId] !== undefined) {
    return false;
  }
  const worker = state.workerStates.find(
    (workerState) => workerState.section_id === sectionId,
  );
  return worker?.status === 'error';
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
  const dispatchedMediaPlanRunIds = useRef<Set<string>>(new Set());
  // Per-runId count of how many times we've re-dispatched an `error` paid-media
  // row. Bounded by CAPSTONE_ERROR_RETRY_CAP so a deterministic failure stops.
  const mediaPlanErrorRetryCounts = useRef<Map<string, number>>(new Map());

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

        // W3-A pure-lean: paid-media dispatches directly off the 6/6 rollup.
        // The server-side onJobComplete on the sixth core-section commit is the
        // autonomous trigger (survives a closed tab); this client poll is the
        // CAS-guarded fallback when a tab is open. claimSectionRun de-dupes the
        // double-trigger.
        //
        // A committed `error` row latches hasPaidMediaPlanStarted=true forever.
        // Under the cap, treat it as retriable: re-open the guard and bump the
        // counter so the bounded re-dispatch fires exactly cap more times.
        const paidMediaRetriableError =
          sixComplete &&
          isSectionErrored(next, PAID_MEDIA_PLAN_SECTION_ID) &&
          (mediaPlanErrorRetryCounts.current.get(runId) ?? 0) <
            CAPSTONE_ERROR_RETRY_CAP;
        if (paidMediaRetriableError) {
          mediaPlanErrorRetryCounts.current.set(
            runId,
            (mediaPlanErrorRetryCounts.current.get(runId) ?? 0) + 1,
          );
          dispatchedMediaPlanRunIds.current.delete(runId);
        }

        const shouldDispatchPaidMediaPlan =
          sixComplete &&
          (paidMediaRetriableError || !hasPaidMediaPlanStarted(next)) &&
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

        if (shouldDispatchPaidMediaPlan) {
          schedule();
          return;
        }

        const allTerminal =
          next.workerStates.length > 0 &&
          next.workerStates.every((w) => TERMINAL.has(w.status));
        const waitingForPostSix = sixComplete && !isPaidMediaPlanTerminal(next);
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
