import { describe, expect, it } from 'vitest';
import {
  JOURNEY_FIELDS,
  JOURNEY_MANUAL_BLOCKER_FIELDS,
  JOURNEY_PREFILL_REVIEW_FIELDS,
  JOURNEY_REQUIRED_BLOCKER_FIELDS,
  JOURNEY_RESEARCH_ENRICHMENT_FIELDS,
  JOURNEY_SECTION_FOLLOWUP_FIELDS,
  JOURNEY_WAVE_TWO_REQUIREMENTS,
} from '../field-catalog';

describe('field-catalog', () => {
  it('covers each field exactly once across the three classifications', () => {
    const allKeys = new Set(JOURNEY_FIELDS.map((field) => field.key));
    const classifiedKeys = new Set([
      ...JOURNEY_REQUIRED_BLOCKER_FIELDS.map((field) => field.key),
      ...JOURNEY_SECTION_FOLLOWUP_FIELDS.map((field) => field.key),
      ...JOURNEY_RESEARCH_ENRICHMENT_FIELDS.map((field) => field.key),
    ]);

    expect(classifiedKeys).toEqual(allKeys);
  });

  it('keeps the review screen aligned to the known scrape-visible fields', () => {
    expect(JOURNEY_PREFILL_REVIEW_FIELDS).toHaveLength(25);
    expect(JOURNEY_PREFILL_REVIEW_FIELDS.some((field) => field.key === 'businessModel')).toBe(true);
    expect(JOURNEY_PREFILL_REVIEW_FIELDS.some((field) => field.key === 'productDescription')).toBe(true);
  });

  it('keeps the required upfront blocker set explicit', () => {
    expect(JOURNEY_MANUAL_BLOCKER_FIELDS.map((field) => field.key)).toEqual([
      'businessModel',
      'productDescription',
      'topCompetitors',
      'primaryIcpDescription',
      'pricingTiers',
      'monthlyAdBudget',
      'goals',
      'uniqueEdge',
    ]);
  });

  it('keeps the wave-two requirement order explicit', () => {
    expect(JOURNEY_WAVE_TWO_REQUIREMENTS.map((item) => item.key)).toEqual([
      'topCompetitors',
      'productDescription',
      'primaryIcpDescription',
      'pricingContext',
    ]);
  });
});
