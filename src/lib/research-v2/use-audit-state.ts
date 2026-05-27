// Client hook: polls /api/research-v2/audit-state every POLL_MS while the
// run has any non-terminal worker. Stops polling once every chip is terminal
// so an idle page doesn't burn API calls.

'use client';

import { useEffect, useRef, useState } from 'react';

import type { AuditStateResponse, WorkerStatus } from '@/app/api/research-v2/audit-state/route';
import {
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
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

function isPaidMediaPlanTerminal(state: AuditStateResponse): boolean {
  const paidMediaWorker = state.workerStates.find(
    (workerState) => workerState.section_id === PAID_MEDIA_PLAN_SECTION_ID,
  );

  return (
    state.sectionsByZone[PAID_MEDIA_PLAN_SECTION_ID] !== undefined ||
    (paidMediaWorker !== undefined && TERMINAL.has(paidMediaWorker.status))
  );
}

async function dispatchPaidMediaPlan(runId: string): Promise<void> {
  const response = await fetch('/api/research-v2/run-lab-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      run_id: runId,
      section_id: PAID_MEDIA_PLAN_SECTION_ID,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Paid media plan dispatch failed for runId=${runId} status=${response.status}`,
    );
  }
}

export function useAuditState(
  runId: string,
  refreshKey = 0,
): AuditStateResponse {
  const [state, setState] = useState<AuditStateResponse>(EMPTY);
  const cancelled = useRef(false);
  const dispatchedMediaPlanRunIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    cancelled.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

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

        const shouldDispatchPaidMediaPlan =
          hasSixPositioningSectionsComplete(next) &&
          !hasPaidMediaPlanStarted(next) &&
          !dispatchedMediaPlanRunIds.current.has(runId);
        if (shouldDispatchPaidMediaPlan) {
          dispatchedMediaPlanRunIds.current.add(runId);
          try {
            await dispatchPaidMediaPlan(runId);
          } catch (error) {
            dispatchedMediaPlanRunIds.current.delete(runId);
            console.error('[use-audit-state] paid media plan dispatch failed', {
              runId,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          schedule();
          return;
        }

        const allTerminal =
          next.workerStates.length > 0 &&
          next.workerStates.every((w) => TERMINAL.has(w.status));
        const waitingForPaidMediaPlan =
          hasSixPositioningSectionsComplete(next) &&
          !isPaidMediaPlanTerminal(next);
        if (!allTerminal || waitingForPaidMediaPlan) schedule();
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
    };
  }, [refreshKey, runId]);

  return state;
}
