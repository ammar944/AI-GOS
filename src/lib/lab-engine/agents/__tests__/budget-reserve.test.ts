import { describe, expect, it } from 'vitest';

import { SectionToolBudget, ToolBudget } from '../budget';

describe('SectionToolBudget', (): void => {
  it('reserves ad lookups so generic tools cannot starve the ad probe', (): void => {
    const budget = new SectionToolBudget(6, 2);

    // Drain the generic pool with six non-ad tool draws.
    for (let i = 0; i < 6; i += 1) {
      expect(budget.consume('web_search')).toBe(true);
    }

    // Generic pool exhausted: a further non-ad tool must NOT borrow the reserve.
    expect(budget.consume('firecrawl')).toBe(false);

    // Ad tools still succeed, drawn from the reserved pool.
    expect(budget.consume('google_ads')).toBe(true);
    expect(budget.consume('meta_ads')).toBe(true);

    // Reserve exhausted: a third ad tool fails.
    expect(budget.consume('adlibrary')).toBe(false);

    // And a non-ad tool still cannot borrow once everything is exhausted.
    expect(budget.consume('reviews')).toBe(false);
  });

  it('routes ad tools to the reserve first, leaving generic for non-ad tools', (): void => {
    const budget = new SectionToolBudget(2, 2);

    // Two ad-tool draws take the reserve first (not the generic pool).
    expect(budget.consume('google_ads')).toBe(true);
    expect(budget.consume('meta_ads')).toBe(true);

    // Generic pool is untouched, so two non-ad draws still succeed.
    expect(budget.consume('web_search')).toBe(true);
    expect(budget.consume('firecrawl')).toBe(true);

    // Everything exhausted now.
    expect(budget.consume('google_ads')).toBe(false);
    expect(budget.consume('web_search')).toBe(false);
  });

  it('reserves reviews and scrape lookups so generic searches cannot starve VoC acquisition', (): void => {
    const budget = new SectionToolBudget(2, 0, 2);

    expect(budget.consume('web_search')).toBe(true);
    expect(budget.consume('web_search')).toBe(true);

    expect(budget.consume('web_search')).toBe(false);
    expect(budget.consume('reviews')).toBe(true);
    expect(budget.consume('firecrawl')).toBe(true);
    expect(budget.consume('reviews')).toBe(false);
  });

  it('behaves like a plain ToolBudget when the reserve is zero (back-compat)', (): void => {
    const reserved = new SectionToolBudget(4, 0);
    const plain = new ToolBudget(4);

    // Four consumes succeed regardless of tool name; the fifth fails.
    const names = ['web_search', 'google_ads', 'firecrawl', 'meta_ads'];
    for (const name of names) {
      expect(reserved.consume(name)).toBe(true);
      expect(plain.consume(name)).toBe(true);
    }

    expect(reserved.consume('google_ads')).toBe(false);
    expect(plain.consume('google_ads')).toBe(false);
    expect(reserved.consume('web_search')).toBe(false);
    expect(plain.consume('web_search')).toBe(false);
  });

  it('reports max as the sum of both pools', (): void => {
    expect(new SectionToolBudget(6, 2).max).toBe(8);
    expect(new SectionToolBudget(5, 0, 2).max).toBe(7);
    expect(new SectionToolBudget(4).max).toBe(4);
  });
});
