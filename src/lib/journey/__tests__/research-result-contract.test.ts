import { describe, expect, it } from 'vitest';
import {
  getBoundaryResearchSectionId,
  normalizeStoredResearchResult,
  normalizeStoredResearchResults,
} from '../research-result-contract';

describe('research-result-contract', () => {
  it('preserves Deep Research results and their durable artifact payload', () => {
    const result = normalizeStoredResearchResults(
      {
        deepResearchProgram: {
          status: 'complete',
          section: 'deepResearchProgram',
          durationMs: 24000,
          artifact: {
            title: 'Airtable GTM Research',
            markdown: '## Deep Research\n\nAirtable sells a connected app platform.',
          },
          data: {
            corpus: {
              company: 'Airtable',
              researchSummary: 'Airtable sells a connected app platform.',
            },
            onboardingFields: {
              companyName: {
                value: 'Airtable',
                confidence: 95,
                sourceUrl: 'https://airtable.com',
                reasoning: 'Verified from company site.',
              },
            },
          },
        },
      },
      'boundary',
    );

    expect(result.deepResearchProgram).toMatchObject({
      status: 'complete',
      section: 'deepResearchProgram',
      artifact: {
        title: 'Airtable GTM Research',
        markdown: expect.stringContaining('connected app platform'),
      },
      data: {
        corpus: {
          company: 'Airtable',
        },
      },
    });
  });

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
          downstreamSequence: ['mediaPlan'],
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
          downstreamSequence: ['mediaPlan'],
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

  it('preserves enriched competitor ad evidence through app-side normalization', () => {
    const result = normalizeStoredResearchResult('competitorIntel', {
      status: 'complete',
      section: 'competitorIntel',
      durationMs: 2400,
      data: {
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

  it('passes through worker error for partial results with runId (no data payload)', () => {
    const result = normalizeStoredResearchResult('competitorIntel', {
      status: 'partial',
      section: 'competitorIntel',
      durationMs: 5200,
      rawText: '{"competitors": [',
      error: 'Validation failed at "competitors": Runner output was truncated.',
      validation: {
        section: 'competitorIntel',
        issues: [
          {
            code: 'schema_validation',
            message: 'Runner output was truncated.',
            path: 'competitors',
          },
        ],
      },
      telemetry: { model: 'claude-sonnet-4-6', stopReason: 'max_tokens' },
      runId: 'run-abc-123',
    });

    expect(result).toMatchObject({
      status: 'partial',
      section: 'competitorIntel',
      error: 'Validation failed at "competitors": Runner output was truncated.',
      validation: {
        section: 'competitorIntel',
        issues: [
          expect.objectContaining({ code: 'schema_validation' }),
        ],
      },
    });
    // Must NOT re-validate empty data and produce "expected array" errors
    expect(result?.error).not.toContain('expected array');
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

describe('cacModelSchema nullable fields', () => {
  async function loadSchema() {
    const mod = await import('@/lib/media-plan/schemas');
    return mod.cacModelSchema;
  }

  it('accepts all nullable fields set to null', async () => {
    const cacModelSchema = await loadSchema();
    const result = cacModelSchema.safeParse({
      targetCAC: null,
      targetCPL: null,
      leadToSqlRate: null,
      sqlToCustomerRate: null,
      expectedMonthlyLeads: null,
      expectedMonthlySQLs: null,
      expectedMonthlyCustomers: null,
      estimatedLTV: null,
      ltvToCacRatio: null,
      insufficientData: ['estimatedLTV: no avgCustomerLtv provided'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a legacy payload without insufficientData', async () => {
    const cacModelSchema = await loadSchema();
    const result = cacModelSchema.safeParse({
      targetCAC: 450,
      targetCPL: 85,
      leadToSqlRate: 22,
      sqlToCustomerRate: 25,
      expectedMonthlyLeads: 47,
      expectedMonthlySQLs: 10,
      expectedMonthlyCustomers: 3,
      estimatedLTV: 3600,
      ltvToCacRatio: '8.0:1 — Healthy',
    });
    expect(result.success).toBe(true);
  });
});

describe('sensitivityAnalysis nullable scenarios', () => {
  it('accepts all scenarios set to null', async () => {
    const { icpValidationDataSchema } = await import('../schemas/icp-validation');
    const result = icpValidationDataSchema.partial().safeParse({
      sensitivityAnalysis: {
        bestCase: null,
        baseCase: null,
        worstCase: null,
        breakEven: null,
        insufficientData: ['breakEven: no avgCustomerLtv provided'],
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a legacy fully-populated payload', async () => {
    const { icpValidationDataSchema } = await import('../schemas/icp-validation');
    const result = icpValidationDataSchema.partial().safeParse({
      sensitivityAnalysis: {
        bestCase: { assumedCPL: 60, leadToSqlRate: 20, sqlToCustomerRate: 30, conditions: 'n' },
        baseCase: { assumedCPL: 85, leadToSqlRate: 15, sqlToCustomerRate: 25, conditions: 'n', confidencePercent: 65 },
        worstCase: { assumedCPL: 120, leadToSqlRate: 10, sqlToCustomerRate: 20, conditions: 'n' },
        breakEven: { maxCPLFor3xLTV: 100, maxCAC: 300, minLeadToSqlRate: 12, budgetFloorForTesting: 3000 },
      },
    });
    expect(result.success).toBe(true);
  });
});
