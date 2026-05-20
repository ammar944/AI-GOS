/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';

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

vi.mock('@/components/research-v2/onboarding-wizard-v2', () => ({
  OnboardingWizardV2: () => <div data-testid="onboarding" />,
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
) {
  return POSITIONING_SECTION_IDS.map((section_id) => ({
    section_id,
    status,
  }));
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

describe('ResearchV2Page — one-pager shell', () => {
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
      sectionsByZone: {},
      eventsByZone: {},
    });
  });

  it('renders DocumentHeader at top with no buttons in the banner region', async () => {
    const fetchMock = vi
      .fn()
      // hydrate via runId (page.tsx initial mount)
      .mockResolvedValue(jsonResponse(buildSessionPayload()));
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV2Page />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-reader-shell')).toBeInTheDocument(),
    );

    // DocumentHeader eyebrow
    expect(
      screen.getByText(/Pre-Pitch Positioning Audit/i),
    ).toBeInTheDocument();

    // Header is a <header> banner — no buttons inside it
    const header = screen.getByRole('banner');
    expect(header.querySelector('button')).toBeNull();
  });

  it('hides the progress strip when every section is complete', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(buildSessionPayload()));
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV2Page />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-reader-shell')).toBeInTheDocument(),
    );

    expect(screen.queryByTestId('audit-progress-strip')).toBeNull();
    expect(screen.queryByText(/drafting/i)).toBeNull();
  });

  it('shows the progress strip when at least one section is still running', async () => {
    useAuditStateMock.mockReturnValue({
      parent_audit_run_id: 'parent-run',
      parent_status: 'running',
      children_complete: 2,
      children_total: 6,
      workerStates: POSITIONING_SECTION_IDS.map((section_id, i) => ({
        section_id,
        status: i < 2 ? 'complete' : i === 2 ? 'running' : 'queued',
      })),
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

    const strip = screen.getByTestId('audit-progress-strip');
    expect(strip).toBeInTheDocument();
    expect(within(strip).getByText(/drafting/i)).toBeInTheDocument();
    expect(within(strip).getByText(/1 running/i)).toBeInTheDocument();
  });

  it('renders all 6 chapters as h2 headings in pipeline order', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(buildSessionPayload()));
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV2Page />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-reader-shell')).toBeInTheDocument(),
    );

    const chapters = screen.getAllByRole('heading', { level: 2 });
    expect(chapters).toHaveLength(6);

    // Pipeline order — labels come from POSITIONING_SECTION_LABELS fallback
    const titles = chapters.map((h) => h.textContent ?? '');
    expect(titles[0]).toMatch(/Market.*Category/i);
    expect(titles[1]).toMatch(/Buyer.*ICP/i);
    expect(titles[2]).toMatch(/Competitor/i);
    expect(titles[3]).toMatch(/Voice of Customer/i);
    expect(titles[4]).toMatch(/Demand/i);
    expect(titles[5]).toMatch(/Offer/i);
  });

  it('renders the footer with dispatch + rerun text links instead of buttons in the header', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(buildSessionPayload()));
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV2Page />);

    await waitFor(() =>
      expect(screen.getByTestId('audit-reader-shell')).toBeInTheDocument(),
    );

    const footer = screen.getByTestId('audit-reader-footer');
    expect(
      within(footer).getByRole('button', { name: /dispatch full audit/i }),
    ).toBeInTheDocument();
    expect(
      within(footer).getByRole('button', { name: /rerun blocked/i }),
    ).toBeInTheDocument();
  });
});
