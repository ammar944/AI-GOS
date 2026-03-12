import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const validIndustryResearchResult = {
  status: 'complete',
  section: 'industryMarket',
  durationMs: 1,
  data: {
    categorySnapshot: {
      category: 'Revenue attribution',
      marketMaturity: 'growing',
      awarenessLevel: 'high',
      buyingBehavior: 'committee_driven',
    },
    marketDynamics: {
      demandDrivers: ['Pressure to prove ROI'],
      buyingTriggers: ['New revenue leader hired'],
      barriersToPurchase: ['Tool fatigue'],
    },
    painPoints: {
      primary: ['Revenue teams lack trustworthy attribution'],
    },
    messagingOpportunities: {
      summaryRecommendations: ['Lead with revenue visibility'],
    },
  },
} as const;

const validCompetitorIntelResult = {
  status: 'complete',
  section: 'competitors',
  durationMs: 1,
  data: {
    competitors: [
      {
        name: 'Dreamdata',
        website: 'https://dreamdata.io',
        positioning: 'Revenue attribution for B2B SaaS',
        strengths: ['Category awareness'],
        weaknesses: ['Complex onboarding'],
        opportunities: ['Own speed-to-value'],
        ourAdvantage: 'Faster deployment and clearer paid media reporting.',
        adActivity: {
          activeAdCount: 4,
          platforms: ['LinkedIn'],
          themes: ['Revenue visibility'],
          evidence: 'Ad library evidence across LinkedIn.',
          sourceConfidence: 'medium',
        },
      },
    ],
    whiteSpaceGaps: [
      {
        gap: 'Proof-led attribution messaging',
        type: 'messaging',
        evidence: 'Competitors lead with workflow breadth.',
        exploitability: 8,
        impact: 8,
        recommendedAction: 'Lead with revenue proof in launch ads.',
      },
    ],
  },
} as const;

const validIcpValidationResult = {
  status: 'complete',
  section: 'icpValidation',
  durationMs: 1,
  data: {
    validatedPersona: 'Growth-stage B2B SaaS marketing leaders',
    demographics: 'VP/Director level in North America',
    channels: ['LinkedIn'],
    triggers: ['Pipeline misses'],
    objections: ['Implementation risk'],
    decisionFactors: [
      { factor: 'Proves revenue impact', relevance: 95 },
    ],
    audienceSize: 'Mid-market B2B SaaS',
    confidenceScore: 82,
    decisionProcess: 'Committee-led with RevOps input',
  },
} as const;

const validOfferAnalysisResult = {
  status: 'complete',
  section: 'offerAnalysis',
  durationMs: 1,
  data: {
    offerStrength: {
      painRelevance: 8,
      urgency: 7,
      differentiation: 7,
      tangibility: 8,
      proof: 6,
      pricingLogic: 7,
      overallScore: 7,
    },
    recommendation: {
      status: 'adjust-messaging',
      summary: 'Solid offer that needs stronger proof and positioning.',
      topStrengths: ['Clear value prop'],
      priorityFixes: ['Stronger proof'],
      recommendedActionPlan: ['Refresh case-study proof blocks'],
    },
    redFlags: [
      {
        issue: 'Proof is thin for cold traffic',
        severity: 'medium',
        priority: 1,
        recommendedAction: 'Add quantified proof to landing pages.',
        launchBlocker: false,
      },
    ],
    pricingAnalysis: {
      currentPricing: '$999/mo',
      marketBenchmark: '$1,200/mo',
      pricingPosition: 'mid-market',
      coldTrafficViability: 'Viable with strong proof and ROI framing.',
    },
    marketFitAssessment: 'Good fit for paid acquisition with stronger credibility.',
    messagingRecommendations: ['Lead with attributable revenue outcomes'],
  },
} as const;

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'user-test' }),
}));

const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      order: mockOrder.mockReturnThis(),
      limit: mockLimit.mockReturnThis(),
      single: mockSingle,
    })),
  })),
}));

describe('waitForResearchReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately when all 4 sections are already complete', async () => {
    mockSingle.mockResolvedValue({
      data: {
        research_results: {
          industryMarket: validIndustryResearchResult,
          competitors: validCompetitorIntelResult,
          icpValidation: validIcpValidationResult,
          offerAnalysis: validOfferAnalysisResult,
        },
      },
      error: null,
    });

    const { waitForResearchReadiness } = await import('../research-readiness');
    const promise = waitForResearchReadiness('user-test', { pollIntervalMs: 100, timeoutMs: 5000 });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ready).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.completedSections).toHaveLength(4);
  });

  it('polls and resolves when sections complete during wait', async () => {
    // First poll: 2 sections complete
    // Second poll: all 4 complete
    mockSingle
      .mockResolvedValueOnce({
        data: {
          research_results: {
            industryMarket: validIndustryResearchResult,
            competitors: validCompetitorIntelResult,
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          research_results: {
            industryMarket: validIndustryResearchResult,
            competitors: validCompetitorIntelResult,
            icpValidation: validIcpValidationResult,
            offerAnalysis: validOfferAnalysisResult,
          },
        },
        error: null,
      });

    const { waitForResearchReadiness } = await import('../research-readiness');
    const promise = waitForResearchReadiness('user-test', { pollIntervalMs: 100, timeoutMs: 5000 });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ready).toBe(true);
    expect(mockSingle).toHaveBeenCalledTimes(2);
  });

  it('resolves with timedOut: true when timeout is exceeded', async () => {
    // Always incomplete
    mockSingle.mockResolvedValue({
        data: {
          research_results: {
            industryMarket: validIndustryResearchResult,
            // others missing
          },
        },
      error: null,
    });

    const { waitForResearchReadiness } = await import('../research-readiness');
    const promise = waitForResearchReadiness('user-test', { pollIntervalMs: 100, timeoutMs: 300 });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ready).toBe(false);
    expect(result.timedOut).toBe(true);
  });

  it('resolves with timedOut: true when Supabase session not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const { waitForResearchReadiness } = await import('../research-readiness');
    const promise = waitForResearchReadiness('user-test', { pollIntervalMs: 100, timeoutMs: 300 });

    await vi.runAllTimersAsync();
    const result = await promise;

    // No session = no research results = treat as timed out
    expect(result.timedOut).toBe(true);
  });
});
