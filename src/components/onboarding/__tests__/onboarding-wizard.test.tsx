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

  it('surfaces per-field provenance (confidence badge + cited source link) for AI-prefilled fields', () => {
    render(
      <OnboardingWizard
        initialData={makeCompleteData()}
        initialPrefillMetadata={prefillMetadata}
        onComplete={vi.fn()}
      />,
    );

    // Raw review-state strings are still NOT rendered as field chrome.
    expect(screen.queryByText('AI-filled')).toBeNull();
    expect(screen.queryByText('User-edited')).toBeNull();
    expect(screen.queryByText('Needs review')).toBeNull();
    // No top pinned/optional review rails.
    expect(screen.queryByText('Review first')).toBeNull();
    expect(screen.queryByText('Improve output')).toBeNull();

    // Step 1 fields companyName + productDescription carry prefill metadata
    // with sourceUrls, so each renders a confidence badge and a click-through
    // to its cited source.
    const sourceLinks = screen.getAllByRole('link', { name: /^Source/i });
    expect(sourceLinks.length).toBeGreaterThan(0);
    expect(sourceLinks[0]).toHaveAttribute('href', 'https://fellow.app');
    // High-confidence prefill (0.92 / 0.94) surfaces a "High" confidence badge.
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
  });

  it('renders the persistent "Researched N sources" disclosure when corpus sources are threaded through', () => {
    render(
      <OnboardingWizard
        initialData={makeCompleteData()}
        initialPrefillMetadata={prefillMetadata}
        corpusSources={[
          {
            title: 'Fellow homepage',
            url: 'https://fellow.app',
            whyItMatters: 'Primary product identity.',
          },
          { title: 'Fellow pricing', url: 'https://fellow.app/pricing' },
        ]}
        onComplete={vi.fn()}
      />,
    );

    const toggle = screen.getByRole('button', { name: /Researched 2 sources/i });
    expect(toggle).toBeInTheDocument();

    // Collapsed by default — the source list links are not yet rendered.
    expect(
      screen.queryByRole('link', { name: /Fellow pricing/i }),
    ).toBeNull();

    fireEvent.click(toggle);

    expect(
      screen.getByRole('link', { name: /Fellow pricing/i }),
    ).toHaveAttribute('href', 'https://fellow.app/pricing');
  });

  it('omits the corpus sources disclosure when no sources are present', () => {
    render(
      <OnboardingWizard
        initialData={makeCompleteData()}
        initialPrefillMetadata={prefillMetadata}
        corpusSources={[]}
        onComplete={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: /Researched .* sources?/i }),
    ).toBeNull();
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

describe('budget field guidance (B3: media plan needs a real budget)', () => {
  // Pricing & Economics is step index 3 (Step 4 of 8) — where monthlyAdBudget lives.
  const PRICING_STEP = 3;

  it('shows non-blocking guidance for a non-answer budget and still allows Continue', () => {
    render(
      <OnboardingWizard
        initialData={{ ...makeCompleteData(), monthlyAdBudget: 'idk' }}
        initialStep={PRICING_STEP}
        onComplete={vi.fn()}
      />,
    );

    const guidance = screen.getByTestId('onboarding-budget-guidance');
    expect(guidance).toHaveTextContent(/media plan/i);
    expect(guidance).toHaveTextContent(/Budget not provided/);

    // Honest-gap, not hard-block: submission proceeds to the next step.
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getAllByText('Step 5 of 8').length).toBeGreaterThan(0);
  });

  it('shows the guidance for $[Budget]-style placeholder garbage', () => {
    render(
      <OnboardingWizard
        initialData={{ ...makeCompleteData(), monthlyAdBudget: '$[Budget]' }}
        initialStep={PRICING_STEP}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByTestId('onboarding-budget-guidance')).toBeInTheDocument();
  });

  it('shows no guidance for a real budget', () => {
    render(
      <OnboardingWizard
        initialData={makeCompleteData()}
        initialStep={PRICING_STEP}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('onboarding-budget-guidance')).toBeNull();
  });

  it('updates the guidance live as the operator types a real number', () => {
    render(
      <OnboardingWizard
        initialData={{ ...makeCompleteData(), monthlyAdBudget: 'idk' }}
        initialStep={PRICING_STEP}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByTestId('onboarding-budget-guidance')).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText('Monthly ad budget (or planned budget)*'),
      { target: { value: '$6,000' } },
    );

    expect(screen.queryByTestId('onboarding-budget-guidance')).toBeNull();
  });
});
