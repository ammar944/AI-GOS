import { describe, expect, it } from 'vitest';

import type { SectionEvent } from '@/app/api/research-v2/audit-state/route';

import { buildSectionActivityFeed } from '../section-activity';

describe('buildSectionActivityFeed', () => {
  it('adapts lab tool events into renderable activity items and counts', (): void => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Reading sources',
      latestActivity: null,
      events: [
        event({
          id: 'evt-1',
          eventType: 'tool-started',
          message: 'Searching primary evidence',
          metadata: { toolName: 'web_search' },
        }),
        event({
          id: 'evt-2',
          eventType: 'tool-finished',
          message: 'Search finished',
          metadata: {
            toolName: 'web_search',
            outputSummary: '3 source candidates',
          },
        }),
      ],
    });

    expect(feed.currentLabel).toBe('web_search finished');
    expect(feed.counts).toMatchObject({
      toolsStarted: 1,
      toolsFinished: 1,
    });
    expect(feed.items).toEqual([
      expect.objectContaining({
        title: 'Using web_search',
        detail: 'Searching primary evidence',
        tone: 'active',
      }),
      expect.objectContaining({
        title: 'web_search finished',
        detail: '3 source candidates',
        tone: 'success',
      }),
    ]);
  });

  it('summarizes validation, repair, and committed sub-section events', (): void => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Validating',
      latestActivity: 'Repairing schema output',
      events: [
        event({
          id: 'evt-1',
          eventType: 'validation-failed',
          metadata: {
            attempt: 1,
            issues: ['missing sources', 'confidence too low'],
          },
        }),
        event({
          id: 'evt-2',
          eventType: 'repair-started',
          metadata: { reason: 'missing sources' },
        }),
        event({
          id: 'evt-3',
          eventType: 'sub-section-committed',
          metadata: { subSectionKey: 'personaReality' },
        }),
      ],
    });

    expect(feed.currentLabel).toBe('Repairing schema output');
    expect(feed.counts).toMatchObject({
      validationFailures: 1,
      repairsStarted: 1,
      subSectionsCommitted: 1,
    });
    expect(feed.items.map((item) => item.title)).toEqual([
      'Validation failed',
      'Repairing Artifact',
      'Sub-section committed',
    ]);
    expect(feed.items[0]?.detail).toBe('missing sources (+1 more)');
    expect(feed.items[2]?.detail).toBe('personaReality');
  });

  it('keeps the newest items while counting the full event stream', (): void => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Reading sources',
      latestActivity: null,
      maxItems: 2,
      events: [
        event({ id: 'evt-1', eventType: 'tool-started' }),
        event({ id: 'evt-2', eventType: 'tool-finished' }),
        event({ id: 'evt-3', eventType: 'artifact-saved' }),
      ],
    });

    expect(feed.currentLabel).toBe('Artifact saved');
    expect(feed.counts.toolsStarted).toBe(1);
    expect(feed.counts.toolsFinished).toBe(1);
    expect(feed.items.map((item) => item.id)).toEqual(['evt-2', 'evt-3']);
  });
});

function event(input: {
  id: string;
  eventType: string;
  message?: string;
  metadata?: Record<string, unknown>;
}): SectionEvent {
  return {
    id: input.id,
    event_type: input.eventType,
    message: input.message ?? null,
    payload: {
      id: input.id,
      type: input.eventType,
      runId: '00000000-0000-4000-8000-0000000000aa',
      sectionId: 'positioningBuyerICP',
      message: input.message ?? 'activity event',
      createdAt: '2026-05-26T12:00:00.000Z',
      metadata: input.metadata ?? {},
    },
    created_at: '2026-05-26T12:00:00.000Z',
  };
}
