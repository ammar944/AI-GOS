import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JourneyRunBlockerPanel } from '../journey-run-blocker-panel';
import type { JourneyRunView } from '@/lib/journey/run-view';

function makeRunView(status: JourneyRunView['status']): JourneyRunView {
  return {
    run: {
      sessionId: 'session-1',
      profileId: null,
      runId: 'run-1',
      companyName: 'Acme AI',
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:05:30.000Z',
      raw: null,
    },
    status,
    deepResearchActivity: null,
    sections: [
      {
        id: 'industryMarket',
        label: 'Market Overview',
        order: 0,
        phase: 'review',
        status: 'complete',
        result: null,
        activity: null,
        cards: [],
        latestEvent: {
          id: 'market-output',
          section: 'industryMarket',
          type: 'output',
          message: 'Synthesized market overview.',
          status: 'complete',
          createdAt: '2026-05-07T00:02:00.000Z',
        },
        events: [],
        blocker: null,
        pendingDependencyReason: null,
      },
      {
        id: 'offerAnalysis',
        label: 'Offer Analysis',
        order: 3,
        phase: 'error',
        status: 'error',
        result: {
          status: 'error',
          section: 'offerAnalysis',
          durationMs: 600000,
          error: 'Source gap: no pricing evidence returned.',
        },
        activity: {
          jobId: 'job-offer',
          section: 'offerAnalysis',
          status: 'error',
          tool: 'researchOffer',
          startedAt: '2026-05-07T00:03:00.000Z',
          completedAt: '2026-05-07T00:13:00.000Z',
          error: 'Worker timed out while evaluating pricing evidence.',
        },
        cards: [],
        latestEvent: {
          id: 'offer-error',
          section: 'offerAnalysis',
          type: 'error',
          message: 'Worker timed out while evaluating pricing evidence.',
          status: 'error',
          createdAt: '2026-05-07T00:13:00.000Z',
          metadata: {
            toolName: 'researchOffer',
          },
        },
        events: [],
        blocker: null,
        pendingDependencyReason: null,
      },
    ],
    latestEventBySection: {},
    eventsBySection: {},
    artifactsBySection: {},
    artifactsByTool: {},
    messages: [],
    readiness: {
      ready: false,
      missingSections: ['offerAnalysis', 'keywordIntel', 'crossAnalysis', 'mediaPlan'],
      completedSectionKeys: ['industryMarket'],
    },
  };
}

describe('JourneyRunBlockerPanel', () => {
  it('answers why the run stopped and what the operator can do next', () => {
    render(<JourneyRunBlockerPanel view={makeRunView('failed')} />);

    const panel = screen.getByTestId('journey-run-blocker-panel');
    expect(panel).toHaveTextContent('Run needs attention');
    expect(panel).toHaveTextContent('Offer Analysis');
    expect(panel).toHaveTextContent('Source gap: no pricing evidence returned.');
    expect(panel).toHaveTextContent('Worker timed out while evaluating pricing evidence.');
    expect(panel).toHaveTextContent(
      'Review the stage details and retry the section when the input or worker issue is resolved',
    );
    expect(panel).toHaveTextContent('Diagnostic details');
    expect(panel).toHaveTextContent('job-offer');
    expect(panel).not.toHaveTextContent('"toolName"');
  });

  it('does not render blocker chrome for a running run', () => {
    const { container } = render(<JourneyRunBlockerPanel view={makeRunView('running')} />);

    expect(container.firstChild).toBeNull();
  });
});
