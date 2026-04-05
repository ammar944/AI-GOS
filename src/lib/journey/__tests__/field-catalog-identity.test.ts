import { describe, expect, it } from 'vitest';
import { JOURNEY_FIELD_GROUPS, PROFILE_FIELD_GROUPS } from '../field-catalog';

describe('field-catalog identity-related fields', () => {
  it('includes monthlyRevenueRange in the offer-pricing group of both JOURNEY_FIELD_GROUPS and PROFILE_FIELD_GROUPS', () => {
    const journeyOfferGroup = JOURNEY_FIELD_GROUPS.find((g) => g.id === 'offer-pricing');
    const profileOfferGroup = PROFILE_FIELD_GROUPS.find((g) => g.id === 'offer-pricing');

    expect(journeyOfferGroup, 'offer-pricing group must exist in JOURNEY_FIELD_GROUPS').toBeDefined();
    expect(profileOfferGroup, 'offer-pricing group must exist in PROFILE_FIELD_GROUPS').toBeDefined();

    expect(journeyOfferGroup!.fieldKeys).toContain('monthlyRevenueRange');
    expect(profileOfferGroup!.fieldKeys).toContain('monthlyRevenueRange');
  });

  it('includes payingCustomerCount in the offer-pricing group of both JOURNEY_FIELD_GROUPS and PROFILE_FIELD_GROUPS', () => {
    const journeyOfferGroup = JOURNEY_FIELD_GROUPS.find((g) => g.id === 'offer-pricing');
    const profileOfferGroup = PROFILE_FIELD_GROUPS.find((g) => g.id === 'offer-pricing');

    expect(journeyOfferGroup, 'offer-pricing group must exist in JOURNEY_FIELD_GROUPS').toBeDefined();
    expect(profileOfferGroup, 'offer-pricing group must exist in PROFILE_FIELD_GROUPS').toBeDefined();

    expect(journeyOfferGroup!.fieldKeys).toContain('payingCustomerCount');
    expect(profileOfferGroup!.fieldKeys).toContain('payingCustomerCount');
  });
});
