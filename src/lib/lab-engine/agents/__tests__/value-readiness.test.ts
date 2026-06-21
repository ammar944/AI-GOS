import { describe, expect, it } from 'vitest';

import { deriveValueReadinessBadge } from '@/components/research-v2/trust-tier';

import { deriveValueReadiness } from '../run-section';

describe('deriveValueReadiness (writer rollup)', () => {
  it('tallies coverage.readiness across nested blocks and picks the strongest as lead', () => {
    const body = {
      marketDefinition: { coverage: { readiness: 'rich' }, prose: 'x' },
      buyerSegments: { coverage: { readiness: 'adequate' } },
      competitorSet: {
        competitors: [{ name: 'A' }],
        coverage: { readiness: 'thin' },
      },
      keywordDemand: { coverage: { readiness: 'gap' } },
    };

    const result = deriveValueReadiness(body);

    expect(result.blocksByReadiness).toEqual({
      rich: 1,
      adequate: 1,
      thin: 1,
      gap: 1,
    });
    expect(result.leadReadiness).toBe('rich');
    expect(result.anyRich).toBe(true);
  });

  it('counts only coverage.readiness records and ignores other coverage shapes', () => {
    const body = {
      a: { coverage: { readiness: 'adequate', byTier: { hard_evidence: 2 } } },
      b: { coverage: { readiness: 'adequate' } },
      c: { coverage: { readiness: 'not-a-level' } },
      d: { coverage: 'string-not-record' },
      e: { noCoverage: true },
    };

    const result = deriveValueReadiness(body);

    expect(result.blocksByReadiness).toEqual({
      rich: 0,
      adequate: 2,
      thin: 0,
      gap: 0,
    });
    expect(result.leadReadiness).toBe('adequate');
    expect(result.anyRich).toBe(false);
  });

  it('returns a null lead and zero counts for a body with no block coverage', () => {
    const result = deriveValueReadiness({ prose: 'no blocks here', items: [] });

    expect(result.leadReadiness).toBeNull();
    expect(result.anyRich).toBe(false);
    expect(result.blocksByReadiness).toEqual({
      rich: 0,
      adequate: 0,
      thin: 0,
      gap: 0,
    });
  });
});

describe('deriveValueReadinessBadge (reader accessor)', () => {
  it('round-trips the writer rollup out of verifierSummary.computedTrust.valueReadiness', () => {
    const valueReadiness = deriveValueReadiness({
      lead: { coverage: { readiness: 'rich' } },
      other: { coverage: { readiness: 'thin' } },
    });

    const badge = deriveValueReadinessBadge({
      computedTrust: { confidence: 0.4, valueReadiness },
    });

    expect(badge).not.toBeNull();
    expect(badge?.leadReadiness).toBe('rich');
    expect(badge?.anyRich).toBe(true);
    expect(badge?.blocksByReadiness).toEqual({
      rich: 1,
      adequate: 0,
      thin: 1,
      gap: 0,
    });
  });

  it('returns null for legacy artifacts lacking computedTrust or valueReadiness', () => {
    expect(deriveValueReadinessBadge(undefined)).toBeNull();
    expect(deriveValueReadinessBadge(null)).toBeNull();
    expect(deriveValueReadinessBadge({})).toBeNull();
    expect(
      deriveValueReadinessBadge({ computedTrust: { confidence: 0.9 } }),
    ).toBeNull();
    expect(
      deriveValueReadinessBadge({ computedTrust: { valueReadiness: null } }),
    ).toBeNull();
  });

  it('coerces malformed readiness payloads to a safe badge', () => {
    const badge = deriveValueReadinessBadge({
      computedTrust: {
        valueReadiness: {
          leadReadiness: 'bogus',
          anyRich: 'yes',
          blocksByReadiness: { rich: 'two', adequate: 3 },
        },
      },
    });

    expect(badge).not.toBeNull();
    expect(badge?.leadReadiness).toBeNull();
    expect(badge?.anyRich).toBe(false);
    expect(badge?.blocksByReadiness).toEqual({
      rich: 0,
      adequate: 3,
      thin: 0,
      gap: 0,
    });
  });
});
