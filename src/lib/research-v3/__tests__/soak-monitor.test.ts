import { describe, expect, it } from 'vitest';

import { evaluateSoakHealth } from '@/lib/research-v3/soak-monitor';

describe('soak monitor health evaluation', () => {
  it('reports healthy complete when parent, six sections, and paid media are complete', (): void => {
    const result = evaluateSoakHealth({
      now: '2026-05-26T12:10:00.000Z',
      previousChildrenComplete: 6,
      artifact: {
        id: 'artifact-1',
        status: 'complete',
        childrenComplete: 6,
        childrenTotal: 6,
      },
      sectionRuns: [
        ...[
          'positioningMarketCategory',
          'positioningBuyerICP',
          'positioningCompetitorLandscape',
          'positioningVoiceOfCustomer',
          'positioningDemandIntent',
          'positioningOfferDiagnostic',
          'positioningPaidMediaPlan',
        ].map((zone) => ({
          zone,
          status: 'complete',
          updatedAt: '2026-05-26T12:05:00.000Z',
        })),
      ],
      events: [],
    });

    expect(result).toEqual({
      status: 'complete',
      failures: [],
      childrenComplete: 6,
      childrenTotal: 6,
    });
  });

  it('fails on artifact errors, section errors, error events, and stale queued work without progress', (): void => {
    const result = evaluateSoakHealth({
      now: '2026-05-26T12:10:00.000Z',
      previousChildrenComplete: 2,
      artifact: {
        id: 'artifact-1',
        status: 'error',
        childrenComplete: 2,
        childrenTotal: 6,
      },
      sectionRuns: [
        {
          zone: 'positioningMarketCategory',
          status: 'complete',
          updatedAt: '2026-05-26T12:01:00.000Z',
        },
        {
          zone: 'positioningBuyerICP',
          status: 'error',
          updatedAt: '2026-05-26T12:02:00.000Z',
        },
        {
          zone: 'positioningCompetitorLandscape',
          status: 'queued',
          updatedAt: '2026-05-26T12:00:00.000Z',
        },
        {
          zone: 'deepResearchProgram',
          status: 'running',
          updatedAt: '2026-05-26T11:50:00.000Z',
        },
      ],
      events: [
        {
          zone: 'positioningBuyerICP',
          eventType: 'error',
          message: 'validator failed',
          createdAt: '2026-05-26T12:02:30.000Z',
        },
      ],
    });

    expect(result.status).toBe('failed');
    expect(result.failures).toEqual([
      'research_artifacts artifact-1 status is error',
      'research_section_runs positioningBuyerICP status is error',
      'research_section_events positioningBuyerICP emitted error: validator failed',
      'research_section_runs positioningCompetitorLandscape is stale in queued for 600000ms',
      'research_section_runs deepResearchProgram is stale in running for 1200000ms',
    ]);
  });
});
