import { describe, it, expect } from 'vitest';
import { CompressedSummarySchema, type CompressedSummary } from '../compressed-summary';

describe('CompressedSummarySchema', () => {
  it('validates a complete summary', () => {
    const input: CompressedSummary = {
      keyFindings: ['B2B SaaS market growing 15% YoY', 'LinkedIn CPL averaging $250'],
      dataPoints: { marketSize: '$50B', avgCAC: '$1,200' },
      confidence: 'high',
      sources: ['https://g2.com/report', 'https://statista.com/saas'],
      gaps: ['No data on SMB segment'],
    };
    const result = CompressedSummarySchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects empty keyFindings', () => {
    const input = {
      keyFindings: [],
      dataPoints: {},
      confidence: 'high',
      sources: [],
      gaps: [],
    };
    const result = CompressedSummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects more than 7 keyFindings', () => {
    const input = {
      keyFindings: Array(8).fill('finding'),
      dataPoints: {},
      confidence: 'high',
      sources: [],
      gaps: [],
    };
    const result = CompressedSummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid confidence level', () => {
    const input = {
      keyFindings: ['finding'],
      dataPoints: {},
      confidence: 'very-high',
      sources: [],
      gaps: [],
    };
    const result = CompressedSummarySchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
