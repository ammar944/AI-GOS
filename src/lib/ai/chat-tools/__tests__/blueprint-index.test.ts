import { describe, it, expect } from 'vitest';
import { buildBlueprintIndex } from '../blueprint-index';

const makeSection = (fields: Record<string, unknown>) => fields;

const fullBlueprint = {
  industryMarketOverview: makeSection({
    categorySnapshot: { category: 'AI Software', marketSize: '$5B' },
    painPoints: { primary: ['pain1', 'pain2', 'pain3'], secondary: ['s1', 's2'] },
    psychologicalDrivers: ['driver1', 'driver2'],
    demandSignals: 'High demand',
    buyingTriggers: ['trigger1'],
    messagingOpportunities: { opportunities: ['opp1', 'opp2', 'opp3'] },
  }),
  icpAnalysisValidation: makeSection({
    finalVerdict: { status: 'proceed', reasoning: 'Strong ICP signal' },
    psychographics: { goals: ['g1'], fears: ['f1'], dayInLife: 'busy exec' },
    painSolutionFit: 'Strong',
    riskAssessment: 'Low',
    reachabilityScore: 8,
  }),
  offerAnalysisViability: makeSection({
    offerStrength: { overallScore: 8.5, painRelevance: 9, urgency: 7 },
    recommendation: { status: 'go' },
    redFlags: [],
  }),
  competitorAnalysis: makeSection({
    competitors: [
      { name: 'CompA', positioning: 'cheap', strengths: ['s1'], weaknesses: ['w1'] },
      { name: 'CompB', positioning: 'premium' },
    ],
    gapsAndOpportunities: { messagingOpportunities: ['gap1', 'gap2'] },
  }),
  crossAnalysisSynthesis: makeSection({
    recommendedPositioning: 'Market leader for SMBs',
    primaryMessagingAngles: ['angle1', 'angle2'],
    adHooks: ['hook1', 'hook2', 'hook3'],
    platformRecommendations: ['Google', 'Meta'],
    nextSteps: ['step1', 'step2'],
  }),
};

describe('buildBlueprintIndex', () => {
  it('returns an index with all 5 known sections', () => {
    const index = buildBlueprintIndex(fullBlueprint);
    expect(index.sections).toHaveLength(5);
    expect(index.totalSections).toBe(5);
  });

  it('marks sections with >=10 leaf fields as complete', () => {
    const index = buildBlueprintIndex(fullBlueprint);
    const industry = index.sections.find(s => s.key === 'industryMarketOverview');
    expect(industry?.status).toBe('complete');
  });

  it('marks missing sections as empty', () => {
    const index = buildBlueprintIndex({});
    expect(index.sections.every(s => s.status === 'empty')).toBe(true);
    expect(index.emptySections).toBe(5);
    expect(index.completedSections).toBe(0);
  });

  it('marks sections with <10 leaf fields as partial', () => {
    const partialBlueprint = {
      industryMarketOverview: { categorySnapshot: { category: 'AI' } },
    };
    const index = buildBlueprintIndex(partialBlueprint);
    const industry = index.sections.find(s => s.key === 'industryMarketOverview');
    expect(industry?.status).toBe('partial');
  });

  it('computes correct fieldCount for nested structures', () => {
    const index = buildBlueprintIndex({
      industryMarketOverview: {
        painPoints: { primary: ['a', 'b', 'c'] },
        category: 'SaaS',
      },
    });
    const industry = index.sections.find(s => s.key === 'industryMarketOverview');
    expect(industry?.fieldCount).toBe(4);
  });

  it('serializes to under 2400 chars (600 tokens)', () => {
    const index = buildBlueprintIndex(fullBlueprint);
    const serialized = JSON.stringify(index);
    expect(serialized.length).toBeLessThan(2400);
  });

  it('includes correct counts for completed/partial/empty', () => {
    const index = buildBlueprintIndex(fullBlueprint);
    expect(index.completedSections + index.partialSections + index.emptySections).toBe(5);
  });

  it('includes a lastUpdated ISO string', () => {
    const index = buildBlueprintIndex(fullBlueprint);
    expect(() => new Date(index.lastUpdated)).not.toThrow();
    expect(index.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
