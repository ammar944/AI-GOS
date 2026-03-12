import { describe, expect, it } from 'vitest';
import {
  applyJourneyPrefillProposals,
  buildJourneyPrefillProposals,
  buildJourneyPrefillProposalsFromState,
} from '../prefill';
import { createEmptyState } from '../session-state';

describe('journey prefill helpers', () => {
  it('maps company research fields into journey proposal cards', () => {
    const proposals = buildJourneyPrefillProposals({
      companyName: {
        value: 'Acme AI',
        confidence: 94,
        sourceUrl: 'https://acme.com',
        reasoning: 'Found in the homepage hero copy.',
      },
      pricingTiers: {
        value: '$499/mo',
        confidence: 88,
        sourceUrl: 'https://acme.com/pricing',
        reasoning: 'Found on the public pricing page.',
      },
    });

    expect(proposals).toEqual([
      {
        fieldName: 'companyName',
        label: 'Company Name',
        value: 'Acme AI',
        confidence: 94,
        sourceUrl: 'https://acme.com',
        reasoning: 'Found in the homepage hero copy.',
      },
      {
        fieldName: 'pricingTiers',
        label: 'Pricing Tiers',
        value: '$499/mo',
        confidence: 88,
        sourceUrl: 'https://acme.com/pricing',
        reasoning: 'Found on the public pricing page.',
      },
    ]);
  });

  it('merges prefill output directly into journey state fields', () => {
    const next = applyJourneyPrefillProposals(createEmptyState(), {
      companyName: {
        value: 'Acme AI',
        confidence: 94,
        sourceUrl: 'https://acme.com',
        reasoning: 'Found in the homepage hero copy.',
      },
      businessModel: {
        value: 'B2B SaaS',
        confidence: 85,
        sourceUrl: 'https://acme.com/about',
        reasoning: 'Found on about page.',
      },
    });

    // applyJourneyPrefillProposals does a shallow merge into OnboardingState.
    // Fields in RESEARCH_TO_JOURNEY_MAP that also exist on OnboardingState are merged.
    expect(next.companyName).toBe('Acme AI');
    expect(next.businessModel).toBe('B2B SaaS');
    // Unrelated fields remain unchanged
    expect(next.industry).toBeNull();
  });

  it('filters out unsourced prefill values from the review step', () => {
    const proposals = buildJourneyPrefillProposals({
      companyName: {
        value: 'Acme AI',
        confidence: 94,
        sourceUrl: null,
        reasoning: 'No direct source was captured.',
      },
      pricingTiers: {
        value: '$499/mo',
        confidence: 88,
        sourceUrl: 'https://acme.com/pricing',
        reasoning: 'Found on the public pricing page.',
      },
    });

    // companyName has null sourceUrl — filtered out
    expect(proposals).toEqual([
      {
        fieldName: 'pricingTiers',
        label: 'Pricing Tiers',
        value: '$499/mo',
        confidence: 88,
        sourceUrl: 'https://acme.com/pricing',
        reasoning: 'Found on the public pricing page.',
      },
    ]);
  });

  it('rebuilds review proposals from saved journey state', () => {
    const state = applyJourneyPrefillProposals(createEmptyState(), {
      companyName: {
        value: 'Acme AI',
        confidence: 94,
        sourceUrl: 'https://acme.com',
        reasoning: 'Found in the homepage hero copy.',
      },
    });

    // buildJourneyPrefillProposalsFromState reads from OnboardingState fields directly,
    // using confidence: 70 and a generic reasoning string (no sourceUrl available from state)
    expect(buildJourneyPrefillProposalsFromState(state)).toEqual([
      {
        fieldName: 'companyName',
        label: 'Company Name',
        value: 'Acme AI',
        confidence: 70,
        sourceUrl: null,
        reasoning: 'Restored from saved journey state.',
      },
    ]);
  });
});
