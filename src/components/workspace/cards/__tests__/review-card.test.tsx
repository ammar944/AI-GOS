import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewCard } from '../review-card';

describe('ReviewCard', () => {
  it('renders all three review sources', () => {
    render(
      <ReviewCard
        competitorName="Acme"
        trustpilot={{ rating: 4.2, reviewCount: 100, themes: ['fast'], url: 'https://tp.com' }}
        g2={{ rating: 3.8, reviewCount: 50, themes: ['analytics'], url: 'https://g2.com' }}
        capterra={{ rating: 4.0, reviewCount: 200, themes: ['CRM'], url: 'https://cap.com' }}
      />,
    );

    expect(screen.getByText('Trustpilot')).toBeDefined();
    expect(screen.getByText('G2')).toBeDefined();
    expect(screen.getByText('Capterra')).toBeDefined();
  });

  it('renders exploit angles when gapIntelligence is provided', () => {
    render(
      <ReviewCard
        competitorName="Acme"
        trustpilot={{ rating: 4.0 }}
        gapIntelligence={{
          recurringComplaints: ['slow onboarding'],
          exploitAngles: [{
            gap: 'Slow onboarding',
            whyItMatters: 'Cited by 3 reviewers',
            positioningAngle: 'Position as instant setup',
            adHook: 'Stop waiting. Start selling.',
            confidence: 'high',
            evidenceQuotes: ['Took 3 weeks to get started'],
          }],
        }}
      />,
    );

    expect(screen.getByText('Exploit Angles')).toBeDefined();
    expect(screen.getByText('Slow onboarding')).toBeDefined();
    expect(screen.getByText('Position as instant setup')).toBeDefined();
  });

  it('does not render exploit angles when gapIntelligence is null', () => {
    render(
      <ReviewCard
        competitorName="Acme"
        trustpilot={{ rating: 4.0 }}
        gapIntelligence={null}
      />,
    );

    expect(screen.queryByText('Exploit Angles')).toBeNull();
  });

  it('does NOT return null when only negativeReviews exist (guard fix)', () => {
    const { container } = render(
      <ReviewCard
        competitorName="Acme"
        negativeReviews={[
          { text: 'Bad UX', rating: 2, source: 'g2' },
        ]}
      />,
    );

    expect(container.firstChild).not.toBeNull();
  });

  it('does NOT return null when only gapIntelligence exists', () => {
    const { container } = render(
      <ReviewCard
        competitorName="Acme"
        gapIntelligence={{
          recurringComplaints: ['poor support'],
          exploitAngles: [{
            gap: 'Poor support',
            whyItMatters: 'Multiple complaints',
            positioningAngle: '24/7 support',
            adHook: 'Always there when you need us.',
            confidence: 'medium',
            evidenceQuotes: ['Support took 5 days'],
          }],
        }}
      />,
    );

    expect(container.firstChild).not.toBeNull();
    expect(screen.getByText('Exploit Angles')).toBeDefined();
  });

  it('returns null when no data exists', () => {
    const { container } = render(
      <ReviewCard competitorName="Acme" />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders confidence badges with correct labels', () => {
    render(
      <ReviewCard
        competitorName="Acme"
        gapIntelligence={{
          recurringComplaints: [],
          exploitAngles: [
            {
              gap: 'Gap A',
              whyItMatters: 'Matters',
              positioningAngle: 'Position A',
              adHook: 'Hook A',
              confidence: 'high',
              evidenceQuotes: [],
            },
            {
              gap: 'Gap B',
              whyItMatters: 'Matters',
              positioningAngle: 'Position B',
              adHook: 'Hook B',
              confidence: 'low',
              evidenceQuotes: [],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('high')).toBeDefined();
    expect(screen.getByText('low')).toBeDefined();
  });
});
