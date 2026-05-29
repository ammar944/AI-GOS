import { describe, expect, it } from 'vitest';

import type { SectionEvent } from '@/app/api/research-v2/audit-state/route';

import {
  buildSectionActivityFeed,
  type CollapsedSectionActivityItem,
} from '../section-activity';

// Raw payload markers that must NEVER reach a customer-facing field.
const RAW_MARKERS = ['outputSummary', '"code"', 'issues', 'body.'];

function assertNoRawLeak(item: CollapsedSectionActivityItem): void {
  const serialized = JSON.stringify(item);
  for (const marker of RAW_MARKERS) {
    expect(serialized).not.toContain(marker);
  }
}

describe('buildSectionActivityFeed — customer-safe adapter', () => {
  it('drops raw tool output and surfaces only a clean search-query chip', () => {
    const rawJson = '[{"code":"invalid_type","path":["body.foo"]}]';
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Reading sources',
      latestActivity: null,
      events: [
        event({
          id: 'evt-1',
          eventType: 'tool-started',
          metadata: { toolName: 'web_search' },
        }),
        event({
          id: 'evt-2',
          eventType: 'tool-finished',
          metadata: {
            toolName: 'web_search',
            outputSummary: rawJson,
            query: 'b2b saas pricing',
          },
        }),
      ],
    });

    // Both tool events collapse into one searching row.
    expect(feed.items).toHaveLength(1);
    const [searching] = feed.items;
    expect(searching.phase).toBe('searching');
    expect(searching.title).toBe('Searching source evidence');
    expect(searching.detail).toBeNull();
    // Collapsed accumulator carries the clean query; the row-level `chip` keeps
    // the first (tool-started) event's value, which is null.
    expect(searching.chips).toEqual(['b2b saas pricing']);

    // The raw outputSummary JSON must not appear anywhere on the item.
    expect(JSON.stringify(searching)).not.toContain(rawJson);
    expect(searching.title).not.toContain(rawJson);
    expect(searching.detail ?? '').not.toContain(rawJson);
    feed.items.forEach(assertNoRawLeak);
  });

  it('drops a JSON-shaped search query rather than rendering it as a chip', () => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Reading sources',
      latestActivity: null,
      events: [
        event({
          id: 'evt-1',
          eventType: 'tool-finished',
          metadata: { query: '[{"code":"bad"}]' },
        }),
      ],
    });

    expect(feed.items[0]?.chip).toBeNull();
    expect(feed.items[0]?.chips).toEqual([]);
    feed.items.forEach(assertNoRawLeak);
  });

  it('hides raw Zod validation issues behind a calm checking line', () => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Validating',
      latestActivity: null,
      events: [
        event({
          id: 'evt-1',
          eventType: 'validation-failed',
          metadata: {
            attempt: 1,
            issues: [
              '[{"code":"invalid_type","path":["body.persona"]}]',
              'confidence too low',
            ],
          },
        }),
      ],
    });

    const [checking] = feed.items;
    expect(checking.phase).toBe('checking');
    expect(checking.title).toBe('Checking source support');
    expect(checking.detail).toBe('Verifying claims against sources');
    expect(JSON.stringify(checking)).not.toContain('invalid_type');
    expect(JSON.stringify(checking)).not.toContain('confidence too low');
    feed.items.forEach(assertNoRawLeak);
  });

  it('translates a grounding repair reason into a calm sentence', () => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Repairing',
      latestActivity: null,
      events: [
        event({
          id: 'evt-1',
          eventType: 'repair-started',
          metadata: { reason: 'grounding 3 unsupported claim(s)' },
        }),
      ],
    });

    expect(feed.items[0]?.title).toBe('Refining unsupported claims');
    expect(feed.items[0]?.detail).toBe('Strengthening 3 claims with sources');
    feed.items.forEach(assertNoRawLeak);
  });

  it('translates a sources-coverage repair reason', () => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Repairing',
      latestActivity: null,
      events: [
        event({
          id: 'evt-1',
          eventType: 'repair-started',
          metadata: { reason: 'sources: have 4, need >=5' },
        }),
      ],
    });

    expect(feed.items[0]?.detail).toBe('Gathering more sources (4 of 5)');
    feed.items.forEach(assertNoRawLeak);
  });

  it('replaces a raw Zod-ish repair reason with a generic fallback', () => {
    const rawReason = '[{"code":"invalid_type","path":["body.foo"]}]';
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Repairing',
      latestActivity: null,
      events: [
        event({
          id: 'evt-1',
          eventType: 'repair-started',
          metadata: { reason: rawReason },
        }),
      ],
    });

    expect(feed.items[0]?.detail).toBe('Refining section structure');
    expect(JSON.stringify(feed.items[0])).not.toContain(rawReason);
    expect(JSON.stringify(feed.items[0])).not.toContain('invalid_type');
    feed.items.forEach(assertNoRawLeak);
  });

  // Regression: the engine emits short, non-JSON jargon repair reasons that
  // would slip past a length/JSON guard. They must NOT reach the detail line.
  it.each([
    'No answer-tool step within 90000ms on attempt 2',
    'Agent did not call answer tool within maxSteps',
  ])('never leaks short non-JSON engine jargon as a repair detail: %s', (
    reason,
  ) => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Repairing',
      latestActivity: null,
      events: [
        event({
          id: 'evt-1',
          eventType: 'repair-started',
          metadata: { reason },
        }),
      ],
    });

    const detail = feed.items[0]?.detail;
    expect(detail).toBe('Refining section structure');
    expect(detail).not.toContain('answer');
    expect(detail).not.toContain('maxSteps');
    expect(detail).not.toContain('step within');
    expect(JSON.stringify(feed.items[0])).not.toContain(reason);
    feed.items.forEach(assertNoRawLeak);
  });

  it('drafting title never exposes the internal schemaName', () => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Drafting',
      latestActivity: null,
      events: [
        event({
          id: 'evt-1',
          eventType: 'structured-output-started',
          metadata: { schemaName: 'BuyerICPArtifactSchema', attempt: 2 },
        }),
      ],
    });

    const [drafting] = feed.items;
    expect(drafting.phase).toBe('drafting');
    expect(drafting.title).toBe('Drafting section');
    expect(drafting.detail).toBeNull();
    expect(JSON.stringify(drafting)).not.toContain('BuyerICPArtifactSchema');
    feed.items.forEach(assertNoRawLeak);
  });

  it('never echoes a raw section-failed error', () => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Failed',
      latestActivity: null,
      events: [
        event({
          id: 'evt-1',
          eventType: 'section-failed',
          message: 'TypeError: cannot read properties of undefined',
          metadata: { error: 'Error: body.sections[0] is not iterable' },
        }),
      ],
    });

    const [failed] = feed.items;
    expect(failed.phase).toBe('done');
    expect(failed.title).toBe('Section needs review');
    expect(failed.detail).toBe('This section needs another pass');
    expect(JSON.stringify(failed)).not.toContain('TypeError');
    expect(JSON.stringify(failed)).not.toContain('not iterable');
    feed.items.forEach(assertNoRawLeak);
  });

  it('maps each allowlisted event to its product phase', () => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Running',
      latestActivity: null,
      maxItems: 0, // disable cap so we can read every collapsed group
      events: [
        event({ id: 'a', eventType: 'section-started' }),
        event({ id: 'b', eventType: 'skill-loaded' }),
        event({ id: 'c', eventType: 'tool-started' }),
        event({ id: 'd', eventType: 'structured-output-started' }),
        event({ id: 'e', eventType: 'validation-failed' }),
        event({ id: 'f', eventType: 'repair-started' }),
        event({ id: 'g', eventType: 'sub-section-committed' }),
        event({ id: 'h', eventType: 'section-completed' }),
      ],
    });

    // maxItems: 0 yields no items, so re-run without the cap for phase reads.
    const full = buildSectionActivityFeed({
      phaseLabel: 'Running',
      latestActivity: null,
      events: [
        event({ id: 'a', eventType: 'section-started' }),
        event({ id: 'b', eventType: 'skill-loaded' }),
        event({ id: 'c', eventType: 'tool-started' }),
        event({ id: 'd', eventType: 'structured-output-started' }),
        event({ id: 'e', eventType: 'validation-failed' }),
        event({ id: 'f', eventType: 'repair-started' }),
        event({ id: 'g', eventType: 'sub-section-committed' }),
        event({ id: 'h', eventType: 'section-completed' }),
      ],
    });

    expect(feed.items).toEqual([]);
    // section-started + skill-loaded collapse (both 'preparing').
    expect(full.items.map((item) => item.phase)).toEqual([
      'preparing',
      'searching',
      'drafting',
      'checking',
      'refining',
      'committing',
      'done',
    ]);
    full.items.forEach(assertNoRawLeak);
  });

  it('drops unknown event types from the feed but they stay invisible', () => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Running',
      latestActivity: null,
      events: [
        event({ id: 'a', eventType: 'tool-started' }),
        event({
          id: 'b',
          eventType: 'internal-debug-trace',
          message: '{"raw":"diagnostics"}',
          metadata: { issues: ['leak me'] },
        }),
        event({ id: 'c', eventType: 'tool-finished' }),
      ],
    });

    // Only the two tool events survive (and collapse into one searching row).
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]?.phase).toBe('searching');
    expect(JSON.stringify(feed.items)).not.toContain('diagnostics');
    expect(JSON.stringify(feed.items)).not.toContain('leak me');
    feed.items.forEach(assertNoRawLeak);
  });

  it('collapses consecutive same-phase tool events with a count and chips', () => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Reading sources',
      latestActivity: null,
      events: [
        event({ id: 'a', eventType: 'tool-started' }),
        event({
          id: 'b',
          eventType: 'tool-finished',
          metadata: { query: 'pricing benchmarks' },
        }),
        event({ id: 'c', eventType: 'tool-started' }),
        event({
          id: 'd',
          eventType: 'tool-finished',
          metadata: { query: 'competitor positioning' },
        }),
      ],
    });

    expect(feed.items).toHaveLength(1);
    const [searching] = feed.items;
    expect(searching.count).toBe(4);
    expect(searching.chips).toEqual([
      'pricing benchmarks',
      'competitor positioning',
    ]);
    feed.items.forEach(assertNoRawLeak);
  });

  it('keeps counts over the full stream and caps the collapsed list', () => {
    const feed = buildSectionActivityFeed({
      phaseLabel: 'Running',
      latestActivity: null,
      maxItems: 2,
      events: [
        event({ id: 'a', eventType: 'tool-started' }),
        event({ id: 'b', eventType: 'tool-finished' }),
        event({ id: 'c', eventType: 'validation-failed' }),
        event({ id: 'd', eventType: 'repair-started' }),
        event({ id: 'e', eventType: 'artifact-saved' }),
      ],
    });

    // Counts reflect the entire raw stream...
    expect(feed.counts).toMatchObject({
      toolsStarted: 1,
      toolsFinished: 1,
      validationFailures: 1,
      repairsStarted: 1,
    });
    // ...but the collapsed list is sliced to the last 2 phases (refining, committing).
    expect(feed.items.map((item) => item.phase)).toEqual([
      'refining',
      'committing',
    ]);
    feed.items.forEach(assertNoRawLeak);
  });

  it('prefers latestActivity, then last item title, then phaseLabel for currentLabel', () => {
    const withLatest = buildSectionActivityFeed({
      phaseLabel: 'Reading sources',
      latestActivity: 'Searching source evidence',
      events: [event({ id: 'a', eventType: 'tool-started' })],
    });
    expect(withLatest.currentLabel).toBe('Searching source evidence');

    const withItems = buildSectionActivityFeed({
      phaseLabel: 'Reading sources',
      latestActivity: null,
      events: [event({ id: 'a', eventType: 'artifact-saved' })],
    });
    expect(withItems.currentLabel).toBe('Section verified & committed');

    const empty = buildSectionActivityFeed({
      phaseLabel: 'Reading sources',
      latestActivity: null,
      events: [],
    });
    expect(empty.currentLabel).toBe('Reading sources');
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
