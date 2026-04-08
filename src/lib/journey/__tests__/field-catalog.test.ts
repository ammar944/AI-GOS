import { describe, expect, it } from 'vitest';
import {
  JOURNEY_FIELDS,
  JOURNEY_MANUAL_BLOCKER_FIELDS,
  JOURNEY_PREFILL_REVIEW_FIELDS,
  JOURNEY_REQUIRED_BLOCKER_FIELDS,
  JOURNEY_RESEARCH_ENRICHMENT_FIELDS,
  JOURNEY_SECTION_FOLLOWUP_FIELDS,
  JOURNEY_WAVE_TWO_REQUIREMENTS,
  JOURNEY_FIELD_GROUPS,
  PROFILE_FIELD_GROUPS,
  PROFILE_MULTILINE_KEYS,
  JOURNEY_REQUIRED_FIELD_KEYS,
  JOURNEY_ENRICHMENT_FIELD_METAS,
  getJourneyFieldDefinition,
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

  it('flows through buildJourneyResearchContext as a labeled line', async () => {
    const { buildJourneyResearchContext } = await import('../context-string');
    const ctx = buildJourneyResearchContext({
      companyName: 'Acme',
      currentMarketingActivities:
        'Meta $8k/mo LAL 1% + UGC, 2.1x ROAS. LinkedIn flat. Google brand-only.',
    });
    expect(ctx).toContain(
      'Current Marketing Activities: Meta $8k/mo LAL 1% + UGC, 2.1x ROAS. LinkedIn flat. Google brand-only.',
    );
  });
});
