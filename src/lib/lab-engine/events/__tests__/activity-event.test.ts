import { describe, expect, it } from 'vitest';

import { activityEventSchema } from '../activity-event';

const baseEvent = {
  id: 'event-1',
  runId: 'run-1',
  sectionId: 'positioningMarketCategory',
  message: 'web_search started',
  createdAt: '2026-05-25T12:00:00.000Z',
} as const;

describe('activityEventSchema tool metadata', (): void => {
  it('accepts tool-started query and sourceUrl metadata', (): void => {
    expect(
      activityEventSchema.parse({
        ...baseEvent,
        type: 'tool-started',
        metadata: {
          toolName: 'web_search',
          query: 'Gong alternatives',
        },
      }).metadata,
    ).toMatchObject({
      toolName: 'web_search',
      query: 'Gong alternatives',
    });

    expect(
      activityEventSchema.parse({
        ...baseEvent,
        id: 'event-2',
        type: 'tool-started',
        message: 'firecrawl started',
        metadata: {
          toolName: 'firecrawl',
          sourceUrl: 'https://www.gong.io/',
        },
      }).metadata,
    ).toMatchObject({
      toolName: 'firecrawl',
      sourceUrl: 'https://www.gong.io/',
    });
  });

  it('accepts tool-finished source metadata while preserving strict gaps', (): void => {
    expect(
      activityEventSchema.parse({
        ...baseEvent,
        id: 'event-3',
        type: 'tool-finished',
        message: 'firecrawl finished',
        metadata: {
          toolName: 'firecrawl',
          sourceUrl: 'https://www.gong.io/',
          gap: {
            reason: 'api_error',
            message: 'Firecrawl returned 502',
          },
        },
      }).metadata,
    ).toMatchObject({
      toolName: 'firecrawl',
      sourceUrl: 'https://www.gong.io/',
      gap: {
        reason: 'api_error',
        message: 'Firecrawl returned 502',
      },
    });
  });

  it('still rejects unknown tool metadata keys', (): void => {
    expect(() =>
      activityEventSchema.parse({
        ...baseEvent,
        type: 'tool-started',
        metadata: {
          toolName: 'web_search',
          query: 'Gong alternatives',
          unknownSignal: 'not allowed',
        },
      }),
    ).toThrow();
  });
});
