/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { crossSectionReasoningFixtureArtifact } from '@/lib/lab-engine/fixtures/cross-section-reasoning-artifact';
import { CrossSectionReasoningRenderer } from '../cross-section-reasoning';

describe('CrossSectionReasoningRenderer', (): void => {
  it('renders the dedicated thinker surface and cross-section threads', (): void => {
    render(
      <CrossSectionReasoningRenderer
        artifact={crossSectionReasoningFixtureArtifact}
      />,
    );

    expect(
      screen.getByTestId('typed-artifact-renderer-positioningCrossSectionReasoning'),
    ).toBeInTheDocument();
    expect(screen.getByText(/time-to-first-campaign/i)).toBeInTheDocument();
    expect(screen.getAllByText('positioningBuyerICP').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('positioningCompetitorLandscape').length,
    ).toBeGreaterThan(0);
  });

  it('renders the blind spot, named tension, risk, and inversion blocks', (): void => {
    render(
      <CrossSectionReasoningRenderer
        artifact={crossSectionReasoningFixtureArtifact}
      />,
    );

    expect(screen.getByText(/Client blind spot/i)).toBeInTheDocument();
    expect(screen.getByText(/Named tension/i)).toBeInTheDocument();
    expect(screen.getByText(/Second-order risk/i)).toBeInTheDocument();
    expect(screen.getByText(/Contrarian inversion/i)).toBeInTheDocument();
    expect(screen.getByText(/underplays the broader strategic-platform story/i)).toBeInTheDocument();
  });
});
