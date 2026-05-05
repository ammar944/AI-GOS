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
import { type ResearchEvidence } from '@/lib/gtm/schemas/evidence';

const validEvidence: ResearchEvidence = {
  id: 'ev_01',
  source_type: 'website_url',
  label: 'homepage',
  url: 'https://example.com',
  quote: 'Best SaaS platform',
  confidence: 'high',
  retrieved_at: '2026-05-01T00:00:00.000Z',
  claim_path: ['companyIdentity', 'companyName'],
};

describe('gtmBriefFieldSchema', () => {
  const field: GtmBriefField = {
    value: 'AIGOS',
    status: 'missing',
    confidence: 'missing',
    sources: [],
    updatedBy: 'system',
    updatedAt: '2026-04-24T12:00:00.000Z',
  };

  it('round-trips a valid missing field', () => {
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

  it('rejects confirmed with empty sources', () => {
    const result = gtmBriefFieldSchema.safeParse({
      ...field,
      status: 'confirmed',
      confidence: 'high',
      sources: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects suggested with empty sources', () => {
    const result = gtmBriefFieldSchema.safeParse({
      ...field,
      status: 'suggested',
      confidence: 'medium',
      sources: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts missing with empty sources', () => {
    const result = gtmBriefFieldSchema.safeParse({
      ...field,
      status: 'missing',
      confidence: 'missing',
      sources: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts confirmed with valid evidence', () => {
    const result = gtmBriefFieldSchema.safeParse({
      ...field,
      status: 'confirmed',
      confidence: 'high',
      sources: [validEvidence],
      updatedBy: 'user',
    });
    expect(result.success).toBe(true);
  });

  it('accepts suggested with valid evidence', () => {
    const result = gtmBriefFieldSchema.safeParse({
      ...field,
      status: 'suggested',
      confidence: 'medium',
      sources: [validEvidence],
      updatedBy: 'ai',
    });
    expect(result.success).toBe(true);
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
