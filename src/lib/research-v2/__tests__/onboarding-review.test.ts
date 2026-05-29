import { describe, expect, it } from 'vitest';

import {
  buildOnboardingReviewMetadata,
  getOnboardingFieldCount,
} from '../onboarding-review';
import {
  EMPTY_ONBOARDING_V2,
  OnboardingV2Schema,
  type OnboardingPrefillMetadata,
  type OnboardingV2Data,
} from '../onboarding-v2-types';

// A fully-filled brief: every hard-required field has a value, optional fields
// also filled. Mirrors a "run-ready" submission.
function makeAllRequiredFilled(): OnboardingV2Data {
  return {
    ...EMPTY_ONBOARDING_V2,
    companyName: 'Fellow',
    productDescription: 'AI meeting assistant.',
    builtFor: 'B2B teams',
    salesMotion: 'hybrid',
    pricingModel: 'subscription',
    conversionPath: 'free_trial',
    acv: '1k_10k',
    idealCustomer: 'Revenue and product teams.',
    industry: 'B2B SaaS',
    jobTitles: 'VP Product, RevOps',
    companySize: '50-500 employees',
    geographicFocus: 'North America',
    triggers: 'Meeting sprawl.',
    currentAlternative: 'Docs and spreadsheets',
    awarenessLevel: 'solution_aware',
    coreFeatures: 'Agendas, recaps, action items.',
    firstValueMoment: 'Usable recap after a meeting.',
    activationEvent: 'Connects calendar.',
    retentionDrivers: 'Team rituals.',
    pricingTiers: 'Free, Pro, Business.',
    targetPlan: 'Business',
    avgLtv: '$4,000',
    targetCac: '$600',
    monthlyAdBudget: '$20,000',
    topCompetitors: 'Otter, Fireflies, Avoma',
    whyCustomersChooseYou: 'Better workflows.',
    lossReasons: 'Standardized elsewhere.',
    competitorAdvantages: 'Bigger brand.',
    primaryGoal90Days: 'More qualified demos.',
    monthlyPipelineTarget: '$250,000',
    commonObjections: 'We already have notes.',
    keyPromises: 'Accountable follow-through.',
    brandPositioning: 'Meeting productivity platform.',
    gtmMotion: 'SLG',
    channels: ['google', 'linkedin'],
    budgetSplit: 'Google 60%, LinkedIn 40%',
    whatsWorking: 'Search demand.',
    whatsNotWorking: 'Generic messaging.',
    currentCac: '$850',
    monthlyRevenue: '$500K MRR',
    avgSalesCycle: '30 days',
    visitorToSignup: '4%',
    signupToActivation: '45%',
    activationToPaid: '18%',
    demoToClose: '22%',
    growthTrend: '+12% MoM',
    creativeCapacity: 'standard',
    leadListAvailable: true,
  };
}

describe('buildOnboardingReviewMetadata field contract', () => {
  it('(a) a hard-required blank both blocks the run and pins to the blocker rail', () => {
    const data = { ...makeAllRequiredFilled(), companyName: '' };

    const review = buildOnboardingReviewMetadata(data);

    // companyName is required → 'Missing' state and pinned as a blocker.
    expect(review.fields.companyName?.state).toBe('Missing');
    expect(review.pinnedFieldKeys).toContain('companyName');
    expect(review.optionalIncomplete).not.toContain('companyName');

    // Run-audit gating: the canonical schema rejects the brief.
    expect(OnboardingV2Schema.safeParse(data).success).toBe(false);
  });

  it('(b) an optional blank does NOT pin and does NOT block the run', () => {
    const data = {
      ...makeAllRequiredFilled(),
      // Optional funnel metrics blank.
      visitorToSignup: '',
      activationToPaid: '',
      growthTrend: '',
      avgSalesCycle: '',
      // Entire Media Plan Setup step is optional.
      creativeCapacity: '',
      leadListAvailable: null,
      salesProcessDocs: [],
      salesLoomUrl: '',
    } satisfies OnboardingV2Data;

    const review = buildOnboardingReviewMetadata(data);

    for (const key of [
      'visitorToSignup',
      'activationToPaid',
      'growthTrend',
      'avgSalesCycle',
      'creativeCapacity',
      'leadListAvailable',
      'salesProcessDocs',
      'salesLoomUrl',
    ] as Array<keyof OnboardingV2Data>) {
      expect(review.fields[key]?.state).toBe('Optional');
      expect(review.pinnedFieldKeys).not.toContain(key);
      expect(review.optionalIncomplete).toContain(key);
    }

    // No optional blank leaks into the blocker rail.
    expect(review.pinnedFieldKeys).toHaveLength(0);

    // Run-audit gating: optional blanks never block the run.
    expect(OnboardingV2Schema.safeParse(data).success).toBe(true);
  });

  it('(c) 100% of required filled with optional blanks reports run-ready (no blockers)', () => {
    const data = {
      ...makeAllRequiredFilled(),
      activationToPaid: '',
      demoToClose: '',
      creativeCapacity: '',
    } satisfies OnboardingV2Data;

    const review = buildOnboardingReviewMetadata(data);

    // Zero blockers => run-ready.
    expect(review.pinnedFieldKeys).toHaveLength(0);
    // The optional blanks are tracked, just not as blockers.
    expect(review.optionalIncomplete).toEqual(
      expect.arrayContaining(['activationToPaid', 'demoToClose', 'creativeCapacity']),
    );
    expect(review.counts.Missing).toBe(0);
    expect(review.counts['Needs review']).toBe(0);

    expect(OnboardingV2Schema.safeParse(data).success).toBe(true);
  });

  it('keeps Needs-review pinning for low-confidence REQUIRED fills only', () => {
    const data = makeAllRequiredFilled();
    const prefill: OnboardingPrefillMetadata = {
      // Required field, low-confidence AI fill that matches the current value.
      idealCustomer: {
        value: data.idealCustomer,
        confidence: 0.4,
        sourceUrl: 'https://example.com',
        reasoning: 'inference',
      },
      // Optional field, low-confidence AI fill — informational, not a blocker.
      growthTrend: {
        value: data.growthTrend,
        confidence: 0.4,
        sourceUrl: 'https://example.com',
        reasoning: 'inference',
      },
    };

    const review = buildOnboardingReviewMetadata(data, prefill);

    expect(review.fields.idealCustomer?.state).toBe('Needs review');
    expect(review.pinnedFieldKeys).toContain('idealCustomer');

    // Optional low-confidence fill stays 'Needs review' (badge) but is NOT a blocker.
    expect(review.fields.growthTrend?.state).toBe('Needs review');
    expect(review.pinnedFieldKeys).not.toContain('growthTrend');
    // It is a non-blocking improve-output item, not an optional *blank*.
    expect(review.optionalIncomplete).not.toContain('growthTrend');
  });

  it('counts every field exactly once across all buckets', () => {
    const data = { ...makeAllRequiredFilled(), companyName: '', activationToPaid: '' };
    const review = buildOnboardingReviewMetadata(data);

    const total =
      review.counts['AI-filled'] +
      review.counts['User-edited'] +
      review.counts.Missing +
      review.counts['Needs review'] +
      review.counts.Optional;

    expect(total).toBe(getOnboardingFieldCount());
  });
});
