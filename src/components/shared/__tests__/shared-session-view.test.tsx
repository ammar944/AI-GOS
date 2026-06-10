import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { buildV3ShareSnapshot } from '@/lib/research-v2/share-snapshot';

import { SharedSessionView } from '../shared-session-view';

afterEach((): void => {
  cleanup();
});

function v3Snapshot(data: unknown) {
  return buildV3ShareSnapshot({
    runId: '00000000-0000-4000-8000-0000000000aa',
    title: 'Acme Positioning Audit',
    sections: [
      {
        zone: 'positioningMarketCategory',
        title: marketCategoryFixtureArtifact.sectionTitle,
        markdown: null,
        data,
        status: 'complete',
        verification_tier: 'needs_review',
        verification_flag: {
          tier: 'needs_review',
          verifiedCount: 2,
          unsupportedCount: 1,
          totalClaims: 3,
          confidence: 2 / 3,
          needsReviewThreshold: 0.75,
          insufficientThreshold: 0.5,
          evidenceGap: false,
        },
        updated_at: '2026-05-25T12:00:00.000Z',
      },
    ],
  });
}

describe('SharedSessionView — v3 share render contract', (): void => {
  it('routes a research-v3 snapshot to the read-only v3 view and renders the typed section', (): void => {
    render(
      <SharedSessionView
        title="Acme Positioning Audit"
        createdAt="2026-06-01T00:00:00.000Z"
        researchSnapshot={v3Snapshot(marketCategoryFixtureArtifact)}
        mediaPlanSnapshot={null}
      />,
    );

    // v3-only chrome (the legacy view has no "Shared Audit" eyebrow)
    expect(screen.getByText('Shared Audit')).toBeInTheDocument();
    expect(screen.getByText('Read-only')).toBeInTheDocument();
    // the typed artifact body renders — this statusSummary prose only appears
    // when pickPositioningTypedArtifact resolves the section (not the fallback)
    expect(
      screen.getByText(/founder-led revenue operations/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Needs review · 1 unsupported claim · 67% grounded'),
    ).toBeInTheDocument();
  });

  it('falls back to "No data available" instead of crashing when a complete section has unpickable data and no markdown', (): void => {
    render(
      <SharedSessionView
        title="Acme Positioning Audit"
        createdAt="2026-06-01T00:00:00.000Z"
        researchSnapshot={v3Snapshot({ not: 'a-real-artifact' })}
        mediaPlanSnapshot={null}
      />,
    );

    expect(
      screen.getByText('No data available for this section'),
    ).toBeInTheDocument();
    // still the v3 view, not a crash or a fall-through to legacy
    expect(screen.getByText('Shared Audit')).toBeInTheDocument();
  });

  it('renders typed cards and review metadata without exposing reviewed artifact JSON', (): void => {
    const reviewedArtifact = {
      ...marketCategoryFixtureArtifact,
      review: {
        upgradedMarkdown:
          [
            '# Reviewed market category',
            '',
            '```json',
            '{"should":"not render"}',
            '```',
          ].join('\n'),
        tier: 'needs_review',
        tierRationale: 'One unsupported claim needs client proof.',
        removedItems: ['Unsupported market-size precision'],
        clientQuestions: ['Can you provide sourced segment sizing?'],
      },
    };

    render(
      <SharedSessionView
        title="Acme Positioning Audit"
        createdAt="2026-06-01T00:00:00.000Z"
        researchSnapshot={v3Snapshot(reviewedArtifact)}
        mediaPlanSnapshot={null}
      />,
    );

    expect(screen.getByText('Review rationale')).toBeInTheDocument();
    expect(
      screen.getByText('One unsupported claim needs client proof.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Needs review · 1 unsupported claim · 67% grounded'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('1 · Category Definition'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Reviewed market category')).not.toBeInTheDocument();
    expect(screen.queryByText('{"should":"not render"}')).not.toBeInTheDocument();
  });
});
