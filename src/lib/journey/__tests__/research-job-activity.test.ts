import { describe, expect, it } from 'vitest';
import {
  collapseResearchJobUpdates,
  extractResearchJobActivity,
} from '../research-job-activity';

describe('extractResearchJobActivity', () => {
  it('maps worker tools back to journey sections', () => {
    expect(
      extractResearchJobActivity({
        'job-1': {
          status: 'running',
          tool: 'researchIndustry',
          startedAt: '2026-03-10T09:00:00.000Z',
          updates: [
            {
              at: '2026-03-10T09:00:01.000Z',
              id: 'update-1',
              message: 'worker accepted research job',
              phase: 'runner',
            },
          ],
        },
      }),
    ).toEqual({
      industryMarket: {
        jobId: 'job-1',
        section: 'industryMarket',
        status: 'running',
        tool: 'researchIndustry',
        startedAt: '2026-03-10T09:00:00.000Z',
        updates: [
          {
            at: '2026-03-10T09:00:01.000Z',
            id: 'update-1',
            message: 'worker accepted research job',
            phase: 'runner',
          },
        ],
      },
    });
  });

  it('keeps the latest job activity per section', () => {
    expect(
      extractResearchJobActivity({
        'job-1': {
          status: 'running',
          tool: 'researchIndustry',
          startedAt: '2026-03-10T09:00:00.000Z',
        },
        'job-2': {
          status: 'complete',
          tool: 'researchIndustry',
          startedAt: '2026-03-10T09:01:00.000Z',
          completedAt: '2026-03-10T09:02:00.000Z',
        },
      }),
    ).toEqual({
      industryMarket: {
        jobId: 'job-2',
        section: 'industryMarket',
        status: 'complete',
        tool: 'researchIndustry',
        startedAt: '2026-03-10T09:01:00.000Z',
        completedAt: '2026-03-10T09:02:00.000Z',
      },
    });
  });

  it('ignores unknown tools', () => {
    expect(
      extractResearchJobActivity({
        'job-1': {
          status: 'running',
          tool: 'unknownTool',
          startedAt: '2026-03-10T09:00:00.000Z',
        },
      }),
    ).toEqual({});
  });

  it('collapses consecutive duplicate updates', () => {
    expect(
      collapseResearchJobUpdates([
        {
          at: '2026-03-10T09:00:00.000Z',
          id: 'update-1',
          message: 'web search started',
          phase: 'tool',
        },
        {
          at: '2026-03-10T09:00:01.000Z',
          id: 'update-2',
          message: 'web search started',
          phase: 'tool',
        },
        {
          at: '2026-03-10T09:00:02.000Z',
          id: 'update-3',
          message: 'synthesizing market overview',
          phase: 'analysis',
        },
      ]),
    ).toEqual([
      {
        at: '2026-03-10T09:00:01.000Z',
        id: 'update-2',
        message: 'web search started',
        phase: 'tool',
        count: 2,
      },
      {
        at: '2026-03-10T09:00:02.000Z',
        id: 'update-3',
        message: 'synthesizing market overview',
        phase: 'analysis',
        count: 1,
      },
    ]);
  });
});
