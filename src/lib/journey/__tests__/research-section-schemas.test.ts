import { describe, expect, it } from 'vitest';
import {
  JOURNEY_SECTION_DATA_SCHEMAS,
  type JourneySectionDataMap,
} from '../schemas';

describe('JOURNEY_SECTION_DATA_SCHEMAS', () => {
  it('includes every canonical Journey research section', () => {
    expect(Object.keys(JOURNEY_SECTION_DATA_SCHEMAS).sort()).toEqual([
      'competitorIntel',
      'icpValidation',
      'industryResearch',
      'keywordIntel',
      'mediaPlan',
      'offerAnalysis',
      'strategicSynthesis',
    ]);
  });

  it.each([
    [
      'industryResearch',
      {
        categorySnapshot: {
          category: 'B2B SaaS analytics',
          marketMaturity: 'growing',
          awarenessLevel: 'medium',
          averageSalesCycle: '30-60 days',
        },
        marketDynamics: {
          demandDrivers: ['Pressure to prove pipeline impact'],
          buyingTriggers: ['Missed quarterly revenue targets'],
          barriersToPurchase: ['Tool fatigue'],
        },
        painPoints: {
          primary: ['Leads are not converting predictably'],
          secondary: ['Reporting is fragmented'],
        },
        messagingOpportunities: {
          summaryRecommendations: ['Lead with revenue visibility and signal quality'],
        },
      } satisfies JourneySectionDataMap['industryResearch'],
    ],
    [
      'competitorIntel',
      {
        competitors: [
          {
            name: 'PipelinePro',
            strengths: ['Strong category awareness'],
            weaknesses: ['Weak onboarding depth'],
            opportunities: ['Win on implementation speed'],
          },
        ],
        marketStrengths: ['Buyers understand the category'],
        marketWeaknesses: ['Most vendors sound interchangeable'],
        whiteSpaceGaps: ['Faster time-to-value messaging'],
      } satisfies JourneySectionDataMap['competitorIntel'],
    ],
    [
      'icpValidation',
      {
        validatedPersona: 'VP of Marketing at growth-stage SaaS companies',
        demographics: 'US-based B2B SaaS leaders with lean in-house teams',
        channels: ['LinkedIn'],
        triggers: ['Board pressure to improve pipeline efficiency'],
        objections: ['We already have attribution tools'],
        decisionFactors: [{ factor: 'Speed to impact', relevance: 88 }],
        audienceSize: 'Medium',
        confidenceScore: 82,
        decisionProcess: 'Marketing leader shortlists, founder approves',
      } satisfies JourneySectionDataMap['icpValidation'],
    ],
    [
      'offerAnalysis',
      {
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
          proof: 6,
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
          reasoning: 'The offer is credible, but proof needs to be more explicit.',
          actionItems: ['Lead with quantified proof on landing pages'],
        },
      } satisfies JourneySectionDataMap['offerAnalysis'],
    ],
    [
      'strategicSynthesis',
      {
        keyInsights: [
          {
            insight: 'Buyers want faster proof of ROI than competitors promise.',
            implication: 'Lead with speed-to-value in paid media.',
            priority: 'high',
          },
        ],
        recommendedPositioning:
          'Position the offer as the fastest path to trustworthy pipeline visibility.',
        positioningStrategy: {
          primary:
            'Own the category around fast, operator-friendly revenue visibility.',
          alternatives: ['Differentiate on implementation support'],
          differentiators: ['Faster deployment'],
          avoidPositions: ['Generic all-in-one analytics'],
        },
        recommendedPlatforms: [
          {
            platform: 'LinkedIn',
            reasoning: 'Core buyers are concentrated there.',
            priority: 'primary',
          },
        ],
        potentialBlockers: ['Thin proof library for cold traffic'],
        nextSteps: ['Refresh proof and case studies before scaling spend'],
        messagingFramework: {
          coreMessage: 'Get trustworthy pipeline visibility in days, not months.',
        },
      } satisfies JourneySectionDataMap['strategicSynthesis'],
    ],
    [
      'keywordIntel',
      {
        keywords: [{ keyword: 'marketing attribution software' }],
        quickWins: [{ keyword: 'b2b attribution tool', opportunity: 82 }],
        highIntentKeywords: [{ keyword: 'best b2b attribution software' }],
        clientStrengths: [{ keyword: 'fast attribution setup' }],
        contentTopicClusters: [{ theme: 'ROI reporting', keywords: ['pipeline reporting'] }],
        metadata: { totalKeywordsAnalyzed: 24 },
      } satisfies JourneySectionDataMap['keywordIntel'],
    ],
    [
      'mediaPlan',
      {
        allocations: [{ channel: 'LinkedIn', percentage: 60 }],
        totalBudget: '$10,000/mo',
        timeline: ['Week 1: launch ICP tests'],
        kpis: [{ channel: 'LinkedIn', target: '< $300 CPL' }],
        testingPlan: ['Test speed-to-value vs. proof-led hooks'],
      } satisfies JourneySectionDataMap['mediaPlan'],
    ],
  ])('accepts a representative payload for %s', (sectionId, payload) => {
    const result = JOURNEY_SECTION_DATA_SCHEMAS[
      sectionId as keyof typeof JOURNEY_SECTION_DATA_SCHEMAS
    ].safeParse(payload);

    expect(result.success).toBe(true);
  });

  it('rejects an invalid wave 1 payload', () => {
    const result = JOURNEY_SECTION_DATA_SCHEMAS.offerAnalysis.safeParse({
      offerStrength: {
        painRelevance: 11,
      },
    });

    expect(result.success).toBe(false);
  });
});
