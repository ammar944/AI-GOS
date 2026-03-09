import { describe, expect, it } from 'vitest';
import { normalizeSectionData } from '../normalize-section-data';

describe('normalizeSectionData', () => {
  it('returns typed data for a valid offer analysis payload', () => {
    const result = normalizeSectionData('offerAnalysis', {
      offerClarity: {
        clearlyArticulated: true,
        solvesRealPain: true,
        benefitsEasyToUnderstand: true,
        transformationMeasurable: true,
        valuePropositionObvious: true,
      },
      offerStrength: {
        painRelevance: 8,
        urgency: 7,
        differentiation: 6,
        tangibility: 8,
        proof: 5,
        pricingLogic: 7,
        overallScore: 7,
      },
      marketOfferFit: {
        marketWantsNow: true,
        competitorsOfferSimilar: true,
        priceMatchesExpectations: true,
        proofStrongForColdTraffic: false,
        transformationBelievable: true,
      },
      redFlags: ['weak_or_no_proof'],
      recommendation: {
        status: 'adjust_messaging',
        reasoning: 'The offer is credible but needs clearer proof.',
        actionItems: ['Rewrite the proof section on the landing page'],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        recommendation: expect.objectContaining({
          status: 'adjust_messaging',
        }),
      }),
    );
  });

  it('returns typed data for a valid strategic synthesis payload', () => {
    const result = normalizeSectionData('strategicSynthesis', {
      keyInsights: [
        {
          insight: 'The category is crowded on generic ROI language.',
          implication: 'Differentiate on speed to insight.',
          priority: 'high',
        },
      ],
      recommendedPositioning:
        'Position the offer as the fastest route to trusted pipeline visibility.',
      positioningStrategy: {
        primary: 'Own fast, operator-friendly attribution.',
        alternatives: ['Lead with onboarding support'],
        differentiators: ['Fast implementation'],
        avoidPositions: ['Generic all-in-one analytics'],
      },
      recommendedPlatforms: [
        {
          platform: 'LinkedIn',
          reasoning: 'The target buyer is highly concentrated there.',
          priority: 'primary',
        },
      ],
      potentialBlockers: ['Weak proof for colder audiences'],
      nextSteps: ['Package stronger customer proof before campaign launch'],
      messagingFramework: {
        coreMessage: 'Get trusted pipeline visibility faster than any other tool.',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        recommendedPositioning: expect.stringContaining('fastest route'),
      }),
    );
  });

  it('returns undefined when validation fails', () => {
    expect(() =>
      normalizeSectionData('offerAnalysis', {
        offerStrength: {
          painRelevance: 15,
        },
      }),
    ).not.toThrow();

    expect(
      normalizeSectionData('offerAnalysis', {
        offerStrength: {
          painRelevance: 15,
        },
      }),
    ).toBeUndefined();
  });

  it('is section-aware by section id', () => {
    const offerPayload = {
      offerClarity: {
        clearlyArticulated: true,
        solvesRealPain: true,
        benefitsEasyToUnderstand: true,
        transformationMeasurable: true,
        valuePropositionObvious: true,
      },
      offerStrength: {
        painRelevance: 8,
        urgency: 7,
        differentiation: 6,
        tangibility: 8,
        proof: 5,
        pricingLogic: 7,
        overallScore: 7,
      },
      marketOfferFit: {
        marketWantsNow: true,
        competitorsOfferSimilar: true,
        priceMatchesExpectations: true,
        proofStrongForColdTraffic: false,
        transformationBelievable: true,
      },
      redFlags: ['weak_or_no_proof'],
      recommendation: {
        status: 'adjust_messaging',
        reasoning: 'The offer is credible but needs clearer proof.',
        actionItems: ['Rewrite the proof section on the landing page'],
      },
    };

    expect(normalizeSectionData('offerAnalysis', offerPayload)).toBeDefined();
    expect(normalizeSectionData('strategicSynthesis', offerPayload)).toBeUndefined();
  });
});
