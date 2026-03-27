import { describe, expect, it } from 'vitest';
import { normalizeProfileFields } from '../business-profiles';

describe('normalizeProfileFields', () => {
  it('keeps string values as-is', () => {
    const result = normalizeProfileFields({
      companyName: 'Acme Corp',
      businessModel: 'B2B SaaS',
    });
    expect(result).toEqual({
      companyName: 'Acme Corp',
      businessModel: 'B2B SaaS',
    });
  });

  it('joins arrays of strings with ", "', () => {
    const result = normalizeProfileFields({
      topCompetitors: ['HubSpot', 'Marketo', 'Pardot'],
    });
    expect(result.topCompetitors).toBe('HubSpot, Marketo, Pardot');
  });

  it('skips objects, nulls, and undefined', () => {
    const result = normalizeProfileFields({
      companyName: 'Acme',
      someObject: { nested: true },
      nullField: null,
      undefinedField: undefined,
    });
    expect(result).toEqual({ companyName: 'Acme' });
  });

  it('filters out non-catalog keys like activeJourneyRunId', () => {
    const result = normalizeProfileFields({
      companyName: 'Acme',
      activeJourneyRunId: 'run-123',
      lastUpdated: '2026-03-27',
      businessModel: 'SaaS',
    });
    expect(result).toEqual({
      companyName: 'Acme',
      businessModel: 'SaaS',
    });
    expect(result).not.toHaveProperty('activeJourneyRunId');
    expect(result).not.toHaveProperty('lastUpdated');
  });

  it('returns empty object for empty input', () => {
    const result = normalizeProfileFields({});
    expect(result).toEqual({});
  });

  it('skips empty strings and whitespace-only strings', () => {
    const result = normalizeProfileFields({
      companyName: 'Acme',
      businessModel: '',
      goals: '   ',
    });
    expect(result).toEqual({ companyName: 'Acme' });
  });

  it('skips empty arrays', () => {
    const result = normalizeProfileFields({
      topCompetitors: [],
      companyName: 'Acme',
    });
    expect(result).toEqual({ companyName: 'Acme' });
  });
});
