/** @vitest-environment jsdom */
import { render, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentArtifactSurface } from '../agent-artifact-surface';
import {
  buyerIcpArtifactFixture,
  competitorLandscapeArtifactFixture,
  demandIntentArtifactFixture,
  marketCategoryArtifactFixture as fullMarketCategoryArtifactFixture,
  offerPerformanceArtifactFixture,
  voiceOfCustomerArtifactFixture,
} from '../section-renderers/fixtures';
import type { PositioningTypedArtifact } from '@/types/positioning-artifact';

const useAuditStateMock = vi.hoisted(() => vi.fn());

vi.mock('../audit-artifact-canvas', () => ({
  AuditArtifactCanvas: ({ runId }: { runId: string }) => (
    <div data-testid="audit-artifact-canvas">canvas-{runId}</div>
  ),
}));

vi.mock('@/lib/research-v2/use-audit-state', () => ({
  useAuditState: useAuditStateMock,
}));

const EMPTY_AUDIT_STATE = {
  parent_audit_run_id: null,
  parent_status: null,
  children_complete: 0,
  children_total: 0,
  workerStates: [],
  sectionsByZone: {},
  eventsByZone: {},
};

const marketCategoryArtifactFixture = {
  sectionTitle: 'Market & Category Intelligence',
  verdict: 'The market exists, but category language is still split.',
  statusSummary: 'The typed artifact should render before markdown fallback.',
  confidence: 7,
  sources: [
    {
      title: 'Market source',
      url: 'https://example.com/market',
      whyItMatters: 'Supports the market category read.',
    },
  ],
  categoryDefinition: {
    prose: 'Pipeline management category prose from typed data.',
    adjacentCategories: [
      {
        name: 'Legacy CRM',
        whyBuyersConfuseIt: 'Confused because buyer teams compare it to pipeline tools.',
        disambiguatingSignal: 'Automation-first follow-up separates the category.',
        sourceTitle: 'CRM comparison',
        sourceUrl: 'https://example.com/crm',
      },
    ],
  },
} satisfies PositioningTypedArtifact;

describe('AgentArtifactSurface', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    useAuditStateMock.mockReturnValue(EMPTY_AUDIT_STATE);
  });

  it('renders the centered composer with no left/right rails', () => {
    render(<AgentArtifactSurface runId="run-abc" />);
    expect(screen.getByTestId('composer')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(document.querySelector('[data-rail]')).toBeNull();
  });

  it('renders six worker chips by default', () => {
    render(<AgentArtifactSurface runId="run-abc" />);
    expect(screen.getAllByTestId(/worker-chip-/)).toHaveLength(6);
  });

  it('renders an artifact-document block when showArtifact is true', () => {
    render(<AgentArtifactSurface runId="run-abc" />);
    expect(screen.getByTestId('artifact-document')).toBeTruthy();
  });

  it('renders all six audit section anchors before the first section completes', () => {
    render(<AgentArtifactSurface runId="run-abc" />);
    expect(screen.getAllByTestId(/^artifact-section-/)).toHaveLength(6);
    expect(screen.getByText('Awaiting first section')).toBeInTheDocument();
  });

  it('hides the artifact-document when showArtifact=false (initial centered-composer state)', () => {
    render(<AgentArtifactSurface runId="run-abc" showArtifact={false} />);
    expect(screen.queryByTestId('artifact-document')).toBeNull();
    expect(screen.queryByTestId('worker-chips')).toBeNull();
    expect(screen.getByTestId('composer')).toBeTruthy();
  });

  it('opens the sources drawer when the toolbar Sources button is clicked', () => {
    render(<AgentArtifactSurface runId="run-abc" />);
    expect(screen.queryByTestId('sources-drawer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sources' }));
    expect(screen.getByTestId('sources-drawer')).toBeTruthy();
  });

  it('lists typed artifact sources in the audit sources drawer', () => {
    useAuditStateMock.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: 'parent-run',
      workerStates: [
        { section_id: 'positioningMarketCategory', status: 'complete' },
        { section_id: 'positioningBuyerICP', status: 'queued' },
        { section_id: 'positioningCompetitorLandscape', status: 'queued' },
        { section_id: 'positioningVoiceOfCustomer', status: 'queued' },
        { section_id: 'positioningDemandIntent', status: 'queued' },
        { section_id: 'positioningOfferDiagnostic', status: 'queued' },
      ],
      sectionsByZone: {
        positioningMarketCategory: {
          title: marketCategoryArtifactFixture.sectionTitle,
          data: marketCategoryArtifactFixture,
        },
      },
    });

    render(<AgentArtifactSurface runId="run-abc" />);
    fireEvent.click(screen.getByRole('button', { name: 'Sources' }));
    const drawer = screen.getByTestId('sources-drawer');
    expect(within(drawer).getByText('Market source')).toBeInTheDocument();
    // Section-level "Market source" + item-level "CRM comparison" both group
    // under the Market & Category Intelligence zone, so the label appears
    // per-source.
    expect(
      within(drawer).getAllByText('Market & Category Intelligence').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('calls onSubmit with the trimmed composer text', () => {
    const onSubmit = vi.fn();
    render(<AgentArtifactSurface runId="run-abc" onSubmit={onSubmit} />);
    const textarea = screen.getByLabelText('Artifact command line') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '   tighten icp claim 1  ' } });
    fireEvent.submit(screen.getByTestId('composer'));
    expect(onSubmit).toHaveBeenCalledWith('tighten icp claim 1');
  });

  it('reflects worker chip status via the data-status attribute', () => {
    render(
      <AgentArtifactSurface
        runId="run-abc"
        workerStates={[
          { section_id: 'positioningMarketCategory', status: 'running' },
          { section_id: 'positioningBuyerICP', status: 'complete' },
          { section_id: 'positioningCompetitorLandscape', status: 'error' },
          { section_id: 'positioningVoiceOfCustomer', status: 'aborted' },
          { section_id: 'positioningDemandIntent', status: 'queued' },
          { section_id: 'positioningOfferDiagnostic', status: 'queued' },
        ]}
      />,
    );
    expect(
      screen.getByTestId('worker-chip-positioningMarketCategory').getAttribute('data-status'),
    ).toBe('running');
    expect(
      screen.getByTestId('worker-chip-positioningBuyerICP').getAttribute('data-status'),
    ).toBe('complete');
  });

  it('renders phase labels, latest activity, and wave state without generic running copy', () => {
    useAuditStateMock.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: 'parent-run',
      children_total: 6,
      workerStates: [
        {
          section_id: 'positioningMarketCategory',
          status: 'running',
          phase: 'Compiling context',
          phaseLabel: 'Compiling context',
          latestTool: 'web_search',
          latestSource: 'https://example.com/category',
          latestActivity: 'Building Section Context Pack',
          nextStep: 'Read source excerpts',
          elapsedMs: 1200,
          wave: 1,
          totalWaves: 2,
          concurrency: 3,
          capabilityGaps: [],
        },
        {
          section_id: 'positioningBuyerICP',
          status: 'running',
          phase: 'Reading sources',
          phaseLabel: 'Reading sources',
          latestTool: null,
          latestSource: null,
          latestActivity: null,
          nextStep: null,
          elapsedMs: 900,
          wave: 1,
          totalWaves: 2,
          concurrency: 3,
          capabilityGaps: [],
        },
        { section_id: 'positioningCompetitorLandscape', status: 'running', phase: 'Drafting', phaseLabel: 'Drafting' },
        { section_id: 'positioningVoiceOfCustomer', status: 'queued', phase: 'Queued', phaseLabel: 'Queued' },
        { section_id: 'positioningDemandIntent', status: 'queued', phase: 'Queued', phaseLabel: 'Queued' },
        { section_id: 'positioningOfferDiagnostic', status: 'queued', phase: 'Queued', phaseLabel: 'Queued' },
      ],
      eventsByZone: {
        positioningMarketCategory: [
          {
            id: 'event-1',
            event_type: 'searching',
            message: 'raw debug event',
            payload: null,
            created_at: '2026-05-15T12:00:00.000Z',
          },
        ],
      },
    });

    render(<AgentArtifactSurface runId="run-abc" />);

    expect(screen.getAllByText('Compiling context')).toHaveLength(3);
    expect(screen.getAllByText('Building Section Context Pack')).toHaveLength(2);
    expect(screen.getAllByText('Next: Read source excerpts')).toHaveLength(2);
    expect(screen.getAllByText('Tool: web_search')).toHaveLength(2);
    expect(screen.getAllByText('Source: example.com')).toHaveLength(2);
    expect(screen.getByText('Wave 1 of 2 - 3 running, 3 queued')).toBeInTheDocument();
    expect(screen.queryByText('Generating')).toBeNull();
    expect(screen.getAllByTestId('raw-events-details-positioningMarketCategory')).toHaveLength(2);
  });

  it('renders typed BuyerICP cards from audit-state instead of the markdown fallback', () => {
    vi.stubEnv('NEXT_PUBLIC_ARTIFACT_UI_V2', 'true');
    useAuditStateMock.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: 'parent-run',
      workerStates: [
        { section_id: 'positioningMarketCategory', status: 'queued' },
        { section_id: 'positioningBuyerICP', status: 'complete' },
        { section_id: 'positioningCompetitorLandscape', status: 'queued' },
        { section_id: 'positioningVoiceOfCustomer', status: 'queued' },
        { section_id: 'positioningDemandIntent', status: 'queued' },
        { section_id: 'positioningOfferDiagnostic', status: 'queued' },
      ],
      sectionsByZone: {
        positioningBuyerICP: {
          title: buyerIcpArtifactFixture.sectionTitle,
          markdown: 'markdown fallback should not render',
          data: buyerIcpArtifactFixture,
        },
      },
    });

    render(<AgentArtifactSurface runId="run-abc" />);

    expect(screen.getByText('Jordan Lee')).toBeInTheDocument();
    expect(screen.getByText('Named ICP evidence')).toBeInTheDocument();
    expect(screen.queryByText('markdown fallback should not render')).toBeNull();
  });

  it('routes all six section artifacts to dedicated typed renderers when artifact UI v2 is enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_ARTIFACT_UI_V2', 'true');
    useAuditStateMock.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: 'parent-run',
      workerStates: [
        { section_id: 'positioningMarketCategory', status: 'complete' },
        { section_id: 'positioningBuyerICP', status: 'complete' },
        { section_id: 'positioningCompetitorLandscape', status: 'complete' },
        { section_id: 'positioningVoiceOfCustomer', status: 'complete' },
        { section_id: 'positioningDemandIntent', status: 'complete' },
        { section_id: 'positioningOfferDiagnostic', status: 'complete' },
      ],
      sectionsByZone: {
        positioningMarketCategory: {
          title: fullMarketCategoryArtifactFixture.sectionTitle,
          markdown: 'market markdown fallback should not render',
          data: fullMarketCategoryArtifactFixture,
        },
        positioningBuyerICP: {
          title: buyerIcpArtifactFixture.sectionTitle,
          data: buyerIcpArtifactFixture,
        },
        positioningCompetitorLandscape: {
          title: competitorLandscapeArtifactFixture.sectionTitle,
          data: competitorLandscapeArtifactFixture,
        },
        positioningVoiceOfCustomer: {
          title: voiceOfCustomerArtifactFixture.sectionTitle,
          data: voiceOfCustomerArtifactFixture,
        },
        positioningDemandIntent: {
          title: demandIntentArtifactFixture.sectionTitle,
          data: demandIntentArtifactFixture,
        },
        positioningOfferDiagnostic: {
          title: offerPerformanceArtifactFixture.sectionTitle,
          data: offerPerformanceArtifactFixture,
        },
      },
    });

    render(<AgentArtifactSurface runId="run-abc" />);

    expect(screen.getByText('Category definition')).toBeInTheDocument();
    expect(screen.getByText('Named ICP evidence')).toBeInTheDocument();
    expect(screen.getByText('Competitor set')).toBeInTheDocument();
    expect(screen.getByText('Pain language')).toBeInTheDocument();
    expect(screen.getByText('Keyword demand')).toBeInTheDocument();
    expect(screen.getByText('Offer-market fit')).toBeInTheDocument();
    expect(screen.queryByText('market markdown fallback should not render')).toBeNull();
  });

  it('renders typed non-BuyerICP sections through the narrative renderer instead of markdown', () => {
    useAuditStateMock.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: 'parent-run',
      workerStates: [
        { section_id: 'positioningMarketCategory', status: 'complete' },
        { section_id: 'positioningBuyerICP', status: 'queued' },
        { section_id: 'positioningCompetitorLandscape', status: 'queued' },
        { section_id: 'positioningVoiceOfCustomer', status: 'queued' },
        { section_id: 'positioningDemandIntent', status: 'queued' },
        { section_id: 'positioningOfferDiagnostic', status: 'queued' },
      ],
      sectionsByZone: {
        positioningMarketCategory: {
          title: marketCategoryArtifactFixture.sectionTitle,
          markdown: 'markdown fallback should not render',
          data: marketCategoryArtifactFixture,
        },
      },
    });

    render(<AgentArtifactSurface runId="run-abc" />);

    const narrative = screen.getByTestId(
      'narrative-renderer-positioningMarketCategory',
    );
    expect(narrative).toBeInTheDocument();
    expect(within(narrative).getByText('Confidence 7/10')).toBeInTheDocument();
    expect(
      within(narrative).getByText(
        'Pipeline management category prose from typed data.',
      ),
    ).toBeInTheDocument();
    expect(within(narrative).getByText('Legacy CRM')).toBeInTheDocument();
    expect(
      screen.getByTestId(
        'narrative-subsection-positioningMarketCategory-categoryDefinition',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('markdown fallback should not render')).toBeNull();
  });

  it('opens the sources drawer and highlights the cited source when a footnote ref is clicked', async () => {
    useAuditStateMock.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: 'parent-run',
      workerStates: [
        { section_id: 'positioningMarketCategory', status: 'complete' },
        { section_id: 'positioningBuyerICP', status: 'queued' },
        { section_id: 'positioningCompetitorLandscape', status: 'queued' },
        { section_id: 'positioningVoiceOfCustomer', status: 'queued' },
        { section_id: 'positioningDemandIntent', status: 'queued' },
        { section_id: 'positioningOfferDiagnostic', status: 'queued' },
      ],
      sectionsByZone: {
        positioningMarketCategory: {
          title: marketCategoryArtifactFixture.sectionTitle,
          data: marketCategoryArtifactFixture,
        },
      },
    });

    render(<AgentArtifactSurface runId="run-abc" />);
    expect(screen.queryByTestId('sources-drawer')).toBeNull();

    // Section-level source is footnote 1 (Market source). Item-level
    // sourceUrl on Legacy CRM is footnote 2 — the lead's inline cite.
    const cite = screen.getByTestId('narrative-cite-positioningMarketCategory-2');
    fireEvent.click(cite);

    const drawer = await screen.findByTestId('sources-drawer');
    const highlighted = within(drawer).getByText('CRM comparison').closest('li');
    expect(highlighted?.getAttribute('data-highlighted')).toBe('true');
  });
});
