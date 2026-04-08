import { describe, it, expect } from 'vitest';
import * as validationModule from '../validation';
import { computeCACModel, type CACModelInput } from '../validation';

describe('computeCACModel — nullable inputs', () => {
  const base: CACModelInput = {
    monthlyBudget: 10000,
    targetCPL: null,
    leadToCustomerRate: null,
    currentCac: null,
    avgCustomerLtv: null,
  };

  it('returns all-null economics when every baseline metric is missing', () => {
    const { cacModel, insufficientData } = computeCACModel(base);
    expect(cacModel.estimatedLTV).toBeNull();
    expect(cacModel.ltvToCacRatio).toBeNull();
    expect(cacModel.targetCAC).toBeNull();
    expect(cacModel.expectedMonthlyCustomers).toBeNull();
    expect(cacModel.expectedMonthlyLeads).toBeNull();
    expect(cacModel.expectedMonthlySQLs).toBeNull();
    expect(cacModel.leadToSqlRate).toBeNull();
    expect(cacModel.sqlToCustomerRate).toBeNull();
    expect(insufficientData.length).toBeGreaterThanOrEqual(3);
    expect(insufficientData.some((s) => s.includes('estimatedLTV'))).toBe(true);
    expect(insufficientData.some((s) => s.includes('leadToCustomerRate'))).toBe(true);
  });

  it('honors user-provided currentCac as targetCAC when provided', () => {
    const { cacModel } = computeCACModel({ ...base, currentCac: 450 });
    expect(cacModel.targetCAC).toBe(450);
    expect(cacModel.estimatedLTV).toBeNull();
    expect(cacModel.ltvToCacRatio).toBeNull();
  });

  it('honors user-provided avgCustomerLtv as estimatedLTV (no retention multiplier)', () => {
    const { cacModel } = computeCACModel({
      ...base,
      avgCustomerLtv: 3600,
      currentCac: 450,
    });
    expect(cacModel.estimatedLTV).toBe(3600);
    expect(cacModel.ltvToCacRatio).toBe('8.0:1 — Healthy');
  });

  it('computes the full deterministic cascade when all four metrics are provided', () => {
    const { cacModel, insufficientData } = computeCACModel({
      monthlyBudget: 10000,
      targetCPL: 50,
      leadToCustomerRate: 4,
      currentCac: 500,
      avgCustomerLtv: 4000,
    });
    // effectiveBudget = 10000 * 0.8 = 8000
    // expectedMonthlyLeads = round(8000 / 50) = 160
    // expectedMonthlyCustomers = max(1, round(160 * 4 / 100)) = 6
    expect(cacModel.expectedMonthlyLeads).toBe(160);
    expect(cacModel.expectedMonthlyCustomers).toBe(6);
    // stageRate = round(sqrt(0.04) * 100 * 10) / 10 = 20
    expect(cacModel.leadToSqlRate).toBe(20);
    expect(cacModel.sqlToCustomerRate).toBe(20);
    // User-provided currentCac wins over derived CAC
    expect(cacModel.targetCAC).toBe(500);
    expect(cacModel.estimatedLTV).toBe(4000);
    expect(cacModel.ltvToCacRatio).toBe('8.0:1 — Healthy');
    expect(insufficientData).toEqual([]);
  });

  it('labels sub-3 ratios as "Below ideal"', () => {
    const { cacModel } = computeCACModel({
      ...base,
      currentCac: 1000,
      avgCustomerLtv: 2000,
    });
    expect(cacModel.ltvToCacRatio).toBe('2.0:1 — Below ideal (target >3:1)');
  });

  it('labels sub-1 ratios as "Unsustainable"', () => {
    const { cacModel } = computeCACModel({
      ...base,
      currentCac: 5000,
      avgCustomerLtv: 2000,
    });
    expect(cacModel.ltvToCacRatio).toBe('0.4:1 — Unsustainable');
  });

  it('derives targetCAC from the conversion cascade when currentCac is null but other inputs are present', () => {
    const { cacModel } = computeCACModel({
      monthlyBudget: 10000,
      targetCPL: 50,
      leadToCustomerRate: 4,
      currentCac: null,
      avgCustomerLtv: null,
    });
    // expectedMonthlyCustomers = 6, targetCAC = round(10000 / 6) = 1667
    expect(cacModel.expectedMonthlyCustomers).toBe(6);
    expect(cacModel.targetCAC).toBe(1667);
  });

  it('nulls expectedMonthlyLeads when targetCPL is null', () => {
    const { cacModel, insufficientData } = computeCACModel({
      monthlyBudget: 10000,
      targetCPL: null,
      leadToCustomerRate: 4,
      currentCac: null,
      avgCustomerLtv: null,
    });
    expect(cacModel.expectedMonthlyLeads).toBeNull();
    expect(cacModel.expectedMonthlyCustomers).toBeNull();
    expect(insufficientData.some((s) => s.includes('targetCPL'))).toBe(true);
  });
});

describe('validation module — estimateRetentionMultiplier is removed', () => {
  it('no longer exports estimateRetentionMultiplier', () => {
    expect(
      (validationModule as Record<string, unknown>).estimateRetentionMultiplier,
    ).toBeUndefined();
  });
});
