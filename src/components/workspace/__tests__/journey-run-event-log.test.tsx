import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JourneyRunEventLog } from '../journey-run-event-log';
import type { JourneyRunView } from '@/lib/journey/run-view';
import type { SectionKey } from '@/lib/workspace/types';

function makeSection(
  overrides: Partial<JourneyRunView['sections'][number]>,
): JourneyRunView['sections'][number] {
  return {
    id: 'industryMarket',
    label: 'Market Overview',
    order: 0,
    phase: 'queued',
    status: 'queued',
    result: null,
    activity: null,
    cards: [],
    latestEvent: null,
    events: [],
    blocker: null,
    pendingDependencyReason: null,
    ...overrides,
  };
}

function makeRunView(): JourneyRunView {
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
    status: 'failed',
    deepResearchActivity: null,
    sections: [
      makeSection({
        id: 'industryMarket',
        label: 'Market Overview',
        order: 0,
        phase: 'review',
        status: 'complete',
        latestEvent: {
          id: 'market-output',
          section: 'industryMarket',
          type: 'output',
          message: 'Synthesized market overview.',
          status: 'complete',
          createdAt: '2026-05-07T00:02:00.000Z',
        },
        events: [
          {
            id: 'market-tool',
            section: 'industryMarket',
            type: 'tool',
            message: 'Collected market sources.',
            status: 'complete',
            createdAt: '2026-05-07T00:01:00.000Z',
            metadata: {
              url: 'https://example.com/source',
              resultCount: 3,
            },
          },
          {
            id: 'market-output',
            section: 'industryMarket',
            type: 'output',
            message: 'Synthesized market overview.',
            status: 'complete',
            createdAt: '2026-05-07T00:02:00.000Z',
          },
        ],
      }),
      makeSection({
        id: 'offerAnalysis',
        label: 'Offer Analysis',
        order: 3,
        phase: 'error',
        status: 'error',
        latestEvent: {
          id: 'offer-error',
          section: 'offerAnalysis',
          type: 'error',
          message: 'Worker timed out while evaluating pricing evidence.',
          status: 'error',
          createdAt: '2026-05-07T00:04:00.000Z',
        },
        events: [
          {
            id: 'offer-error',
            section: 'offerAnalysis',
            type: 'error',
            message: 'Worker timed out while evaluating pricing evidence.',
            status: 'error',
            createdAt: '2026-05-07T00:04:00.000Z',
          },
        ],
        blocker: 'Offer Analysis timed out after 10 minutes.',
      }),
      makeSection({
        id: 'icpValidation' as SectionKey,
        label: 'ICP Validation',
        order: 1,
        phase: 'queued',
        status: 'queued',
      }),
    ],
    latestEventBySection: {},
    eventsBySection: {},
    artifactsBySection: {},
    artifactsByTool: {},
    messages: [],
    readiness: {
      ready: false,
      missingSections: ['icpValidation', 'competitors', 'offerAnalysis', 'keywordIntel', 'crossAnalysis', 'mediaPlan'],
      completedSectionKeys: ['industryMarket'],
    },
  };
}

describe('JourneyRunEventLog', () => {
  it('renders grouped stage events in persisted order with expandable history and secondary diagnostics', () => {
    render(<JourneyRunEventLog view={makeRunView()} />);

    const log = screen.getByTestId('journey-run-event-log');
    expect(log).toHaveTextContent('Event log');
    expect(log.textContent?.indexOf('Market Overview')).toBeLessThan(
      log.textContent?.indexOf('ICP Validation') ?? 0,
    );
    expect(log.textContent?.indexOf('ICP Validation')).toBeLessThan(
      log.textContent?.indexOf('Offer Analysis') ?? 0,
    );

    expect(log).toHaveTextContent('Latest');
    expect(log).toHaveTextContent('Synthesized market overview.');
    expect(log).toHaveTextContent('Offer Analysis timed out after 10 minutes.');
    expect(log).toHaveTextContent('Worker timed out while evaluating pricing evidence.');
    expect(log).not.toHaveTextContent('Collected market sources.');
    expect(log).not.toHaveTextContent('https://example.com/source');
    expect(log).not.toHaveTextContent('"url"');

    fireEvent.click(
      screen.getByRole('button', { name: /show full history for market overview/i }),
    );

    const marketGroup = screen.getByTestId('journey-run-event-log-industryMarket');
    expect(within(marketGroup).getByText('Collected market sources.')).toBeInTheDocument();
    expect(within(marketGroup).getByText('Diagnostics')).toBeInTheDocument();
    expect(within(marketGroup).getByText('url')).toBeInTheDocument();
    expect(within(marketGroup).getByText('https://example.com/source')).toBeInTheDocument();
  });

  it('does not render without a run view', () => {
    const { container } = render(<JourneyRunEventLog view={null} />);

    expect(container.firstChild).toBeNull();
  });
});
