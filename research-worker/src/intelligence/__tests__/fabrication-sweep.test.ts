import { describe, it, expect } from 'vitest';
import { sweepString, sweepCard } from '../fabrication-sweep';

describe('sweepString — true positives', () => {
  const NO_USER_RATE = { path: 'f', allowGrowthClaims: false, userGrowthRate: null };

  it('flags ungated YoY growth percentages', () => {
    const m = sweepString('Expect 32% YoY growth in this segment.', NO_USER_RATE.path, false, null);
    expect(m).toHaveLength(1);
    expect(m[0]?.pattern).toBe('yoy_growth');
  });

  it('flags "scale to $X ARR in N months"', () => {
    const m = sweepString('We can scale to $10M ARR in 18 months with this motion.', 'a.b', false, null);
    expect(m).toHaveLength(1);
    expect(m[0]?.pattern).toBe('scale_to_arr');
  });

  it('flags "grow from $X to $Y"', () => {
    const m = sweepString('Opportunity to grow from $2M to $15M quickly.', 'a', false, null);
    expect(m).toHaveLength(1);
    expect(m[0]?.pattern).toBe('grow_from_to');
  });

  it('flags "reach $X ARR"', () => {
    const m = sweepString('Path to reach $50M ARR in the category.', 'a', false, null);
    expect(m).toHaveLength(1);
    expect(m[0]?.pattern).toBe('reach_arr');
  });

  it('flags multiple patterns in one string', () => {
    const m = sweepString(
      'With 45% YoY growth, we can scale to $10M ARR and reach $25M ARR soon.',
      'a',
      false,
      null,
    );
    expect(m.length).toBeGreaterThanOrEqual(3);
  });
});

describe('sweepString — true negatives', () => {
  it('preserves cited YoY via benchmark keyword', () => {
    const text = 'The B2B SaaS category grows 20% YoY according to Gartner 2025.';
    const m = sweepString(text, 'a', false, null);
    expect(m).toHaveLength(0);
  });

  it('preserves YoY when user reported that exact rate', () => {
    const text = 'Expect 25% YoY growth in this segment.';
    const m = sweepString(text, 'a', true, 25);
    expect(m).toHaveLength(0);
  });

  it('strips user rate NOT matching the cited number', () => {
    const text = 'Expect 60% YoY growth in this segment.';
    const m = sweepString(text, 'a', true, 25);
    expect(m).toHaveLength(1);
  });

  it('preserves "industry typically sees X%"', () => {
    const text = 'This industry typically sees 15% YoY growth.';
    const m = sweepString(text, 'a', false, null);
    expect(m).toHaveLength(0);
  });

  it('returns empty for empty string', () => {
    expect(sweepString('', 'a', false, null)).toEqual([]);
  });
});

describe('sweepCard — recursive object walk', () => {
  it('flags matches across nested arrays and objects', () => {
    const card = {
      opportunities: [
        { opportunity: 'Market gap', size: 'Expect 30% YoY growth' },
        { opportunity: 'Another', size: 'Mid-market.' },
      ],
      summary: 'Path to reach $100M ARR within 24 months.',
    };
    const result = sweepCard(card, { allowGrowthClaims: false, userGrowthRate: null });
    expect(result.fabricated).toBe(true);
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
    expect(result.matches.some((m) => m.path === 'opportunities[0].size')).toBe(true);
    expect(result.matches.some((m) => m.path === 'summary')).toBe(true);
  });

  it('returns fabricated=false for clean evidence-cited text', () => {
    const card = {
      opportunities: [
        {
          opportunity: 'Compliance gap in mid-market',
          size: 'per Gartner, the segment grows 18% YoY',
          evidence: 'https://gartner.com/report-2025',
        },
      ],
    };
    const result = sweepCard(card, { allowGrowthClaims: false, userGrowthRate: null });
    expect(result.fabricated).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it('handles null, undefined, booleans, numbers without crashing', () => {
    const card = {
      a: null,
      b: undefined,
      c: true,
      d: 42,
      e: { nested: 'reach $20M ARR quickly' },
    };
    const result = sweepCard(card, { allowGrowthClaims: false, userGrowthRate: null });
    expect(result.fabricated).toBe(true);
    expect(result.matches[0]?.path).toBe('e.nested');
  });

  it('respects user-reported rate through recursive sweep', () => {
    const card = {
      scorecard: [
        { dimension: 'growth', summary: 'Company reports 25% YoY growth' },
        { dimension: 'retention', summary: 'strong' },
      ],
    };
    const result = sweepCard(card, { allowGrowthClaims: true, userGrowthRate: 25 });
    expect(result.fabricated).toBe(false);
  });
});
