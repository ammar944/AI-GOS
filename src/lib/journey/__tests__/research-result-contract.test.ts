import { describe, expect, it } from 'vitest';
import {
  getBoundaryResearchSectionId,
  normalizeStoredResearchResult,
  normalizeStoredResearchResults,
} from '../research-result-contract';

describe('research-result-contract', () => {
  it('normalizes legacy section ids and adds provenance metadata for valid artifacts', () => {
    const result = normalizeStoredResearchResult('crossAnalysis', {
      status: 'complete',
      section: 'crossAnalysis',
      durationMs: 4200,
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
      citations: [
        {
          url: 'https://example.com/revops-report',
          title: '2026 RevOps Report',
        },
      ],
      data: {
        keyInsights: [
          {
            insight:
              'LinkedIn still holds the densest concentration of RevOps buyers.',
            source: 'icpValidation',
            implication: 'Lead with title-based targeting before broadening reach.',
            priority: 'high',
          },
        ],
        positioningStrategy: {
          recommendedAngle:
            'Own revenue accountability instead of generic lead generation.',
          alternativeAngles: ['Speed-to-value', 'Pipeline clarity'],
          leadRecommendation:
            'It maps directly to the proof and objections found across the research.',
          keyDifferentiator: 'Revenue accountability from click to closed-won.',
        },
        platformRecommendations: [
          {
            platform: 'LinkedIn',
            role: 'primary',
            budgetAllocation: '60% ($3,000)',
            rationale: 'The ICP is concentrated on LinkedIn.',
            priority: 1,
          },
        ],
        messagingAngles: [
          {
            angle: 'Revenue accountability',
            targetEmotion: 'Confidence',
            exampleHook: 'See where revenue is leaking before finance does.',
            evidence:
              'Review and interview evidence both point to attribution frustration.',
          },
        ],
        criticalSuccessFactors: ['Tight CRM attribution'],
        nextSteps: ['Build the LinkedIn launch asset pack'],
        strategicNarrative:
          'The category is crowded with channel operators but thin on revenue-accountable positioning.',
        planningContext: {
          monthlyBudget: '$5,000/month',
          targetCpl: '$300',
          downstreamSequence: ['keywordIntel', 'mediaPlan'],
        },
      },
    });

    expect(result).toMatchObject({
      status: 'complete',
      section: 'strategicSynthesis',
      provenance: {
        status: 'sourced',
        citationCount: 1,
      },
      citations: [
        {
          url: 'https://example.com/revops-report',
          title: '2026 RevOps Report',
        },
      ],
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
    expect(getBoundaryResearchSectionId(result?.section ?? null)).toBe('crossAnalysis');
  });

  it('downgrades schema-invalid complete artifacts to partial with validation metadata', () => {
    const result = normalizeStoredResearchResult('competitors', {
      status: 'complete',
      section: 'competitors',
      durationMs: 1900,
      rawText: 'Acme is strong. Beta is strong too.',
      data: {
        summary: 'Acme is strong. Beta is strong too.',
      },
    });

    expect(result).toMatchObject({
      status: 'partial',
      section: 'competitorIntel',
      error: expect.stringContaining('Validation failed'),
      rawText: 'Acme is strong. Beta is strong too.',
      validation: {
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'schema_validation' }),
        ]),
      },
    });
  });

  it('downgrades fallback language in user-facing strategy artifacts', () => {
    const result = normalizeStoredResearchResult('strategicSynthesis', {
      status: 'complete',
      section: 'strategicSynthesis',
      durationMs: 3200,
      data: {
        keyInsights: [
          {
            insight: 'Primary pass timed out — using fallback benchmarks instead.',
            source: 'industryResearch',
            implication: 'This should never reach the user.',
            priority: 'medium',
          },
        ],
        positioningStrategy: {
          recommendedAngle: 'Fallback strategy',
          alternativeAngles: ['Timeout copy'],
          leadRecommendation: 'This should fail validation.',
          keyDifferentiator: 'N/A',
        },
        platformRecommendations: [
          {
            platform: 'Google Search',
            role: 'primary',
            budgetAllocation: '100% ($2,000)',
            rationale: 'Placeholder',
            priority: 1,
          },
        ],
        messagingAngles: [
          {
            angle: 'Fallback angle',
            targetEmotion: 'Clarity',
            exampleHook: 'This is a fallback hook.',
            evidence: 'Fallback.',
          },
        ],
        criticalSuccessFactors: ['Clean downstream orchestration'],
        nextSteps: ['Regenerate the artifact correctly'],
        strategicNarrative: 'Timed out while building the artifact.',
        planningContext: {
          monthlyBudget: '$2,000/month',
          downstreamSequence: ['keywordIntel', 'mediaPlan'],
        },
      },
    });

    expect(result).toMatchObject({
      status: 'partial',
      validation: {
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'fallback_language' }),
        ]),
      },
    });
  });

  it('normalizes stored result maps to boundary section ids', () => {
    const results = normalizeStoredResearchResults(
      {
        industryResearch: {
          status: 'complete',
          section: 'industryResearch',
          durationMs: 1,
          data: {
            categorySnapshot: {
              category: 'B2B SaaS',
              marketSize: '$4.2B',
              marketMaturity: 'growing',
              buyingBehavior: 'committee_driven',
              awarenessLevel: 'high',
              averageSalesCycle: '45-90 days',
            },
            painPoints: {
              primary: ['Revenue teams lack trustworthy attribution'],
              secondary: ['Channel data is fragmented'],
            },
            marketDynamics: {
              demandDrivers: ['Pressure to prove ROI'],
              buyingTriggers: ['New revenue leader hired'],
              barriersToPurchase: ['Tool fatigue'],
            },
            trendSignals: [
              {
                trend: 'AI-assisted reporting',
                direction: 'rising',
                evidence: 'Search demand keeps climbing.',
              },
            ],
            messagingOpportunities: {
              angles: ['Own clarity and accountability'],
              summaryRecommendations: ['Lead with revenue visibility'],
            },
          },
        },
      },
      'boundary',
    );

    expect(results.industryMarket?.status).toBe('complete');
    expect(results.industryResearch).toBeUndefined();
  });

  it('normalizes industry trend direction aliases before validating stored results', () => {
    const result = normalizeStoredResearchResult('industryResearch', {
      status: 'complete',
      section: 'industryResearch',
      durationMs: 1200,
      data: {
        categorySnapshot: {
          category: 'B2B SaaS',
          marketSize: '$4.2B',
          marketMaturity: 'growing',
          buyingBehavior: 'committee_driven',
          awarenessLevel: 'high',
          averageSalesCycle: '45-90 days',
        },
        painPoints: {
          primary: ['Revenue teams lack trustworthy attribution'],
          secondary: ['Channel data is fragmented'],
        },
        marketDynamics: {
          demandDrivers: ['Pressure to prove ROI'],
          buyingTriggers: ['New revenue leader hired'],
          barriersToPurchase: ['Tool fatigue'],
        },
        trendSignals: [
          {
            trend: 'Privacy-first measurement',
            description: 'growing',
            evidence: 'Search demand keeps climbing.',
          },
        ],
        messagingOpportunities: {
          angles: ['Own clarity and accountability'],
          summaryRecommendations: ['Lead with revenue visibility'],
        },
      },
    });

    expect(result).toMatchObject({
      status: 'complete',
      section: 'industryResearch',
      data: {
        trendSignals: [
          {
            trend: 'Privacy-first measurement',
            direction: 'rising',
            evidence: 'Search demand keeps climbing.',
          },
        ],
      },
    });
  });
});
