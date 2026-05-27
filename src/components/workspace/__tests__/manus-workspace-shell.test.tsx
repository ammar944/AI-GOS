import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ManusWorkspaceShell } from '../manus-workspace-shell';
import type { SectionKey, SectionPhase, WorkspaceState } from '@/lib/workspace/types';

const sectionStates: Record<SectionKey, SectionPhase> = {
  deepResearchProgram: 'approved',
  industryMarket: 'approved',
  icpValidation: 'researching',
  competitors: 'queued',
  offerAnalysis: 'queued',
  keywordIntel: 'queued',
  crossAnalysis: 'queued',
  mediaPlan: 'queued',
};

const workspaceState: Pick<WorkspaceState, 'currentSection' | 'sectionStates'> = {
  currentSection: 'icpValidation',
  sectionStates,
};

describe('ManusWorkspaceShell', () => {
  it('renders chat as the primary surface with adjacent artifact and secondary run details', () => {
    render(
      <ManusWorkspaceShell
        workspaceState={workspaceState}
        statusSummary={<p>2 of 7 sections ready</p>}
        chat={<div>Operator chat</div>}
        artifact={<div>Artifact body</div>}
        runDetails={<div>Worker heartbeat telemetry</div>}
      />,
    );

    const shell = screen.getByTestId('manus-workspace-shell');
    const chat = screen.getByTestId('manus-workspace-chat');
    const artifact = screen.getByTestId('manus-workspace-artifact');
    const runDetails = screen.getByTestId('manus-workspace-run-details');
    const progress = screen.getByTestId('manus-workspace-section-progress');

    expect(chat).toHaveAccessibleName('Primary chat workspace');
    expect(artifact).toHaveAccessibleName('Report artifact workspace');
    expect(within(chat).getByText('Operator chat')).toBeInTheDocument();
    expect(within(artifact).getByText('Artifact body')).toBeInTheDocument();
    expect(within(runDetails).getByText('Worker heartbeat telemetry')).toBeInTheDocument();
    expect(within(shell).getByText('2 of 7 sections ready')).toBeInTheDocument();

    expect(chat.compareDocumentPosition(artifact) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(progress).getByLabelText('Market & Category: approved')).toBeInTheDocument();
    expect(within(progress).getByLabelText('Buyer & ICP: researching')).toHaveAttribute('aria-current', 'step');
  });

  it('uses a section navigation slot and omits telemetry when run details are not provided', () => {
    render(
      <ManusWorkspaceShell
        sectionNav={<nav aria-label="Custom section navigation">Custom nav</nav>}
        chat={<div>Chat slot</div>}
        artifact={<div>Artifact slot</div>}
      />,
    );

    expect(screen.getByLabelText('Custom section navigation')).toHaveTextContent('Custom nav');
    expect(screen.queryByTestId('manus-workspace-section-progress')).not.toBeInTheDocument();
    expect(screen.queryByTestId('manus-workspace-run-details')).not.toBeInTheDocument();
  });
});
