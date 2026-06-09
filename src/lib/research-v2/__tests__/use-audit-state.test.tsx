/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import {
  CROSS_SECTION_REASONING_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
// W3-A note: CROSS_SECTION_REASONING_SECTION_ID + POSITIONING_SYNTHESIS_SECTION_ID
// are imported only for negative assertions (these capstones must NEVER dispatch).
import { useAuditState } from '../use-audit-state';

const RUN_ID = '00000000-0000-4000-8000-0000000000aa';

function completeWorker(
  sectionId: AllPositioningSectionId,
): AuditStateResponse['workerStates'][number] {
  return {
    section_id: sectionId,
    status: 'complete',
    phase: 'Committed',
    phaseLabel: 'Committed',
    phaseStartedAt: null,
    latestTool: null,
    latestSource: null,
    latestActivity: 'Committed',
    nextStep: null,
    concurrency: null,
    elapsedMs: null,
    capabilityGaps: [],
    executionMode: 'lab',
    runtimeTimings: {},
  };
}

function erroredWorker(
  sectionId: AllPositioningSectionId,
): AuditStateResponse['workerStates'][number] {
  return {
    ...completeWorker(sectionId),
    status: 'error',
    latestActivity: 'Failed',
  };
}

// W3-A pure-lean: 6/6 complete is the paid-media dispatch trigger. This helper
// builds a 6/6 state with extra capstone (paid-media) workers attached.
function sixCompleteWithCapstoneState(
  capstoneWorkers: AuditStateResponse['workerStates'] = [],
): AuditStateResponse {
  return sixCompleteState({
    workerStates: [
      ...POSITIONING_SECTION_IDS.map((sectionId) => completeWorker(sectionId)),
      ...capstoneWorkers,
    ],
  });
}

function sixCompleteState(
  overrides: Partial<AuditStateResponse> = {},
): AuditStateResponse {
  return {
    parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
    parent_status: 'complete',
    children_complete: 6,
    children_total: 6,
    workerStates: POSITIONING_SECTION_IDS.map((sectionId) =>
      completeWorker(sectionId),
    ),
    sectionsByZone: {},
    eventsByZone: {},
    ...overrides,
  };
}

function responseForJson(body: unknown): Response {
  return Response.json(body);
}

function dispatchedSectionIds(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls
    .map(([, init]) => {
      const body = (init as { body?: unknown } | undefined)?.body;
      if (typeof body !== 'string') return null;
      const parsed = JSON.parse(body) as { section_id?: unknown };
      return typeof parsed.section_id === 'string' ? parsed.section_id : null;
    })
    .filter((sectionId): sectionId is string => sectionId !== null);
}

async function flushHookPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useAuditState post-six dispatch sequencing', (): void => {
  afterEach((): void => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('dispatches paid-media directly after six sections complete (no thinker, no synthesis)', async (): Promise<void> => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseForJson(sixCompleteState()))
      .mockResolvedValue(responseForJson({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useAuditState(RUN_ID));

    await waitFor(() => {
      expect(dispatchedSectionIds(fetchMock)).toContain(
        PAID_MEDIA_PLAN_SECTION_ID,
      );
    });

    // The thinker + synthesis capstones must NEVER be dispatched by the client.
    expect(dispatchedSectionIds(fetchMock)).not.toContain(
      CROSS_SECTION_REASONING_SECTION_ID,
    );
    expect(dispatchedSectionIds(fetchMock)).not.toContain(
      POSITIONING_SYNTHESIS_SECTION_ID,
    );

    unmount();
  });

  it('does not dispatch paid-media before the six sections complete', async (): Promise<void> => {
    const partial = sixCompleteState({
      children_complete: 5,
      children_total: 6,
      workerStates: POSITIONING_SECTION_IDS.slice(0, 5).map((sectionId) =>
        completeWorker(sectionId),
      ),
      parent_status: 'partial',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseForJson(partial))
      .mockResolvedValue(responseForJson(partial));
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useAuditState(RUN_ID));

    await flushHookPromises();

    expect(dispatchedSectionIds(fetchMock)).not.toContain(
      PAID_MEDIA_PLAN_SECTION_ID,
    );

    unmount();
  });

  it('retries the paid-media dispatch after a transient 409 (no permanent latch)', async (): Promise<void> => {
    // ARI: the client no longer latches post-six dispatch off on a 409. The
    // server treats readiness as a coverage annotation, so a 409 is only ever a
    // transient race and must be retried on the next poll.
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseForJson(sixCompleteState())) // poll 1
      .mockResolvedValueOnce(
        Response.json({ error: 'positioning_sections_not_ready' }, { status: 409 }),
      ) // paid-media dispatch 1 -> transient race
      .mockResolvedValueOnce(responseForJson(sixCompleteState())) // poll 2
      .mockResolvedValueOnce(responseForJson({ ok: true })) // paid-media dispatch 2 -> success
      .mockResolvedValue(responseForJson(sixCompleteState())); // subsequent polls
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useAuditState(RUN_ID));

    await flushHookPromises();
    expect(dispatchedSectionIds(fetchMock)).toEqual([PAID_MEDIA_PLAN_SECTION_ID]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // The transient 409 did NOT latch dispatch off — paid-media was retried.
    const paidMediaDispatches = dispatchedSectionIds(fetchMock).filter(
      (id) => id === PAID_MEDIA_PLAN_SECTION_ID,
    );
    expect(paidMediaDispatches.length).toBeGreaterThanOrEqual(2);

    unmount();
  });

  it('re-dispatches a paid-media row that committed as error, then stops at the cap', async (): Promise<void> => {
    // T3c: an `error` row used to latch hasPaidMediaPlanStarted=true forever, so
    // a failed paid-media capstone never retried. The bounded retry re-fires once
    // on the observed error, then stops at the cap so a deterministic failure
    // never loops a paid-API call.
    vi.useFakeTimers();

    const erroredCapstone = sixCompleteWithCapstoneState([
      erroredWorker(PAID_MEDIA_PLAN_SECTION_ID),
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseForJson(erroredCapstone)) // poll 1 -> retry #1
      .mockResolvedValueOnce(responseForJson({ ok: true })) // paid-media re-dispatch
      .mockResolvedValue(responseForJson(erroredCapstone)); // still errored on later polls
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useAuditState(RUN_ID));

    await flushHookPromises();

    // Re-dispatched exactly once on the first observed error row.
    expect(
      dispatchedSectionIds(fetchMock).filter(
        (id) => id === PAID_MEDIA_PLAN_SECTION_ID,
      ),
    ).toHaveLength(1);

    // Subsequent polls keep returning an error row, but the cap (1) is hit, so
    // no further re-dispatch fires — the bounded retry does not loop.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
    }

    expect(
      dispatchedSectionIds(fetchMock).filter(
        (id) => id === PAID_MEDIA_PLAN_SECTION_ID,
      ),
    ).toHaveLength(1);

    unmount();
  });

  it('does not re-dispatch paid-media once it has committed an artifact', async (): Promise<void> => {
    // Guard: a committed (non-error) paid-media row with an artifact in
    // sectionsByZone must never be re-dispatched by the error-retry path.
    vi.useFakeTimers();

    const committedCapstone = sixCompleteWithCapstoneState([
      completeWorker(PAID_MEDIA_PLAN_SECTION_ID),
    ]);
    committedCapstone.sectionsByZone = {
      ...committedCapstone.sectionsByZone,
      [PAID_MEDIA_PLAN_SECTION_ID]: { data: { sectionTitle: 'Paid Media Plan' } },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(responseForJson(committedCapstone));
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useAuditState(RUN_ID));

    await flushHookPromises();
    for (let i = 0; i < 2; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
    }

    expect(dispatchedSectionIds(fetchMock)).not.toContain(
      PAID_MEDIA_PLAN_SECTION_ID,
    );

    unmount();
  });
});
