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

  it('dispatches cross-section reasoning first after six sections complete', async (): Promise<void> => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseForJson(sixCompleteState()))
      .mockResolvedValue(responseForJson({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useAuditState(RUN_ID));

    await waitFor(() => {
      expect(dispatchedSectionIds(fetchMock)).toContain(
        CROSS_SECTION_REASONING_SECTION_ID,
      );
    });

    expect(dispatchedSectionIds(fetchMock)).not.toContain(
      PAID_MEDIA_PLAN_SECTION_ID,
    );
    expect(dispatchedSectionIds(fetchMock)).not.toContain(
      POSITIONING_SYNTHESIS_SECTION_ID,
    );

    unmount();
  });

  it('dispatches synthesis and paid media only after the thinker completes', async (): Promise<void> => {
    const state = sixCompleteState({
      workerStates: [
        ...POSITIONING_SECTION_IDS.map((sectionId) => completeWorker(sectionId)),
        completeWorker(CROSS_SECTION_REASONING_SECTION_ID),
      ],
      sectionsByZone: {
        [CROSS_SECTION_REASONING_SECTION_ID]: {
          data: { sectionTitle: 'Cross-Section Reasoning' },
        },
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseForJson(state))
      .mockResolvedValue(responseForJson({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useAuditState(RUN_ID));

    await waitFor(() => {
      expect(dispatchedSectionIds(fetchMock)).toContain(
        PAID_MEDIA_PLAN_SECTION_ID,
      );
      expect(dispatchedSectionIds(fetchMock)).toContain(
        POSITIONING_SYNTHESIS_SECTION_ID,
      );
    });

    expect(dispatchedSectionIds(fetchMock)).not.toContain(
      CROSS_SECTION_REASONING_SECTION_ID,
    );

    unmount();
  });

  it('retries a post-six dispatch after a transient 409 (no permanent latch)', async (): Promise<void> => {
    // ARI: the client no longer latches post-six dispatch off on a 409. The
    // server treats readiness as a coverage annotation, so a 409 is only ever a
    // transient race and must be retried on the next poll.
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseForJson(sixCompleteState())) // poll 1
      .mockResolvedValueOnce(
        Response.json({ error: 'positioning_sections_not_ready' }, { status: 409 }),
      ) // thinker dispatch 1 -> transient race
      .mockResolvedValueOnce(responseForJson(sixCompleteState())) // poll 2
      .mockResolvedValueOnce(responseForJson({ ok: true })) // thinker dispatch 2 -> success
      .mockResolvedValue(responseForJson(sixCompleteState())); // subsequent polls
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useAuditState(RUN_ID));

    await flushHookPromises();
    expect(dispatchedSectionIds(fetchMock)).toEqual([
      CROSS_SECTION_REASONING_SECTION_ID,
    ]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // The transient 409 did NOT latch dispatch off — the thinker was retried.
    const thinkerDispatches = dispatchedSectionIds(fetchMock).filter(
      (id) => id === CROSS_SECTION_REASONING_SECTION_ID,
    );
    expect(thinkerDispatches.length).toBeGreaterThanOrEqual(2);

    unmount();
  });
});
