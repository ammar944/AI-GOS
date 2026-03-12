import { describe, expect, it } from 'vitest';
import {
  applyJourneySandboxSectionResets,
  buildJourneyResearchSandboxContext,
  buildJourneyResearchSandboxUnifiedExport,
  buildJourneyResearchSandboxUnifiedReport,
  clearJourneySandboxSectionJobs,
  clearJourneySandboxSectionResult,
  getJourneyResearchSandboxRunAllSequence,
  getJourneyResearchSandboxUserId,
  getJourneySandboxMissingPrerequisites,
  getJourneySandboxSectionResetAt,
  getJourneySandboxContextDrafts,
  normalizeJourneySandboxResearchResults,
  sanitizeJourneyResearchSandboxKey,
} from '../research-sandbox';

const validIndustryResearchResult = {
  status: 'complete',
  section: 'industryMarket',
  durationMs: 1000,
  data: {
    categorySnapshot: {
      category: 'Revenue attribution',
      marketMaturity: 'growing',
      awarenessLevel: 'high',
      buyingBehavior: 'committee_driven',
    },
    marketDynamics: {
      demandDrivers: ['Pressure to prove ROI'],
      buyingTriggers: ['Pipeline misses'],
      barriersToPurchase: ['Tool fatigue'],
    },
    painPoints: {
      primary: ['Attribution is not trusted'],
    },
    messagingOpportunities: {
      summaryRecommendations: ['Lead with revenue accountability'],
    },
  },
} as const;

const validCompetitorIntelResult = {
  status: 'complete',
  section: 'competitors',
  durationMs: 1200,
  data: {
    competitors: [
      {
        name: 'Dreamdata',
        website: 'https://dreamdata.io',
        positioning: 'Revenue attribution for B2B SaaS',
        strengths: ['Category awareness'],
        weaknesses: ['Complex onboarding'],
        opportunities: ['Own speed-to-value'],
        ourAdvantage: 'Faster launch and clearer paid media reporting.',
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
        evidence: 'Competitors focus on workflow breadth.',
        exploitability: 8,
        impact: 8,
        recommendedAction: 'Lead with proof-backed revenue visibility.',
      },
    ],
  },
} as const;

const validStrategicSynthesisResult = {
  status: 'complete',
  section: 'strategicSynthesis',
  durationMs: 1,
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
  data: {
    keyInsights: [
      {
        insight: 'LinkedIn holds the densest concentration of buyers.',
        source: 'icpValidation',
        implication: 'Lead with title-based targeting first.',
        priority: 'high',
      },
    ],
    positioningStrategy: {
      recommendedAngle: 'Revenue accountability',
      alternativeAngles: ['Speed-to-value'],
      leadRecommendation: 'Anchor the story in attributable pipeline.',
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
        evidence: 'Interview evidence points to attribution frustration.',
      },
    ],
    planningContext: {
      monthlyBudget: '$12,000/month',
      downstreamSequence: ['keywordIntel', 'mediaPlan'],
    },
    criticalSuccessFactors: ['Tight CRM attribution'],
    nextSteps: ['Build the LinkedIn launch asset pack'],
    strategicNarrative: 'Crowded category, thin on accountable positioning.',
  },
} as const;

const validKeywordIntelResult = {
  status: 'complete',
  section: 'keywordIntel',
  durationMs: 1,
  data: {
    totalKeywordsFound: 12,
    competitorGapCount: 3,
    campaignGroups: [
      {
        campaign: 'Competitor Alternatives',
        intent: 'bottom-of-funnel',
        recommendedMonthlyBudget: 1800,
        adGroups: [
          {
            name: 'Dreamdata Alternatives',
            recommendedMatchTypes: ['phrase'],
            keywords: [
              {
                keyword: 'dreamdata alternative',
                searchVolume: 320,
                estimatedCpc: '$16.20',
                difficulty: 'medium',
                priorityScore: 84,
                confidence: 'medium',
              },
            ],
            negativeKeywords: ['jobs'],
          },
        ],
      },
    ],
    topOpportunities: [
      {
        keyword: 'revenue attribution software',
        searchVolume: 1200,
        estimatedCpc: '$18.00',
        difficulty: 'medium',
        priorityScore: 88,
        confidence: 'high',
      },
    ],
    recommendedStartingSet: [
      {
        keyword: 'dreamdata alternative',
        campaign: 'Competitor Alternatives',
        adGroup: 'Dreamdata Alternatives',
        recommendedMonthlyBudget: 900,
        reason: 'High-intent comparison term with budget fit.',
        priorityScore: 84,
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
      { keyword: 'free', reason: 'Low purchase intent' },
    ],
    confidenceNotes: ['Volumes are directional because SpyFu coverage is sparse.'],
    quickWins: ['Launch competitor alternative ad groups first.'],
  },
} as const;

describe('research sandbox helpers', () => {
  it('normalizes sandbox keys and derives an isolated user id', () => {
    expect(sanitizeJourneyResearchSandboxKey('  QA Lane / 01  ')).toBe('qa-lane-01');
    expect(getJourneyResearchSandboxUserId('user_live_123', 'QA Lane / 01')).toBe(
      'user_live_123::journey-research-sandbox::qa-lane-01',
    );
  });

  it('extracts saved context drafts from sandbox metadata', () => {
    expect(
      getJourneySandboxContextDrafts({
        researchSandbox: {
          contextDrafts: {
            competitors: 'Saved competitor draft',
            mediaPlan: 'Saved media plan draft',
          },
        },
      }),
    ).toEqual({
      competitors: 'Saved competitor draft',
      mediaPlan: 'Saved media plan draft',
    });
  });

  it('extracts per-section reset timestamps from sandbox metadata', () => {
    expect(
      getJourneySandboxSectionResetAt({
        researchSandbox: {
          sectionResetAt: {
            industryMarket: '2026-03-11T10:00:00.000Z',
            competitors: '2026-03-11T10:05:00.000Z',
          },
        },
      }),
    ).toEqual({
      industryMarket: '2026-03-11T10:00:00.000Z',
      competitors: '2026-03-11T10:05:00.000Z',
    });
  });

  it('builds a section context from Journey metadata plus upstream research', () => {
    const context = buildJourneyResearchSandboxContext('crossAnalysis', {
      metadata: {
        companyName: { value: 'FlowMetrics' },
        websiteUrl: 'https://flowmetrics.io',
        businessModel: { value: 'B2B SaaS' },
        productDescription: { value: 'Revenue attribution software for B2B marketers' },
        primaryIcpDescription: {
          value: 'Growth-stage B2B SaaS marketing leaders',
        },
        pricingTiers: { value: 'Growth: $999/mo' },
        monthlyAdBudget: { value: '$12,000/month' },
        goals: { value: 'Lower CAC while increasing demo volume' },
      },
      researchResults: {
        industryMarket: validIndustryResearchResult,
        competitors: validCompetitorIntelResult,
      },
    });

    expect(context).toContain('Section: Strategic Synthesis');
    expect(context).toContain('- Company Name: FlowMetrics');
    expect(context).toContain('- Monthly Ad Budget: $12,000/month');
    expect(context).toContain('## Market Overview');
    expect(context).toContain('"category": "Revenue attribution"');
    expect(context).toContain('## Competitor Intel');
    expect(context).toContain('"name": "Dreamdata"');
  });

  it('clears only the selected section result and matching worker jobs', () => {
    expect(
      clearJourneySandboxSectionResult(
        {
          industryMarket: { status: 'complete' },
          strategicSynthesis: { status: 'complete' },
          competitors: { status: 'complete' },
        },
        'crossAnalysis',
      ),
    ).toEqual({
      industryMarket: { status: 'complete' },
      competitors: { status: 'complete' },
    });

    expect(
      clearJourneySandboxSectionJobs(
        {
          'job-market': { tool: 'researchIndustry', status: 'complete' },
          'job-competitors': { tool: 'researchCompetitors', status: 'running' },
          'job-icp': { tool: 'researchICP', status: 'complete' },
        },
        'competitors',
      ),
    ).toEqual({
      'job-market': { tool: 'researchIndustry', status: 'complete' },
      'job-icp': { tool: 'researchICP', status: 'complete' },
    });
  });

  it('normalizes aliased research result keys for sandbox reads', () => {
    expect(
      normalizeJourneySandboxResearchResults({
        industryResearch: {
          ...validIndustryResearchResult,
          section: 'industryResearch',
          durationMs: 1,
        },
        competitorIntel: {
          ...validCompetitorIntelResult,
          section: 'competitorIntel',
          durationMs: 1,
        },
        strategicSynthesis: validStrategicSynthesisResult,
        keywords: {
          ...validKeywordIntelResult,
          section: 'keywords',
          durationMs: 1,
        },
      }),
    ).toEqual({
      industryMarket: expect.objectContaining({
        status: 'complete',
        section: 'industryMarket',
        durationMs: 1,
      }),
      competitors: expect.objectContaining({
        status: 'complete',
        section: 'competitors',
        durationMs: 1,
      }),
      crossAnalysis: expect.objectContaining({
        status: 'complete',
        section: 'crossAnalysis',
        durationMs: 1,
      }),
      keywordIntel: expect.objectContaining({
        status: 'complete',
        section: 'keywordIntel',
        durationMs: 1,
      }),
    });
  });

  it('reports missing prerequisites using normalized section aliases', () => {
    expect(
      getJourneySandboxMissingPrerequisites('mediaPlan', {
        strategicSynthesis: validStrategicSynthesisResult,
      }),
    ).toEqual(['keywordIntel']);
  });

  it('returns the first six production sections for sandbox run-all orchestration', () => {
    expect(getJourneyResearchSandboxRunAllSequence()).toEqual([
      'industryMarket',
      'competitors',
      'icpValidation',
      'offerAnalysis',
      'crossAnalysis',
      'keywordIntel',
    ]);
  });

  it('filters stale sandbox job and result data after a section reset marker', () => {
    const filtered = applyJourneySandboxSectionResets({
      metadata: {
        researchSandbox: {
          sectionResetAt: {
            competitors: '2026-03-11T10:00:00.000Z',
          },
        },
      },
      researchResults: {
        competitors: validCompetitorIntelResult,
      },
      jobStatus: {
        'job-old': {
          status: 'error',
          tool: 'researchCompetitors',
          startedAt: '2026-03-11T09:59:00.000Z',
          completedAt: '2026-03-11T10:01:00.000Z',
        },
      },
    });

    expect(filtered.researchResults).toEqual({});
    expect(filtered.jobStatus).toEqual({});
  });

  it('keeps sandbox job and result data that started after a reset marker', () => {
    const filtered = applyJourneySandboxSectionResets({
      metadata: {
        researchSandbox: {
          sectionResetAt: {
            competitors: '2026-03-11T10:00:00.000Z',
          },
        },
      },
      researchResults: {
        competitors: validCompetitorIntelResult,
      },
      jobStatus: {
        'job-new': {
          status: 'complete',
          tool: 'researchCompetitors',
          startedAt: '2026-03-11T10:00:30.000Z',
          completedAt: '2026-03-11T10:01:00.000Z',
        },
      },
    });

    expect(filtered.researchResults).toEqual({
      competitors: expect.objectContaining({
        status: 'complete',
      }),
    });
    expect(filtered.jobStatus).toEqual({
      'job-new': {
        status: 'complete',
        tool: 'researchCompetitors',
        startedAt: '2026-03-11T10:00:30.000Z',
        completedAt: '2026-03-11T10:01:00.000Z',
      },
    });
  });

  it('builds a unified sandbox report with timing, token, cost, and chart summaries', () => {
    const report = buildJourneyResearchSandboxUnifiedReport({
      sandboxResults: {
        industryMarket: validIndustryResearchResult,
        competitors: validCompetitorIntelResult,
        crossAnalysis: validStrategicSynthesisResult,
        keywordIntel: validKeywordIntelResult,
      },
      sandboxJobStatus: {
        'job-industry': {
          status: 'complete',
          tool: 'researchIndustry',
          startedAt: '2026-03-11T10:00:00.000Z',
          completedAt: '2026-03-11T10:01:00.000Z',
          updates: [
            {
              at: '2026-03-11T10:00:30.000Z',
              id: 'u-1',
              message: 'market overview complete',
              phase: 'output',
            },
          ],
        },
        'job-cross': {
          status: 'complete',
          tool: 'synthesizeResearch',
          startedAt: '2026-03-11T10:03:00.000Z',
          completedAt: '2026-03-11T10:05:00.000Z',
          updates: [
            {
              at: '2026-03-11T10:03:20.000Z',
              id: 'u-2',
              message: 'generateChart started',
              phase: 'tool',
            },
          ],
        },
      },
    });

    expect(report.sections).toHaveLength(6);
    expect(report.sections[0]).toMatchObject({
      section: 'industryMarket',
      status: 'complete',
      durationMs: 1000,
      logCount: 1,
    });
    expect(report.sections.find((section) => section.section === 'crossAnalysis')).toMatchObject({
      status: 'complete',
      durationMs: 1,
      telemetry: {
        model: 'claude-sonnet-4-6',
        usage: {
          totalTokens: 3000,
        },
        estimatedCostUsd: 0.0234,
      },
      chartCount: 1,
      hasCharts: true,
    });
    expect(report.totals).toMatchObject({
      completedSections: 4,
      totalTokens: 3000,
      totalEstimatedCostUsd: 0.0234,
      totalCharts: 1,
    });
  });

  it('builds a copyable unified export across the first six sections', () => {
    const report = buildJourneyResearchSandboxUnifiedReport({
      sandboxResults: {
        industryMarket: validIndustryResearchResult,
        competitors: validCompetitorIntelResult,
      },
      sandboxJobStatus: {},
    });

    const exportText = buildJourneyResearchSandboxUnifiedExport(report);

    expect(exportText).toContain('# Journey Research Sandbox Unified Output');
    expect(exportText).toContain('## Market Overview (industryMarket)');
    expect(exportText).toContain('## Competitor Intel (competitors)');
    expect(exportText).toContain('"category": "Revenue attribution"');
    expect(exportText).toContain('"name": "Dreamdata"');
  });

  it('marks downstream sections as blocked when prerequisites are not complete', () => {
    const report = buildJourneyResearchSandboxUnifiedReport({
      sandboxResults: {
        industryMarket: {
          ...validIndustryResearchResult,
          status: 'partial',
          error: 'Validation failed',
        },
      },
      sandboxJobStatus: {},
    });

    expect(report.sections.find((section) => section.section === 'competitors')).toMatchObject({
      status: 'blocked',
      missingPrerequisites: ['industryMarket'],
    });
    expect(report.sections.find((section) => section.section === 'icpValidation')).toMatchObject({
      status: 'blocked',
      missingPrerequisites: ['industryMarket'],
    });
  });
});
