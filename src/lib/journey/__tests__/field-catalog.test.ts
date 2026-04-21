import { describe, expect, it } from 'vitest';
import {
  JOURNEY_FIELDS,
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
    // v3: scrape-visible fields cover basics, ICP core, offer core, competition core, + asset URLs.
    expect(JOURNEY_PREFILL_REVIEW_FIELDS.length).toBeGreaterThanOrEqual(15);
    expect(JOURNEY_PREFILL_REVIEW_FIELDS.some((f) => f.key === 'productDescription')).toBe(true);
    expect(JOURNEY_PREFILL_REVIEW_FIELDS.some((f) => f.key === 'targetCustomer')).toBe(true);
  });

  it('keeps the required upfront blocker set explicit', () => {
    expect(JOURNEY_MANUAL_BLOCKER_FIELDS.map((field) => field.key)).toEqual([
      'productDescription',
      'targetCustomer',
      'salesMotion',
      'pricingModel',
      'conversionPath',
      'avgAcv',
      'primaryIcpDescription',
      'topCompetitors',
      'uniqueEdge',
      'pricingTiers',
      'monthlyAdBudget',
      'goals',
    ]);
  });

  it('keeps the wave-two requirement order explicit', () => {
    expect(JOURNEY_WAVE_TWO_REQUIREMENTS.map((item) => item.key)).toEqual([
      'topCompetitors',
      'productDescription',
      'primaryIcpDescription',
      'targetCustomer',
      'salesMotion',
      'pricingModel',
      'conversionPath',
      'avgAcv',
      'pricingContext',
    ]);
  });
});

describe('Current Performance baseline-metric fields', () => {
  // v3: leadToCustomerRate retired (replaced by demoToCloseRate); we keep cac/ltv/growth-trend.
  const BASELINE_KEYS = ['currentCac', 'avgCustomerLtv', 'last3to6MoGrowthTrend'] as const;

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
    expect(meta?.placeholder).toBeTruthy();
    expect(meta?.placeholder).toMatch(/^e\.g\./);
    expect(meta?.helper).toBeTruthy();
  });

  it.each(BASELINE_KEYS)('never marks %s as required or in the pricing group', (key) => {
    expect(JOURNEY_REQUIRED_FIELD_KEYS.has(key)).toBe(false);
    expect(JOURNEY_PRICING_GROUP_KEYS.has(key)).toBe(false);
  });

  it('places baseline-ish metrics inside the v3 current-marketing group in JOURNEY_FIELD_GROUPS', () => {
    const group = JOURNEY_FIELD_GROUPS.find((g) => g.id === 'current-marketing');
    expect(group).toBeDefined();
    expect(group?.label).toBe('Current Marketing & Performance');
    expect(group?.fieldKeys).toContain('currentCac');
    expect(group?.fieldKeys).toContain('last3to6MoGrowthTrend');
  });

  it('routes baseline metrics across v3 pricing-economics + current-marketing groups in PROFILE_FIELD_GROUPS', () => {
    // LTV lives in Pricing & Economics (anchors CAC ceiling). Current CAC + growth trend live in
    // Current Marketing & Performance (diagnostics).
    const pricing = PROFILE_FIELD_GROUPS.find((g) => g.id === 'pricing-economics');
    const marketing = PROFILE_FIELD_GROUPS.find((g) => g.id === 'current-marketing');
    expect(pricing).toBeDefined();
    expect(marketing).toBeDefined();
    const allKeys = [...(pricing?.fieldKeys ?? []), ...(marketing?.fieldKeys ?? [])];
    for (const key of BASELINE_KEYS) {
      expect(allKeys).toContain(key);
    }
  });
});

describe('v3 obsolete fields', () => {
  // These fields were retired during v3 onboarding rewrite. The test documents the removal
  // so reintroducing them requires a deliberate catalog entry.
  const OBSOLETE_KEYS = [
    'businessModel',
    'currentFunnelType',
    'easiestToClose',
    'bestClientSources',
    'competitorFrustrations',
    'marketBottlenecks',
    'salesProcessOverview',
    'campaignDuration',
    'targetCpl',
    'leadToCustomerRate',
    'currentMarketingActivities',
    'headquartersLocation',
    'marketProblem',
    'guarantees',
    'monthlyRevenueRange',
    'payingCustomerCount',
    'situationBeforeBuying',
    'desiredTransformation',
    'last12MoGrowthRate',
  ] as const;

  it.each(OBSOLETE_KEYS)('removes %s from JOURNEY_FIELDS', (key) => {
    expect(getJourneyFieldDefinition(key)).toBeUndefined();
  });
});
