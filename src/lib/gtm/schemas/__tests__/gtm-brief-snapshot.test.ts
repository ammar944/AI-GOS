import { describe, expect, it } from 'vitest';
import { buildEmptyGtmBrief } from '@/lib/gtm/schemas/gtm-brief';
import {
  gtmBriefSnapshotSchema,
  freezeBriefAsSnapshot,
  type GtmBriefSnapshot,
} from '@/lib/gtm/schemas/gtm-brief-snapshot';

describe('gtmBriefSnapshotSchema', () => {
  it('round-trips a valid snapshot', () => {
    const brief = buildEmptyGtmBrief({ briefId: 'brief_01', updatedAt: '2026-04-24T12:00:00.000Z' });
    const snapshot: GtmBriefSnapshot = {
      snapshotId: 'snap_01',
      parentBriefId: 'brief_01',
      fields: brief.fields,
      briefCreatedAt: brief.createdAt,
      briefUpdatedAt: brief.updatedAt,
      snapshotCreatedAt: '2026-04-24T12:01:00.000Z',
    };
    expect(gtmBriefSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it('rejects missing snapshotId', () => {
    const brief = buildEmptyGtmBrief({ briefId: 'brief_01' });
    const result = gtmBriefSnapshotSchema.safeParse({
      parentBriefId: 'brief_01',
      fields: brief.fields,
      briefCreatedAt: brief.createdAt,
      briefUpdatedAt: brief.updatedAt,
      snapshotCreatedAt: '2026-04-24T12:01:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('freezeBriefAsSnapshot', () => {
  it('produces a snapshot that parses and carries the source brief id', () => {
    const brief = buildEmptyGtmBrief({ briefId: 'brief_01', updatedAt: '2026-04-24T12:00:00.000Z' });
    const snapshot = freezeBriefAsSnapshot(brief, { snapshotId: 'snap_01', now: '2026-04-24T12:01:00.000Z' });
    expect(gtmBriefSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot.parentBriefId).toBe('brief_01');
    expect(snapshot.snapshotCreatedAt).toBe('2026-04-24T12:01:00.000Z');
  });

  it('does not share field references with the source brief (immutability)', () => {
    const brief = buildEmptyGtmBrief({ briefId: 'brief_01' });
    const snapshot = freezeBriefAsSnapshot(brief, { snapshotId: 'snap_01' });
    expect(snapshot.fields).not.toBe(brief.fields);
    expect(snapshot.fields.companyName).not.toBe(brief.fields.companyName);
  });
});
