import { describe, it, expect } from 'vitest';
import {
  computeAdDistribution,
  getHookQuotas,
  validateHookDiversity,
  remediateHooks,
  type AdDistributionTier,
} from '../hook-diversity-validator';
import type { AdHook } from '../schemas/cross-analysis';

// =============================================================================
// Test Helpers
// =============================================================================

function makeHook(overrides: Partial<AdHook> & { hook: string }): AdHook {
  return {
    technique: 'curiosity-gap',
    targetAwareness: 'problem-aware',
    ...overrides,
  };
}

function makeExtractedHook(competitor: string, hookText: string): AdHook {
  return makeHook({
    hook: hookText,
    source: { type: 'extracted', competitors: [competitor], platform: 'meta' },
  });
}

function makeInspiredHook(competitor: string, hookText: string): AdHook {
  return makeHook({
    hook: hookText,
    source: { type: 'inspired', competitors: [competitor], platform: 'meta' },
  });
}

function makeGeneratedHook(hookText: string): AdHook {
  return makeHook({
    hook: hookText,
    source: { type: 'generated' },
  });
}

// =============================================================================
// computeAdDistribution
// =============================================================================

describe('computeAdDistribution', () => {
  it('returns "zero" when no competitors have ads', () => {
    const competitors = [
      { name: 'Comp A', adCreatives: [] },
      { name: 'Comp B' },
      { name: 'Comp C', adCreatives: undefined },
    ];
    expect(computeAdDistribution(competitors)).toBe('zero');
  });

  it('returns "zero" when ads have no text content', () => {
    const competitors = [
      { name: 'Comp A', adCreatives: [{ headline: '', body: '' }] },
      { name: 'Comp B', adCreatives: [{ headline: '   ', body: '  ' }] },
    ];
    expect(computeAdDistribution(competitors)).toBe('zero');
  });

  it('returns "sparse" for 1 competitor with ads', () => {
    const competitors = [
      { name: 'Loman AI', adCreatives: [{ headline: 'Pizza night!' }] },
      { name: 'Comp B', adCreatives: [] },
      { name: 'Comp C' },
    ];
    expect(computeAdDistribution(competitors)).toBe('sparse');
  });

  it('returns "sparse" for 2 competitors with ads', () => {
    const competitors = [
      { name: 'Comp A', adCreatives: [{ headline: 'Try us!' }] },
      { name: 'Comp B', adCreatives: [{ body: 'Best product ever' }] },
      { name: 'Comp C' },
    ];
    expect(computeAdDistribution(competitors)).toBe('sparse');
  });

  it('returns "standard" for 3+ competitors with ads', () => {
    const competitors = [
      { name: 'A', adCreatives: [{ headline: 'Hook A' }] },
      { name: 'B', adCreatives: [{ headline: 'Hook B' }] },
      { name: 'C', adCreatives: [{ body: 'Hook C' }] },
    ];
    expect(computeAdDistribution(competitors)).toBe('standard');
  });

  it('returns "standard" for 4 competitors with ads', () => {
    const competitors = [
      { name: 'A', adCreatives: [{ headline: 'a' }] },
      { name: 'B', adCreatives: [{ headline: 'b' }] },
      { name: 'C', adCreatives: [{ headline: 'c' }] },
      { name: 'D', adCreatives: [{ headline: 'd' }] },
    ];
    expect(computeAdDistribution(competitors)).toBe('standard');
  });

  it('ignores empty ad arrays', () => {
    const competitors = [
      { name: 'A', adCreatives: [] },
      { name: 'B', adCreatives: [{ headline: 'Real ad' }] },
    ];
    expect(computeAdDistribution(competitors)).toBe('sparse');
  });
});

// =============================================================================
// getHookQuotas
// =============================================================================

describe('getHookQuotas', () => {
  const tiers: AdDistributionTier[] = ['zero', 'sparse', 'standard'];

  it.each(tiers)('returns quotas totaling 12 for tier "%s"', (tier) => {
    const quotas = getHookQuotas(tier);
    expect(quotas.extracted + quotas.inspired + quotas.original).toBe(12);
  });

  it.each(tiers)('always has maxPerCompetitor = 2 for tier "%s"', (tier) => {
    expect(getHookQuotas(tier).maxPerCompetitor).toBe(2);
  });

  it('returns zero extracted for "zero" tier', () => {
    const quotas = getHookQuotas('zero');
    expect(quotas.extracted).toBe(0);
    expect(quotas.inspired).toBe(6);
    expect(quotas.original).toBe(6);
  });

  it('caps extracted at 2 for "sparse" tier', () => {
    const quotas = getHookQuotas('sparse');
    expect(quotas.extracted).toBe(2);
    expect(quotas.inspired).toBe(4);
    expect(quotas.original).toBe(6);
  });

  it('allows 4 extracted for "standard" tier', () => {
    const quotas = getHookQuotas('standard');
    expect(quotas.extracted).toBe(4);
    expect(quotas.inspired).toBe(4);
    expect(quotas.original).toBe(4);
  });
});

// =============================================================================
// validateHookDiversity
// =============================================================================

describe('validateHookDiversity', () => {
  it('returns no violations for evenly distributed hooks', () => {
    const hooks = [
      makeExtractedHook('Comp A', 'Hook 1'),
      makeExtractedHook('Comp A', 'Hook 2'),
      makeExtractedHook('Comp B', 'Hook 3'),
      makeExtractedHook('Comp B', 'Hook 4'),
      makeInspiredHook('Comp C', 'Hook 5'),
      makeInspiredHook('Comp C', 'Hook 6'),
      makeGeneratedHook('Hook 7'),
      makeGeneratedHook('Hook 8'),
      makeGeneratedHook('Hook 9'),
      makeGeneratedHook('Hook 10'),
      makeGeneratedHook('Hook 11'),
      makeGeneratedHook('Hook 12'),
    ];
    const violations = validateHookDiversity(hooks, 2);
    expect(violations).toHaveLength(0);
  });

  it('flags source concentration when one competitor has >50% of hooks', () => {
    // AgentSupply/Loman AI scenario: 8 hooks from Loman AI out of 10
    const hooks = [
      makeExtractedHook('Loman AI', 'Pizza is great'),
      makeExtractedHook('Loman AI', 'Fast casual rocks'),
      makeInspiredHook('Loman AI', 'QSR operators love us'),
      makeInspiredHook('Loman AI', 'Order more pizza'),
      makeExtractedHook('Loman AI', 'Delivery speed matters'),
      makeInspiredHook('Loman AI', 'Low cost dining'),
      makeExtractedHook('Loman AI', 'Pizza night forever'),
      makeInspiredHook('Loman AI', 'Fast food innovation'),
      makeGeneratedHook('Fine dining excellence'),
      makeGeneratedHook('Upscale experience'),
    ];

    const violations = validateHookDiversity(hooks, 2);
    expect(violations.length).toBeGreaterThan(0);

    const concentrationViolations = violations.filter(v => v.type === 'source-concentration');
    expect(concentrationViolations.length).toBeGreaterThan(0);
    expect(concentrationViolations[0].detail).toContain('loman ai');
  });

  it('passes at exactly 50% (not a violation)', () => {
    const hooks = [
      makeExtractedHook('Comp A', 'Hook 1'),
      makeExtractedHook('Comp A', 'Hook 2'),
      makeInspiredHook('Comp A', 'Hook 3'),
      makeInspiredHook('Comp A', 'Hook 4'),
      makeInspiredHook('Comp A', 'Hook 5'),
      makeGeneratedHook('Hook 6'),
      makeGeneratedHook('Hook 7'),
      makeGeneratedHook('Hook 8'),
      makeGeneratedHook('Hook 9'),
      makeGeneratedHook('Hook 10'),
    ];
    // 5/10 = exactly 50%, should pass
    const violations = validateHookDiversity(hooks, 5);
    const concentrationViolations = violations.filter(v => v.type === 'source-concentration');
    expect(concentrationViolations).toHaveLength(0);
  });

  it('flags at 51% (violation)', () => {
    // 6 out of 10 from same competitor = 60%
    const hooks = [
      makeExtractedHook('Comp A', 'Hook 1'),
      makeExtractedHook('Comp A', 'Hook 2'),
      makeInspiredHook('Comp A', 'Hook 3'),
      makeInspiredHook('Comp A', 'Hook 4'),
      makeInspiredHook('Comp A', 'Hook 5'),
      makeInspiredHook('Comp A', 'Hook 6'),
      makeGeneratedHook('Hook 7'),
      makeGeneratedHook('Hook 8'),
      makeGeneratedHook('Hook 9'),
      makeGeneratedHook('Hook 10'),
    ];
    const violations = validateHookDiversity(hooks, 10);
    const concentrationViolations = violations.filter(v => v.type === 'source-concentration');
    expect(concentrationViolations.length).toBeGreaterThan(0);
  });

  it('flags per-competitor cap violations', () => {
    const hooks = [
      makeExtractedHook('Comp A', 'Hook 1'),
      makeExtractedHook('Comp A', 'Hook 2'),
      makeInspiredHook('Comp A', 'Hook 3'), // 3rd from Comp A, over cap of 2
      makeGeneratedHook('Hook 4'),
    ];
    const violations = validateHookDiversity(hooks, 2);
    const capViolations = violations.filter(v => v.type === 'per-competitor-cap');
    expect(capViolations.length).toBeGreaterThanOrEqual(1);
    expect(capViolations[0].hookIndex).toBe(2); // 3rd hook (index 2)
  });

  it('does not flag hooks without source competitors', () => {
    const hooks = [
      makeGeneratedHook('Hook 1'),
      makeGeneratedHook('Hook 2'),
      makeGeneratedHook('Hook 3'),
      makeGeneratedHook('Hook 4'),
    ];
    const violations = validateHookDiversity(hooks, 2);
    expect(violations).toHaveLength(0);
  });
});

// =============================================================================
// remediateHooks
// =============================================================================

describe('remediateHooks', () => {
  it('returns hooks unchanged when no violations', () => {
    const hooks = [
      makeExtractedHook('A', 'H1'),
      makeExtractedHook('B', 'H2'),
      makeGeneratedHook('H3'),
    ];
    const result = remediateHooks(hooks, [], [], 2);
    expect(result).toEqual(hooks);
  });

  it('reduces over-represented competitor to maxPerCompetitor', () => {
    // Loman AI has 8 hooks, should keep only 2
    const hooks = [
      makeExtractedHook('Loman AI', 'Pizza hook 1'),
      makeExtractedHook('Loman AI', 'Pizza hook 2'),
      makeInspiredHook('Loman AI', 'Pizza hook 3'),
      makeInspiredHook('Loman AI', 'Pizza hook 4'),
      makeExtractedHook('Loman AI', 'Pizza hook 5'),
      makeInspiredHook('Loman AI', 'Pizza hook 6'),
      makeExtractedHook('Loman AI', 'Pizza hook 7'),
      makeInspiredHook('Loman AI', 'Pizza hook 8'),
      makeGeneratedHook('Fine dining hook 1'),
      makeGeneratedHook('Fine dining hook 2'),
      makeGeneratedHook('Fine dining hook 3'),
      makeGeneratedHook('Fine dining hook 4'),
    ];

    const violations = validateHookDiversity(hooks, 2);
    const synthesisPool = [
      makeGeneratedHook('Synthesis pool 1'),
      makeGeneratedHook('Synthesis pool 2'),
      makeGeneratedHook('Synthesis pool 3'),
      makeGeneratedHook('Synthesis pool 4'),
      makeGeneratedHook('Synthesis pool 5'),
      makeGeneratedHook('Synthesis pool 6'),
      makeGeneratedHook('Synthesis pool 7'),
      makeGeneratedHook('Synthesis pool 8'),
      makeGeneratedHook('Synthesis pool 9'),
      makeGeneratedHook('Synthesis pool 10'),
    ];

    const result = remediateHooks(hooks, violations, synthesisPool, 2);

    // Count Loman AI hooks in result
    const lomanCount = result.filter(h =>
      h.source?.competitors?.some(c => c.toLowerCase().includes('loman'))
    ).length;
    expect(lomanCount).toBeLessThanOrEqual(2);
    expect(result.length).toBeLessThanOrEqual(12);
  });

  it('fills with synthesis pool hooks when removing excess', () => {
    const hooks = [
      makeExtractedHook('Comp A', 'Hook 1'),
      makeExtractedHook('Comp A', 'Hook 2'),
      makeExtractedHook('Comp A', 'Hook 3'), // excess
    ];

    const violations = validateHookDiversity(hooks, 2);
    const synthesisPool = [makeGeneratedHook('Replacement hook')];

    const result = remediateHooks(hooks, violations, synthesisPool, 2);
    expect(result.length).toBeLessThanOrEqual(12);
    // Should contain the replacement hook
    const hasReplacement = result.some(h => h.hook === 'Replacement hook');
    expect(hasReplacement).toBe(true);
  });

  it('handles empty synthesis pool gracefully', () => {
    const hooks = [
      makeExtractedHook('Comp A', 'Hook 1'),
      makeExtractedHook('Comp A', 'Hook 2'),
      makeExtractedHook('Comp A', 'Hook 3'),
      makeExtractedHook('Comp A', 'Hook 4'),
    ];

    const violations = validateHookDiversity(hooks, 2);
    const result = remediateHooks(hooks, violations, [], 2);

    // Should keep only 2 from Comp A, no fillers available
    const compACount = result.filter(h =>
      h.source?.competitors?.some(c => c.toLowerCase() === 'comp a')
    ).length;
    expect(compACount).toBeLessThanOrEqual(2);
  });

  it('preserves hooks that do not violate constraints', () => {
    const hooks = [
      makeExtractedHook('Comp A', 'A hook 1'),
      makeExtractedHook('Comp A', 'A hook 2'),
      makeExtractedHook('Comp A', 'A hook 3'), // excess
      makeExtractedHook('Comp B', 'B hook 1'),
      makeGeneratedHook('Gen hook 1'),
    ];

    const violations = validateHookDiversity(hooks, 2);
    const synthesisPool = [makeGeneratedHook('Synth hook')];
    const result = remediateHooks(hooks, violations, synthesisPool, 2);

    // Comp B hook should still be present
    expect(result.some(h => h.hook === 'B hook 1')).toBe(true);
    // Generated hook should still be present
    expect(result.some(h => h.hook === 'Gen hook 1')).toBe(true);
  });
});

// =============================================================================
// Scenario Tests
// =============================================================================

describe('scenario: AgentSupply (sparse ad data)', () => {
  it('caps extraction from single competitor and produces diverse hooks', () => {
    const competitors = [
      { name: 'Loman AI', adCreatives: [{ headline: 'Pizza night ad' }, { body: 'Fast casual promotion' }] },
      { name: 'Competitor B', adCreatives: [] },
      { name: 'Competitor C' },
    ];

    const distribution = computeAdDistribution(competitors);
    expect(distribution).toBe('sparse');

    const quotas = getHookQuotas(distribution);
    expect(quotas.extracted).toBe(2); // max 2 extracted in sparse tier
    expect(quotas.maxPerCompetitor).toBe(2);
  });

  it('validates and remediates hooks dominated by one competitor', () => {
    // Simulate what happens when extraction returns 8 Loman AI hooks
    const extractedHooks = Array.from({ length: 8 }, (_, i) =>
      makeExtractedHook('Loman AI', `Pizza hook ${i + 1}`)
    );
    const synthesisHooks = Array.from({ length: 6 }, (_, i) =>
      makeGeneratedHook(`Fine dining hook ${i + 1}`)
    );

    const combined = [...extractedHooks, ...synthesisHooks];
    const violations = validateHookDiversity(combined, 2);

    expect(violations.length).toBeGreaterThan(0);

    const remediated = remediateHooks(combined, violations, synthesisHooks, 2);

    const lomanCount = remediated.filter(h =>
      h.source?.competitors?.some(c => c.toLowerCase().includes('loman'))
    ).length;
    expect(lomanCount).toBeLessThanOrEqual(2);
    expect(remediated.length).toBeLessThanOrEqual(12);
  });
});

describe('scenario: zero ad data', () => {
  it('returns zero tier with no extracted quota', () => {
    const competitors = [
      { name: 'A' },
      { name: 'B', adCreatives: [] },
    ];

    const distribution = computeAdDistribution(competitors);
    expect(distribution).toBe('zero');

    const quotas = getHookQuotas(distribution);
    expect(quotas.extracted).toBe(0);
    expect(quotas.inspired + quotas.original).toBe(12);
  });
});

describe('scenario: rich ad data (4 competitors)', () => {
  it('returns standard tier with balanced quotas', () => {
    const competitors = [
      { name: 'A', adCreatives: [{ headline: 'Ad A' }] },
      { name: 'B', adCreatives: [{ headline: 'Ad B' }] },
      { name: 'C', adCreatives: [{ headline: 'Ad C' }] },
      { name: 'D', adCreatives: [{ headline: 'Ad D' }] },
    ];

    const distribution = computeAdDistribution(competitors);
    expect(distribution).toBe('standard');

    const quotas = getHookQuotas(distribution);
    expect(quotas.extracted).toBe(4);
    expect(quotas.inspired).toBe(4);
    expect(quotas.original).toBe(4);
  });

  it('hooks distributed across competitors pass validation', () => {
    const hooks = [
      makeExtractedHook('A', 'Hook A1'),
      makeExtractedHook('A', 'Hook A2'),
      makeExtractedHook('B', 'Hook B1'),
      makeExtractedHook('B', 'Hook B2'),
      makeInspiredHook('C', 'Hook C1'),
      makeInspiredHook('C', 'Hook C2'),
      makeInspiredHook('D', 'Hook D1'),
      makeInspiredHook('D', 'Hook D2'),
      makeGeneratedHook('Gen 1'),
      makeGeneratedHook('Gen 2'),
      makeGeneratedHook('Gen 3'),
      makeGeneratedHook('Gen 4'),
    ];

    const violations = validateHookDiversity(hooks, 2);
    expect(violations).toHaveLength(0);
  });
});
