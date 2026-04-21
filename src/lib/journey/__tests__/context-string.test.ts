import { describe, expect, it } from 'vitest';
import { buildJourneyResearchContext } from '../context-string';

describe('buildJourneyResearchContext', () => {
  it('wraps field values with human-readable labels from the field catalog', () => {
    const ctx = buildJourneyResearchContext({
      companyName: 'Acme',
      productDescription: 'Widgets for warehouses',
    });

    expect(ctx).toContain("Here's what I found about the company:");
    expect(ctx).toContain('Company Name: Acme');
    expect(ctx).toContain('Product Description: Widgets for warehouses');
    expect(ctx).toContain('Please use this context and begin the research journey.');
  });

  it('omits empty, whitespace-only, and undefined fields', () => {
    const ctx = buildJourneyResearchContext({
      companyName: 'Acme',
      productDescription: '',
      valueProp: '   ',
      guarantees: undefined,
    });

    expect(ctx).toContain('Company Name: Acme');
    expect(ctx).not.toContain('Product Description');
    expect(ctx).not.toContain('Value Proposition');
    expect(ctx).not.toContain('Guarantees');
    expect(ctx).not.toContain('undefined');
  });

  it('honours the explicit orderedKeys parameter when supplied', () => {
    const ctx = buildJourneyResearchContext(
      { companyName: 'Acme', productDescription: 'Widgets', goals: 'Scale' },
      ['goals', 'companyName', 'productDescription'],
    );

    const goalsIdx = ctx.indexOf('Primary 90-Day Goal: Scale');
    const companyIdx = ctx.indexOf('Company Name: Acme');
    const productIdx = ctx.indexOf('Product Description: Widgets');

    expect(goalsIdx).toBeGreaterThan(-1);
    expect(goalsIdx).toBeLessThan(companyIdx);
    expect(companyIdx).toBeLessThan(productIdx);
  });

  it('returns a non-empty preamble+postamble even when all fields are empty', () => {
    const ctx = buildJourneyResearchContext({});
    expect(ctx).toContain("Here's what I found about the company:");
    expect(ctx).toContain('Please use this context and begin the research journey.');
    expect(ctx).not.toContain('undefined');
  });

  it('falls back to the raw key when a field has no catalog label entry', () => {
    const ctx = buildJourneyResearchContext({ someWeirdCustomKey: 'hello' });
    expect(ctx).toContain('someWeirdCustomKey: hello');
  });
});
