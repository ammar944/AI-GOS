import { describe, it, expect } from 'vitest';
import { buildScriptMatrix, validateMatrixDiversity } from '../stages/01-plan/planner';

const DEFAULT_INPUT = {
  objections: ['Too expensive', 'No time', 'Already tried this', 'Scam fear'],
  proofPointCount: 5,
  claimCount: 15,
  hasCompetitorAds: true,
  hasCaseStudies: true,
};

describe('buildScriptMatrix', () => {
  it('produces exactly 15 scripts', () => {
    const plans = buildScriptMatrix(DEFAULT_INPUT);
    expect(plans).toHaveLength(15);
  });

  it('assigns 3 scripts per awareness level', () => {
    const plans = buildScriptMatrix(DEFAULT_INPUT);
    const byLevel = new Map<string, number>();
    for (const p of plans) {
      byLevel.set(p.awarenessLevel, (byLevel.get(p.awarenessLevel) ?? 0) + 1);
    }
    expect(byLevel.get('unaware')).toBe(3);
    expect(byLevel.get('problem')).toBe(3);
    expect(byLevel.get('solution')).toBe(3);
    expect(byLevel.get('product')).toBe(3);
    expect(byLevel.get('mostAware')).toBe(3);
  });

  it('distributes platforms evenly (5 each)', () => {
    const plans = buildScriptMatrix(DEFAULT_INPUT);
    const byPlatform = new Map<string, number>();
    for (const p of plans) {
      byPlatform.set(p.platform, (byPlatform.get(p.platform) ?? 0) + 1);
    }
    expect(byPlatform.get('meta')).toBe(5);
    expect(byPlatform.get('google')).toBe(5);
    expect(byPlatform.get('linkedin')).toBe(5);
  });

  it('distributes formats evenly (5 each)', () => {
    const plans = buildScriptMatrix(DEFAULT_INPUT);
    const byFormat = new Map<string, number>();
    for (const p of plans) {
      byFormat.set(p.format, (byFormat.get(p.format) ?? 0) + 1);
    }
    expect(byFormat.get('video')).toBe(5);
    expect(byFormat.get('static')).toBe(5);
    expect(byFormat.get('email')).toBe(5);
  });

  it('uses at least 4 distinct frameworks', () => {
    const plans = buildScriptMatrix(DEFAULT_INPUT);
    const frameworks = new Set(plans.map((p) => p.framework));
    expect(frameworks.size).toBeGreaterThanOrEqual(4);
  });

  it('assigns no duplicate angles within same level', () => {
    const plans = buildScriptMatrix(DEFAULT_INPUT);
    const levels = ['unaware', 'problem', 'solution', 'product', 'mostAware'];
    for (const level of levels) {
      const levelPlans = plans.filter((p) => p.awarenessLevel === level);
      const angles = levelPlans.map((p) => p.angle);
      expect(new Set(angles).size).toBe(angles.length);
    }
  });

  it('assigns no duplicate platforms within same level', () => {
    const plans = buildScriptMatrix(DEFAULT_INPUT);
    const levels = ['unaware', 'problem', 'solution', 'product', 'mostAware'];
    for (const level of levels) {
      const levelPlans = plans.filter((p) => p.awarenessLevel === level);
      const platforms = levelPlans.map((p) => p.platform);
      expect(new Set(platforms).size).toBe(platforms.length);
    }
  });

  it('maps in-market tiers correctly from awareness levels', () => {
    const plans = buildScriptMatrix(DEFAULT_INPUT);
    for (const p of plans) {
      if (p.awarenessLevel === 'mostAware' || p.awarenessLevel === 'product') {
        expect(p.inMarketTier).toBe('in-market');
      } else if (p.awarenessLevel === 'solution' || p.awarenessLevel === 'problem') {
        expect(p.inMarketTier).toBe('needs-convinced');
      } else {
        expect(p.inMarketTier).toBe('cold-mass');
      }
    }
  });

  it('assigns sub-segments only to in-market tier', () => {
    const plans = buildScriptMatrix(DEFAULT_INPUT);
    for (const p of plans) {
      if (p.inMarketTier === 'in-market') {
        expect(p.subSegment).not.toBeNull();
      } else {
        expect(p.subSegment).toBeNull();
      }
    }
  });

  it('assigns objections to at least 6 scripts', () => {
    const plans = buildScriptMatrix(DEFAULT_INPUT);
    const withObjections = plans.filter((p) => p.objectionToHandle !== null);
    expect(withObjections.length).toBeGreaterThanOrEqual(6);
  });

  it('assigns duration based on awareness level', () => {
    const plans = buildScriptMatrix(DEFAULT_INPUT);
    for (const p of plans) {
      if (p.awarenessLevel === 'mostAware' || p.awarenessLevel === 'product') {
        expect(p.duration).toBe('30s');
      } else if (p.awarenessLevel === 'solution' || p.awarenessLevel === 'problem') {
        expect(p.duration).toBe('60s');
      } else {
        expect(p.duration).toBe('90s');
      }
    }
  });

  it('works with zero objections and zero proof points', () => {
    const plans = buildScriptMatrix({
      objections: [],
      proofPointCount: 0,
      claimCount: 5,
      hasCompetitorAds: false,
      hasCaseStudies: false,
    });
    expect(plans).toHaveLength(15);
    const violations = validateMatrixDiversity(plans);
    expect(violations).toHaveLength(0);
  });
});

describe('validateMatrixDiversity', () => {
  it('passes for a valid matrix', () => {
    const plans = buildScriptMatrix(DEFAULT_INPUT);
    const violations = validateMatrixDiversity(plans);
    expect(violations).toHaveLength(0);
  });
});
