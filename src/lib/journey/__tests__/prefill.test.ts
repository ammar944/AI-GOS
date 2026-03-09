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
      pricing: {
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
        label: 'Pricing',
        value: '$499/mo',
        confidence: 88,
        sourceUrl: 'https://acme.com/pricing',
        reasoning: 'Found on the public pricing page.',
      },
    ]);
  });

  it('stores prefill output as proposals instead of confirmed journey fields', () => {
    const next = applyJourneyPrefillProposals(createEmptyState(), {
      companyName: {
        value: 'Acme AI',
        confidence: 94,
        sourceUrl: 'https://acme.com',
        reasoning: 'Found in the homepage hero copy.',
      },
      headquartersLocation: {
        value: 'Austin, TX',
        confidence: 81,
        sourceUrl: 'https://linkedin.com/company/acme',
        reasoning: 'Found on LinkedIn.',
      },
    });

    expect(next.companyName).toBeNull();
    expect(next.geography).toBeNull();
    expect(next.proposals.companyName?.value).toBe('Acme AI');
    expect(next.proposals.geography?.value).toBe('Austin, TX');
    expect(next.fieldMeta.companyName?.status).toBe('proposed');
    expect(next.fieldMeta.geography?.source).toBe('linkedin');
  });

  it('filters out unsourced prefill values from the review step', () => {
    const proposals = buildJourneyPrefillProposals({
      companyName: {
        value: 'Acme AI',
        confidence: 94,
        sourceUrl: null,
        reasoning: 'No direct source was captured.',
      },
      pricing: {
        value: '$499/mo',
        confidence: 88,
        sourceUrl: 'https://acme.com/pricing',
        reasoning: 'Found on the public pricing page.',
      },
    });

    expect(proposals).toEqual([
      {
        fieldName: 'pricingTiers',
        label: 'Pricing',
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

    expect(buildJourneyPrefillProposalsFromState(state)).toEqual([
      {
        fieldName: 'companyName',
        label: 'Company Name',
        value: 'Acme AI',
        confidence: 94,
        sourceUrl: 'https://acme.com',
        reasoning: 'Found in the homepage hero copy.',
      },
    ]);
  });
});
