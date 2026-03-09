import { describe, expect, it } from 'vitest';
import { flushBufferedResearchChunks } from '../research-stream-buffer';

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
