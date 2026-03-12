import { describe, expect, it } from 'vitest';
import { buildJourneyWorkerStatusItems } from '../research-worker-status';

describe('buildJourneyWorkerStatusItems', () => {
  it('limits timeout status to the timed out sections instead of all active research', () => {
    const items = buildJourneyWorkerStatusItems({
      activeResearch: ['industryMarket', 'keywordIntel'],
      researchJobActivity: {
        industryMarket: {
          jobId: 'job-1',
          section: 'industryMarket',
          status: 'running',
          tool: 'researchIndustry',
          startedAt: '2026-03-12T09:00:00.000Z',
        },
      },
      researchResults: {},
      timedOutSections: ['industryMarket'],
    });

    expect(items).toEqual([
      expect.objectContaining({
        kind: 'dispatch-timeout',
        section: 'industryMarket',
      }),
      expect.objectContaining({
        kind: 'queued',
        section: 'keywordIntel',
      }),
    ]);
  });
});
