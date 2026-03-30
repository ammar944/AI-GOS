import { describe, it, expect } from 'vitest';
import { getProofSubset, detectUsedProofPoints } from '../runners/ad-scripts';

describe('getProofSubset', () => {
  it('returns empty array for 0 proof points', () => {
    expect(getProofSubset([], 0)).toEqual([]);
    expect(getProofSubset([], 3)).toEqual([]);
  });

  it('returns the single proof point for all levels when 1 available', () => {
    const proofs = ['proof-A'];
    expect(getProofSubset(proofs, 0)).toEqual(['proof-A']);
    expect(getProofSubset(proofs, 1)).toEqual(['proof-A']);
    expect(getProofSubset(proofs, 4)).toEqual(['proof-A']);
  });

  it('alternates between 2 proof points for even/odd levels', () => {
    const proofs = ['proof-A', 'proof-B'];
    expect(getProofSubset(proofs, 0)).toEqual(['proof-A']);
    expect(getProofSubset(proofs, 1)).toEqual(['proof-B']);
    expect(getProofSubset(proofs, 2)).toEqual(['proof-A']);
    expect(getProofSubset(proofs, 3)).toEqual(['proof-B']);
  });

  it('uses sliding window for 3 proof points', () => {
    const proofs = ['A', 'B', 'C'];
    // window size = ceil(3/2) = 2
    expect(getProofSubset(proofs, 0)).toEqual(['A', 'B']);
    expect(getProofSubset(proofs, 1)).toEqual(['B', 'C']);
    expect(getProofSubset(proofs, 2)).toEqual(['C', 'A']); // wraps
  });

  it('uses sliding window for 5 proof points with wrapping', () => {
    const proofs = ['A', 'B', 'C', 'D', 'E'];
    // window size = ceil(5/2) = 3
    expect(getProofSubset(proofs, 0)).toEqual(['A', 'B', 'C']);
    expect(getProofSubset(proofs, 1)).toEqual(['B', 'C', 'D']);
    expect(getProofSubset(proofs, 2)).toEqual(['C', 'D', 'E']);
    expect(getProofSubset(proofs, 3)).toEqual(['D', 'E', 'A']); // wraps
    expect(getProofSubset(proofs, 4)).toEqual(['E', 'A', 'B']); // wraps
  });

  it('wraps levelIndex when > proofs.length', () => {
    const proofs = ['A', 'B', 'C'];
    // levelIndex 5 % 3 = 2
    expect(getProofSubset(proofs, 5)).toEqual(getProofSubset(proofs, 2));
  });

  it('produces different subsets for each of 5 levels', () => {
    const proofs = ['A', 'B', 'C', 'D', 'E'];
    const subsets = [0, 1, 2, 3, 4].map((i) => getProofSubset(proofs, i));
    // Each subset should be different from at least one other
    const unique = new Set(subsets.map((s) => s.join(',')));
    expect(unique.size).toBe(5);
  });
});

describe('detectUsedProofPoints', () => {
  it('detects exact headline match in body (case-insensitive)', () => {
    const scripts = [
      { body: 'We achieved a 13% MQL increase within 60 days', headline: 'Test headline' },
    ];
    const result = detectUsedProofPoints(scripts, ['13% MQL increase']);
    expect(result.get('13% MQL increase')).toBe(1);
  });

  it('returns empty map when no matches found', () => {
    const scripts = [
      { body: 'Generic copy with no proof points', headline: 'No match' },
    ];
    const result = detectUsedProofPoints(scripts, ['13% MQL increase']);
    expect(result.size).toBe(0);
  });

  it('counts multiple uses across scripts', () => {
    const scripts = [
      { body: 'First script mentions 13% MQL increase result', headline: '' },
      { body: 'Second script also has 13% MQL increase data', headline: '' },
      { body: 'Third script is clean', headline: '' },
    ];
    const result = detectUsedProofPoints(scripts, ['13% MQL increase']);
    expect(result.get('13% MQL increase')).toBe(2);
  });

  it('detects match in headline field too', () => {
    const scripts = [
      { body: 'Clean body', headline: 'See our 13% MQL increase results' },
    ];
    const result = detectUsedProofPoints(scripts, ['13% MQL increase']);
    expect(result.get('13% MQL increase')).toBe(1);
  });

  it('handles missing body/headline gracefully', () => {
    const scripts = [
      { angle: 'painPoint' },
      { body: undefined, headline: null },
    ];
    expect(() => detectUsedProofPoints(scripts as any, ['test'])).not.toThrow();
  });

  it('tracks multiple different proof points independently', () => {
    const scripts = [
      { body: 'We got 13% MQL increase and 2x ROI improvement', headline: '' },
    ];
    const result = detectUsedProofPoints(scripts, ['13% MQL increase', '2x ROI improvement']);
    expect(result.get('13% MQL increase')).toBe(1);
    expect(result.get('2x ROI improvement')).toBe(1);
  });
});
