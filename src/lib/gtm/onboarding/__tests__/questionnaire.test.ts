import { describe, expect, it } from 'vitest';
import {
  GTM_ONBOARDING_QUESTIONNAIRE,
  getGtmOnboardingQuestions,
  getGtmOnboardingSection,
  type GtmOnboardingQuestion,
} from '@/lib/gtm/onboarding/questionnaire';

function getQuestionByPrompt(prompt: string): GtmOnboardingQuestion {
  const question = getGtmOnboardingQuestions().find((item) => item.prompt === prompt);
  if (!question) {
    throw new Error(`Missing onboarding question: ${prompt}`);
  }
  return question;
}

describe('GTM_ONBOARDING_QUESTIONNAIRE', () => {
  it('keeps the exact seven-section onboarding flow from the source document', () => {
    expect(GTM_ONBOARDING_QUESTIONNAIRE.map((section) => section.heading)).toEqual([
      'Business Basics',
      'Target Customer',
      'Offer & Product Experience',
      'Pricing & Economics',
      'Competition',
      'Goals & Strategy',
      'Current Performance',
    ]);

    expect(GTM_ONBOARDING_QUESTIONNAIRE.map((section) => section.title)).toEqual([
      'Product & Revenue Model',
      'ICP + Pain',
      'Offer & Product Experience',
      'Pricing & Economics',
      'Competition & Positioning',
      'Goals & Strategy',
      'Current Marketing & Performance',
    ]);
  });

  it('keeps every question prompt exactly as written in the onboarding document', () => {
    expect(getGtmOnboardingQuestions().map((question) => question.prompt)).toEqual([
      'Company Name',
      'What does your product/SaaS do?',
      'Who is it built for?',
      'How do customers buy?',
      'What is your pricing model?',
      'How do customers convert?',
      'What is your average price or ACV (contract value)?',
      'Describe your ideal customer (company + persona)',
      'What industry do they operate in?',
      'What job titles do you sell to?',
      'Company size (employees or revenue range)',
      'Geographic focus',
      'What triggers them to look for a solution like yours?',
      'What are they currently using instead?',
      'How aware are they of the problem?',
      'What are the core features / main outcome(s) your product delivers?',
      'What is the first “value moment” users experience?',
      'What action defines an activated user?',
      'What keeps your best customers using the product?',
      'List your pricing tiers',
      'What is your target customer’s typical plan?',
      'Average LTV (if known)',
      'Target CAC (if known)',
      'Monthly ad budget (or planned budget)',
      'Who are your top competitors (minimum 3)?',
      'Why do customers choose you over alternatives?',
      'In deals you lose, what do prospects say before choosing a competitor?',
      'What do competitors do better than you?',
      'What is your primary goal in the next 90 days?',
      'Monthly pipeline target ($ or # of demos)',
      'Target CAC',
      'Common objections from prospects',
      'Key promises / outcomes you want to be known for',
      'Current brand positioning (1–2 sentences)',
      'What channels are you currently running?',
      'Budget split per channel',
      'What’s working right now?',
      'What’s not working?',
      'Current CAC',
      'Avg Customer LTV',
      'Monthly revenue (MRR or ARR)',
      'Average sales cycle length (if sales-led)',
      'Website visitor → signup %',
      'Signup → activation %',
      'Activation → paid %',
      'Demo → close rate (if applicable)',
      'Last 3–6 months growth trend',
    ]);
  });

  it('keeps the exact select options from the onboarding document', () => {
    expect(getQuestionByPrompt('How do customers buy?').options).toEqual([
      'Product-led (self-serve)',
      'Sales-led (demo → close)',
      'Hybrid',
    ]);
    expect(getQuestionByPrompt('What is your pricing model?').options).toEqual([
      'Subscription (monthly / annual)',
      'Usage-based',
      'Per seat',
      'One-time + subscription',
    ]);
    expect(getQuestionByPrompt('How do customers convert?').options).toEqual([
      'Free trial',
      'Freemium',
      'Demo required',
      'Direct checkout',
    ]);
    expect(getQuestionByPrompt('What is your average price or ACV (contract value)?').options).toEqual([
      '<$1K',
      '$1K–$10K',
      '$10K–$50K',
      '$50K+',
    ]);
    expect(getQuestionByPrompt('How aware are they of the problem?').options).toEqual([
      'Unaware',
      'Problem-aware',
      'Solution-aware',
      'Product-aware',
    ]);
    expect(getQuestionByPrompt('What channels are you currently running?').options).toEqual([
      'Meta',
      'Google',
      'LinkedIn',
      'Cold Email',
      'Outbound',
      'Organic',
      'Other (specify)',
    ]);
  });

  it('preserves value and unlock notes for every section', () => {
    for (const section of GTM_ONBOARDING_QUESTIONNAIRE) {
      expect(section.goal.length).toBeGreaterThan(0);
      expect(section.whyThisSetupWorks.length).toBeGreaterThan(0);
      expect(section.unlocks.length).toBeGreaterThan(0);
    }
  });

  it('keeps existing-field change notes where the document defines them', () => {
    expect(getGtmOnboardingSection('business-basics')?.existingFieldChanges).toEqual([
      'Business Model → Repurposed to How do customers buy?',
    ]);
    expect(getGtmOnboardingSection('offer-product-experience')?.existingFieldChanges).toEqual([
      'Pricing tiers → Moved to Pricing & Economics',
      'Monthly Ad Budget → Moved to Pricing & Economics',
      'Guarantees → Removed',
      'Monthly Revenue Range → Removed',
      'Paying Customer Count → Removed',
    ]);
    expect(getGtmOnboardingSection('goals-strategy')?.existingFieldChanges).toEqual([
      'Desired Transformation → Removed',
      'Before State → Removed',
      'Current Marketing Activities → Moved to Current Marketing & Performance',
    ]);
    expect(getGtmOnboardingSection('current-performance')?.existingFieldChanges).toEqual([
      'Last 12-Month Revenue Growth % → Last 3–6 months growth trend',
    ]);
  });

  it('keeps each question id unique while allowing repeated answer keys', () => {
    const ids = getGtmOnboardingQuestions().map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getGtmOnboardingQuestions()).toHaveLength(47);
  });
});
