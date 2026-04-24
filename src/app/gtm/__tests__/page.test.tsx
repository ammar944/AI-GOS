import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GtmPage from '@/app/gtm/page';
import { GTM_ONBOARDING_QUESTIONNAIRE, getGtmOnboardingQuestions } from '@/lib/gtm/onboarding/questionnaire';

describe('GtmPage', () => {
  it('renders the canonical GTM onboarding questionnaire', () => {
    render(<GtmPage />);

    for (const section of GTM_ONBOARDING_QUESTIONNAIRE) {
      expect(screen.getByRole('heading', { name: section.heading })).toBeInTheDocument();
      expect(screen.getByText(section.goal)).toBeInTheDocument();
    }

    for (const question of getGtmOnboardingQuestions()) {
      expect(screen.getAllByText(question.prompt).length).toBeGreaterThan(0);
    }
  });
});
