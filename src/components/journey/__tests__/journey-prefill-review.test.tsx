import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JourneyPrefillReview } from '../journey-prefill-review';

describe('JourneyPrefillReview', () => {
  const proposals = [
    {
      fieldName: 'companyName' as const,
      label: 'Company Name',
      value: 'Acme AI',
      confidence: 94,
      sourceUrl: 'https://acme.com/about',
      reasoning: 'Found in the homepage headline and about page.',
    },
    {
      fieldName: 'pricingTiers' as const,
      label: 'Pricing',
      value: '$499/mo',
      confidence: 82,
      sourceUrl: 'https://acme.com/pricing',
      reasoning: 'Captured from the public pricing page.',
    },
  ];

  it('shows field count and labels summary', () => {
    render(
      <JourneyPrefillReview
        proposals={proposals}
        onApplyReview={vi.fn()}
        onSkipForNow={vi.fn()}
      />,
    );

    expect(screen.getByText('Found 2 details from your site')).toBeInTheDocument();
    expect(screen.getByText('Company Name, Pricing')).toBeInTheDocument();
  });

  it('calls onApplyReview with accept-all decisions when "Use these details" clicked', () => {
    const onApplyReview = vi.fn();

    render(
      <JourneyPrefillReview
        proposals={proposals}
        onApplyReview={onApplyReview}
        onSkipForNow={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /use these details and start/i }));

    expect(onApplyReview).toHaveBeenCalledWith([
      { fieldName: 'companyName', action: 'accept', value: 'Acme AI' },
      { fieldName: 'pricingTiers', action: 'accept', value: '$499/mo' },
    ]);
  });

  it('calls onSkipForNow when skip button clicked', () => {
    const onSkipForNow = vi.fn();

    render(
      <JourneyPrefillReview
        proposals={proposals}
        onApplyReview={vi.fn()}
        onSkipForNow={onSkipForNow}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /skip/i }));

    expect(onSkipForNow).toHaveBeenCalledOnce();
  });
});
