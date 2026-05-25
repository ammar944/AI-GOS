import { describe, it, expect } from 'vitest';
import { trimResearchForScripts } from '../trim-research-context';

const fullResearch = {
  industryMarket: {
    data: {
      categorySnapshot: { category: 'Restaurant Tech', marketSize: '$5B' },
      painPoints: { primary: ['Time management', 'Online presence'] },
      marketDynamics: { demandDrivers: ['Digital shift'], buyingTriggers: ['COVID recovery'] },
    },
  },
  icpValidation: {
    data: {
      persona: { role: 'Restaurant Owner', company: 'SMB', demographics: 'US-based' },
      painPoints: ['No time for marketing', 'Inconsistent info across platforms'],
      desires: ['More foot traffic', 'Automated marketing'],
    },
  },
  offerAnalysis: {
    data: {
      valueProposition: '65-platform sync for restaurants',
      pricing: '$50/mo',
      differentiators: ['Cross-platform sync', '48h text updates'],
    },
  },
  competitors: {
    data: {
      competitors: [
        { name: 'Spothopper', positioning: 'Restaurant marketing', gaps: ['No sync'] },
        { name: 'SinglePlatform', positioning: 'Listing management', gaps: ['Expensive'] },
        { name: 'Yext', positioning: 'Enterprise listings', gaps: ['Too complex for SMB'] },
        { name: 'Fourth competitor', positioning: 'Niche', gaps: ['Small'] },
      ],
    },
  },
  keywordIntel: {
    data: {
      keywords: Array.from({ length: 20 }, (_, i) => ({
        keyword: `keyword-${i}`,
        volume: 1000 - i * 50,
        difficulty: 'medium',
        intent: 'commercial',
      })),
    },
  },
  crossAnalysis: {
    data: {
      keyInsights: [{ insight: 'SMBs need simple tools', priority: 'high' }],
      positioningStrategy: { recommendedAngle: 'Simplicity' },
    },
  },
  mediaPlan: {
    data: {
      channelMixBudget: { totalBudget: 5000, channels: ['meta', 'google'] },
    },
  },
};

describe('trimResearchForScripts', () => {
  it('returns an object with all priority sections', () => {
    const result = trimResearchForScripts(fullResearch);
    expect(result.icpValidation).toBeDefined();
    expect(result.offerAnalysis).toBeDefined();
    expect(result.competitors).toBeDefined();
    expect(result.keywordIntel).toBeDefined();
    expect(result.industryMarket).toBeDefined();
    expect(result.crossAnalysis).toBeDefined();
    expect(result.mediaPlan).toBeDefined();
  });

  it('includes full ICP data (priority section)', () => {
    const result = trimResearchForScripts(fullResearch);
    expect(result.icpValidation).toEqual(fullResearch.icpValidation.data);
  });

  it('limits competitors to top 3', () => {
    const result = trimResearchForScripts(fullResearch);
    expect(result.competitors?.competitors).toHaveLength(3);
  });

  it('limits keywords to top 10', () => {
    const result = trimResearchForScripts(fullResearch);
    expect(result.keywordIntel?.keywords).toHaveLength(10);
  });

  it('extracts targetAudience from ICP persona', () => {
    const result = trimResearchForScripts(fullResearch);
    expect(result.targetAudience).toContain('Restaurant Owner');
  });

  it('handles missing sections gracefully', () => {
    const partial = { icpValidation: fullResearch.icpValidation };
    const result = trimResearchForScripts(partial);
    expect(result.icpValidation).toBeDefined();
    expect(result.competitors).toBeUndefined();
  });

  it('serialized output is under 16000 chars (~8000 tokens)', () => {
    const result = trimResearchForScripts(fullResearch);
    const serialized = JSON.stringify(result);
    expect(serialized.length).toBeLessThan(16000);
  });
});
