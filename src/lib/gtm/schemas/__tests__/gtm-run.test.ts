import { describe, expect, it } from 'vitest';
import {
  GTM_STAGE_KEYS,
  GTM_RUN_STATUSES,
  gtmRunSchema,
  type GtmRun,
  type GtmStageKey,
} from '@/lib/gtm/schemas/gtm-run';

describe('GTM_STAGE_KEYS', () => {
  const expected: readonly GtmStageKey[] = [
    'discover-url',
    'enrich-brief',
    'review-brief',
    'lock-brief',
    'research-market-category',
    'research-buyer-icp',
    'research-competitors',
    'research-voc',
    'research-demand-intent',
    'research-offer-funnel',
    'synthesize-strategy',
    'generate-media-plan',
    'generate-scripts',
  ];

  it('matches the canonical stage order in the spec', () => {
    expect(GTM_STAGE_KEYS).toEqual(expected);
  });

  it('has no duplicates', () => {
    expect(new Set(GTM_STAGE_KEYS).size).toBe(GTM_STAGE_KEYS.length);
  });
});

describe('gtmRunSchema', () => {
  const validRun: GtmRun = {
    id: 'run_01',
    userId: 'user_01',
    clientId: 'client_01',
    briefId: 'brief_01',
    briefSnapshotId: 'snap_01',
    status: 'running',
    currentStage: 'research-market-category',
    createdAt: '2026-04-24T12:00:00.000Z',
    updatedAt: '2026-04-24T12:00:00.000Z',
  };

  it('round-trips a valid run', () => {
    expect(gtmRunSchema.parse(validRun)).toEqual(validRun);
  });

  it('rejects unknown status', () => {
    const result = gtmRunSchema.safeParse({ ...validRun, status: 'paused' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown stage', () => {
    const result = gtmRunSchema.safeParse({ ...validRun, currentStage: 'finish-everything' });
    expect(result.success).toBe(false);
  });

  it('requires briefSnapshotId', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { briefSnapshotId: _omitted, ...rest } = validRun;
    expect(gtmRunSchema.safeParse(rest).success).toBe(false);
  });

  it('accepts every declared status', () => {
    for (const status of GTM_RUN_STATUSES) {
      expect(gtmRunSchema.safeParse({ ...validRun, status }).success).toBe(true);
    }
  });
});
