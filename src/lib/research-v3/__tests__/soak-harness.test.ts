import { describe, expect, it } from 'vitest';

import {
  buildSoakPlan,
  evaluateRunEvidence,
  serializeSoakRecord,
} from '@/lib/research-v3/soak-harness';

describe('soak harness planning and evidence checks', () => {
  it('bounds planned runs by both run cap and cumulative estimated cost', (): void => {
    const plan = buildSoakPlan({
      urls: ['https://ramp.com', 'https://vanta.com', 'https://webflow.com'],
      maxRuns: 5,
      maxEstimatedCostUsd: 0.25,
      estimatedCostPerRunUsd: 0.1,
      intervalMs: 60_000,
      startedAt: '2026-05-26T12:00:00.000Z',
    });

    expect(plan.runs).toEqual([
      {
        index: 1,
        scheduledAt: '2026-05-26T12:00:00.000Z',
        url: 'https://ramp.com',
        estimatedCostUsd: 0.1,
      },
      {
        index: 2,
        scheduledAt: '2026-05-26T12:01:00.000Z',
        url: 'https://vanta.com',
        estimatedCostUsd: 0.1,
      },
    ]);
    expect(plan.totalEstimatedCostUsd).toBe(0.2);
    expect(plan.stopReason).toBe('cost_cap');
  });

  it('fails evidence with synthetic, example.com, or Anthropic source hits', (): void => {
    const result = evaluateRunEvidence({
      runId: 'run-source-sweep',
      childrenComplete: 6,
      childrenTotal: 6,
      workerStates: [
        { sectionId: 'positioningMarketCategory', status: 'complete' },
        { sectionId: 'positioningPaidMediaPlan', status: 'complete' },
      ],
      sectionsByZone: {
        positioningMarketCategory: {
          markdown: 'Synthetic: generated fallback',
          data: {
            sources: [
              { url: 'https://www.example.com/placeholder' },
              { url: 'https://www.anthropic.com/news' },
            ],
          },
        },
      },
      errorBoundaryText: null,
    });

    expect(result.status).toBe('failed');
    expect(result.failures).toEqual([
      'Forbidden synthetic marker found in positioningMarketCategory.markdown',
      'Forbidden source host www.example.com found in positioningMarketCategory.data.sources[0].url',
      'Forbidden source host www.anthropic.com found in positioningMarketCategory.data.sources[1].url',
    ]);
  });

  it('serializes one run outcome as newline-delimited JSON', (): void => {
    expect(
      serializeSoakRecord({
        runId: 'run-1',
        url: 'https://ramp.com',
        status: 'passed',
        failures: [],
        startedAt: '2026-05-26T12:00:00.000Z',
        completedAt: '2026-05-26T12:02:00.000Z',
        estimatedCostUsd: 0.1,
      }),
    ).toBe(
      '{"runId":"run-1","url":"https://ramp.com","status":"passed","failures":[],"startedAt":"2026-05-26T12:00:00.000Z","completedAt":"2026-05-26T12:02:00.000Z","estimatedCostUsd":0.1}\n',
    );
  });
});
