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

describe('OnboardingWizard (multi-step surface)', () => {
  it('mounts only the current step and shows the step counter / progress', () => {
    render(
      <OnboardingWizard
        initialData={makeCompleteData()}
        initialPrefillMetadata={prefillMetadata}
        onComplete={vi.fn()}
      />,
    );

    // Step counter is present (rendered in both the desktop progress block and
    // the mobile section header — jsdom mounts both responsive variants).
    expect(screen.getAllByText('Step 1 of 8').length).toBeGreaterThan(0);
    // Field-count header survives.
    expect(
      screen.getByText(`${getOnboardingFieldCount()} fields`),
    ).toBeInTheDocument();

    // Step 1 (Product) fields are mounted.
    expect(screen.getByLabelText('Company Name*')).toBeInTheDocument();
    // Step 7 (Current Marketing) channels group is NOT mounted yet.
    expect(
      screen.queryByRole('group', {
        name: 'What channels are you currently running?',
      }),
    ).toBeNull();
  });

  it('renders clean fields — no per-field badges, source, or reasoning chrome', () => {
    render(
      <OnboardingWizard
        initialData={makeCompleteData()}
        initialPrefillMetadata={prefillMetadata}
        onComplete={vi.fn()}
      />,
    );

    // No inline state badges on step 1 (companyName is User-edited here).
    expect(screen.queryByText('AI-filled')).toBeNull();
    expect(screen.queryByText('User-edited')).toBeNull();
    expect(screen.queryByText('Needs review')).toBeNull();
    // No source chip text.
    expect(screen.queryByText(/^Source:/)).toBeNull();
    // No top pinned/optional review rails.
    expect(screen.queryByText('Review first')).toBeNull();
    expect(screen.queryByText('Improve output')).toBeNull();
  });

  it('Continue advances to the next step; Back returns', () => {
    render(
      <OnboardingWizard
        initialData={makeCompleteData()}
        initialPrefillMetadata={prefillMetadata}
        onComplete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getAllByText('Step 2 of 8').length).toBeGreaterThan(0);
    // Step 2 (ICP) field is mounted.
    expect(
      screen.getByLabelText('What industry do they operate in?*'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getAllByText('Step 1 of 8').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Company Name*')).toBeInTheDocument();
  });

  it('per-step validation blocks Continue when a required field is empty', () => {
    render(
      <OnboardingWizard
        initialData={{ ...makeCompleteData(), companyName: '' }}
        initialPrefillMetadata={prefillMetadata}
        onComplete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Stayed on step 1.
    expect(screen.getAllByText('Step 1 of 8').length).toBeGreaterThan(0);
    expect(screen.getByText('Company name is required')).toBeInTheDocument();

    // Fill it; Continue now advances.
    fireEvent.change(screen.getByLabelText('Company Name*'), {
      target: { value: 'Fellow' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getAllByText('Step 2 of 8').length).toBeGreaterThan(0);
  });

  it('"Go to next field" jumps to the right step and focuses the field', () => {
    // Everything complete EXCEPT `targetCac` (step 4, Pricing & Economics),
    // which is forward of the starting step and not yet visited — proving the
    // jump bypasses the `<= highestStepReached` guard.
    const data = { ...makeCompleteData(), targetCac: '' };
    const pricingStepIndex = SECTION_META.findIndex((section) =>
      section.fields.some((field) => field.key === 'targetCac'),
    );

    render(
      <OnboardingWizard
        initialData={data}
        initialPrefillMetadata={{}}
        onComplete={vi.fn()}
      />,
    );

    // The still-required panel surfaces exactly one blocker with its label.
    expect(screen.getByText('1 field still need input')).toBeInTheDocument();
    expect(screen.getByText('Next: “Target CAC”')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Go to next field/ }));

    // Jumped to the pricing step (step 4) without visiting steps 2-3.
    expect(
      screen.getAllByText(`Step ${pricingStepIndex + 1} of 8`).length,
    ).toBeGreaterThan(0);

    const control = document.getElementById('targetCac-control');
    expect(control).not.toBeNull();
    expect(document.activeElement).toBe(control);
  });

  it('shows the complete state when no required fields remain', () => {
    render(
      <OnboardingWizard
        initialData={makeCompleteData()}
        initialPrefillMetadata={{}}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText('All required fields complete')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Go to next field/ }),
    ).toBeNull();
  });

  it('Run audit on the last step fires onComplete once with full payload + review metadata', () => {
    const onComplete = vi.fn();
    const lastStep = SECTION_META.length - 1;

    render(
      <OnboardingWizard
        initialData={{ ...makeCompleteData(), gtmMotion: '' }}
        initialPrefillMetadata={prefillMetadata}
        initialStep={lastStep}
        onComplete={onComplete}
      />,
    );

    expect(
      screen.getAllByText(`Step ${lastStep + 1} of 8`).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Run audit' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const [completedData, review] = onComplete.mock.calls[0] as [
      OnboardingV2Data,
      { fieldCount: number; fields: Record<string, { state: string }> },
    ];
    // gtmMotion derived from salesMotion ('hybrid' -> 'SLG').
    expect(completedData.gtmMotion).toBe('SLG');
    // Review-metadata shape preserved (load-bearing for the server route).
    expect(review.fieldCount).toBe(getOnboardingFieldCount());
    expect(review.fields.productDescription.state).toBe('AI-filled');
    expect(review.fields.companyName.state).toBe('User-edited');
    expect(review.fields.idealCustomer.state).toBe('Needs review');
  });

  it('associates labels with controls and exposes stable id + name (a11y)', () => {
    render(
      <OnboardingWizard
        initialData={makeCompleteData()}
        initialPrefillMetadata={prefillMetadata}
        onComplete={vi.fn()}
      />,
    );

    const companyInput = screen.getByLabelText('Company Name*') as HTMLInputElement;
    expect(companyInput.tagName).toBe('INPUT');
    expect(companyInput.id).toBe('companyName-control');
    expect(companyInput.getAttribute('name')).toBe('companyName');
    expect(companyInput.getAttribute('aria-required')).toBe('true');

    // Wrapper anchor keeps the bare field key and must not collide with control.
    const anchor = document.getElementById('companyName');
    expect(anchor).not.toBeNull();
    expect(anchor).not.toBe(companyInput);
    expect(document.querySelectorAll('#companyName')).toHaveLength(1);

    // The radio group on step 1 resolves.
    expect(
      screen.getByRole('radiogroup', { name: 'How do customers buy?' }),
    ).toBeInTheDocument();
  });
});
