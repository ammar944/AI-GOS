import { describe, expect, it } from 'vitest';
import {
  JOURNEY_FIELDS,
  JOURNEY_ENRICHMENT_FIELD_METAS,
  JOURNEY_FIELD_GROUPS,
  JOURNEY_MANUAL_BLOCKER_FIELDS,
  JOURNEY_PREFILL_REVIEW_FIELDS,
  JOURNEY_PRICING_GROUP_KEYS,
  JOURNEY_REQUIRED_BLOCKER_FIELDS,
  JOURNEY_REQUIRED_FIELD_KEYS,
  JOURNEY_RESEARCH_ENRICHMENT_FIELDS,
  JOURNEY_SECTION_FOLLOWUP_FIELDS,
  JOURNEY_WAVE_TWO_REQUIREMENTS,
  PROFILE_FIELD_GROUPS,
  PROFILE_MULTILINE_KEYS,
  getJourneyFieldDefinition,
  getManualBlockerMeta,
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

describe('currentMarketingActivities field', () => {
  it('is registered in JOURNEY_FIELDS with the correct shape', () => {
    const field = getJourneyFieldDefinition('currentMarketingActivities');
    expect(field).toBeDefined();
    expect(field?.category).toBe('section-followup');
    expect(field?.section).toBe('crossAnalysis');
    expect(field?.collectionMode).toBe('manual');
    expect(field?.prefillVisible).toBeFalsy();
  });

  it('appears in the goals-strategy group of JOURNEY_FIELD_GROUPS', () => {
    const group = JOURNEY_FIELD_GROUPS.find((g) => g.id === 'goals-strategy');
    expect(group?.fieldKeys).toContain('currentMarketingActivities');
  });

  it('appears in the goals-strategy group of PROFILE_FIELD_GROUPS', () => {
    const group = PROFILE_FIELD_GROUPS.find((g) => g.id === 'goals-strategy');
    expect(group?.fieldKeys).toContain('currentMarketingActivities');
  });

  it('renders as a multi-line textarea on the profile edit page', () => {
    expect(PROFILE_MULTILINE_KEYS.has('currentMarketingActivities')).toBe(true);
  });

  it('is NOT required — must remain optional for existing users', () => {
    expect(JOURNEY_REQUIRED_FIELD_KEYS.has('currentMarketingActivities')).toBe(false);
  });

  it('has placeholder and helper metadata in JOURNEY_ENRICHMENT_FIELD_METAS', () => {
    const meta = JOURNEY_ENRICHMENT_FIELD_METAS.find(
      (m) => m.key === 'currentMarketingActivities',
    );
    expect(meta).toBeDefined();
    expect(meta?.placeholder).toBeTruthy();
    expect(meta?.helper).toBeTruthy();
    expect(meta?.rows).toBeGreaterThan(1);
    expect(meta?.required).toBeFalsy();
  });

});

describe('Current Performance baseline-metric fields', () => {
  const BASELINE_KEYS = ['currentCac', 'avgCustomerLtv', 'leadToCustomerRate', 'last12MoGrowthRate'] as const;

  it.each(BASELINE_KEYS)('defines %s as a section-followup field', (key) => {
    const def = getJourneyFieldDefinition(key);
    expect(def).toBeDefined();
    expect(def?.category).toBe('section-followup');
    expect(def?.section).toBe('offerAnalysis');
    expect(def?.collectionMode).toBe('manual');
    expect(def?.prefillVisible).toBe(false);
  });

  it.each(BASELINE_KEYS)('gives %s a placeholder and helper via enrichment metas', (key) => {
    const meta = getManualBlockerMeta(key);
    expect(meta).toBeDefined();
    expect(meta?.rows).toBe(1);

    const expected: Record<typeof BASELINE_KEYS[number], { placeholder: string; helper: string }> = {
      currentCac: {
        placeholder: 'e.g. $450 — what one customer currently costs to acquire',
        helper: 'What it currently costs you to acquire a customer.',
      },
      avgCustomerLtv: {
        placeholder: 'e.g. $3,600 — total revenue per customer over their lifetime',
        helper: "Lifetime revenue per customer. Leave blank if you're not sure.",
      },
      leadToCustomerRate: {
        placeholder: 'e.g. 5 (means 5% — 5 of every 100 leads close)',
        helper: 'Of every 100 leads, how many become paying customers?',
      },
      last12MoGrowthRate: {
        placeholder: 'e.g. 25 (means 25% — leave blank if you don\'t track it)',
        helper: "Leave blank if you don't track it. Used to gate growth-rate claims in the plan.",
      },
    };

    // Pin both: placeholder reads as a hint (starts with "e.g."),
    // helper reads as a directive sentence.
    expect(meta?.placeholder).toBe(expected[key].placeholder);
    expect(meta?.placeholder).toMatch(/^e\.g\./);
    expect(meta?.helper).toBe(expected[key].helper);
  });

  it.each(BASELINE_KEYS)('never marks %s as required or in the pricing group', (key) => {
    expect(JOURNEY_REQUIRED_FIELD_KEYS.has(key)).toBe(false);
    expect(JOURNEY_PRICING_GROUP_KEYS.has(key)).toBe(false);
  });

  it('adds a current-performance group to JOURNEY_FIELD_GROUPS', () => {
    const group = JOURNEY_FIELD_GROUPS.find((g) => g.id === 'current-performance');
    expect(group).toBeDefined();
    expect(group?.label).toBe('Current Performance');
    expect(group?.fieldKeys).toEqual([...BASELINE_KEYS]);
  });

  it('adds a current-performance group to PROFILE_FIELD_GROUPS', () => {
    const group = PROFILE_FIELD_GROUPS.find((g) => g.id === 'current-performance');
    expect(group).toBeDefined();
    expect(group?.fieldKeys).toEqual([...BASELINE_KEYS]);
  });
});
