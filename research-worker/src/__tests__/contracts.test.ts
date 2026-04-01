import { describe, expect, it } from 'vitest';
import { finalizeRunnerResult } from '../contracts';
import { z } from 'zod';

// ── ICP segments schema ───────────────────────────────────────────────────────

describe('icpValidation segments field', () => {
  const baseIcpPayload = {
    validatedPersona: 'B2B SaaS VP of Marketing at 50-500 employee companies',
    demographics: 'US-based, mid-market SaaS, $5M-$50M ARR',
    channels: ['LinkedIn', 'Google'],
    triggers: ['New CMO hire', 'Series B funding'],
    objections: ['Too expensive for our stage'],
    decisionFactors: [{ factor: 'ROI proof', relevance: 90 }],
    audienceSize: 'Medium',
    confidenceScore: 75,
    decisionProcess: 'Marketing lead evaluates, CFO approves budgets over $50k',
  };

  it('validates ICP data without segments (backward compat — old format)', () => {
    const result = finalizeRunnerResult({
      section: 'icpValidation',
      durationMs: 1100,
      parsed: baseIcpPayload,
      rawText: JSON.stringify(baseIcpPayload),
    });
    expect(result.status).toBe('complete');
    expect(result.section).toBe('icpValidation');
    // segments should be absent on old data
    expect((result as { data?: { segments?: unknown } }).data?.segments).toBeUndefined();
  });

  it('validates ICP data with a single segment', () => {
    const payload = {
      ...baseIcpPayload,
      segments: [
        {
          productLine: 'Pipeline Analytics',
          validatedPersona: 'VP Marketing at mid-market SaaS',
          audienceSize: 'Medium',
          confidence: 80,
          channels: ['LinkedIn', 'Google'],
          triggers: ['New CMO hire'],
          objections: ['Too expensive'],
        },
      ],
    };
    const result = finalizeRunnerResult({
      section: 'icpValidation',
      durationMs: 1200,
      parsed: payload,
      rawText: JSON.stringify(payload),
    });
    expect(result.status).toBe('complete');
    expect((result as { data?: { segments?: unknown[] } }).data?.segments).toHaveLength(1);
  });

  it('validates ICP data with multiple segments (multi-product business)', () => {
    const payload = {
      ...baseIcpPayload,
      validatedPersona: 'B2B SaaS VP of Marketing (primary segment)',
      segments: [
        {
          productLine: 'Pipeline Analytics',
          validatedPersona: 'VP Marketing at mid-market SaaS companies ($5M-$50M ARR)',
          audienceSize: 'Medium',
          confidence: 82,
          channels: ['LinkedIn', 'Google'],
          triggers: ['New CMO hire', 'Series B funding'],
          objections: ['Existing BI tools cover this'],
        },
        {
          productLine: 'Ad Attribution',
          validatedPersona: 'Performance marketing managers at D2C e-commerce brands',
          audienceSize: 'Large',
          confidence: 71,
          channels: ['Meta', 'Google'],
          triggers: ['iOS privacy changes', 'Rising CAC'],
          objections: ['We already use Triple Whale'],
        },
      ],
    };
    const result = finalizeRunnerResult({
      section: 'icpValidation',
      durationMs: 1500,
      parsed: payload,
      rawText: JSON.stringify(payload),
    });
    expect(result.status).toBe('complete');
    const segments = (result as { data?: { segments?: unknown[] } }).data?.segments;
    expect(segments).toHaveLength(2);
  });

  it('rejects a segment missing required productLine field', () => {
    const payload = {
      ...baseIcpPayload,
      segments: [
        {
          // productLine intentionally omitted
          validatedPersona: 'VP Marketing at mid-market SaaS',
          audienceSize: 'Medium',
          confidence: 80,
          channels: ['LinkedIn'],
          triggers: ['New CMO hire'],
          objections: ['Too expensive'],
        },
      ],
    };
    const result = finalizeRunnerResult({
      section: 'icpValidation',
      durationMs: 1000,
      parsed: payload,
      rawText: JSON.stringify(payload),
    });
    // Should fail validation due to missing productLine
    expect(result.status).toBe('partial');
  });

  it('rejects a segment with confidence out of 0-100 range', () => {
    const payload = {
      ...baseIcpPayload,
      segments: [
        {
          productLine: 'Pipeline Analytics',
          validatedPersona: 'VP Marketing',
          audienceSize: 'Medium',
          confidence: 150, // invalid — over 100
          channels: ['LinkedIn'],
          triggers: ['New CMO'],
          objections: ['Expensive'],
        },
      ],
    };
    const result = finalizeRunnerResult({
      section: 'icpValidation',
      durationMs: 1000,
      parsed: payload,
      rawText: JSON.stringify(payload),
    });
    expect(result.status).toBe('partial');
  });
});

// ── Reviews schema ────────────────────────────────────────────────────────────

const reviewsSchema = z.object({
  trustpilot: z.object({
    rating: z.number().min(0).max(5).optional(),
    reviewCount: z.number().nonnegative().optional(),
    recentThemes: z.array(z.string()).optional(),
    url: z.string().optional(),
  }).optional(),
  g2: z.object({
    rating: z.number().min(0).max(5).optional(),
    reviewCount: z.number().nonnegative().optional(),
    categories: z.array(z.string()).optional(),
    url: z.string().optional(),
  }).optional(),
  capterra: z.object({
    rating: z.number().min(0).max(5).optional(),
    reviewCount: z.number().nonnegative().optional(),
    categories: z.array(z.string()).optional(),
    url: z.string().optional(),
  }).optional(),
  negativeReviews: z.array(z.object({
    text: z.string(),
    rating: z.number().min(1).max(3),
    date: z.string().optional(),
    source: z.enum(['g2', 'capterra', 'trustpilot']),
  })).max(5).optional(),
});

describe('reviews schema', () => {
  it('accepts capterra data alongside trustpilot and g2', () => {
    const result = reviewsSchema.safeParse({
      trustpilot: { rating: 4.2, reviewCount: 1200, url: 'https://www.trustpilot.com/review/example.com' },
      g2: { rating: 4.5, reviewCount: 300, categories: ['CRM'], url: 'https://www.g2.com/products/example' },
      capterra: { rating: 4.3, reviewCount: 500, categories: ['Sales Software'], url: 'https://www.capterra.com/p/12345/example/' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts capterra without trustpilot or g2 (optional fields)', () => {
    const result = reviewsSchema.safeParse({
      capterra: { rating: 4.1, reviewCount: 250, url: 'https://www.capterra.com/p/99/tool/' },
    });
    expect(result.success).toBe(true);
  });

  it('passes validation when negativeReviews is undefined (backward compat)', () => {
    const result = reviewsSchema.safeParse({
      g2: { rating: 4.0, reviewCount: 100 },
    });
    expect(result.success).toBe(true);
    expect(result.data?.negativeReviews).toBeUndefined();
  });

  it('accepts negativeReviews with ratings 1-3', () => {
    const result = reviewsSchema.safeParse({
      negativeReviews: [
        { text: 'Too expensive for what it offers.', rating: 2, source: 'g2' },
        { text: 'Slow customer support.', rating: 1, date: '2024-11', source: 'capterra' },
        { text: 'Limited integrations.', rating: 3, source: 'trustpilot' },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data?.negativeReviews).toHaveLength(3);
  });

  it('rejects negativeReviews with rating above 3', () => {
    const result = reviewsSchema.safeParse({
      negativeReviews: [
        { text: 'Pretty good actually.', rating: 4, source: 'g2' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects negativeReviews with rating below 1', () => {
    const result = reviewsSchema.safeParse({
      negativeReviews: [
        { text: 'Zero stars.', rating: 0, source: 'capterra' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 5 negative reviews', () => {
    const result = reviewsSchema.safeParse({
      negativeReviews: [1, 2, 3, 4, 5, 6].map((i) => ({
        text: `Review ${i}`,
        rating: 2,
        source: 'g2' as const,
      })),
    });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 5 negative reviews', () => {
    const result = reviewsSchema.safeParse({
      negativeReviews: [1, 2, 3, 4, 5].map((i) => ({
        text: `Review ${i}`,
        rating: 1 + ((i - 1) % 3),
        source: (['g2', 'capterra', 'trustpilot', 'g2', 'capterra'] as const)[i - 1],
      })),
    });
    expect(result.success).toBe(true);
  });
});

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
