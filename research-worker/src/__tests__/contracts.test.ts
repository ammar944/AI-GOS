import { describe, expect, it } from 'vitest';
import { finalizeRunnerResult } from '../contracts';

describe('finalizeRunnerResult', () => {
  it('normalizes valid runner output to a canonical complete result', () => {
    const result = finalizeRunnerResult({
      section: 'crossAnalysis',
      durationMs: 1200,
      parsed: {
        keyInsights: [
          {
            insight: 'LinkedIn is the strongest starting point for this ICP.',
            source: 'icpValidation',
            implication: 'Start narrow and title-led.',
            priority: 'high',
          },
        ],
        positioningStrategy: {
          recommendedAngle: 'Own revenue accountability.',
          alternativeAngles: ['Speed-to-value'],
          leadRecommendation: 'It fits the research evidence best.',
          keyDifferentiator: 'Click-to-closed-won clarity.',
        },
        platformRecommendations: [
          {
            platform: 'LinkedIn',
            role: 'primary',
            budgetAllocation: '60% ($3,000)',
            rationale: 'The ICP is concentrated there.',
            priority: 1,
          },
        ],
        messagingAngles: [
          {
            angle: 'Revenue clarity',
            targetEmotion: 'Confidence',
            exampleHook: 'See where pipeline is leaking before finance does.',
            evidence: 'Research points to opaque reporting pain.',
          },
        ],
        criticalSuccessFactors: ['Tight CRM attribution'],
        nextSteps: ['Ship the launch asset pack'],
        strategicNarrative: 'Lead with trust and accountability.',
        planningContext: {
          monthlyBudget: '$5,000/month',
          downstreamSequence: ['keywordIntel', 'mediaPlan'],
        },
        citations: [
          {
            url: 'https://example.com/report',
            title: 'RevOps Report',
          },
        ],
      },
      rawText: '{"ok":true}',
    });

    expect(result).toMatchObject({
      status: 'complete',
      section: 'strategicSynthesis',
      provenance: {
        status: 'sourced',
        citationCount: 1,
      },
    });
  });

  it('returns partial when a runner payload fails schema validation', () => {
    const result = finalizeRunnerResult({
      section: 'competitors',
      durationMs: 950,
      parsed: {
        summary: 'Acme is strong.',
      },
      rawText: 'Acme is strong.',
    });

    expect(result).toMatchObject({
      status: 'partial',
      section: 'competitorIntel',
      validation: {
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'schema_validation' }),
        ]),
      },
      rawText: 'Acme is strong.',
    });
  });

  it('rejects non-canonical market overview enums in the worker contract', () => {
    const result = finalizeRunnerResult({
      section: 'industryResearch',
      durationMs: 1100,
      parsed: {
        categorySnapshot: {
          category: 'B2B SaaS demand generation agencies',
          marketMaturity: 'mature',
          buyingBehavior: 'multi-stakeholder evaluation',
          awarenessLevel: 'solution-aware to product-aware',
        },
        painPoints: {
          primary: ['Teams cannot trust attribution enough to scale spend.'],
        },
        marketDynamics: {
          demandDrivers: ['Pressure to prove CAC efficiency'],
          buyingTriggers: ['A new CMO needs better pipeline visibility'],
          barriersToPurchase: ['Tool fatigue'],
        },
        messagingOpportunities: {
          summaryRecommendations: ['Lead with accountable pipeline impact.'],
        },
      },
      rawText: '{"categorySnapshot":{"marketMaturity":"mature"}}',
    });

    expect(result).toMatchObject({
      status: 'partial',
      section: 'industryResearch',
      validation: {
        issues: expect.arrayContaining([
          expect.objectContaining({ path: 'categorySnapshot.marketMaturity' }),
        ]),
      },
    });
  });

  it('normalizes industry trend direction aliases before validation', () => {
    const result = finalizeRunnerResult({
      section: 'industryResearch',
      durationMs: 900,
      parsed: {
        categorySnapshot: {
          category: 'B2B SaaS demand generation agencies',
          marketMaturity: 'growing',
          buyingBehavior: 'committee_driven',
          awarenessLevel: 'high',
        },
        painPoints: {
          primary: ['Teams cannot trust attribution enough to scale spend.'],
        },
        marketDynamics: {
          demandDrivers: ['Pressure to prove CAC efficiency'],
          buyingTriggers: ['A new CMO needs better pipeline visibility'],
          barriersToPurchase: ['Tool fatigue'],
        },
        trendSignals: [
          {
            trend: 'Privacy-first measurement',
            description: 'steady',
            evidence: 'Buyers still expect first-party data strategies.',
          },
        ],
        messagingOpportunities: {
          summaryRecommendations: ['Lead with accountable pipeline impact.'],
        },
      },
      rawText: '{"trendSignals":[{"description":"steady"}]}',
    });

    expect(result).toMatchObject({
      status: 'complete',
      section: 'industryResearch',
      data: {
        trendSignals: [
          {
            trend: 'Privacy-first measurement',
            direction: 'stable',
            evidence: 'Buyers still expect first-party data strategies.',
          },
        ],
      },
    });
  });

  it('normalizes empty competitor ad platforms to an explicit missing-data marker', () => {
    const result = finalizeRunnerResult({
      section: 'competitorIntel',
      durationMs: 1400,
      parsed: {
        competitors: [
          {
            name: 'Sales Captain',
            website: 'https://www.salescaptain.com',
            positioning: 'AI-powered CX automation for SMB teams.',
            price: 'See pricing page',
            pricingConfidence: 'low',
            strengths: ['Strong automation story'],
            weaknesses: ['Weak B2B SaaS overlap'],
            opportunities: ['Differentiate on SaaS specialization'],
            ourAdvantage: 'Purpose-built for B2B SaaS pipeline generation.',
            adActivity: {
              activeAdCount: 0,
              platforms: [],
              themes: ['AI-powered lead management'],
              evidence:
                'Ad Library tool returned HTTP 400 errors. No direct ad platform evidence available.',
              sourceConfidence: 'low',
            },
            threatAssessment: {
              threatFactors: {
                marketShareRecognition: 3,
                adSpendIntensity: 3,
                productOverlap: 3,
                priceCompetitiveness: 4,
                growthTrajectory: 4,
              },
              topAdHooks: ['Automate customer communications'],
              counterPositioning: 'Lead with B2B SaaS specialization.',
            },
          },
        ],
        marketPatterns: ['Mixed overlap across the competitive set'],
        marketStrengths: ['Strong category positioning'],
        marketWeaknesses: ['Sparse verified ad evidence'],
        whiteSpaceGaps: [
          {
            gap: 'B2B SaaS-only positioning',
            type: 'audience',
            evidence: 'Several competitors serve broader SMB audiences.',
            exploitability: 8,
            impact: 8,
            recommendedAction: 'Lead with SaaS-only pipeline systems.',
          },
        ],
        overallLandscape: 'Fragmented competitive set with mixed overlap.',
      },
      rawText: '{"competitors":[{"name":"Sales Captain"}]}',
    });

    expect(result).toMatchObject({
      status: 'complete',
      section: 'competitorIntel',
      data: {
        competitors: [
          {
            adActivity: {
              platforms: ['Not verified'],
            },
          },
        ],
      },
    });
  });

  it('preserves enriched competitor ad evidence through worker finalization', () => {
    const result = finalizeRunnerResult({
      section: 'competitorIntel',
      durationMs: 2100,
      parsed: {
        competitors: [
          {
            name: 'Hey Digital',
            website: 'https://heydigital.com',
            positioning: 'B2B SaaS PPC agency',
            strengths: ['Strong case studies'],
            weaknesses: ['Limited platform coverage'],
            opportunities: ['Win on multi-channel'],
            ourAdvantage: 'Broader platform strategy.',
            adActivity: {
              activeAdCount: 8,
              platforms: ['LinkedIn', 'Google'],
              themes: ['Pipeline growth'],
              evidence: 'Observed 8 current ad-library records.',
              sourceConfidence: 'medium',
            },
            adCreatives: [
              {
                platform: 'meta',
                id: 'meta-1',
                advertiser: 'Hey Digital',
                headline: 'Pipeline growth without attribution guesswork',
                format: 'image',
                isActive: true,
                imageUrl: 'https://cdn.test/meta-1.jpg',
                detailsUrl: 'https://www.facebook.com/ads/library/?id=123',
              },
            ],
            libraryLinks: {
              metaLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=Hey%20Digital',
              linkedInLibraryUrl: 'https://www.linkedin.com/ad-library/search?keyword=Hey%20Digital',
              googleAdvertiserUrl: 'https://adstransparency.google.com/advertiser/AR123?region=US',
            },
          },
        ],
        whiteSpaceGaps: [
          {
            gap: 'Multi-channel strategy',
            type: 'channel',
            evidence: 'Competitors focus on single platforms.',
            exploitability: 8,
            impact: 7,
            recommendedAction: 'Lead with cross-platform proof.',
          },
        ],
      },
      rawText: '{"competitors":[{"name":"Hey Digital"}]}',
    });

    expect(result).toMatchObject({
      status: 'complete',
      section: 'competitorIntel',
      data: {
        competitors: [
          {
            name: 'Hey Digital',
            adCreatives: [
              {
                platform: 'meta',
                id: 'meta-1',
                advertiser: 'Hey Digital',
                headline: 'Pipeline growth without attribution guesswork',
                detailsUrl: 'https://www.facebook.com/ads/library/?id=123',
              },
            ],
            libraryLinks: {
              metaLibraryUrl: expect.stringContaining('facebook.com/ads/library'),
              linkedInLibraryUrl: expect.stringContaining('linkedin.com/ad-library'),
              googleAdvertiserUrl: expect.stringContaining('adstransparency.google.com'),
            },
          },
        ],
      },
    });
  });

  it('preserves telemetry metadata on valid runner output', () => {
    const result = finalizeRunnerResult({
      section: 'crossAnalysis',
      durationMs: 1200,
      parsed: {
        keyInsights: [
          {
            insight: 'LinkedIn is the strongest starting point for this ICP.',
            source: 'icpValidation',
            implication: 'Start narrow and title-led.',
            priority: 'high',
          },
        ],
        positioningStrategy: {
          recommendedAngle: 'Own revenue accountability.',
          alternativeAngles: ['Speed-to-value'],
          leadRecommendation: 'It fits the research evidence best.',
          keyDifferentiator: 'Click-to-closed-won clarity.',
        },
        platformRecommendations: [
          {
            platform: 'LinkedIn',
            role: 'primary',
            budgetAllocation: '60% ($3,000)',
            rationale: 'The ICP is concentrated there.',
            priority: 1,
          },
        ],
        messagingAngles: [
          {
            angle: 'Revenue clarity',
            targetEmotion: 'Confidence',
            exampleHook: 'See where pipeline is leaking before finance does.',
            evidence: 'Research points to opaque reporting pain.',
          },
        ],
        criticalSuccessFactors: ['Tight CRM attribution'],
        nextSteps: ['Ship the launch asset pack'],
        strategicNarrative: 'Lead with trust and accountability.',
        planningContext: {
          monthlyBudget: '$5,000/month',
          downstreamSequence: ['keywordIntel', 'mediaPlan'],
        },
        charts: [
          {
            chartType: 'pie',
            title: 'Budget Allocation',
            imageUrl: 'https://cdn.example.com/pie.png',
            description: 'Channel budget split.',
          },
        ],
        citations: [
          {
            url: 'https://example.com/report',
            title: 'RevOps Report',
          },
        ],
      },
      rawText: '{"ok":true}',
      telemetry: {
        model: 'claude-sonnet-4-6',
        usage: {
          inputTokens: 2100,
          outputTokens: 900,
          totalTokens: 3000,
          cacheCreationInputTokens: 200,
          cacheReadInputTokens: 100,
        },
        estimatedCostUsd: 0.0234,
        charts: [
          {
            chartType: 'pie',
            title: 'Budget Allocation',
            imageUrl: 'https://cdn.example.com/pie.png',
          },
        ],
      },
    });

    expect(result).toMatchObject({
      status: 'complete',
      section: 'strategicSynthesis',
      telemetry: {
        model: 'claude-sonnet-4-6',
        usage: {
          inputTokens: 2100,
          outputTokens: 900,
          totalTokens: 3000,
          cacheCreationInputTokens: 200,
          cacheReadInputTokens: 100,
        },
        estimatedCostUsd: 0.0234,
        charts: [
          {
            chartType: 'pie',
            title: 'Budget Allocation',
            imageUrl: 'https://cdn.example.com/pie.png',
          },
        ],
      },
    });
  });
});
