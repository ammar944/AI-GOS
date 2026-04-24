import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_SOURCE_TYPES,
  evidenceSourceSchema,
  type EvidenceSource,
} from '@/lib/gtm/schemas/evidence';

describe('evidenceSourceSchema', () => {
  const validSource: EvidenceSource = {
    id: 'src_01HXYZ',
    type: 'url',
    label: 'aigos.ai homepage',
    url: 'https://aigos.ai',
    excerpt: 'We help SaaS companies run GTM experiments.',
    capturedAt: '2026-04-24T12:00:00.000Z',
  };

  it('round-trips a valid source', () => {
    expect(evidenceSourceSchema.parse(validSource)).toEqual(validSource);
  });

  it('accepts every declared source type', () => {
    for (const type of EVIDENCE_SOURCE_TYPES) {
      const parsed = evidenceSourceSchema.parse({ ...validSource, type });
      expect(parsed.type).toBe(type);
    }
  });

  it('rejects unknown source types', () => {
    const result = evidenceSourceSchema.safeParse({ ...validSource, type: 'slack' });
    expect(result.success).toBe(false);
  });

  it('allows url and excerpt to be omitted', () => {
    const result = evidenceSourceSchema.safeParse({
      id: 'src_1',
      type: 'manual_note',
      label: 'founder note',
      capturedAt: '2026-04-24T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const { id: _omitted, ...rest } = validSource;
    const result = evidenceSourceSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
