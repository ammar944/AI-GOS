/** @vitest-environment jsdom */
import { render, screen, cleanup, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import { buyerICPFixtureArtifact } from '@/lib/lab-engine/fixtures/buyer-icp-artifact';
import { competitorLandscapeFixtureArtifact } from '@/lib/lab-engine/fixtures/competitor-landscape-artifact';
import { demandIntentFixtureArtifact } from '@/lib/lab-engine/fixtures/demand-intent-artifact';
import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { offerDiagnosticFixtureArtifact } from '@/lib/lab-engine/fixtures/offer-diagnostic-artifact';
import { voiceOfCustomerFixtureArtifact } from '@/lib/lab-engine/fixtures/voice-of-customer-artifact';
import type { PositioningTypedArtifact } from '@/types/positioning-artifact';

import { SectionCard } from '../section-card';

interface SectionCardCase {
  zoneId: PositioningSectionId;
  title: string;
  artifact: PositioningTypedArtifact;
  expectedText: string;
  expectedTestId?: string;
}

const sectionCardCases: readonly SectionCardCase[] = [
  {
    zoneId: 'positioningMarketCategory',
    title: 'Market & Category Intelligence',
    artifact: marketCategoryFixtureArtifact,
    expectedText: 'CRM cleanup tools',
    expectedTestId: 'adjacent-item',
  },
  {
    zoneId: 'positioningBuyerICP',
    title: 'Buyer & ICP Validation',
    artifact: buyerICPFixtureArtifact,
    expectedText: 'Founder Community Signal',
    expectedTestId: 'firmographic-item',
  },
  {
    zoneId: 'positioningCompetitorLandscape',
    title: 'Competitor Landscape & Positioning',
    artifact: competitorLandscapeFixtureArtifact,
    expectedText: 'SignalForge',
  },
  {
    zoneId: 'positioningVoiceOfCustomer',
    title: 'Voice of Customer & Objection Evidence',
    artifact: voiceOfCustomerFixtureArtifact,
    expectedText: 'We keep losing track of the next best account action 1.',
    expectedTestId: 'voc-quote',
  },
  {
    zoneId: 'positioningDemandIntent',
    title: 'Demand & Intent Signals',
    artifact: demandIntentFixtureArtifact,
    expectedText: 'founder sales workflow 1',
    expectedTestId: 'keyword-item',
  },
  {
    zoneId: 'positioningOfferDiagnostic',
    title: 'Offer & Performance Diagnostic',
    artifact: offerDiagnosticFixtureArtifact,
    expectedText: 'Proof metric 1',
    expectedTestId: 'proof-point-item',
  },
];

function completeWorkerState(
  sectionId: PositioningSectionId,
): AuditStateResponse['workerStates'][number] {
  return {
    section_id: sectionId,
    status: 'complete',
    phase: 'Committed',
    phaseLabel: 'Committed',
    phaseStartedAt: null,
    latestTool: null,
    latestSource: null,
    latestActivity: null,
    nextStep: null,
    wave: null,
    totalWaves: null,
    concurrency: null,
    elapsedMs: null,
    capabilityGaps: [],
    executionMode: null,
    runtimeTimings: {},
  };
}

describe('<SectionCard>', () => {
  afterEach((): void => cleanup());

  it.each(sectionCardCases)(
    'renders completed lab-envelope $zoneId artifacts without crashing',
    ({ zoneId, title, artifact, expectedText, expectedTestId }): void => {
      render(
        <SectionCard
          zoneId={zoneId}
          body={{
            title,
            data: artifact,
          }}
          workerState={completeWorkerState(zoneId)}
        />,
      );

      expect(screen.getAllByText(expectedText).length).toBeGreaterThan(0);
      if (expectedTestId) {
        expect(screen.getAllByTestId(expectedTestId).length).toBeGreaterThan(0);
      }
    },
  );

  it('renders completed lab-envelope Buyer ICP awareness rows from body fields', (): void => {
    render(
      <SectionCard
        zoneId="positioningBuyerICP"
        body={{
          title: 'Buyer & ICP Validation',
          data: buyerICPFixtureArtifact,
        }}
        workerState={completeWorkerState('positioningBuyerICP')}
      />,
    );

    expect(screen.getAllByTestId('firmographic-item').length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByTestId('awareness-row')).toHaveLength(5);
  });

  it('renders a one-line verdict strip with subtle confidence and source metadata', (): void => {
    render(
      <SectionCard
        zoneId="positioningMarketCategory"
        body={{
          title: 'Market & Category Intelligence',
          data: marketCategoryFixtureArtifact,
        }}
        workerState={completeWorkerState('positioningMarketCategory')}
      />,
    );

    const verdictLine = screen.getByTestId(
      'section-verdict-line-positioningMarketCategory',
    );

    expect(verdictLine).toHaveTextContent(marketCategoryFixtureArtifact.verdict);
    expect(within(verdictLine).getByText('Confidence 6/10')).toBeInTheDocument();
    expect(within(verdictLine).getByText('3 sources')).toBeInTheDocument();
  });
});
