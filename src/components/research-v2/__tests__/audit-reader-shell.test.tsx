import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FormEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import {
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';

const mocks = vi.hoisted(() => ({
  useAuditState: vi.fn(),
}));

const EMPTY_AUDIT_STATE: AuditStateResponse = {
  parent_audit_run_id: null,
  parent_status: null,
  children_complete: 0,
  children_total: 0,
  workerStates: [],
  sectionsByZone: {},
  eventsByZone: {},
};

vi.mock('@/lib/research-v2/use-audit-state', () => ({
  useAuditState: mocks.useAuditState,
}));

const { AuditReaderShell } = await import('../audit-reader-shell');

describe('<AuditReaderShell>', () => {
  beforeEach((): void => {
    mocks.useAuditState.mockReturnValue(EMPTY_AUDIT_STATE);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  afterEach((): void => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('normalizes 0..1 lab confidence values in the header and progress strip', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 1,
      children_total: 6,
      workerStates: [completeWorker('positioningMarketCategory')],
      sectionsByZone: {
        positioningMarketCategory: {
          data: marketCategoryFixtureArtifact,
        },
      },
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByLabelText('Confidence 6/10')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /market & category.*6 confidence/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('0.6 confidence')).not.toBeInTheDocument();
  });

  it('shows verified and unsupported claim counts for completed sections', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 1,
      children_total: 6,
      workerStates: [completeWorker('positioningMarketCategory')],
      sectionsByZone: {
        positioningMarketCategory: {
          data: {
            ...marketCategoryFixtureArtifact,
            verification: {
              verifiedCount: 12,
              unsupportedCount: 2,
              claims: [],
            },
          },
        },
      },
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByText('Verified 12 / Unsupported 2')).toBeInTheDocument();
  });

  it('renders the paid media terminal and hides the progress strip when every section is terminal', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 6,
      children_total: 6,
      workerStates: [
        ...POSITIONING_SECTION_IDS.map((sectionId) => completeWorker(sectionId)),
        completeWorker(PAID_MEDIA_PLAN_SECTION_ID),
      ],
      sectionsByZone: {
        [PAID_MEDIA_PLAN_SECTION_ID]: {
          data: paidMediaPlanFixtureArtifact,
        },
      },
    });

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId={PAID_MEDIA_PLAN_SECTION_ID}
      />,
    );

    expect(screen.getByText('Section 7 of 7')).toBeInTheDocument();
    expect(screen.queryByTestId('section-progress-strip')).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`typed-artifact-renderer-${PAID_MEDIA_PLAN_SECTION_ID}`),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId(`typed-artifact-renderer-${PAID_MEDIA_PLAN_SECTION_ID}`),
      ).getByTestId('paid-media-plan-renderer'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByTestId(
        new RegExp(`^sub-section-status-${PAID_MEDIA_PLAN_SECTION_ID}-`),
      ),
    ).toHaveLength(12);
  });

  it('uses the controlled section change callback for keyboard navigation', (): void => {
    const onSectionChange = vi.fn();

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId="positioningMarketCategory"
        onSectionChange={onSectionChange}
      />,
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(onSectionChange).toHaveBeenCalledWith('positioningBuyerICP');
  });

  it('moves backward with ArrowLeft from a controlled active section', (): void => {
    const onSectionChange = vi.fn();

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId="positioningBuyerICP"
        onSectionChange={onSectionChange}
      />,
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    expect(onSectionChange).toHaveBeenCalledWith('positioningMarketCategory');
  });

  it('ignores arrow keys while an editable field has focus', (): void => {
    const onSectionChange = vi.fn();
    const input = document.createElement('input');
    document.body.appendChild(input);

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId="positioningMarketCategory"
        onSectionChange={onSectionChange}
      />,
    );
    input.focus();

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(onSectionChange).not.toHaveBeenCalled();
    input.remove();
  });

  it('calls the controlled section change callback when a rail item is clicked', (): void => {
    const onSectionChange = vi.fn();

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId="positioningMarketCategory"
        onSectionChange={onSectionChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /buyer \/ icp/i }));

    expect(onSectionChange).toHaveBeenCalledWith('positioningBuyerICP');
  });

  it('shows paid media as locked before all six positioning sections complete', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'running',
      children_complete: 5,
      children_total: 6,
      workerStates: POSITIONING_SECTION_IDS.map((sectionId, index) =>
        buildWorker(sectionId, index < 5 ? 'complete' : 'running'),
      ),
      sectionsByZone: {},
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByTestId('section-progress-strip')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /paid media plan.*locked until 6\/6/i }),
    ).toBeEnabled();
  });

  it('shows paid media as ready after six sections complete but before the terminal starts', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 6,
      children_total: 6,
      workerStates: POSITIONING_SECTION_IDS.map((sectionId) =>
        completeWorker(sectionId),
      ),
      sectionsByZone: {},
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByTestId('section-progress-strip')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /paid media plan.*ready after 6\/6/i }),
    ).toBeEnabled();
  });

  it('renders running activity and recent event messages for the active section', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'running',
      children_complete: 0,
      children_total: 6,
      workerStates: [
        buildWorker(
          'positioningMarketCategory',
          'running',
          'Reading category evidence',
        ),
      ],
      eventsByZone: {
        positioningMarketCategory: [
          {
            id: 'evt-1',
            event_type: 'tool-started',
            message: 'Search started',
            payload: null,
            created_at: '2026-05-26T12:00:00.000Z',
          },
        ],
      },
      sectionsByZone: {},
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByText('Reading category evidence')).toBeInTheDocument();
    expect(screen.getByText('Search started')).toBeInTheDocument();
  });

  it('renders running activity over stale complete section data during a rerun', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'running',
      children_complete: 5,
      children_total: 6,
      workerStates: [
        buildWorker(
          'positioningMarketCategory',
          'running',
          'Reading category evidence',
        ),
      ],
      sectionsByZone: {
        positioningMarketCategory: {
          data: marketCategoryFixtureArtifact,
        },
      },
      eventsByZone: {
        positioningMarketCategory: [
          {
            id: 'evt-1',
            event_type: 'section-started',
            message: 'Started rerun',
            payload: null,
            created_at: '2026-05-26T12:00:00.000Z',
          },
        ],
      },
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByText('Reading category evidence')).toBeInTheDocument();
    expect(screen.getByText('Started rerun')).toBeInTheDocument();
    expect(
      screen.queryByText(marketCategoryFixtureArtifact.verdict),
    ).not.toBeInTheDocument();
  });

  it('keeps the first automatic section selection stable across poll updates', async (): Promise<void> => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'running',
      children_complete: 0,
      children_total: 6,
      workerStates: [buildWorker('positioningMarketCategory', 'running')],
      sectionsByZone: {},
    });

    const { rerender } = render(
      <AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />,
    );

    expect(screen.getByText('Section 1 of 7')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Section 1 of 7')).toBeInTheDocument());

    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'running',
      children_complete: 1,
      children_total: 6,
      workerStates: [
        completeWorker('positioningMarketCategory'),
        buildWorker('positioningBuyerICP', 'running'),
      ],
      sectionsByZone: {
        positioningMarketCategory: {
          data: marketCategoryFixtureArtifact,
        },
      },
    });
    rerender(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByText('Section 1 of 7')).toBeInTheDocument();
    expect(vi.mocked(HTMLElement.prototype.scrollTo)).not.toHaveBeenCalled();
  });

  it('renders an error state for failed active sections', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'running',
      children_complete: 0,
      children_total: 6,
      workerStates: [buildWorker('positioningMarketCategory', 'error')],
      sectionsByZone: {},
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByText('Section needs review')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /rerun section/i }),
    ).toBeEnabled();
  });

  it('auto-kicks lab orchestration when a seeded run has no parent id yet', async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: null,
      workerStates: [buildWorker('positioningMarketCategory', 'queued')],
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/research-v2/orchestrate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            run_id: '00000000-0000-4000-8000-0000000000aa',
            executionMode: 'lab',
          }),
        }),
      ),
    );
  });

  it('does not auto-kick lab orchestration again when worker state length changes', async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({}));
    const runId = '00000000-0000-4000-8000-0000000000bb';
    const orchestrateCallCount = (): number =>
      fetchMock.mock.calls.filter(([url]) => url === '/api/research-v2/orchestrate')
        .length;
    vi.stubGlobal('fetch', fetchMock);
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: null,
      workerStates: [buildWorker('positioningMarketCategory', 'queued')],
    });

    const { rerender } = render(<AuditReaderShell runId={runId} />);

    await waitFor(() => expect(orchestrateCallCount()).toBe(1));

    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: null,
      workerStates: [
        buildWorker('positioningMarketCategory', 'queued'),
        buildWorker('positioningBuyerICP', 'queued'),
      ],
    });
    rerender(<AuditReaderShell runId={runId} />);

    await waitFor(() => expect(orchestrateCallCount()).toBe(1));
  });

  it('does not auto-kick lab orchestration again after a non-ok response', async (): Promise<void> => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      url === '/api/research-v2/orchestrate'
        ? new Response('temporary failure', { status: 503 })
        : Response.json({}),
    );
    const runId = '00000000-0000-4000-8000-0000000000cc';
    const orchestrateCallCount = (): number =>
      fetchMock.mock.calls.filter(([url]) => url === '/api/research-v2/orchestrate')
        .length;
    vi.stubGlobal('fetch', fetchMock);
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: null,
      workerStates: [buildWorker('positioningMarketCategory', 'queued')],
    });

    const { rerender } = render(<AuditReaderShell runId={runId} />);

    await waitFor(() => expect(orchestrateCallCount()).toBe(1));
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: null,
      workerStates: [
        buildWorker('positioningMarketCategory', 'queued'),
        buildWorker('positioningBuyerICP', 'queued'),
      ],
    });
    rerender(<AuditReaderShell runId={runId} />);

    await waitFor(() => expect(orchestrateCallCount()).toBe(1));
  });

  it('reruns positioning sections through the rerun-section route in lab mode', async (): Promise<void> => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId="positioningVoiceOfCustomer"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^rerun$/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/research-v2/rerun-section',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            runId: '00000000-0000-4000-8000-0000000000aa',
            zone: 'positioningVoiceOfCustomer',
            executionMode: 'lab',
          }),
        }),
      ),
    );
  });

  it('reruns paid media through the one-section lab route', async (): Promise<void> => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    const submitMock = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    vi.stubGlobal('fetch', fetchMock);
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 6,
      children_total: 6,
      workerStates: [
        ...POSITIONING_SECTION_IDS.map((sectionId) => completeWorker(sectionId)),
        completeWorker(PAID_MEDIA_PLAN_SECTION_ID),
      ],
      sectionsByZone: {
        [PAID_MEDIA_PLAN_SECTION_ID]: {
          data: paidMediaPlanFixtureArtifact,
        },
      },
    });

    render(
      <form onSubmit={submitMock}>
        <AuditReaderShell
          runId="00000000-0000-4000-8000-0000000000aa"
          activeSectionId={PAID_MEDIA_PLAN_SECTION_ID}
        />
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^rerun$/i }));
    expect(submitMock).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/research-v2/run-lab-section',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            run_id: '00000000-0000-4000-8000-0000000000aa',
            section_id: PAID_MEDIA_PLAN_SECTION_ID,
          }),
        }),
      ),
    );
  });

  it('copies the full active typed artifact as markdown', async (): Promise<void> => {
    const writeText = vi.fn(async (text: string): Promise<void> => {
      void text;
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 1,
      children_total: 6,
      workerStates: [completeWorker('positioningMarketCategory')],
      sectionsByZone: {
        positioningMarketCategory: {
          data: marketCategoryFixtureArtifact,
        },
      },
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('Market & Category Intelligence'),
      ),
    );
    const copiedText = writeText.mock.calls[0]?.[0];
    expect(copiedText).toContain(marketCategoryFixtureArtifact.verdict);
    expect(copiedText).toContain('## Category Definition');
    expect(copiedText).toContain(
      marketCategoryFixtureArtifact.body.categoryDefinition.prose,
    );
    expect(copiedText).toContain('## Sources');
  });

  it('surfaces clipboard failures on the copy button', async (): Promise<void> => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const writeText = vi.fn(async (): Promise<void> => {
      throw new Error('clipboard blocked');
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 1,
      children_total: 6,
      workerStates: [completeWorker('positioningMarketCategory')],
      sectionsByZone: {
        positioningMarketCategory: {
          data: marketCategoryFixtureArtifact,
        },
      },
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => expect(screen.getByText('Copy failed')).toBeInTheDocument());
    warnSpy.mockRestore();
  });
});

function buildWorker(
  sectionId: AllPositioningSectionId,
  status: AuditStateResponse['workerStates'][number]['status'],
  latestActivity: string | null = null,
): AuditStateResponse['workerStates'][number] {
  const phase = status === 'complete'
    ? 'Committed'
    : status === 'running'
      ? 'Reading sources'
      : status === 'error' || status === 'aborted'
        ? 'Needs review'
        : 'Queued';
  return {
    section_id: sectionId,
    status,
    phase,
    phaseLabel: phase,
    phaseStartedAt: null,
    latestTool: null,
    latestSource: null,
    latestActivity,
    nextStep: null,
    wave: null,
    totalWaves: null,
    concurrency: null,
    elapsedMs: null,
    capabilityGaps: [],
    executionMode: 'lab',
    runtimeTimings: {},
  };
}

function completeWorker(
  sectionId: AllPositioningSectionId,
): AuditStateResponse['workerStates'][number] {
  return buildWorker(sectionId, 'complete');
}
