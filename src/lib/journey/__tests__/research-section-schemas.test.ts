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
            website: 'https://pipelinepro.test',
            positioning: 'Fast attribution for growth-stage SaaS teams',
            price: '$499/mo',
            pricingConfidence: 'high',
            strengths: ['Strong category awareness'],
            weaknesses: ['Weak onboarding depth'],
            opportunities: ['Win on implementation speed'],
            ourAdvantage: 'Lead with faster time-to-value and clearer attribution proof.',
            adActivity: {
              activeAdCount: 14,
              platforms: ['LinkedIn', 'Google'],
              themes: ['Revenue visibility', 'Faster implementation'],
              evidence:
                'SearchAPI and ad-library enrichment both show active prospecting creatives.',
              sourceConfidence: 'high',
            },
            threatAssessment: {
              threatFactors: {
                marketShareRecognition: 7,
                adSpendIntensity: 6,
                productOverlap: 8,
                priceCompetitiveness: 5,
                growthTrajectory: 6,
              },
              topAdHooks: ['Fix attribution before the board meeting'],
              counterPositioning:
                'Position against their slow onboarding and enterprise-heavy setup.',
            },
            adCreatives: [
              {
                platform: 'meta',
                id: 'meta-1',
                advertiser: 'PipelinePro',
                headline: 'Fix attribution before the board meeting',
                format: 'image',
                isActive: true,
                imageUrl: 'https://cdn.test/meta-1.jpg',
                detailsUrl: 'https://www.facebook.com/ads/library/?id=123',
              },
            ],
            libraryLinks: {
              metaLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=PipelinePro',
              linkedInLibraryUrl: 'https://www.linkedin.com/ad-library/search?keyword=PipelinePro',
              googleAdvertiserUrl: 'https://adstransparency.google.com/advertiser/AR123?region=US',
            },
          },
        ],
        marketPatterns: ['Most vendors default to platform-first messaging'],
        marketStrengths: ['Buyers already understand the category'],
        marketWeaknesses: ['Most positioning sounds interchangeable'],
        whiteSpaceGaps: [
          {
            gap: 'Faster time-to-value messaging',
            type: 'messaging',
            evidence: 'Review complaints center on slow onboarding and implementation drag.',
            exploitability: 8,
            impact: 9,
            recommendedAction: 'Lead with launch speed in paid creative and landing page proof.',
          },
        ],
        overallLandscape:
          'Crowded market with strong demand but weak differentiation on onboarding speed.',
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
        offerStrength: {
          painRelevance: 8,
          urgency: 7,
          differentiation: 6,
          tangibility: 8,
          proof: 6,
          pricingLogic: 7,
          overallScore: 7,
        },
        recommendation: {
          status: 'needs-work',
          summary: 'The offer is credible, but it needs stronger proof and a clearer launch plan.',
          topStrengths: ['Clear operational pain solved', 'Pricing is in-market'],
          priorityFixes: ['Add quantified proof to the landing page'],
          recommendedActionPlan: [
            'Rewrite the hero section around a measurable before/after outcome.',
          ],
        },
        redFlags: [
          {
            issue: 'Thin proof for cold traffic',
            severity: 'high',
            priority: 1,
            recommendedAction: 'Add quantified case-study proof to the offer page.',
            launchBlocker: true,
            evidence: 'The current page has no outcome metrics or named customer proof.',
          },
        ],
        pricingAnalysis: {
          currentPricing: '$3,000/month',
          marketBenchmark: '$2,000-$4,500/month',
          pricingPosition: 'mid-market',
          coldTrafficViability:
            'Viable if the landing page carries stronger proof and a tighter promise.',
        },
        marketFitAssessment:
          'The market wants the outcome, but the current package needs more proof to convert cold traffic.',
        messagingRecommendations: [
          'Lead with the measurable revenue outcome before listing deliverables.',
        ],
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
        positioningStrategy: {
          recommendedAngle:
            'Position the offer as the fastest path to trustworthy pipeline visibility.',
          alternativeAngles: ['Differentiate on implementation support'],
          leadRecommendation:
            'Speed-to-value is the sharpest gap against competitor onboarding friction.',
          keyDifferentiator: 'Faster deployment with revenue-accountable reporting.',
        },
        platformRecommendations: [
          {
            platform: 'LinkedIn',
            role: 'primary',
            budgetAllocation: '60% ($3,000)',
            rationale: 'Core buyers are concentrated there.',
            priority: 1,
          },
        ],
        messagingAngles: [
          {
            angle: 'Faster proof of pipeline impact',
            targetEmotion: 'Confidence',
            exampleHook: 'Get trustworthy attribution before next month’s board review.',
            evidence: 'Review and interview data both highlight proof and reporting anxiety.',
          },
        ],
        planningContext: {
          monthlyBudget: '$5,000/month',
          targetCpl: '$300',
          targetCac: '$2,000',
          downstreamSequence: ['keywordIntel', 'mediaPlan'],
        },
        nextSteps: ['Refresh proof and case studies before scaling spend'],
        criticalSuccessFactors: ['Thin proof library for cold traffic'],
        strategicNarrative:
          'Position the offer around trust and speed, then use LinkedIn plus search to capture demand.',
      } satisfies JourneySectionDataMap['strategicSynthesis'],
    ],
    [
      'keywordIntel',
      {
        totalKeywordsFound: 24,
        competitorGapCount: 6,
        campaignGroups: [
          {
            campaign: 'Core High-Intent Search',
            intent: 'bottom-of-funnel',
            recommendedMonthlyBudget: 2500,
            adGroups: [
              {
                name: 'Attribution Software',
                recommendedMatchTypes: ['phrase', 'exact'],
                keywords: [
                  {
                    keyword: 'marketing attribution software',
                    searchVolume: 2400,
                    estimatedCpc: '$18.40',
                    difficulty: 'high',
                    priorityScore: 91,
                    confidence: 'high',
                  },
                ],
                negativeKeywords: ['free', 'jobs'],
              },
            ],
          },
        ],
        topOpportunities: [
          {
            keyword: 'marketing attribution software',
            searchVolume: 2400,
            estimatedCpc: '$18.40',
            difficulty: 'high',
            priorityScore: 91,
            confidence: 'high',
          },
        ],
        recommendedStartingSet: [
          {
            keyword: 'marketing attribution software',
            campaign: 'Core High-Intent Search',
            adGroup: 'Attribution Software',
            recommendedMonthlyBudget: 900,
            reason: 'Highest-intent head term with strong budget fit.',
            priorityScore: 91,
          },
        ],
        competitorGaps: [
          {
            keyword: 'dreamdata alternative',
            competitorName: 'Dreamdata',
            searchVolume: 320,
            estimatedCpc: '$16.20',
            priorityScore: 84,
          },
        ],
        negativeKeywords: [
          {
            keyword: 'free',
            reason: 'Low purchase intent',
          },
        ],
        confidenceNotes: ['Competitor gap volumes are directional because SpyFu coverage is sparse.'],
        quickWins: ['Launch competitor alternative ad groups first.'],
      } satisfies JourneySectionDataMap['keywordIntel'],
    ],
    [
      'mediaPlan',
      {
        channelPlan: [
          {
            platform: 'LinkedIn',
            role: 'primary',
            monthlyBudget: 3000,
            budgetPercentage: 60,
            campaignStructure: {
              campaigns: [
                {
                  name: 'RevOps Demand Gen',
                  type: 'lead-generation',
                  dailyBudget: 100,
                  targeting: 'Revenue leaders at B2B SaaS companies',
                  bidStrategy: 'Maximize leads',
                },
              ],
            },
          },
        ],
        launchSequence: [
          {
            week: 1,
            actions: ['Launch LinkedIn retargeting and search capture'],
            milestone: 'Launch',
          },
        ],
        kpiFramework: {
          northStar: 'Qualified pipeline generated',
          weeklyReview: ['Review CPL by audience', 'Check CRM attribution integrity'],
        },
        budgetSummary: {
          totalMonthly: 5000,
          byPlatform: [
            { platform: 'LinkedIn', amount: 3000, percentage: 60 },
            { platform: 'Google Search', amount: 2000, percentage: 40 },
          ],
        },
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
