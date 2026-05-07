import { describe, expect, it } from 'vitest';
import {
  buildDeepResearchAgentStreamState,
  flushBufferedResearchChunks,
} from '../research-stream-buffer';

describe('flushBufferedResearchChunks', () => {
  it('merges buffered chunks and status patches into a single state update', () => {
    const next = flushBufferedResearchChunks(
      {
        industryResearch: {
          text: 'Existing ',
          status: 'running',
          startedAt: 100,
        },
      },
      {
        chunkBuffers: {
          industryResearch: ['delta 1', 'delta 2'],
          keywordIntel: ['new text'],
        },
        statusPatches: {
          keywordIntel: {
            status: 'running',
            startedAt: 200,
          },
          industryResearch: {
            status: 'complete',
          },
        },
      },
    );

    expect(next).toEqual({
      industryResearch: {
        text: 'Existing delta 1delta 2',
        status: 'complete',
        startedAt: 100,
      },
      keywordIntel: {
        text: 'new text',
        status: 'running',
        startedAt: 200,
      },
    });
  });

  it('resets stale text when a fresh run restarts a section', () => {
    const next = flushBufferedResearchChunks(
      {
        industryResearch: {
          text: 'Old completed text',
          status: 'complete',
          startedAt: 100,
        },
      },
      {
        chunkBuffers: {
          industryResearch: ['Fresh delta'],
        },
        statusPatches: {
          industryResearch: {
            status: 'running',
            startedAt: 200,
          },
        },
      },
    );

    expect(next).toEqual({
      industryResearch: {
        text: 'Fresh delta',
        status: 'running',
        startedAt: 200,
      },
    });
  });
});

describe('buildDeepResearchAgentStreamState', () => {
  it('shows Deep Research Agent as the first visible assistant step and hides inactive specialists', () => {
    const state = buildDeepResearchAgentStreamState({
      activeRunId: 'run-1',
      deepResearchStatus: 'starting',
      phase: 'prefilling',
      researchActivity: {},
      researchResults: {},
    });

    expect(state.visibleSteps.map((step) => step.section)).toEqual([
      'deepResearchProgram',
    ]);
    expect(state.visibleSteps[0]).toMatchObject({
      name: 'Deep Research Agent',
      status: 'running',
    });
    expect(state.hiddenSections).toContain('industryMarket');
    expect(state.hiddenSections).toContain('competitors');
    expect(state.assistantOpening).toContain('Deep Research Agent');
  });

  it('builds a growing report block from persisted draft progress chunks', () => {
    const state = buildDeepResearchAgentStreamState({
      activeRunId: 'run-1',
      deepResearchStatus: 'complete',
      phase: 'workspace',
      researchActivity: {
        industryMarket: {
          jobId: 'job-market',
          section: 'industryMarket',
          status: 'running',
          tool: 'researchIndustry',
          startedAt: '2026-05-07T09:00:00.000Z',
          updates: [
            {
              at: '2026-05-07T09:00:01.000Z',
              id: 'draft-1',
              message: 'draft Airtable is positioned as an app platform for teams.',
              phase: 'analysis',
            },
            {
              at: '2026-05-07T09:00:02.000Z',
              id: 'draft-2',
              message: 'draft Buyers compare Airtable against spreadsheet and workflow tools.',
              phase: 'analysis',
            },
          ],
        },
      },
      researchResults: {
        deepResearchProgram: {
          status: 'complete',
          section: 'deepResearchProgram',
          data: {},
          durationMs: 1000,
        },
      },
    });

    expect(state.reportBlocks).toHaveLength(1);
    expect(state.reportBlocks[0]).toMatchObject({
      section: 'industryMarket',
      status: 'running',
    });
    expect(state.reportBlocks[0]?.content).toContain(
      'Airtable is positioned as an app platform for teams.',
    );
    expect(state.reportBlocks[0]?.content).toContain(
      'Buyers compare Airtable against spreadsheet and workflow tools.',
    );
  });

  it('buffers out-of-order completed specialists until earlier sections reveal', () => {
    const state = buildDeepResearchAgentStreamState({
      activeRunId: 'run-1',
      deepResearchStatus: 'complete',
      phase: 'workspace',
      researchActivity: {
        icpValidation: {
          jobId: 'job-icp',
          section: 'icpValidation',
          status: 'running',
          tool: 'researchICP',
          startedAt: '2026-05-07T09:02:00.000Z',
        },
      },
      researchResults: {
        deepResearchProgram: {
          status: 'complete',
          section: 'deepResearchProgram',
          data: {},
          durationMs: 1000,
        },
        industryMarket: {
          status: 'complete',
          section: 'industryMarket',
          data: { sectionTitle: 'Market', statusSummary: 'Market ready.' },
          durationMs: 1000,
        },
        competitors: {
          status: 'complete',
          section: 'competitors',
          data: { sectionTitle: 'Competitors', statusSummary: 'Competitors ready.' },
          durationMs: 1000,
        },
      },
    });

    expect(state.visibleSteps.map((step) => step.section)).toEqual([
      'deepResearchProgram',
      'industryMarket',
      'icpValidation',
    ]);
    expect(state.bufferedSteps.map((step) => step.section)).toEqual([
      'competitors',
    ]);
  });

  it('reconstructs completed, active, partial, and buffered run state after refresh', () => {
    const state = buildDeepResearchAgentStreamState({
      activeRunId: 'run-refresh',
      deepResearchStatus: 'idle',
      phase: 'workspace',
      researchActivity: {
        offerAnalysis: {
          jobId: 'job-offer',
          section: 'offerAnalysis',
          status: 'running',
          tool: 'researchOffer',
          startedAt: '2026-05-07T09:04:00.000Z',
          updates: [
            {
              at: '2026-05-07T09:04:01.000Z',
              id: 'offer-draft',
              message: 'draft Offer analysis is being written from the corpus.',
              phase: 'analysis',
            },
          ],
        },
      },
      researchResults: {
        deepResearchProgram: {
          status: 'complete',
          section: 'deepResearchProgram',
          data: {},
          durationMs: 1000,
        },
        industryMarket: {
          status: 'complete',
          section: 'industryMarket',
          data: { statusSummary: 'Market complete.' },
          durationMs: 1000,
        },
        icpValidation: {
          status: 'complete',
          section: 'icpValidation',
          data: { statusSummary: 'ICP complete.' },
          durationMs: 1000,
        },
        competitors: {
          status: 'partial',
          section: 'competitors',
          data: { statusSummary: 'Competitor draft needs review.' },
          durationMs: 1000,
        },
        keywordIntel: {
          status: 'complete',
          section: 'keywordIntel',
          data: { statusSummary: 'Keyword output finished early.' },
          durationMs: 1000,
        },
      },
    });

    expect(state.statusSummary).toEqual({
      activeSection: 'offerAnalysis',
      bufferedSections: ['keywordIntel'],
      completedSections: ['deepResearchProgram', 'industryMarket', 'icpValidation'],
      partialSections: ['competitors'],
    });
    expect(state.visibleSteps.map((step) => step.section)).toEqual([
      'deepResearchProgram',
      'industryMarket',
      'icpValidation',
      'competitors',
      'offerAnalysis',
    ]);
  });
});
