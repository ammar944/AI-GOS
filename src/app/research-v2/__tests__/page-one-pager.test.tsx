/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import {
  POSITIONING_SECTION_IDS,
} from '@/lib/ai/prompts/positioning-skills';

// ---------------------------------------------------------------------------
// Hoisted mocks — mirrors page-corpus-transition.test.tsx setup
// ---------------------------------------------------------------------------

const routerMock = vi.hoisted(() => ({ replace: vi.fn() }));
const searchParamsMock = vi.hoisted(() => ({
  value: new URLSearchParams('runId=run-sections'),
}));
const useAuditStateMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParamsMock.value,
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    isLoaded: true,
    user: { id: 'user_1' },
  }),
}));

// Stub the heavy renderer so the shell renders cleanly without the full
// typed-artifact tree (which is out of scope for this test).
vi.mock('@/components/research-v2/typed-artifact-renderer', () => ({
  TypedArtifactRenderer: ({ zoneId }: { zoneId: string }) => (
    <div data-testid={`typed-stub-${zoneId}`}>typed:{zoneId}</div>
  ),
}));

vi.mock('@/lib/research-v2/use-audit-state', () => ({
  useAuditState: useAuditStateMock,
}));

// Stub the other state-machine surfaces so they don't interfere when state
// is 'welcome' (the initial mount before hydration completes).
vi.mock('@/components/research-v2/welcome-form', () => ({
  WelcomeForm: () => <div data-testid="welcome" />,
}));

vi.mock('@/components/research-v2/corpus-stream', () => ({
  CorpusStream: () => <div data-testid="corpus" />,
}));

vi.mock('@/components/research-v2/error-recovery', () => ({
  ErrorRecovery: () => <div data-testid="error" />,
}));

vi.mock('@/components/onboarding', () => ({
  OnboardingWizard: () => <div data-testid="onboarding" />,
}));

const { default: ResearchV2Page } = await import('../page');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeWorkerStates(
  status: 'queued' | 'running' | 'complete' = 'complete',
): AuditStateResponse['workerStates'] {
  return POSITIONING_SECTION_IDS.map((section_id) => makeWorkerState(section_id, status));
}

function makeWorkerState(
  section_id: AuditStateResponse['workerStates'][number]['section_id'],
  status: AuditStateResponse['workerStates'][number]['status'],
  latestActivity: string | null = null,
): AuditStateResponse['workerStates'][number] {
  const phase = status === 'complete'
    ? 'Committed'
    : status === 'running'
      ? 'Reading sources'
      : 'Queued';
  return {
    section_id,
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

function makeArtifact({
  confidence = 8,
  sectionTitle = 'Market & Category Intelligence',
  sources = [],
}: {
  confidence?: number;
  sectionTitle?: string;
  sources?: Array<{ title: string; url: string; whyItMatters?: string }>;
}): Record<string, unknown> {
  return {
    sectionTitle,
    verdict: `${sectionTitle} verdict.`,
    statusSummary: `${sectionTitle} status.`,
    confidence,
    sources,
  };
}

function buildSessionPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    runId: 'run-sections',
    researchResults: {
      deepResearchProgram: {
        status: 'complete',
        data: {
          onboardingFields: {
            companyName: { value: 'Clay', confidence: 0.9 },
          },
        },
      },
      // 6 positioning sections committed = sections state
      ...Object.fromEntries(
        POSITIONING_SECTION_IDS.map((id) => [id, { status: 'complete', data: {} }]),
      ),
    },
    jobStatus: null,
    onboardingData: { companyName: 'Clay', websiteUrl: 'https://clay.com' },
    metadata: { websiteUrl: 'https://clay.com', companyName: 'Clay' },
    updatedAt: '2026-05-20T12:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResearchV2Page — light audit reader shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    searchParamsMock.value = new URLSearchParams('runId=run-sections');
    useAuditStateMock.mockReturnValue({
      parent_audit_run_id: 'parent-run',
      parent_status: 'complete',
      children_complete: 6,
      children_total: 6,
      workerStates: makeWorkerStates('complete'),
      sectionsByZone: {
        positioningMarketCategory: {
          data: makeArtifact({
            confidence: 8,
            sources: [
              {
                title: 'Market source',
                url: 'https://example.com/market-source',
                whyItMatters: 'Market source reason.',
              },
            ],
          }),
        },
      },
      eventsByZone: {},
    });
  });

  it('renders the light top bar, active section controls, and seven-section rail', async () => {
    const fetchMock = vi
      .fn()
      // hydrate via runId (page.tsx initial mount)
      .mockResolvedValue(jsonResponse(buildSessionPayload()));
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV2Page />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-reader-shell')).toBeInTheDocument(),
    );

    expect(screen.getByText('Positioning Audit')).toBeInTheDocument();
    expect(screen.getByText('Section 1 of 7')).toBeInTheDocument();
    expect(screen.getByLabelText('Confidence 8/10')).toBeInTheDocument();
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('button', { name: /copy/i })).toBeEnabled();
    expect(within(header).getByRole('button', { name: /rerun/i })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /market.*category.*8 confidence/i }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /paid media plan.*ready after 6\/6/i }),
    ).toBeEnabled();
  });

  it('does not render the retired one-pager progress strip or footer', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(buildSessionPayload()));
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV2Page />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-reader-shell')).toBeInTheDocument(),
    );

    expect(screen.queryByTestId('audit-progress-strip')).toBeNull();
    expect(screen.queryByTestId('audit-reader-footer')).toBeNull();
    expect(screen.queryByText(/Pre-Pitch Positioning Audit/i)).toBeNull();
  });

  it('shows running activity in the reading column and rail', async () => {
    useAuditStateMock.mockReturnValue({
      parent_audit_run_id: 'parent-run',
      parent_status: 'running',
      children_complete: 2,
      children_total: 6,
      workerStates: POSITIONING_SECTION_IDS.map((section_id, i) =>
        makeWorkerState(
          section_id,
          i < 2 ? 'complete' : i === 2 ? 'running' : 'queued',
          i === 2 ? 'Reading competitor evidence' : null,
        ),
      ),
      sectionsByZone: {},
      eventsByZone: {},
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(buildSessionPayload()));
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV2Page />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-reader-shell')).toBeInTheDocument(),
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Competitor/i,
    );
    expect(screen.getByText('Reading competitor evidence')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /competitors.*running/i }),
    ).toBeEnabled();
  });

  it('renders the seven rail items in pipeline order', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(buildSessionPayload()));
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV2Page />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-reader-shell')).toBeInTheDocument(),
    );

    const rail = screen.getByRole('navigation', { name: 'Sections' });
    const items = within(rail).getAllByRole('button');
    expect(items).toHaveLength(7);
    expect(items.map((item) => item.getAttribute('aria-label') ?? '')).toEqual([
      expect.stringMatching(/Market & Category/i),
      expect.stringMatching(/Buyer \/ ICP/i),
      expect.stringMatching(/Competitors/i),
      expect.stringMatching(/Voice of Customer/i),
      expect.stringMatching(/Demand \/ Intent/i),
      expect.stringMatching(/Offer Diagnostic/i),
      expect.stringMatching(/Paid Media Plan/i),
    ]);
  });

  it('locks the paid media terminal until all six positioning sections complete', async () => {
    useAuditStateMock.mockReturnValue({
      parent_audit_run_id: 'parent-run',
      parent_status: 'running',
      children_complete: 5,
      children_total: 6,
      workerStates: POSITIONING_SECTION_IDS.map((section_id, i) =>
        makeWorkerState(section_id, i < 5 ? 'complete' : 'running'),
      ),
      sectionsByZone: {},
      eventsByZone: {},
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(buildSessionPayload()));
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV2Page />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-reader-shell')).toBeInTheDocument(),
    );

    expect(
      screen.getByRole('button', { name: /paid media plan.*locked until 6\/6/i }),
    ).toBeInTheDocument();
  });

  it('renders the active section body and source list from the typed artifact', async () => {
    const sourceUrl = 'https://example.com/market-source';
    useAuditStateMock.mockReturnValue({
      parent_audit_run_id: 'parent-run',
      parent_status: 'complete',
      children_complete: 6,
      children_total: 6,
      workerStates: makeWorkerStates('complete'),
      sectionsByZone: {
        positioningMarketCategory: {
          data: makeArtifact({
            sectionTitle: 'Market Category',
            confidence: 8,
            sources: [
              {
                title: 'Market source',
                url: sourceUrl,
                whyItMatters: 'Top-level source.',
              },
            ],
          }),
        },
      },
      eventsByZone: {},
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(buildSessionPayload()));
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV2Page />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-reader-shell')).toBeInTheDocument(),
    );

    expect(screen.getByTestId('typed-stub-positioningMarketCategory')).toHaveTextContent(
      'typed:positioningMarketCategory',
    );
    expect(screen.getByText('1 sources')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /market source/i })).toHaveAttribute(
      'href',
      sourceUrl,
    );
  });
});
