import { describe, expect, it } from 'vitest';

import {
  formatConfidenceToTen,
  getConfidenceToneClass,
  normalizeConfidenceToTen,
} from '../confidence-display';

describe('confidence display helpers', (): void => {
  it('normalizes lab envelope confidence from 0..1 to the reader 0..10 scale', (): void => {
    expect(normalizeConfidenceToTen(0.65)).toBe(6.5);
    expect(formatConfidenceToTen(0.72)).toBe('7.2');
  });

  it('preserves legacy managed-artifact confidence values already on 0..10 scale', (): void => {
    expect(normalizeConfidenceToTen(8)).toBe(8);
    expect(formatConfidenceToTen(7.5)).toBe('7.5');
  });

  it('bounds invalid display values to the visible scale before classifying tone', (): void => {
    expect(formatConfidenceToTen(12)).toBe('10');
    expect(formatConfidenceToTen(-2)).toBe('0');
    expect(getConfidenceToneClass(0.9)).toContain('--green');
    expect(getConfidenceToneClass(0.55)).toContain('--amber');
    expect(getConfidenceToneClass(0.2)).toContain('--red');
  });
});
