/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OnboardingWizardV2 } from '../onboarding-wizard-v2';
import {
  EMPTY_ONBOARDING_V2,
  SECTION_META,
  type OnboardingPrefillMetadata,
  type OnboardingV2Data,
} from '@/lib/research-v2/onboarding-v2-types';

function makeCompleteData(): OnboardingV2Data {
  return {
    ...EMPTY_ONBOARDING_V2,
    companyName: 'Fellow',
    productDescription: 'AI meeting assistant for high-performing teams.',
    builtFor: 'B2B teams running recurring meetings',
    salesMotion: 'hybrid',
    pricingModel: 'subscription',
    conversionPath: 'free_trial',
    acv: '1k_10k',
    idealCustomer: 'Revenue and product teams at B2B SaaS companies.',
    industry: 'B2B SaaS',
    jobTitles: 'VP Product, Chief of Staff, RevOps leader',
    companySize: '50-500 employees',
    geographicFocus: 'North America',
    triggers: 'Meeting sprawl, slow follow-up, inconsistent action tracking.',
    currentAlternative: 'Docs, spreadsheets, generic meeting notes tools',
    awarenessLevel: 'solution_aware',
    coreFeatures: 'Meeting agendas, AI recaps, action items, integrations.',
    firstValueMoment: 'A team gets a usable recap immediately after a meeting.',
    activationEvent: 'Connects calendar and runs first recurring meeting.',
    retentionDrivers: 'Team rituals, recurring templates, CRM handoff.',
    pricingTiers: 'Free, Pro, Business, Enterprise.',
    targetPlan: 'Business',
    ltv: '$4,000',
    targetCac: '$600',
    monthlyAdBudget: '$20,000',
    topCompetitors: 'Otter, Fireflies, Avoma',
    whyCustomersChooseYou: 'Better meeting workflows and team adoption.',
    lossReasons: 'Already standardized on another note taker.',
    competitorAdvantages: 'Broader transcription brand awareness.',
    primaryGoal90Days: 'Increase qualified demos from team leads.',
    monthlyPipelineTarget: '$250,000',
    goalTargetCac: '$700',
    commonObjections: 'We already have meeting notes.',
    keyPromises: 'Turn meetings into accountable follow-through.',
    brandPositioning: 'The meeting productivity platform for teams.',
    channels: ['google', 'linkedin'],
    budgetSplit: 'Google 60%, LinkedIn 40%',
    whatsWorking: 'Search demand around meeting notes.',
    whatsNotWorking: 'Generic productivity messaging.',
    currentCac: '$850',
    avgLtv: '$4,000',
    monthlyRevenue: '$500K MRR',
    avgSalesCycle: '30 days',
    visitorToSignup: '4%',
    signupToActivation: '45%',
    activationToPaid: '18%',
    demoToClose: '22%',
    growthTrend: '+12% MoM',
  };
}

const prefillMetadata: OnboardingPrefillMetadata = {
  companyName: {
    value: 'Fellow AI',
    confidence: 0.92,
    sourceUrl: 'https://fellow.app',
    reasoning: 'Homepage brand extraction.',
  },
  productDescription: {
    value: 'AI meeting assistant for high-performing teams.',
    confidence: 0.94,
    sourceUrl: 'https://fellow.app',
    reasoning: 'Homepage hero copy.',
  },
  idealCustomer: {
    value: 'Revenue and product teams at B2B SaaS companies.',
    confidence: 0.42,
    sourceUrl: 'https://fellow.app/customers',
    reasoning: 'Customer page inference needs confirmation.',
  },
};

describe('OnboardingWizardV2 review surface', () => {
  it('renders every onboarding field grouped under the existing sections', () => {
    render(
      <OnboardingWizardV2
        initialData={makeCompleteData()}
        initialPrefillMetadata={prefillMetadata}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId(/^onboarding-field-/)).toHaveLength(47);
    for (const section of SECTION_META) {
      expect(screen.getByRole('heading', { name: section.title })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Company Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Activation → paid %')).toBeInTheDocument();
    expect(screen.getByLabelText('Last 3–6 months growth trend')).toBeInTheDocument();
  });

  it('pins missing and low-confidence fields without hiding filled group fields', () => {
    const data = {
      ...makeCompleteData(),
      activationToPaid: '',
    };

    render(
      <OnboardingWizardV2
        initialData={data}
        initialPrefillMetadata={prefillMetadata}
        onComplete={vi.fn()}
      />,
    );

    const pinned = screen.getByTestId('onboarding-review-pinned');
    expect(within(pinned).getByText('ICP + Pain')).toBeInTheDocument();
    expect(within(pinned).getByText('Ideal Customer')).toBeInTheDocument();
    expect(within(pinned).getByText('Activation → paid %')).toBeInTheDocument();

    const groupedMarketing = screen.getByTestId('onboarding-section-current-marketing');
    expect(within(groupedMarketing).getByLabelText('Activation → paid %')).toBeInTheDocument();
  });

  it('shows AI-filled, User-edited, Missing, and Needs review field states', () => {
    const data = {
      ...makeCompleteData(),
      activationToPaid: '',
    };

    render(
      <OnboardingWizardV2
        initialData={data}
        initialPrefillMetadata={prefillMetadata}
        onComplete={vi.fn()}
      />,
    );

    expect(
      within(screen.getByTestId('onboarding-field-productDescription')).getByText('AI-filled'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('onboarding-field-companyName')).getByText('User-edited'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('onboarding-field-activationToPaid')).getByText('Missing'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('onboarding-field-idealCustomer')).getByText('Needs review'),
    ).toBeInTheDocument();
  });

  it('submits reviewed data with persisted field-state metadata', () => {
    const onComplete = vi.fn();

    render(
      <OnboardingWizardV2
        initialData={makeCompleteData()}
        initialPrefillMetadata={prefillMetadata}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run audit' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const [, review] = onComplete.mock.calls[0] as [OnboardingV2Data, { fieldCount: number; fields: Record<string, { state: string }> }];
    expect(review.fieldCount).toBe(47);
    expect(review.fields.productDescription.state).toBe('AI-filled');
    expect(review.fields.companyName.state).toBe('User-edited');
    expect(review.fields.idealCustomer.state).toBe('Needs review');
  });
});
