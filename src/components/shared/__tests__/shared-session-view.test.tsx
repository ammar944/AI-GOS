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
});
