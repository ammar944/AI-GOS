/** @vitest-environment jsdom */
import { render, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentArtifactSurface } from '../agent-artifact-surface';
import { buyerIcpArtifactFixture } from '../buyer-icp/__tests__/test-fixtures';
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
    expect(within(drawer).getByText('Market & Category Intelligence')).toBeInTheDocument();
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

  it('renders typed BuyerICP cards from audit-state instead of the markdown fallback', () => {
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
    expect(screen.getByText('Confidence 8/10')).toBeInTheDocument();
    expect(screen.queryByText('markdown fallback should not render')).toBeNull();
  });

  it('renders typed non-BuyerICP cards from audit-state instead of the markdown fallback', () => {
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

    expect(
      screen.getByTestId('typed-artifact-renderer-positioningMarketCategory'),
    ).toBeInTheDocument();
    expect(screen.getByText('Confidence 7/10')).toBeInTheDocument();
    expect(screen.getByText('Pipeline management category prose from typed data.')).toBeInTheDocument();
    expect(screen.getByText('Legacy CRM')).toBeInTheDocument();
    expect(
      screen.getByTestId(
        'typed-card-group-positioningMarketCategory-categoryDefinition-adjacentCategories',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('markdown fallback should not render')).toBeNull();
  });
});
