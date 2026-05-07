import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JourneyRunArtifactVisibilityPanel } from '../journey-run-artifact-visibility-panel';
import type { JourneyRunView } from '@/lib/journey/run-view';

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
  const marketResult: NonNullable<JourneyRunView['sections'][number]['result']> = {
    status: 'complete',
    section: 'industryMarket',
    durationMs: 1200,
    citations: [{ number: 1, url: 'https://example.com/source' }],
    provenance: {
      status: 'sourced',
      citationCount: 1,
    },
    validation: {
      section: 'industryResearch',
      issues: [],
    },
    data: {
      verdict: 'Demand exists.',
    },
  };

  const offerResult: NonNullable<JourneyRunView['sections'][number]['result']> = {
    status: 'complete',
    section: 'offerAnalysis',
    durationMs: 2400,
    validation: {
      section: 'offerAnalysis',
      issues: [
        {
          code: 'schema_validation',
          message: 'Missing pricing proof.',
          path: 'pricing',
        },
      ],
    },
    data: {
      unsupportedShape: true,
    },
  };

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
    status: 'partial',
    deepResearchActivity: null,
    sections: [
      makeSection({
        id: 'industryMarket',
        label: 'Market Overview',
        order: 0,
        phase: 'review',
        status: 'complete',
        result: marketResult,
        cards: [
          {
            id: 'industryMarket-prose-card-research-verdict',
            sectionKey: 'industryMarket',
            cardType: 'prose-card',
            label: 'Research Verdict',
            content: { text: 'Demand exists.' },
            status: 'draft',
            versions: [
              {
                content: { text: 'Previous verdict.' },
                editedBy: 'ai',
                timestamp: 1770000000000,
              },
            ],
          },
        ],
      }),
      makeSection({
        id: 'offerAnalysis',
        label: 'Offer Analysis',
        order: 3,
        phase: 'review',
        status: 'complete',
        result: offerResult,
        cards: [],
      }),
      makeSection({
        id: 'keywordIntel',
        label: 'Keywords',
        order: 4,
        phase: 'queued',
        status: 'queued',
      }),
    ],
    latestEventBySection: {},
    eventsBySection: {},
    artifactsBySection: {
      industryMarket: marketResult,
      offerAnalysis: offerResult,
    },
    artifactsByTool: {},
    messages: [],
    readiness: {
      ready: false,
      missingSections: ['offerAnalysis', 'keywordIntel', 'crossAnalysis', 'mediaPlan'],
      completedSectionKeys: ['industryMarket'],
    },
  };
}

describe('JourneyRunArtifactVisibilityPanel', () => {
  it('groups persisted artifacts by Journey section and flags outputs without visible cards', () => {
    render(<JourneyRunArtifactVisibilityPanel view={makeRunView()} />);

    const panel = screen.getByTestId('journey-run-artifact-visibility-panel');
    expect(panel).toHaveTextContent('Artifact visibility');
    expect(panel).toHaveTextContent('Market Overview');
    expect(panel).toHaveTextContent('1 visible card');
    expect(panel).toHaveTextContent('Offer Analysis');
    expect(panel).toHaveTextContent('Persisted output has no visible cards');
    expect(panel).not.toHaveTextContent('Keywords');

    expect(panel).toHaveTextContent('Metadata');
    expect(panel).toHaveTextContent('industryMarket');
    expect(panel).toHaveTextContent('1 citation');
    expect(panel).toHaveTextContent('1 saved version');
    expect(panel).toHaveTextContent('1 validation issue');
    expect(panel).not.toHaveTextContent('"unsupportedShape"');
  });

  it('does not render without persisted artifacts or visible cards', () => {
    const { container } = render(<JourneyRunArtifactVisibilityPanel view={null} />);

    expect(container.firstChild).toBeNull();
  });
});
