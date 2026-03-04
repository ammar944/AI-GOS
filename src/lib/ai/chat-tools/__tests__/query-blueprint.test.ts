import { describe, it, expect } from 'vitest';
import { createQueryBlueprintTool } from '../query-blueprint';

const fullBlueprint = {
  industryMarketOverview: {
    categorySnapshot: { category: 'AI Software', marketSize: '$5B' },
    painPoints: {
      primary: ['pain1', 'pain2', 'pain3', 'pain4', 'pain5', 'pain6'],
      secondary: ['s1', 's2', 's3', 's4'],
    },
    psychologicalDrivers: ['driver1', 'driver2', 'driver3'],
    demandSignals: 'High demand',
    buyingTriggers: ['trigger1', 'trigger2'],
    messagingOpportunities: { opportunities: ['opp1', 'opp2', 'opp3', 'opp4', 'opp5', 'opp6'] },
  },
  offerAnalysisViability: {
    offerStrength: {
      overallScore: 8.5,
      painRelevance: 9,
      urgency: 7,
      differentiation: 8,
      tangibility: 9,
      proof: 7,
      pricingLogic: 8,
    },
    recommendation: { status: 'go', reasoning: 'Strong offer' },
    redFlags: ['flag1', 'flag2', 'flag3', 'flag4', 'flag5', 'flag6'],
    strengths: ['s1', 's2', 's3', 's4'],
  },
  competitorAnalysis: {
    competitors: [
      {
        name: 'CompA',
        positioning: 'cheap volume',
        weaknesses: ['w1', 'w2', 'w3'],
        adHooks: ['hook1', 'hook2', 'hook3'],
        creativeFormats: ['video', 'image', 'carousel'],
      },
    ],
    gapsAndOpportunities: {
      messagingOpportunities: ['gap1', 'gap2', 'gap3', 'gap4', 'gap5', 'gap6'],
    },
  },
};

describe('createQueryBlueprintTool', () => {
  it('returns condensed industry market section', async () => {
    const queryBlueprint = createQueryBlueprintTool(fullBlueprint);
    const result = await queryBlueprint.execute({ section: 'industryMarketOverview' }, {} as never);
    expect(result.status).toBe('loaded');
    expect(result.summary).toBeDefined();
    expect((result.summary as Record<string, unknown>).primaryPainPoints).toHaveLength(5);
    expect((result.summary as Record<string, unknown>).messagingOpportunities).toHaveLength(5);
  });

  it('returns condensed offer section with all 6 dimension scores', async () => {
    const queryBlueprint = createQueryBlueprintTool(fullBlueprint);
    const result = await queryBlueprint.execute({ section: 'offerAnalysisViability' }, {} as never);
    expect(result.status).toBe('loaded');
    const summary = result.summary as Record<string, unknown>;
    expect(summary.overallScore).toBe(8.5);
    expect(summary.dimensionScores).toBeDefined();
    expect((summary.redFlags as string[]).length).toBeLessThanOrEqual(5);
    expect((summary.strengths as string[]).length).toBeLessThanOrEqual(3);
  });

  it('returns condensed competitor analysis', async () => {
    const queryBlueprint = createQueryBlueprintTool(fullBlueprint);
    const result = await queryBlueprint.execute({ section: 'competitorAnalysis' }, {} as never);
    expect(result.status).toBe('loaded');
    const summary = result.summary as Record<string, unknown>;
    const competitors = summary.competitors as Array<Record<string, unknown>>;
    expect(competitors).toHaveLength(1);
    expect((competitors[0].topWeaknesses as string[]).length).toBeLessThanOrEqual(2);
    expect((competitors[0].adHooks as string[]).length).toBeLessThanOrEqual(2);
    expect((summary.messagingGaps as string[]).length).toBeLessThanOrEqual(5);
  });

  it('returns error for missing section', async () => {
    const queryBlueprint = createQueryBlueprintTool({});
    const result = await queryBlueprint.execute(
      { section: 'industryMarketOverview' },
      {} as never
    );
    expect(result.status).toBe('empty');
    expect(result.error).toBeDefined();
    expect(result.summary).toBeNull();
  });

  it('output stays under 6000 chars (1500 tokens)', async () => {
    const queryBlueprint = createQueryBlueprintTool(fullBlueprint);
    const result = await queryBlueprint.execute(
      { section: 'competitorAnalysis' },
      {} as never
    );
    expect(JSON.stringify(result).length).toBeLessThan(6000);
  });

  it('accepts optional aspect parameter without error', async () => {
    const queryBlueprint = createQueryBlueprintTool(fullBlueprint);
    const result = await queryBlueprint.execute(
      { section: 'industryMarketOverview', aspect: 'pain points' },
      {} as never
    );
    expect(result.status).toBe('loaded');
    expect(result.aspect).toBe('pain points');
  });
});
