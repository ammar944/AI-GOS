import { describe, expect, it } from 'vitest';
import { JOURNEY_FIELD_GROUPS, PROFILE_FIELD_GROUPS } from '../field-catalog';

describe('field-catalog identity-related fields (v3 onboarding)', () => {
  // v3 routing-relevant enums live in the Product & Revenue Model section and must
  // be surfaced in BOTH the journey review (new users) and profile edit (existing users).
  const V3_IDENTITY_FIELDS = ['salesMotion', 'pricingModel', 'conversionPath', 'avgAcv'] as const;

  it.each(V3_IDENTITY_FIELDS)(
    'exposes %s in the product-revenue-model group of JOURNEY_FIELD_GROUPS',
    (key) => {
      const group = JOURNEY_FIELD_GROUPS.find((g) => g.id === 'product-revenue-model');
      expect(group, 'product-revenue-model group must exist').toBeDefined();
      expect(group?.fieldKeys).toContain(key);
    },
  );

  it.each(V3_IDENTITY_FIELDS)(
    'exposes %s in the product-revenue-model group of PROFILE_FIELD_GROUPS',
    (key) => {
      const group = PROFILE_FIELD_GROUPS.find((g) => g.id === 'product-revenue-model');
      expect(group, 'product-revenue-model group must exist').toBeDefined();
      expect(group?.fieldKeys).toContain(key);
    },
  );

  it('keeps targetCustomer in product-revenue-model (the one-line "Who is it built for?" field)', () => {
    const journeyGroup = JOURNEY_FIELD_GROUPS.find((g) => g.id === 'product-revenue-model');
    const profileGroup = PROFILE_FIELD_GROUPS.find((g) => g.id === 'product-revenue-model');
    expect(journeyGroup?.fieldKeys).toContain('targetCustomer');
    expect(profileGroup?.fieldKeys).toContain('targetCustomer');
  });
});
