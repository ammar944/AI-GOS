import { describe, expect, it } from 'vitest';
import {
  RESEARCH_EVIDENCE_SOURCE_TYPES,
  researchEvidenceSchema,
  sourceGapSchema,
  evidenceSetSchema,
  EMPTY_EVIDENCE_SET,
  type ResearchEvidence,
  type SourceGap,
} from '@/lib/gtm/schemas/evidence';

describe('researchEvidenceSchema', () => {
  const validEvidence: ResearchEvidence = {
    id: 'ev_01HXYZ',
    source_type: 'website_url',
    label: 'aigos.ai homepage',
    url: 'https://aigos.ai',
    quote: 'We help SaaS companies run GTM experiments.',
    confidence: 'high',
    retrieved_at: '2026-04-24T12:00:00.000Z',
    claim_path: ['companyIdentity', 'companyName'],
  };

  it('round-trips valid evidence', () => {
    expect(researchEvidenceSchema.parse(validEvidence)).toEqual(validEvidence);
  });

  it('accepts every declared source type with retrieved_at', () => {
    for (const type of RESEARCH_EVIDENCE_SOURCE_TYPES) {
      const timestamp = type === 'user_input'
        ? {}
        : { retrieved_at: '2026-04-24T12:00:00.000Z' };
      const ev = { ...validEvidence, source_type: type, ...timestamp };
      const parsed = researchEvidenceSchema.parse(ev);
      expect(parsed.source_type).toBe(type);
    }
  });

  it('rejects unknown source types', () => {
    const result = researchEvidenceSchema.safeParse({
      ...validEvidence,
      source_type: 'slack_message',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown confidence', () => {
    const result = researchEvidenceSchema.safeParse({
      ...validEvidence,
      confidence: 'certain',
    });
    expect(result.success).toBe(false);
  });

  it('allows optional reference fields to be omitted', () => {
    const result = researchEvidenceSchema.safeParse({
      id: 'ev_2',
      source_type: 'user_input',
      label: 'founder note',
      confidence: 'medium',
      claim_path: ['companyIdentity', 'companyName'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects claim_path with fewer than one segment', () => {
    const result = researchEvidenceSchema.safeParse({
      ...validEvidence,
      claim_path: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing id', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _omitted, ...rest } = validEvidence;
    const result = researchEvidenceSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects web_page without retrieved_at or observed_at', () => {
    const ev = {
      id: 'ev_3',
      source_type: 'web_page',
      label: 'example page',
      url: 'https://example.com',
      confidence: 'medium',
      claim_path: ['icp', 'icpPains'],
    };
    const result = researchEvidenceSchema.safeParse(ev);
    expect(result.success).toBe(false);
  });

  it('accepts website_url with retrieved_at', () => {
    const result = researchEvidenceSchema.safeParse(validEvidence);
    expect(result.success).toBe(true);
  });

  it('accepts transcript with observed_at', () => {
    const result = researchEvidenceSchema.safeParse({
      id: 'ev_t1',
      source_type: 'transcript',
      label: 'founder call',
      transcript_reference: 'call_001',
      quote: 'Our biggest pain is lead velocity.',
      confidence: 'high',
      observed_at: '2026-05-01T10:00:00.000Z',
      claim_path: ['icp', 'icpPains'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts user_input without timestamp', () => {
    const result = researchEvidenceSchema.safeParse({
      id: 'ev_ui',
      source_type: 'user_input',
      label: 'founder note',
      quote: 'ACV is ~$25k.',
      confidence: 'medium',
      claim_path: ['economics', 'avgAcv'],
    });
    expect(result.success).toBe(true);
  });
});

describe('sourceGapSchema', () => {
  const validGap: SourceGap = {
    id: 'gap_01',
    claim_path: ['icp', 'icpPains'],
    severity: 'blocker',
    reason: 'No customer interviews or review data found.',
  };

  it('round-trips a valid gap', () => {
    expect(sourceGapSchema.parse(validGap)).toEqual(validGap);
  });

  it('allows informational severity', () => {
    const gap = sourceGapSchema.parse({ ...validGap, severity: 'informational' });
    expect(gap.severity).toBe('informational');
  });

  it('allows degraded severity', () => {
    const gap = sourceGapSchema.parse({ ...validGap, severity: 'degraded' });
    expect(gap.severity).toBe('degraded');
  });

  it('allows remediation string', () => {
    const gap = sourceGapSchema.parse({
      ...validGap,
      remediation: 'Ask user for 3 customer call recordings.',
    });
    expect(gap.remediation).toBe('Ask user for 3 customer call recordings.');
  });

  it('rejects claim_path with zero segments', () => {
    const result = sourceGapSchema.safeParse({ ...validGap, claim_path: [] });
    expect(result.success).toBe(false);
  });

  it('rejects unknown severity', () => {
    const result = sourceGapSchema.safeParse({ ...validGap, severity: 'critical' });
    expect(result.success).toBe(false);
  });
});

describe('evidenceSetSchema', () => {
  it('EMPTY_EVIDENCE_SET has the expected shape', () => {
    expect(EMPTY_EVIDENCE_SET).toEqual({ evidence: [], source_gaps: [] });
  });

  it('accepts empty evidence and gaps', () => {
    const result = evidenceSetSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.evidence).toEqual([]);
      expect(result.data.source_gaps).toEqual([]);
    }
  });

  it('accepts a full evidence set', () => {
    const set = {
      evidence: [
        {
          id: 'ev_1',
          source_type: 'website_url' as const,
          label: 'homepage',
          url: 'https://example.com',
          quote: 'Best SaaS platform',
          confidence: 'high' as const,
          retrieved_at: '2026-05-01T00:00:00.000Z',
          claim_path: ['companyIdentity', 'companyName'],
        },
      ],
      source_gaps: [
        {
          id: 'gap_1',
          claim_path: ['icp', 'icpPains'],
          severity: 'degraded' as const,
          reason: 'No review data available.',
        },
      ],
    };
    expect(evidenceSetSchema.safeParse(set).success).toBe(true);
  });
});
