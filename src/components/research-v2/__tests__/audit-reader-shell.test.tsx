import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FormEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import {
  CROSS_SECTION_REASONING_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { crossSectionReasoningFixtureArtifact } from '@/lib/lab-engine/fixtures/cross-section-reasoning-artifact';
import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';
import { positioningSynthesisFixtureArtifact } from '@/lib/lab-engine/fixtures/positioning-synthesis-artifact';

const mocks = vi.hoisted(() => ({
  useAuditState: vi.fn(),
  useSectionPartials: vi.fn(),
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

vi.mock('@/lib/research-v2/use-section-partials', () => ({
  useSectionPartials: mocks.useSectionPartials,
}));

const { AuditReaderShell, buildDraftArtifact } = await import(
  '../audit-reader-shell'
);

describe('buildDraftArtifact', () => {
  const active = POSITIONING_SECTION_IDS[0] as Parameters<
    typeof buildDraftArtifact
  >[0]['active'];

  it('unwraps snapshot.body so sub-sections render at the top level, not under a "Body" group', () => {
    // The widened streamed schema broadcasts { verdict, statusSummary, body: {...} }.
    // The drafting view must lift the body sub-sections to the top level (mirroring
    // the committed artifact) so GenericTypedArtifactRenderer renders them directly.
    const snapshot = {
      verdict: 'streamed verdict',
      statusSummary: 'streamed status',
      body: { categoryDefinition: { prose: 'partial prose' } },
    };

    const result = buildDraftArtifact({ active, snapshot }) as Record<
      string,
      unknown
    >;

    expect(result.categoryDefinition).toEqual({ prose: 'partial prose' });
    expect('body' in result).toBe(false);
  });

  it('falls back to the raw snapshot for the legacy bare-body shape', () => {
    const snapshot = { categoryDefinition: { prose: 'legacy prose' } };

    const result = buildDraftArtifact({ active, snapshot }) as Record<
      string,
      unknown
    >;

    expect(result.categoryDefinition).toEqual({ prose: 'legacy prose' });
  });
});

describe('<AuditReaderShell>', () => {
  beforeEach((): void => {
    mocks.useAuditState.mockReturnValue(EMPTY_AUDIT_STATE);
    mocks.useSectionPartials.mockReturnValue({});
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

  it('does not surface section confidence in the header or progress strip', (): void => {
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

    // Confidence display was removed from the reader; the completed rail item
    // reports status ("Complete"), never a confidence score.
    expect(screen.queryByLabelText('Confidence 6/10')).not.toBeInTheDocument();
    expect(screen.queryByText('6 confidence')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /market & category.*complete/i }),
    ).toBeInTheDocument();
  });

  it('shows graded verification claim counts for completed sections', (): void => {
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

    expect(
      screen.getByText('Verified · 12 supported · 86% grounded'),
    ).toBeInTheDocument();
  });

  it('prefers the persisted verification tier over fallback count math', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 1,
      children_total: 6,
      workerStates: [completeWorker('positioningMarketCategory')],
      sectionsByZone: {
        positioningMarketCategory: {
          verificationTier: 'insufficient',
          verificationFlag: {
            tier: 'insufficient',
            verifiedCount: 9,
            unsupportedCount: 1,
            totalClaims: 10,
            confidence: 0.9,
            needsReviewThreshold: 0.75,
            insufficientThreshold: 0.5,
            evidenceGap: true,
          },
          data: {
            ...marketCategoryFixtureArtifact,
            verification: {
              verifiedCount: 9,
              unsupportedCount: 1,
              claims: [],
            },
          },
        },
      },
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(
      screen.getByText('Insufficient evidence · 1 unsupported · 90% grounded'),
    ).toBeInTheDocument();
  });

  it('renders reviewed markdown before structured evidence for reviewed sections', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 1,
      children_total: 6,
      workerStates: [completeWorker('positioningMarketCategory')],
      sectionsByZone: {
        positioningMarketCategory: {
          verificationTier: 'needs_review',
          data: {
            ...marketCategoryFixtureArtifact,
            review: {
              upgradedMarkdown:
                '## Reviewed strategic thesis\n\nThis is the upgraded narrative.',
              tier: 'needs_review',
              tierRationale: 'One claim needs stronger sourcing.',
              removedItems: ['Removed fabricated TAM precision'],
              clientQuestions: ['Can you provide sourced TAM assumptions?'],
            },
          },
        },
      },
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByTestId('reviewed-section-markdown')).toHaveTextContent(
      'Reviewed strategic thesis',
    );
    expect(screen.getByText('Review rationale')).toBeInTheDocument();
    expect(screen.getByText('Removed fabricated TAM precision')).toBeInTheDocument();
    expect(screen.getByText('Structured evidence')).toBeInTheDocument();
  });

  it('renders strategic critic metadata for critiqued cross-section reasoning', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 6,
      children_total: 6,
      workerStates: [
        ...POSITIONING_SECTION_IDS.map((sectionId) => completeWorker(sectionId)),
        completeWorker(CROSS_SECTION_REASONING_SECTION_ID),
      ],
      sectionsByZone: {
        [CROSS_SECTION_REASONING_SECTION_ID]: {
          data: {
            ...crossSectionReasoningFixtureArtifact,
            strategicCritique: {
              checkedAt: '2026-06-04T13:00:00.000Z',
              items: [
                {
                  action: 'deepened',
                  path: 'body.crossSectionThreads[0].claim',
                  rationale:
                    'The critic made the implementation-delay trade-off specific.',
                  text: 'The upgraded strategic claim.',
                  verdict: 'passes',
                },
              ],
              modelId: 'claude-opus-4-5',
              summary: 'The critic deepened the main cross-section thread.',
              target: 'cross_section_reasoning',
            },
          },
        },
      },
    });

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId={CROSS_SECTION_REASONING_SECTION_ID}
      />,
    );

    expect(screen.getByText('Strategic critic')).toBeInTheDocument();
    expect(
      screen.getByText('The critic deepened the main cross-section thread.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/implementation-delay trade-off specific/i),
    ).toBeInTheDocument();
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
        completeWorker(CROSS_SECTION_REASONING_SECTION_ID),
        completeWorker(POSITIONING_SYNTHESIS_SECTION_ID),
        completeWorker(PAID_MEDIA_PLAN_SECTION_ID),
      ],
      sectionsByZone: {
        [CROSS_SECTION_REASONING_SECTION_ID]: {
          data: crossSectionReasoningFixtureArtifact,
        },
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

    expect(screen.getByText('Section 9 of 9')).toBeInTheDocument();
    expect(screen.getByTestId('section-progress-strip')).toBeInTheDocument();
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
    ).toHaveLength(15);
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

    const rail = screen.getByRole('navigation', { name: 'Sections' });
    fireEvent.click(within(rail).getByRole('button', { name: /buyer \/ icp/i }));

    expect(onSectionChange).toHaveBeenCalledWith('positioningBuyerICP');
  });

  it('shows the thinker as locked before all six positioning sections complete', (): void => {
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
      screen.getByRole('button', { name: /thinker.*locked until 6\/6/i }),
    ).toBeEnabled();
  });

  it('shows the thinker as ready after six sections complete but keeps paid media locked', (): void => {
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
      screen.getByRole('button', { name: /thinker.*ready after 6\/6/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /paid media plan.*locked until thinker/i }),
    ).toBeEnabled();
  });

  it('shows paid media as ready after cross-section reasoning completes', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 6,
      children_total: 6,
      workerStates: [
        ...POSITIONING_SECTION_IDS.map((sectionId) => completeWorker(sectionId)),
        completeWorker(CROSS_SECTION_REASONING_SECTION_ID),
      ],
      sectionsByZone: {
        [CROSS_SECTION_REASONING_SECTION_ID]: {
          data: crossSectionReasoningFixtureArtifact,
        },
      },
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByTestId('section-progress-strip')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /paid media plan.*ready after thinker/i }),
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
    // Customer-safe feed: the raw tool message is dropped; the tool-started
    // event surfaces as the translated phase title.
    expect(screen.getByText('Searching source evidence')).toBeInTheDocument();
    expect(screen.queryByText('Search started')).not.toBeInTheDocument();

    // Run rollup reads honest completion across the 6 positioning sections
    // ("0/6"), never a per-section percent like "0%" for active work.
    expect(screen.getByText('0/6')).toBeInTheDocument();
    const strip = screen.getByTestId('section-progress-strip');
    expect(strip.textContent).not.toContain('%');
  });

  it('renders streamed partials through the generic drafting renderer without committed state', (): void => {
    mocks.useSectionPartials.mockReturnValue({
      positioningMarketCategory: {
        zone: 'positioningMarketCategory',
        sectionId: 'positioningMarketCategory',
        seq: 3,
        snapshot: {
          categoryDefinition: {
            prose: 'Draft category definition is arriving progressively.',
          },
        },
      },
    });
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
          'Drafting section',
        ),
      ],
      sectionsByZone: {},
      eventsByZone: {},
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByText('Drafting...')).toBeInTheDocument();
    expect(
      screen.getByTestId('typed-artifact-renderer-positioningMarketCategory'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Draft category definition is arriving progressively.'),
    ).toBeInTheDocument();
    expect(mocks.useAuditState.mock.results[0]?.value.sectionsByZone).toEqual({});
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
    // Customer-safe feed: raw rerun message is dropped; the section-started
    // event surfaces as the translated phase title.
    expect(screen.getByText('Preparing context')).toBeInTheDocument();
    expect(screen.queryByText('Started rerun')).not.toBeInTheDocument();
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

    expect(screen.getByText('Section 1 of 9')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Section 1 of 9')).toBeInTheDocument());

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

    expect(screen.getByText('Section 1 of 9')).toBeInTheDocument();
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

    // The auto-kickoff is age-gated: it only fires once the parentless state has
    // persisted for a full poll cycle, so it cannot race the page's own kickoff.
    await waitFor(
      () =>
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
      { timeout: 4000 },
    );
  });

  it('does not fire the auto-kickoff immediately on mount (age-gate suppresses the page-kickoff race)', async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({}));
    const runId = '00000000-0000-4000-8000-0000000000dd';
    const orchestrateCallCount = (): number =>
      fetchMock.mock.calls.filter(([url]) => url === '/api/research-v2/orchestrate')
        .length;
    vi.stubGlobal('fetch', fetchMock);
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: null,
      workerStates: [buildWorker('positioningMarketCategory', 'queued')],
    });

    render(<AuditReaderShell runId={runId} />);

    // Within the gate window the kickoff must NOT have fired yet — this is the
    // belt that stops the shell racing the page's in-flight orchestrate POST.
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
    expect(orchestrateCallCount()).toBe(0);

    // After the full gate it fires once (legitimate reload-mid-flow bootstrap).
    await waitFor(() => expect(orchestrateCallCount()).toBe(1), { timeout: 4000 });
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

    await waitFor(() => expect(orchestrateCallCount()).toBe(1), { timeout: 4000 });

    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: null,
      workerStates: [
        buildWorker('positioningMarketCategory', 'queued'),
        buildWorker('positioningBuyerICP', 'queued'),
      ],
    });
    rerender(<AuditReaderShell runId={runId} />);

    await waitFor(() => expect(orchestrateCallCount()).toBe(1), { timeout: 4000 });
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

    await waitFor(() => expect(orchestrateCallCount()).toBe(1), { timeout: 4000 });
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

    await waitFor(() => expect(orchestrateCallCount()).toBe(1), { timeout: 4000 });
  });

  it('reruns positioning sections through the rerun-section route in lab mode', async (): Promise<void> => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 1,
      children_total: 6,
      workerStates: [completeWorker('positioningMarketCategory')],
      sectionsByZone: {
        positioningMarketCategory: { data: marketCategoryFixtureArtifact },
      },
    });

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId="positioningMarketCategory"
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
            zone: 'positioningMarketCategory',
            executionMode: 'lab',
          }),
        }),
      ),
    );
  });

  it('disables the top-level rerun while the active section is non-terminal', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'running',
      children_complete: 0,
      children_total: 6,
      workerStates: [buildWorker('positioningMarketCategory', 'running')],
      sectionsByZone: {},
    });

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId="positioningMarketCategory"
      />,
    );

    expect(screen.getByRole('button', { name: /^rerun$/i })).toBeDisabled();
  });

  it('enables the top-level rerun once the active section is terminal', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 1,
      children_total: 6,
      workerStates: [completeWorker('positioningMarketCategory')],
      sectionsByZone: {
        positioningMarketCategory: { data: marketCategoryFixtureArtifact },
      },
    });

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId="positioningMarketCategory"
      />,
    );

    expect(screen.getByRole('button', { name: /^rerun$/i })).toBeEnabled();
  });

  it('reruns paid media through the rerun route so completed rows reset before scheduling', async (): Promise<void> => {
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
        '/api/research-v2/rerun-section',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            runId: '00000000-0000-4000-8000-0000000000aa',
            zone: PAID_MEDIA_PLAN_SECTION_ID,
            executionMode: 'lab',
          }),
        }),
      ),
    );
  });

  it('reruns cross-section reasoning through the rerun route so completed rows reset before scheduling', async (): Promise<void> => {
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
        completeWorker(CROSS_SECTION_REASONING_SECTION_ID),
      ],
      sectionsByZone: {
        [CROSS_SECTION_REASONING_SECTION_ID]: {
          data: crossSectionReasoningFixtureArtifact,
        },
      },
    });

    render(
      <form onSubmit={submitMock}>
        <AuditReaderShell
          runId="00000000-0000-4000-8000-0000000000aa"
          activeSectionId={CROSS_SECTION_REASONING_SECTION_ID}
        />
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^rerun$/i }));
    expect(submitMock).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/research-v2/rerun-section',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            runId: '00000000-0000-4000-8000-0000000000aa',
            zone: CROSS_SECTION_REASONING_SECTION_ID,
            executionMode: 'lab',
          }),
        }),
      ),
    );
  });

  it('reruns synthesis through the rerun route so completed rows reset before scheduling', async (): Promise<void> => {
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
        completeWorker(POSITIONING_SYNTHESIS_SECTION_ID),
      ],
      sectionsByZone: {
        [POSITIONING_SYNTHESIS_SECTION_ID]: {
          data: positioningSynthesisFixtureArtifact,
        },
      },
    });

    render(
      <form onSubmit={submitMock}>
        <AuditReaderShell
          runId="00000000-0000-4000-8000-0000000000aa"
          activeSectionId={POSITIONING_SYNTHESIS_SECTION_ID}
        />
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^rerun$/i }));
    expect(submitMock).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/research-v2/rerun-section',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            runId: '00000000-0000-4000-8000-0000000000aa',
            zone: POSITIONING_SYNTHESIS_SECTION_ID,
            executionMode: 'lab',
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

  it('does not copy strategic critic metadata as artifact body markdown', async (): Promise<void> => {
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
      children_complete: 6,
      children_total: 6,
      workerStates: [
        ...POSITIONING_SECTION_IDS.map((sectionId) => completeWorker(sectionId)),
        completeWorker(CROSS_SECTION_REASONING_SECTION_ID),
      ],
      sectionsByZone: {
        [CROSS_SECTION_REASONING_SECTION_ID]: {
          data: {
            ...crossSectionReasoningFixtureArtifact,
            strategicCritique: {
              checkedAt: '2026-06-04T13:00:00.000Z',
              items: [
                {
                  action: 'deepened',
                  path: 'body.crossSectionThreads[0].claim',
                  rationale:
                    'The critic made the implementation-delay trade-off specific.',
                  text: 'The upgraded strategic claim.',
                  verdict: 'passes',
                },
              ],
              modelId: 'claude-opus-4-5',
              summary: 'The critic deepened the main cross-section thread.',
              target: 'cross_section_reasoning',
            },
          },
        },
      },
    });

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId={CROSS_SECTION_REASONING_SECTION_ID}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('Cross-Section Reasoning'),
      ),
    );
    const copiedText = writeText.mock.calls[0]?.[0];
    expect(copiedText).toContain('## Cross Section Threads');
    expect(copiedText).not.toContain('Strategic Critique');
    expect(copiedText).not.toContain(
      'The critic deepened the main cross-section thread.',
    );
    expect(copiedText).not.toContain('body.crossSectionThreads[0].claim');
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

  it('shares the current v3 run and copies the public link', async (): Promise<void> => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input);
        if (url.includes('/api/journey/session')) {
          return Response.json({ metadata: { companyName: 'SaaSLaunch' } });
        }
        if (url === '/api/share') {
          return Response.json({
            success: true,
            shareUrl: '/shared/share_token_123',
            shareToken: 'share_token_123',
          });
        }
        return Response.json({ error: 'unexpected request' }, { status: 500 });
      },
    );
    vi.stubGlobal('fetch', fetchMock);
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
    await screen.findByText('SaaSLaunch');

    fireEvent.click(screen.getByRole('button', { name: /share audit/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/share',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            sessionId: '00000000-0000-4000-8000-0000000000aa',
            title: 'SaaSLaunch Positioning Audit',
          }),
        }),
      ),
    );
    expect(writeText).toHaveBeenCalledWith('/shared/share_token_123');
  });

  it('contains malformed committed bodies with an error boundary', (): void => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
            sectionTitle: 'Market & Category Intelligence',
            verdict: 'Malformed body should not white-screen.',
            statusSummary: 'Renderer crash is contained.',
            confidence: 0,
            sources: [{ title: 'Source', url: 'https://example.com' }],
          },
        },
      },
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByText('Section body could not render.')).toBeInTheDocument();
    errorSpy.mockRestore();
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
