import { describe, it, expect } from 'vitest';
import {
  BASELINE_METRIC_KEYS,
  extractBaselineMetrics,
  hasAnyBaselineMetrics,
} from '../baseline-metrics';

describe('BASELINE_METRIC_KEYS', () => {
  it('lists exactly the four baseline metric keys in a stable order', () => {
    expect(BASELINE_METRIC_KEYS).toEqual([
      'currentCac',
      'avgCustomerLtv',
      'leadToCustomerRate',
      'last3to6MoGrowthTrend',
    ]);
  });
});

describe('extractBaselineMetrics', () => {
  it('returns all nulls for an empty collectedFields bag', () => {
    expect(extractBaselineMetrics({})).toEqual({
      currentCac: null,
      avgCustomerLtv: null,
      leadToCustomerRate: null,
      last3to6MoGrowthTrend: null,
    });
  });

  it('returns all nulls for null or undefined input', () => {
    const expected = {
      currentCac: null,
      avgCustomerLtv: null,
      leadToCustomerRate: null,
      last3to6MoGrowthTrend: null,
    };
    expect(extractBaselineMetrics(null)).toEqual(expected);
    expect(extractBaselineMetrics(undefined)).toEqual(expected);
  });

  it('parses plain numeric strings', () => {
    expect(
      extractBaselineMetrics({
        currentCac: '450',
        avgCustomerLtv: '3600',
        leadToCustomerRate: '5',
        last3to6MoGrowthTrend: '25',
      }),
    ).toEqual({
      currentCac: 450,
      avgCustomerLtv: 3600,
      leadToCustomerRate: 5,
      last3to6MoGrowthTrend: 25,
    });
  });

  it('strips currency symbols, commas, and percent signs before parsing', () => {
    expect(
      extractBaselineMetrics({
        currentCac: '$450',
        avgCustomerLtv: '$3,600',
        leadToCustomerRate: '5%',
        last3to6MoGrowthTrend: '25%',
      }),
    ).toEqual({
      currentCac: 450,
      avgCustomerLtv: 3600,
      leadToCustomerRate: 5,
      last3to6MoGrowthTrend: 25,
    });
  });

  it('passes through numeric values unchanged', () => {
    expect(
      extractBaselineMetrics({
        currentCac: 450,
        avgCustomerLtv: 3600,
        leadToCustomerRate: 5,
        last3to6MoGrowthTrend: 25,
      }),
    ).toEqual({
      currentCac: 450,
      avgCustomerLtv: 3600,
      leadToCustomerRate: 5,
      last3to6MoGrowthTrend: 25,
    });
  });

  it('accepts negative growth rates (shrinking revenue)', () => {
    expect(
      extractBaselineMetrics({ last3to6MoGrowthTrend: '-15%' }),
    ).toEqual({
      currentCac: null,
      avgCustomerLtv: null,
      leadToCustomerRate: null,
      last3to6MoGrowthTrend: -15,
    });
  });

  it('returns null for unparseable strings', () => {
    expect(
      extractBaselineMetrics({
        currentCac: 'four hundred fifty',
        avgCustomerLtv: '',
        leadToCustomerRate: '   ',
      }),
    ).toEqual({
      currentCac: null,
      avgCustomerLtv: null,
      leadToCustomerRate: null,
      last3to6MoGrowthTrend: null,
    });
  });

  it('returns null for NaN and Infinity', () => {
    expect(
      extractBaselineMetrics({
        currentCac: NaN,
        avgCustomerLtv: Infinity,
      }),
    ).toEqual({
      currentCac: null,
      avgCustomerLtv: null,
      leadToCustomerRate: null,
      last3to6MoGrowthTrend: null,
    });
  });

  it('ignores baseline-metric-shaped values of the wrong type (objects, arrays)', () => {
    expect(
      extractBaselineMetrics({
        currentCac: { value: 450 },
        avgCustomerLtv: [3600],
      }),
    ).toEqual({
      currentCac: null,
      avgCustomerLtv: null,
      leadToCustomerRate: null,
      last3to6MoGrowthTrend: null,
    });
  });

  it('partial fills preserve every user input and null the rest', () => {
    expect(
      extractBaselineMetrics({
        currentCac: '$450',
        leadToCustomerRate: '5',
      }),
    ).toEqual({
      currentCac: 450,
      avgCustomerLtv: null,
      leadToCustomerRate: 5,
      last3to6MoGrowthTrend: null,
    });
  });

  it('ignores unrelated keys in the collectedFields bag', () => {
    const result = extractBaselineMetrics({
      currentCac: '$450',
      monthlyAdBudget: '5000',
      pricingTiers: 'Starter $49/mo',
    });
    expect(result.currentCac).toBe(450);
    expect(result).not.toHaveProperty('monthlyAdBudget');
    expect(result).not.toHaveProperty('pricingTiers');
  });
});

describe('hasAnyBaselineMetrics', () => {
  it('returns false when every field is null', () => {
    expect(
      hasAnyBaselineMetrics({
        currentCac: null,
        avgCustomerLtv: null,
        leadToCustomerRate: null,
        last3to6MoGrowthTrend: null,
      }),
    ).toBe(false);
  });

  it('returns true when any single field is set', () => {
    expect(
      hasAnyBaselineMetrics({
        currentCac: 450,
        avgCustomerLtv: null,
        leadToCustomerRate: null,
        last3to6MoGrowthTrend: null,
      }),
    ).toBe(true);
  });

  it('returns true when last3to6MoGrowthTrend is zero (still a user-provided value)', () => {
    expect(
      hasAnyBaselineMetrics({
        currentCac: null,
        avgCustomerLtv: null,
        leadToCustomerRate: null,
        last3to6MoGrowthTrend: 0,
      }),
    ).toBe(true);
  });

  it('returns true when last3to6MoGrowthTrend is negative', () => {
    expect(
      hasAnyBaselineMetrics({
        currentCac: null,
        avgCustomerLtv: null,
        leadToCustomerRate: null,
        last3to6MoGrowthTrend: -15,
      }),
    ).toBe(true);
  });
});
