// Client hook: polls /api/research-v2/audit-state every POLL_MS while the
// run has any non-terminal worker. Stops polling once every chip is terminal
// so an idle page doesn't burn API calls.

'use client';

import { useEffect, useRef, useState } from 'react';

import type { AuditStateResponse, WorkerStatus } from '@/app/api/research-v2/audit-state/route';
import { hasSixPositioningSectionsComplete } from '@/lib/research-v2/six-sections-complete';
import {
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';

const POLL_MS = 2500;
const TERMINAL: ReadonlySet<WorkerStatus> = new Set(['complete', 'error', 'aborted']);
// Bounded client-side retry for rows that committed as `error`. Cap is per
// runId:sectionId: a deterministic failure (e.g. a schema the model can't fill)
// must stop after this many re-dispatches so we never loop a paid-API call. The
// core-section retry waits until the first fan-out wave is terminal; paid-media
// still uses the normal run-lab-section claim path because it is not reset via
// /rerun-section.
const SECTION_ERROR_RETRY_CAP = 1;

const EMPTY: AuditStateResponse = {
  parent_audit_run_id: null,
  parent_status: null,
  children_complete: 0,
  children_total: 0,
  workerStates: [],
  sectionsByZone: {},
  eventsByZone: {},
};

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

function isCoreFanoutTerminal(state: AuditStateResponse): boolean {
  return POSITIONING_SECTION_IDS.every((sectionId) => {
    if (state.sectionsByZone[sectionId] !== undefined) {
      return true;
    }

    const worker = state.workerStates.find(
      (workerState) => workerState.section_id === sectionId,
    );
    return worker !== undefined && TERMINAL.has(worker.status);
  });
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

async function dispatchSectionRerun(
  runId: string,
  sectionId: AllPositioningSectionId,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/research-v2/rerun-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      runId,
      zone: sectionId,
      executionMode: 'lab',
    }),
    signal,
  });

  await throwIfDispatchFailed({ label: `${sectionId} rerun`, response, runId });
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
  const sectionRerunKeysInFlight = useRef<Set<string>>(new Set());
  // Per-runId:sectionId count of how many times we've re-dispatched an `error`
  // row. Bounded by SECTION_ERROR_RETRY_CAP so a deterministic failure stops.
  const sectionErrorRetryCounts = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    cancelled.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // W3 executive brief: the detached brief route writes thesis
    // {status:'generating'} ~1s after the paid-media commit. Keep a short
    // bounded grace window after paid-media turns terminal so the poll
    // observes that claim, then keep polling only while it reports
    // 'generating'. A null thesis after the grace window (kickoff never
    // configured/fired) stops the poll exactly as before.
    let briefGracePollsLeft = 4;
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
        const coreFanoutTerminal = isCoreFanoutTerminal(next);
        const retriableCoreSectionIds = coreFanoutTerminal
          ? POSITIONING_SECTION_IDS.filter((sectionId) => {
              const retryKey = `${runId}:${sectionId}`;
              return (
                isSectionErrored(next, sectionId) &&
                !sectionRerunKeysInFlight.current.has(retryKey) &&
                (sectionErrorRetryCounts.current.get(retryKey) ?? 0) <
                  SECTION_ERROR_RETRY_CAP
              );
            })
          : [];

        if (retriableCoreSectionIds.length > 0) {
          await Promise.all(
            retriableCoreSectionIds.map(async (sectionId) => {
              const retryKey = `${runId}:${sectionId}`;
              sectionErrorRetryCounts.current.set(
                retryKey,
                (sectionErrorRetryCounts.current.get(retryKey) ?? 0) + 1,
              );
              sectionRerunKeysInFlight.current.add(retryKey);
              try {
                await dispatchSectionRerun(runId, sectionId, dispatchAbort.signal);
              } catch (error) {
                sectionRerunKeysInFlight.current.delete(retryKey);
                logDispatchError(`${sectionId} rerun`, runId, error);
              }
            }),
          );
          schedule();
          return;
        }

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
          (sectionErrorRetryCounts.current.get(
            `${runId}:${PAID_MEDIA_PLAN_SECTION_ID}`,
          ) ?? 0) < SECTION_ERROR_RETRY_CAP;
        if (paidMediaRetriableError) {
          const retryKey = `${runId}:${PAID_MEDIA_PLAN_SECTION_ID}`;
          sectionErrorRetryCounts.current.set(
            retryKey,
            (sectionErrorRetryCounts.current.get(retryKey) ?? 0) + 1,
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
        const brief = next.executive_brief;
        const briefGenerating =
          isRecord(brief) && brief.status === 'generating';
        const briefPendingGrace =
          isPaidMediaPlanTerminal(next) &&
          (brief === null || brief === undefined) &&
          briefGracePollsLeft > 0;
        if (briefPendingGrace) {
          briefGracePollsLeft -= 1;
        }
        if (
          !allTerminal ||
          waitingForPostSix ||
          briefGenerating ||
          briefPendingGrace
        )
          schedule();
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
