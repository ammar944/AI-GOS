import { describe, expect, it } from 'vitest';
import {
  GTM_BRIEF_FIELD_KEYS,
  GTM_BRIEF_FIELD_GROUPS,
  gtmBriefFieldSchema,
  gtmBriefSchema,
  buildEmptyGtmBrief,
  type GtmBrief,
  type GtmBriefField,
} from '@/lib/gtm/schemas/gtm-brief';

describe('gtmBriefFieldSchema', () => {
  const field: GtmBriefField = {
    value: 'AIGOS',
    status: 'confirmed',
    confidence: 'high',
    sources: [],
    updatedBy: 'user',
    updatedAt: '2026-04-24T12:00:00.000Z',
  };

  it('round-trips a valid field', () => {
    expect(gtmBriefFieldSchema.parse(field)).toEqual(field);
  });

  it('rejects unknown status', () => {
    const result = gtmBriefFieldSchema.safeParse({ ...field, status: 'approved' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown confidence', () => {
    const result = gtmBriefFieldSchema.safeParse({ ...field, confidence: 'certain' });
    expect(result.success).toBe(false);
  });

  it('requires updatedBy to be ai | user | system', () => {
    for (const updatedBy of ['ai', 'user', 'system'] as const) {
      expect(gtmBriefFieldSchema.safeParse({ ...field, updatedBy }).success).toBe(true);
    }
    expect(gtmBriefFieldSchema.safeParse({ ...field, updatedBy: 'bot' }).success).toBe(false);
  });
});

describe('GTM_BRIEF_FIELD_GROUPS', () => {
  it('every declared field key belongs to exactly one group', () => {
    const grouped = Object.values(GTM_BRIEF_FIELD_GROUPS).flat();
    const unique = new Set(grouped);
    expect(grouped.length).toBe(unique.size);
    expect(unique.size).toBe(GTM_BRIEF_FIELD_KEYS.length);
    for (const key of GTM_BRIEF_FIELD_KEYS) {
      expect(unique.has(key)).toBe(true);
    }
  });
});

describe('gtmBriefSchema', () => {
  it('buildEmptyGtmBrief produces a parseable, missing-everywhere brief', () => {
    const brief: GtmBrief = buildEmptyGtmBrief();
    const parsed = gtmBriefSchema.parse(brief);
    for (const key of GTM_BRIEF_FIELD_KEYS) {
      expect(parsed.fields[key].status).toBe('missing');
      expect(parsed.fields[key].confidence).toBe('missing');
      expect(parsed.fields[key].value).toBe('');
    }
  });

  it('requires every field key to be present', () => {
    const brief = buildEmptyGtmBrief();
    delete (brief.fields as Record<string, unknown>).companyName;
    expect(gtmBriefSchema.safeParse(brief).success).toBe(false);
  });

  it('honours briefId and updatedAt overrides', () => {
    const brief = buildEmptyGtmBrief({ briefId: 'brief_01', updatedAt: '2026-04-24T12:00:00.000Z' });
    expect(brief.briefId).toBe('brief_01');
    expect(brief.updatedAt).toBe('2026-04-24T12:00:00.000Z');
  });
});
