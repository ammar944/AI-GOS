/** @vitest-environment jsdom */
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AgentArtifactSurface } from '../agent-artifact-surface';

vi.mock('../audit-artifact-canvas', () => ({
  AuditArtifactCanvas: ({ runId }: { runId: string }) => (
    <div data-testid="audit-artifact-canvas">canvas-{runId}</div>
  ),
}));

describe('AgentArtifactSurface', () => {
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

  it('hides the artifact-document when showArtifact=false (initial centered-composer state)', () => {
    render(<AgentArtifactSurface runId="run-abc" showArtifact={false} />);
    expect(screen.queryByTestId('artifact-document')).toBeNull();
    expect(screen.queryByTestId('worker-chips')).toBeNull();
    expect(screen.getByTestId('composer')).toBeTruthy();
  });

  it('opens the sources drawer when the toolbar Sources button is clicked', () => {
    render(<AgentArtifactSurface runId="run-abc" />);
    expect(screen.queryByTestId('sources-drawer')).toBeNull();
    fireEvent.click(screen.getByText('Sources'));
    expect(screen.getByTestId('sources-drawer')).toBeTruthy();
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
});
