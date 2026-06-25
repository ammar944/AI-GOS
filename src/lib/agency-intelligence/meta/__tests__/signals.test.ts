import { describe, it, expect } from 'vitest';
import {
  frequencySignal,
  ctrSignal,
  cpcSignal,
  cpmSignal,
  creativeFatigueSignal,
  computeMetaSignals,
  type DailyCtrPoint,
} from '../signals';

describe('frequencySignal (prospecting M-CR2)', () => {
  it('null -> unknown', () => {
    expect(frequencySignal(null).status).toBe('unknown');
    expect(frequencySignal(null).value).toBeNull();
  });
  it('<3.0 good, boundary 3.0 watch, 5.0 watch, >5.0 poor', () => {
    expect(frequencySignal(2.99).status).toBe('good');
    expect(frequencySignal(3.0).status).toBe('watch');
    expect(frequencySignal(5.0).status).toBe('watch');
    expect(frequencySignal(5.01).status).toBe('poor');
  });
  it('retargeting bands (<8 good, 8–12 watch, >12 poor)', () => {
    expect(frequencySignal(7.99, 'retargeting').status).toBe('good');
    expect(frequencySignal(8.0, 'retargeting').status).toBe('watch');
    expect(frequencySignal(12.0, 'retargeting').status).toBe('watch');
    expect(frequencySignal(12.01, 'retargeting').status).toBe('poor');
  });
});

describe('ctrSignal (M-CR4 absolute bands)', () => {
  it('null -> unknown', () => {
    expect(ctrSignal(null).status).toBe('unknown');
  });
  it('>=1.0 good, 0.5–1.0 watch, <0.5 poor', () => {
    expect(ctrSignal(1.0).status).toBe('good');
    expect(ctrSignal(0.99).status).toBe('watch');
    expect(ctrSignal(0.5).status).toBe('watch');
    expect(ctrSignal(0.49).status).toBe('poor');
  });
  it('objective drives the benchmark label', () => {
    expect(ctrSignal(2, 'OUTCOME_LEADS').benchmark).toContain('Leads avg 2.59%');
    expect(ctrSignal(2, 'OUTCOME_TRAFFIC').benchmark).toContain('Traffic avg 1.71%');
  });
});

describe('cpcSignal (objective benchmark; ≤bm good, ≤2× watch, >2× poor)', () => {
  it('Leads benchmark $1.92', () => {
    expect(cpcSignal(1.92, 'OUTCOME_LEADS').status).toBe('good');
    expect(cpcSignal(3.84, 'OUTCOME_LEADS').status).toBe('watch'); // exactly 2×
    expect(cpcSignal(3.85, 'OUTCOME_LEADS').status).toBe('poor');
  });
  it('Traffic benchmark $0.70', () => {
    expect(cpcSignal(0.7, 'OUTCOME_TRAFFIC').status).toBe('good');
    expect(cpcSignal(1.5, 'OUTCOME_TRAFFIC').status).toBe('poor'); // >1.40
  });
  it('null -> unknown', () => {
    expect(cpcSignal(null).status).toBe('unknown');
  });
});

describe('cpmSignal (industry benchmark; ≤bm good, ≤1.5× watch, >1.5× poor)', () => {
  it('B2B SaaS $35', () => {
    expect(cpmSignal(35, 'b2b_saas').status).toBe('good');
    expect(cpmSignal(52.5, 'b2b_saas').status).toBe('watch'); // exactly 1.5×
    expect(cpmSignal(52.51, 'b2b_saas').status).toBe('poor');
  });
  it('default general $8', () => {
    expect(cpmSignal(8).status).toBe('good');
    expect(cpmSignal(12).status).toBe('watch');
    expect(cpmSignal(12.01).status).toBe('poor');
  });
  it('null -> unknown', () => {
    expect(cpmSignal(null).status).toBe('unknown');
  });
});

describe('creativeFatigueSignal (M28: >20% over ~14d)', () => {
  const series = (vals: number[]): DailyCtrPoint[] =>
    vals.map((ctr, i) => ({ date: `2026-06-${String(i + 1).padStart(2, '0')}`, ctr }));

  it('<4 points -> unknown', () => {
    expect(creativeFatigueSignal(series([2, 2, 2])).status).toBe('unknown');
  });
  it('stable CTR -> good', () => {
    expect(creativeFatigueSignal(series([2, 2, 2, 2, 2, 2])).status).toBe('good');
  });
  it('>20% drop (baseline 2.0 -> recent 1.0) -> poor', () => {
    const s = creativeFatigueSignal(series([2, 2, 2, 1, 1, 1]));
    expect(s.status).toBe('poor');
    expect(s.value).toBeGreaterThan(20);
  });
  it('10–20% drop -> watch', () => {
    // baseline avg 2.0, recent avg 1.7 -> 15% drop
    expect(creativeFatigueSignal(series([2, 2, 2, 1.7, 1.7, 1.7])).status).toBe('watch');
  });
  it('ignores null ctr points and unsorted input', () => {
    const pts: DailyCtrPoint[] = [
      { date: '2026-06-06', ctr: 1 },
      { date: '2026-06-01', ctr: 2 },
      { date: '2026-06-03', ctr: null },
      { date: '2026-06-02', ctr: 2 },
      { date: '2026-06-05', ctr: 1 },
      { date: '2026-06-04', ctr: 2 },
    ];
    // sorted non-null: [2,2,2,1,1] -> baseline [2,2] rec [2,1,1] -> drop>20
    expect(creativeFatigueSignal(pts).status).toBe('poor');
  });
});

describe('computeMetaSignals (honesty guardrail)', () => {
  it('never returns a numeric health score', () => {
    const r = computeMetaSignals({ frequency: 1.33, ctr: 2.0, cpc: 4.5, cpm: 80, objective: 'OUTCOME_LEADS' });
    expect(r.healthScore).toBeNull();
  });
  it('Checkle-like account: 4 of 5 computable (no series) -> not insufficient', () => {
    const r = computeMetaSignals({ frequency: 1.33, ctr: 2.0, cpc: 4.5, cpm: 80, objective: 'OUTCOME_LEADS' });
    expect(r.computable).toBe(4);
    expect(r.total).toBe(5);
    expect(r.insufficientData).toBe(false);
    // cpc 4.5 vs Leads $1.92 -> poor; cpm 80 vs general $8 -> poor; ctr 2 -> good; freq 1.33 -> good
    const byKey = Object.fromEntries(r.signals.map((s) => [s.key, s.status]));
    expect(byKey.ctr).toBe('good');
    expect(byKey.frequency).toBe('good');
    expect(byKey.cpc).toBe('poor');
    expect(byKey.cpm).toBe('poor');
    expect(byKey.creative_fatigue).toBe('unknown');
  });
  it('>50% N/A -> insufficientData true', () => {
    const r = computeMetaSignals({ frequency: 1.5 });
    expect(r.computable).toBe(1);
    expect(r.insufficientData).toBe(true);
    expect(r.healthScore).toBeNull();
  });
});
