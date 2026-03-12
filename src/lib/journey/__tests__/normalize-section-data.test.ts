import { describe, expect, it } from 'vitest';
import { normalizeSectionData } from '../normalize-section-data';

describe('normalizeSectionData', () => {
  it('returns typed data for a valid offer analysis payload', () => {
    const result = normalizeSectionData('offerAnalysis', {
      offerStrength: {
        painRelevance: 8,
        urgency: 7,
        differentiation: 6,
        tangibility: 8,
        proof: 5,
        pricingLogic: 7,
        overallScore: 7,
      },
      redFlags: [
        {
          issue: 'Proof is thin for cold traffic',
          severity: 'medium',
          priority: 1,
          recommendedAction: 'Add quantified proof to the landing page.',
          launchBlocker: false,
        },
      ],
      recommendation: {
        status: 'adjust-messaging',
        summary: 'The offer is credible but needs clearer proof.',
        topStrengths: ['Clear transformation promise'],
        priorityFixes: ['Rewrite the proof section on the landing page'],
        recommendedActionPlan: ['Refresh case studies'],
      },
      pricingAnalysis: {
        currentPricing: '$999/mo',
        marketBenchmark: '$1,200/mo',
        pricingPosition: 'mid-market',
        coldTrafficViability: 'Viable with stronger proof.',
      },
      marketFitAssessment: 'Good fit for paid acquisition with better credibility.',
      messagingRecommendations: ['Lead with attributable revenue outcomes'],
    });

    expect(result).toEqual(
      expect.objectContaining({
        recommendation: expect.objectContaining({
          status: 'adjust-messaging',
        }),
      }),
    );
  });

  it('returns typed data for a valid strategic synthesis payload', () => {
    const result = normalizeSectionData('strategicSynthesis', {
      keyInsights: [
        {
          insight: 'The category is crowded on generic ROI language.',
          source: 'competitorIntel',
          implication: 'Differentiate on speed to insight.',
          priority: 'high',
        },
      ],
      positioningStrategy: {
        recommendedAngle:
          'Position the offer as the fastest route to trusted pipeline visibility.',
        alternativeAngles: ['Lead with onboarding support'],
        leadRecommendation: 'Anchor the launch story in speed and confidence.',
        keyDifferentiator: 'Fast implementation',
      },
      platformRecommendations: [
        {
          platform: 'LinkedIn',
          role: 'primary',
          budgetAllocation: '60% ($3,000)',
          rationale: 'The target buyer is highly concentrated there.',
          priority: 1,
        },
      ],
      messagingAngles: [
        {
          angle: 'Speed to trusted attribution',
          targetEmotion: 'Confidence',
          exampleHook: 'Get revenue visibility before the quarter closes.',
          evidence: 'Category messaging is generic on ROI claims.',
        },
      ],
      planningContext: {
        monthlyBudget: '$5,000/month',
        downstreamSequence: ['keywordIntel', 'mediaPlan'],
      },
      criticalSuccessFactors: ['Tight CRM attribution'],
      nextSteps: ['Package stronger customer proof before campaign launch'],
      strategicNarrative:
        'Position the offer as the fastest route to trusted pipeline visibility.',
    });

    expect(result).toEqual(
      expect.objectContaining({
        positioningStrategy: expect.objectContaining({
          recommendedAngle: expect.stringContaining('fastest route'),
        }),
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
      offerStrength: {
        painRelevance: 8,
        urgency: 7,
        differentiation: 6,
        tangibility: 8,
        proof: 5,
        pricingLogic: 7,
        overallScore: 7,
      },
      redFlags: [
        {
          issue: 'Proof is thin for cold traffic',
          severity: 'medium',
          priority: 1,
          recommendedAction: 'Add quantified proof to the landing page.',
          launchBlocker: false,
        },
      ],
      recommendation: {
        status: 'adjust-messaging',
        summary: 'The offer is credible but needs clearer proof.',
        topStrengths: ['Clear transformation promise'],
        priorityFixes: ['Rewrite the proof section on the landing page'],
        recommendedActionPlan: ['Refresh case studies'],
      },
      pricingAnalysis: {
        currentPricing: '$999/mo',
        marketBenchmark: '$1,200/mo',
        pricingPosition: 'mid-market',
        coldTrafficViability: 'Viable with stronger proof.',
      },
      marketFitAssessment: 'Good fit for paid acquisition with better credibility.',
      messagingRecommendations: ['Lead with attributable revenue outcomes'],
    };

    expect(normalizeSectionData('offerAnalysis', offerPayload)).toBeDefined();
    expect(normalizeSectionData('strategicSynthesis', offerPayload)).toBeUndefined();
  });
});
