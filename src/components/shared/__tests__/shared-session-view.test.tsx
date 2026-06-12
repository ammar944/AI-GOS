import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';
import { buildV3ShareSnapshot } from '@/lib/research-v2/share-snapshot';

import { SharedSessionView } from '../shared-session-view';

afterEach((): void => {
  cleanup();
});

function v3Snapshot(data: unknown, executiveBrief?: string | null) {
  return buildV3ShareSnapshot({
    runId: '00000000-0000-4000-8000-0000000000aa',
    title: 'Acme Positioning Audit',
    executiveBrief,
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
      screen.getAllByText(/founder-led revenue operations/i).length,
    ).toBeGreaterThan(0);
    // Tier chrome removed from the shared view (user decision 2026-06-11) —
    // the persisted tier/flag never render as a badge.
    expect(
      screen.queryByText('Needs review · 1 unsupported claim · 67% grounded'),
    ).not.toBeInTheDocument();
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

    // Only the client-facing questions render — tier rationale, removed
    // items, and the tier badge are verifier metric noise and stay hidden.
    expect(screen.getByText('Open questions (1)')).toBeInTheDocument();
    expect(
      screen.getByText('Can you provide sourced segment sizing?'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Review rationale')).not.toBeInTheDocument();
    expect(
      screen.queryByText('One unsupported claim needs client proof.'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Unsupported market-size precision'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Needs review · 1 unsupported claim · 67% grounded'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Category definition'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Reviewed market category')).not.toBeInTheDocument();
    expect(screen.queryByText('{"should":"not render"}')).not.toBeInTheDocument();
  });

  it('renders the executive brief as the memo at the top when the snapshot carries one', (): void => {
    render(
      <SharedSessionView
        title="Acme Positioning Audit"
        createdAt="2026-06-01T00:00:00.000Z"
        researchSnapshot={v3Snapshot(
          marketCategoryFixtureArtifact,
          'The category is consolidating and Acme must pick a side this quarter.',
        )}
        mediaPlanSnapshot={null}
      />,
    );

    expect(screen.getByText('Executive memo')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The category is consolidating and Acme must pick a side this quarter.',
      ),
    ).toBeInTheDocument();
  });

  it('omits the memo for older snapshots without an executive brief', (): void => {
    render(
      <SharedSessionView
        title="Acme Positioning Audit"
        createdAt="2026-06-01T00:00:00.000Z"
        researchSnapshot={v3Snapshot(marketCategoryFixtureArtifact)}
        mediaPlanSnapshot={null}
      />,
    );

    expect(screen.queryByText('Executive memo')).not.toBeInTheDocument();
  });

  it('shows a neutral footer with no self-promotion CTA', (): void => {
    render(
      <SharedSessionView
        title="Acme Positioning Audit"
        createdAt="2026-06-01T00:00:00.000Z"
        researchSnapshot={v3Snapshot(marketCategoryFixtureArtifact)}
        mediaPlanSnapshot={null}
      />,
    );

    expect(screen.getByText('Prepared with AI-GOS')).toBeInTheDocument();
    expect(screen.queryByText('Create Your Own')).not.toBeInTheDocument();
    expect(screen.queryByText('Generated with AIGOS')).not.toBeInTheDocument();
  });

  it('renders the paid-media section as the client deck, not the operator tables', (): void => {
    const snapshot = buildV3ShareSnapshot({
      runId: '00000000-0000-4000-8000-0000000000aa',
      title: 'Acme Positioning Audit',
      sections: [
        {
          zone: 'positioningPaidMediaPlan',
          title: paidMediaPlanFixtureArtifact.sectionTitle,
          markdown: null,
          data: paidMediaPlanFixtureArtifact,
          status: 'complete',
          verification_tier: null,
          verification_flag: null,
          updated_at: '2026-05-25T12:00:00.000Z',
        },
      ],
    });

    render(
      <SharedSessionView
        title="Acme Positioning Audit"
        createdAt="2026-06-01T00:00:00.000Z"
        researchSnapshot={snapshot}
        mediaPlanSnapshot={null}
      />,
    );

    expect(screen.getByTestId('paid-media-plan-deck')).toBeInTheDocument();
    expect(
      screen.queryByTestId('typed-artifact-renderer-positioningPaidMediaPlan'),
    ).not.toBeInTheDocument();
    // The cover band carries the subject derived from the share title.
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });
});
