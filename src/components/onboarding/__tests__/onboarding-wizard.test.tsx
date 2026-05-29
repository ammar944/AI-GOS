/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OnboardingWizard } from '../onboarding-wizard';
import { getOnboardingFieldCount } from '@/lib/research-v2/onboarding-review';
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
    avgLtv: '$4,000',
    targetCac: '$600',
    monthlyAdBudget: '$20,000',
    topCompetitors: 'Otter, Fireflies, Avoma',
    whyCustomersChooseYou: 'Better meeting workflows and team adoption.',
    lossReasons: 'Already standardized on another note taker.',
    competitorAdvantages: 'Broader transcription brand awareness.',
    primaryGoal90Days: 'Increase qualified demos from team leads.',
    monthlyPipelineTarget: '$250,000',
    commonObjections: 'We already have meeting notes.',
    keyPromises: 'Turn meetings into accountable follow-through.',
    brandPositioning: 'The meeting productivity platform for teams.',
    salesProcessDocs: [
      { label: 'Process overview', url: 'https://docs.example.com/process' },
      { label: 'SDR outreach SOP', url: 'https://docs.example.com/sdr' },
    ],
    salesLoomUrl: 'https://www.loom.com/share/fellow-sales-process',
    gtmMotion: 'SLG',
    channels: ['google', 'linkedin'],
    budgetSplit: 'Google 60%, LinkedIn 40%',
    whatsWorking: 'Search demand around meeting notes.',
    whatsNotWorking: 'Generic productivity messaging.',
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

describe('OnboardingWizard (flat collapsed surface)', () => {
  it('renders all sections as a single flat scroll', () => {
    render(
      <OnboardingWizard
        initialData={makeCompleteData()}
        initialPrefillMetadata={prefillMetadata}
        onComplete={vi.fn()}
      />,
    );

    // Field-count header survives the collapse.
    expect(screen.getByText(`${getOnboardingFieldCount()} fields`)).toBeInTheDocument();

    // Every section header is present, exactly once (no rail duplicates).
    for (const section of SECTION_META) {
      expect(
        screen.getByRole('heading', { name: section.title }),
      ).toBeInTheDocument();
    }

    // Fields from MULTIPLE sections are mounted simultaneously with NO
    // navigation: section 1 (Product) and section 7 (Current Marketing).
    expect(screen.getByLabelText('Company Name*')).toBeInTheDocument();
    expect(
      screen.getByRole('group', {
        name: 'What channels are you currently running?',
      }),
    ).toBeInTheDocument();
  });

  it('submit fires onComplete once with full payload + review metadata', () => {
    const onComplete = vi.fn();

    render(
      <OnboardingWizard
        initialData={{ ...makeCompleteData(), gtmMotion: '' }}
        initialPrefillMetadata={prefillMetadata}
        onComplete={onComplete}
      />,
    );

    // Single click on the one primary button — no Continue navigation.
    fireEvent.click(screen.getByRole('button', { name: 'Run audit' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const [data, review] = onComplete.mock.calls[0] as [
      OnboardingV2Data,
      { fieldCount: number; fields: Record<string, { state: string }> },
    ];
    // Derive preserved.
    expect(data.gtmMotion).toBe('SLG');
    // Review-metadata shape preserved (load-bearing for the server route).
    expect(review.fieldCount).toBe(getOnboardingFieldCount());
    expect(review.fields.productDescription.state).toBe('AI-filled');
    expect(review.fields.companyName.state).toBe('User-edited');
    expect(review.fields.idealCustomer.state).toBe('Needs review');
  });

  it('removes all step/review chrome', () => {
    render(
      <OnboardingWizard
        initialData={makeCompleteData()}
        initialPrefillMetadata={prefillMetadata}
        onComplete={vi.fn()}
      />,
    );

    // No step counter.
    expect(screen.queryByText(/Step \d+ of/)).toBeNull();
    // No pinned / optional review rails.
    expect(screen.queryByText('Review first')).toBeNull();
    expect(screen.queryByText('Improve output')).toBeNull();
    // No inline per-field state badges.
    expect(screen.queryByText('AI-filled')).toBeNull();
    expect(screen.queryByText('User-edited')).toBeNull();
    expect(screen.queryByText('Needs review')).toBeNull();
    // No source chip text.
    expect(screen.queryByText(/^Source:/)).toBeNull();
    // No multi-step navigation button.
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('associates labels with controls and exposes stable id + name (a11y)', () => {
    render(
      <OnboardingWizard
        initialData={makeCompleteData()}
        initialPrefillMetadata={prefillMetadata}
        onComplete={vi.fn()}
      />,
    );

    // A single text control: visible <label htmlFor> resolves to the input,
    // not the wrapper div, and the input carries a stable id + name.
    const companyInput = screen.getByLabelText('Company Name*') as HTMLInputElement;
    expect(companyInput.tagName).toBe('INPUT');
    expect(companyInput.id).toBe('companyName-control');
    expect(companyInput.getAttribute('name')).toBe('companyName');
    expect(companyInput.getAttribute('aria-required')).toBe('true');

    // The wrapper anchor keeps the bare field key as its id and must NOT
    // collide with the control id.
    const anchor = document.getElementById('companyName');
    expect(anchor).not.toBeNull();
    expect(anchor).not.toBe(companyInput);
    expect(document.querySelectorAll('#companyName')).toHaveLength(1);

    // Both a radio group (section 1) and the channels checkbox group
    // (section 7) resolve in the same flat render — no initialStep needed.
    expect(
      screen.getByRole('radiogroup', { name: 'How do customers buy?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', {
        name: 'What channels are you currently running?',
      }),
    ).toBeInTheDocument();
  });
});
