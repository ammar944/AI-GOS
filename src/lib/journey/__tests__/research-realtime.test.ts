import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getResearchResultSignature,
  isJourneySessionRowFresh,
  shouldHandleResearchResult,
  useResearchRealtime,
  type ResearchSectionResult,
} from '../research-realtime';

function makeResult(
  overrides: Partial<ResearchSectionResult> = {},
): ResearchSectionResult {
  return {
    status: 'complete',
    section: 'competitors',
    data: { competitors: [{ name: 'Hey Digital' }] },
    durationMs: 120000,
    ...overrides,
  };
}

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

describe('getResearchResultSignature', () => {
  it('changes when the rendered artifact payload changes', () => {
    const initial = getResearchResultSignature(makeResult());
    const updated = getResearchResultSignature(
      makeResult({
        data: { competitors: [{ name: 'Hey Digital' }, { name: 'Directive' }] },
      }),
    );

    expect(updated).not.toBe(initial);
  });
});

describe('useResearchRealtime', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not hydrate stale research before an active run exists', async () => {
    const onSectionComplete = vi.fn();

    renderHook(() =>
      useResearchRealtime({
        userId: 'user-123',
        activeRunId: null,
        onSectionComplete,
      }),
    );

    await waitFor(() => {
      expect(onSectionComplete).not.toHaveBeenCalled();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('only hydrates results that belong to the active run', async () => {
    const onSectionComplete = vi.fn();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        metadata: {
          activeJourneyRunId: 'run-old',
        },
        researchResults: {
          industryMarket: {
            ...makeResult({
              section: 'industryMarket',
              data: { summary: 'stale market overview' },
            }),
            runId: 'run-old',
          },
        },
        jobStatus: null,
        updatedAt: '2026-03-12T09:00:00.000Z',
      }),
    });

    renderHook(() =>
      useResearchRealtime({
        userId: 'user-123',
        activeRunId: 'run-new',
        onSectionComplete,
      }),
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/journey/session?runId=run-new', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
    });

    expect(onSectionComplete).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(
      '[journey] Ignoring stale research snapshot with mismatched run id:',
      {
        activeRunId: 'run-new',
        snapshotRunId: 'run-old',
      },
    );
  });

  it('logs when a snapshot predates the current reset boundary', async () => {
    const onSectionComplete = vi.fn();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        metadata: {
          activeJourneyRunId: 'run-123',
        },
        researchResults: {
          industryMarket: {
            ...makeResult({
              section: 'industryMarket',
              data: { summary: 'stale market overview' },
            }),
            runId: 'run-123',
          },
        },
        jobStatus: null,
        updatedAt: '2026-03-12T08:59:59.000Z',
      }),
    });

    renderHook(() =>
      useResearchRealtime({
        userId: 'user-123',
        activeRunId: 'run-123',
        ignoreUpdatedBefore: '2026-03-12T09:00:00.000Z',
        onSectionComplete,
      }),
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/journey/session?runId=run-123', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
    });

    expect(onSectionComplete).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(
      '[journey] Ignoring stale research snapshot before reset boundary:',
      {
        ignoreUpdatedBefore: '2026-03-12T09:00:00.000Z',
        updatedAt: '2026-03-12T08:59:59.000Z',
      },
    );
  });
});

describe('shouldHandleResearchResult', () => {
  it('suppresses identical repeat writes for the same section', () => {
    const seen = new Map<string, string>();
    const result = makeResult();

    expect(shouldHandleResearchResult(seen, 'competitors', result)).toBe(true);
    expect(shouldHandleResearchResult(seen, 'competitors', result)).toBe(false);
  });

  it('accepts an updated result for the same section', () => {
    const seen = new Map<string, string>();

    expect(shouldHandleResearchResult(seen, 'competitors', makeResult())).toBe(true);
    expect(
      shouldHandleResearchResult(
        seen,
        'competitors',
        makeResult({
          data: { competitors: [{ name: 'Hey Digital' }, { name: 'Directive' }] },
        }),
      ),
    ).toBe(true);
  });
});

describe('isJourneySessionRowFresh', () => {
  it('accepts rows when no reset boundary is set', () => {
    expect(isJourneySessionRowFresh('2026-03-10T18:59:16.964Z', null)).toBe(true);
  });

  it('rejects rows older than the current reset boundary', () => {
    expect(
      isJourneySessionRowFresh(
        '2026-03-10T18:59:16.964Z',
        '2026-03-10T19:00:00.000Z',
      ),
    ).toBe(false);
  });

  it('accepts rows written after the current reset boundary', () => {
    expect(
      isJourneySessionRowFresh(
        '2026-03-10T19:00:01.000Z',
        '2026-03-10T19:00:00.000Z',
      ),
    ).toBe(true);
  });
});
