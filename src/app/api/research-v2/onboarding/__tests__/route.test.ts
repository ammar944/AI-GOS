import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_ONBOARDING_V2, type OnboardingV2Data } from '@/lib/research-v2/onboarding-v2-types';

const VALID_RUN_ID = '00000000-0000-4000-8000-0000000000aa';

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const selectQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  selectQuery.select.mockReturnValue(selectQuery);
  selectQuery.eq.mockReturnValue(selectQuery);

  const updateQuery = {
    update: vi.fn(),
    eq: vi.fn(),
  };
  updateQuery.eq.mockReturnValue(updateQuery);

  const from = vi.fn((table: string) => {
    if (table !== 'journey_sessions') {
      throw new Error(`Unexpected table ${table}`);
    }
    return {
      select: selectQuery.select,
      update: updateQuery.update,
      eq: selectQuery.eq,
      maybeSingle: selectQuery.maybeSingle,
    };
  });
  const createAdminClient = vi.fn(() => ({ from }));

  return { auth, createAdminClient, from, selectQuery, updateQuery };
});

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => routeMocks.auth(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: routeMocks.createAdminClient,
}));

const { POST } = await import('../route');

function makeCompleteData(): OnboardingV2Data {
  return {
    ...EMPTY_ONBOARDING_V2,
    companyName: 'Fellow',
    productDescription: 'AI meeting assistant.',
    builtFor: 'B2B teams',
    salesMotion: 'hybrid',
    pricingModel: 'subscription',
    conversionPath: 'free_trial',
    acv: '1k_10k',
    idealCustomer: 'SaaS teams',
    industry: 'B2B SaaS',
    jobTitles: 'VP Product',
    companySize: '50-500',
    geographicFocus: 'North America',
    triggers: 'Meeting sprawl',
    currentAlternative: 'Docs',
    awarenessLevel: 'solution_aware',
    coreFeatures: 'AI agendas',
    firstValueMoment: 'First recap',
    activationEvent: 'Calendar connected',
    retentionDrivers: 'Weekly rituals',
    pricingTiers: 'Free, Pro',
    targetPlan: 'Business',
    monthlyAdBudget: '$20K',
    topCompetitors: 'Otter, Fireflies, Avoma',
    whyCustomersChooseYou: 'Better workflows',
    lossReasons: 'Existing vendor',
    competitorAdvantages: 'Brand awareness',
    primaryGoal90Days: 'More demos',
    monthlyPipelineTarget: '$250K',
    goalTargetCac: '$700',
    commonObjections: 'Already have notes',
    keyPromises: 'Better follow-through',
    brandPositioning: 'Meeting productivity platform',
    channels: ['google'],
    budgetSplit: 'Google 100%',
    whatsWorking: 'Search intent',
    whatsNotWorking: 'Generic messaging',
    currentCac: '$850',
    avgLtv: '$4K',
    monthlyRevenue: '$500K MRR',
  };
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/research-v2/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/research-v2/onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.selectQuery.select.mockReturnValue(routeMocks.selectQuery);
    routeMocks.selectQuery.eq.mockReturnValue(routeMocks.selectQuery);
    routeMocks.selectQuery.maybeSingle.mockResolvedValue({
      data: { metadata: { websiteUrl: 'https://fellow.app' } },
      error: null,
    });
    routeMocks.updateQuery.update.mockReturnValue(routeMocks.updateQuery);
  });

  it('persists reviewed onboarding data and review metadata under journey metadata', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });

    const reviewMetadata = {
      fieldCount: 52,
      lowConfidenceThreshold: 0.7,
      pinnedFieldKeys: ['idealCustomer'],
      counts: {
        'AI-filled': 1,
        'User-edited': 1,
        Missing: 0,
        'Needs review': 1,
      },
      fields: {
        companyName: {
          key: 'companyName',
          label: 'Company Name',
          sectionId: 'product-revenue',
          sectionTitle: 'Product & Revenue Model',
          state: 'User-edited',
          value: 'Fellow',
        },
      },
    };

    const response = await POST(
      makeRequest({
        runId: VALID_RUN_ID,
        data: makeCompleteData(),
        reviewMetadata,
      }),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.updateQuery.update).toHaveBeenCalledTimes(1);
    const [patch] = routeMocks.updateQuery.update.mock.calls[0] as [Record<string, unknown>];
    expect(patch.onboarding_data).toMatchObject({ companyName: 'Fellow' });
    expect(patch.metadata).toMatchObject({
      websiteUrl: 'https://fellow.app',
      researchV2OnboardingReview: {
        source: 'onboarding_v2_review',
        fieldCount: 52,
        pinnedFieldKeys: ['idealCustomer'],
        fields: {
          companyName: expect.objectContaining({ state: 'User-edited' }),
        },
      },
    });
    expect(
      (patch.metadata as { researchV2OnboardingReview: { savedAt: string } })
        .researchV2OnboardingReview.savedAt,
    ).toEqual(expect.any(String));
  });
});
