/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { DemandIntentArtifact } from '@/types/positioning-artifact';

import {
  DemandIntentRenderer,
  isDemandIntentHonestlyUnavailable,
} from '../demand-intent';
import { demandIntentArtifact } from './fixtures';

function buildHonestlyUnavailableDemandIntent(): DemandIntentArtifact {
  const artifact: DemandIntentArtifact = structuredClone(demandIntentArtifact);
  artifact.confidence = 0.1;
  artifact.keywordDemand.keywords = [];
  artifact.keywordDemand.blockGap = {
    summary: 'evidence gap: section exceeded its time budget — rerun to retry',
    foundCount: 0,
    requiredCount: 3,
    sourcingPlan: ['Rerun this section to retry — it exceeded its time budget'],
  };
  artifact.questionMining.questions = [];
  artifact.contentGaps.gaps = [];
  artifact.intentSignals.items = [];
  artifact.venueMap.venues = [];
  return artifact;
}

describe('DemandIntentRenderer', () => {
  it('renders the editorial template and five narrative blocks', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);

    expect(screen.getByTestId('verdict-hero')).toHaveTextContent(/demand is visible/i);
    expect(screen.getByTestId('key-findings')).toBeInTheDocument();
    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toHaveTextContent('Keyword demand');
    expect(blocks[1]).toHaveTextContent('Question mining');
    expect(blocks[2]).toHaveTextContent('Content gaps');
    expect(blocks[3]).toHaveTextContent('Intent signals');
    expect(blocks[4]).toHaveTextContent('Venue map');
  });

  it('keeps the keyword table as an exhibit with source chips', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);

    expect(screen.getByText(/Exhibits: keyword table/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('keyword-item').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('$8.40 (SpyFu-estimated)')).toBeInTheDocument();
  });

  it('renders buyer questions as quote cards', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);

    expect(screen.getAllByTestId('quote-card').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText(/automate lead routing/i).length).toBeGreaterThanOrEqual(2);
  });

  it('shows the status summary once — as the verdict, never duplicated as a key finding', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);

    expect(
      screen.getAllByText(/category-aware demand with several unserved topics/i),
    ).toHaveLength(1);
  });

  it('renders validator-style intent gaps as GapNote, never raw validator text', () => {
    const artifact = structuredClone(demandIntentArtifact);
    artifact.intentSignals.items[0].description = 'validator requires >=5 intent signals';
    artifact.questionMining.questions = [];

    render(<DemandIntentRenderer artifact={artifact} />);

    expect(screen.queryByText(/validator requires/i)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('gap-note').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByTestId('question-item')).toHaveLength(0);
  });

  it('backfill: empty questionMining/contentGaps/intentSignals/venueMap each collapse to one honest GapNote that surfaces the engine blockGap', () => {
    const artifact: DemandIntentArtifact = structuredClone(demandIntentArtifact);
    artifact.questionMining.questions = [];
    artifact.questionMining.blockGap = {
      summary: 'No buyer questions cleared the permalink bar this run.',
      foundCount: 0,
      requiredCount: 3,
      sourcingPlan: ['Pull People Also Ask permalinks'],
    };
    artifact.contentGaps.gaps = [];
    artifact.contentGaps.blockGap = {
      summary: 'No content gaps could be sourced against ranking pages.',
      foundCount: 0,
      requiredCount: 1,
      sourcingPlan: ['Compare ranking pages to buyer questions'],
    };
    artifact.intentSignals.items = [];
    artifact.intentSignals.blockGap = {
      summary: 'No independent intent signals were captured.',
      foundCount: 0,
      requiredCount: 1,
      sourcingPlan: ['Pull job postings and RFP venues'],
    };
    artifact.venueMap.venues = [];
    artifact.venueMap.blockGap = {
      summary: 'No buyer venues were sourced with URLs.',
      foundCount: 0,
      requiredCount: 1,
      sourcingPlan: ['Identify communities and newsletters with source URLs'],
    };

    render(<DemandIntentRenderer artifact={artifact} />);

    // Each empty block surfaces its OWN honest engine blockGap summary, not a
    // generic placeholder, and not an empty grid header over nothing.
    expect(
      screen.getByText('No buyer questions cleared the permalink bar this run.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No content gaps could be sourced against ranking pages.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No independent intent signals were captured.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No buyer venues were sourced with URLs.'),
    ).toBeInTheDocument();
    // How-to-close lines come from each block's own sourcingPlan.
    expect(screen.getByText(/Pull People Also Ask permalinks/i)).toBeInTheDocument();
    // Four collapsed blocks => four gap notes (no rows rendered for any).
    expect(screen.getAllByTestId('gap-note')).toHaveLength(4);
    expect(screen.queryAllByTestId('question-item')).toHaveLength(0);
    expect(screen.queryAllByTestId('gap-item')).toHaveLength(0);
    expect(screen.queryAllByTestId('intent-item')).toHaveLength(0);
    expect(screen.queryAllByTestId('venue-item')).toHaveLength(0);
  });

  it('never leaks a forbidden tool term from a blockGap.summary', () => {
    const artifact: DemandIntentArtifact = structuredClone(demandIntentArtifact);
    artifact.questionMining.questions = [];
    artifact.questionMining.blockGap = {
      summary: "A web_search for 'ramp spend management reddit' returned no clean buyer questions.",
      foundCount: 0,
      requiredCount: 3,
      sourcingPlan: ['Pull People Also Ask permalinks'],
    };

    const { container } = render(<DemandIntentRenderer artifact={artifact} />);

    expect(container.textContent).not.toContain('web_search');
  });

  it('detects a wholly-empty artifact as honestly unavailable', () => {
    expect(isDemandIntentHonestlyUnavailable(demandIntentArtifact)).toBe(false);
    expect(
      isDemandIntentHonestlyUnavailable(buildHonestlyUnavailableDemandIntent()),
    ).toBe(true);
  });

  it('renders ONE compact honest gap note, not five carpet-bombed panels, when wholly unavailable', () => {
    render(
      <DemandIntentRenderer
        artifact={buildHonestlyUnavailableDemandIntent()}
      />,
    );

    expect(screen.getByTestId('demand-honestly-unavailable')).toBeInTheDocument();
    // Exactly one quiet trust note — no subsection walls.
    expect(screen.getAllByTestId('gap-note')).toHaveLength(1);
    expect(screen.queryAllByTestId('subsection')).toHaveLength(0);
    expect(screen.queryAllByTestId('keyword-item')).toHaveLength(0);
    expect(screen.queryAllByTestId('venue-item')).toHaveLength(0);
    // Honest framing, never the raw pipeline placeholder string.
    expect(
      screen.getByText(/Not enough public evidence was found/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/exceeded its time budget — rerun to retry/i),
    ).not.toBeInTheDocument();
  });

  it('keeps the full body for a PARTIAL shortfall (one block populated)', () => {
    const artifact = buildHonestlyUnavailableDemandIntent();
    // Restore one block — this is a partial shortfall, not wholly unavailable.
    artifact.keywordDemand.keywords =
      structuredClone(demandIntentArtifact).keywordDemand.keywords;

    expect(isDemandIntentHonestlyUnavailable(artifact)).toBe(false);

    render(<DemandIntentRenderer artifact={artifact} />);

    expect(
      screen.queryByTestId('demand-honestly-unavailable'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('subsection')).toHaveLength(5);
    expect(screen.getAllByTestId('keyword-item').length).toBeGreaterThanOrEqual(3);
  });
});
