import { describe, it, expect } from 'vitest';
import {
  renderBaselineMetricsBlock,
  readBaselineMetricsFromContext,
  type BaselineMetrics,
} from '../baseline-metrics';

describe('renderBaselineMetricsBlock', () => {
  it('renders NOT PROVIDED for every null field', () => {
    const metrics: BaselineMetrics = {
      currentCac: null,
      avgCustomerLtv: null,
      leadToCustomerRate: null,
      last12MoGrowthRate: null,
    };
    const block = renderBaselineMetricsBlock(metrics);
    expect(block).toContain('currentCac: NOT PROVIDED');
    expect(block).toContain('avgCustomerLtv: NOT PROVIDED');
    expect(block).toContain('leadToCustomerRate: NOT PROVIDED');
    expect(block).toContain('last12MoGrowthRate: NOT PROVIDED');
    expect(block).toContain('BASELINE METRICS DATA INTEGRITY');
    expect(block).toContain('NEVER invent LTV, CAC');
  });

  it('substitutes actual values when provided', () => {
    const metrics: BaselineMetrics = {
      currentCac: 450,
      avgCustomerLtv: 3600,
      leadToCustomerRate: 5,
      last12MoGrowthRate: 25,
    };
    const block = renderBaselineMetricsBlock(metrics);
    expect(block).toContain('currentCac: $450');
    expect(block).toContain('avgCustomerLtv: $3600');
    expect(block).toContain('leadToCustomerRate: 5%');
    expect(block).toContain('last12MoGrowthRate: 25%');
  });

  it('accepts undefined (no baselineMetrics) and renders all NOT PROVIDED', () => {
    const block = renderBaselineMetricsBlock(undefined);
    expect(block).toContain('currentCac: NOT PROVIDED');
    expect(block).toContain('last12MoGrowthRate: NOT PROVIDED');
  });
});

describe('readBaselineMetricsFromContext', () => {
  it('returns undefined when context is missing or wrong type', () => {
    expect(readBaselineMetricsFromContext(undefined)).toBeUndefined();
    expect(readBaselineMetricsFromContext(null)).toBeUndefined();
    expect(readBaselineMetricsFromContext('string')).toBeUndefined();
    expect(readBaselineMetricsFromContext(42)).toBeUndefined();
  });

  it('returns undefined when baselineMetrics key is absent or wrong type', () => {
    expect(readBaselineMetricsFromContext({})).toBeUndefined();
    expect(readBaselineMetricsFromContext({ baselineMetrics: null })).toBeUndefined();
    expect(readBaselineMetricsFromContext({ baselineMetrics: 'nope' })).toBeUndefined();
  });

  it('extracts all four metrics when present', () => {
    expect(
      readBaselineMetricsFromContext({
        baselineMetrics: {
          currentCac: 450,
          avgCustomerLtv: 3600,
          leadToCustomerRate: 5,
          last12MoGrowthRate: 25,
        },
      }),
    ).toEqual({
      currentCac: 450,
      avgCustomerLtv: 3600,
      leadToCustomerRate: 5,
      last12MoGrowthRate: 25,
    });
  });

  it('preserves partial nulls', () => {
    expect(
      readBaselineMetricsFromContext({
        baselineMetrics: { currentCac: 450, avgCustomerLtv: null },
      }),
    ).toEqual({
      currentCac: 450,
      avgCustomerLtv: null,
      leadToCustomerRate: null,
      last12MoGrowthRate: null,
    });
  });

  it('rejects non-finite and non-numeric values', () => {
    expect(
      readBaselineMetricsFromContext({
        baselineMetrics: {
          currentCac: 'four hundred',
          avgCustomerLtv: NaN,
          leadToCustomerRate: Infinity,
          last12MoGrowthRate: null,
        },
      }),
    ).toEqual({
      currentCac: null,
      avgCustomerLtv: null,
      leadToCustomerRate: null,
      last12MoGrowthRate: null,
    });
  });
});
