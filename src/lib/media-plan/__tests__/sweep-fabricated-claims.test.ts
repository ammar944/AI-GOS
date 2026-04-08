import { describe, it, expect } from 'vitest';
import { sweepFabricatedClaims } from '../validation';

describe('sweepFabricatedClaims — true positives (must be stripped)', () => {
  const FABRICATIONS = [
    'Targeting 30% YoY growth through aggressive paid spend.',
    'We expect 45% year-over-year growth.',
    'Aiming for 25% annualized growth across all channels.',
    'Expected to scale to $5M ARR in 18 months.',
    'Scale to $10M ARR in 24 months with this plan.',
    'Scale to $500K in revenue in 12 months.',
    'Growing from $500K to $2M ARR over the next year.',
    'Grow by $1M ARR this year.',
    'Plan to reach $10M ARR by end of year.',
    'Reach $3M ARR through paid acquisition.',
    'This positions you for 50% YoY growth.',
    'Project 40% annual growth in the B2B segment.',
  ];

  it.each(FABRICATIONS)('strips: %s', (sentence) => {
    const { clean, stripped } = sweepFabricatedClaims(sentence, false, null);
    expect(clean).not.toBe(sentence);
    expect(stripped.length).toBeGreaterThanOrEqual(1);
    expect(clean).toContain('[growth rate not tracked]');
  });
});

describe('sweepFabricatedClaims — true negatives (must pass unchanged)', () => {
  const LEGITIMATE = [
    'Industry benchmark: B2B SaaS sees 20-35% annual growth per Gartner 2025.',
    'Scale winning ad sets after 7 days of sustained CPL.',
    'Reach 10 million impressions monthly with the primary budget.',
    'Growth marketing requires consistent creative refresh.',
    'Scale spend gradually based on ROAS thresholds.',
    'This campaign drives brand awareness.',
    'Expected monthly leads: 120.',
    'LTV benchmarks range from $3000 to $8000 in this vertical.',
    'Customer retention in SaaS averages 12 months according to OpenView.',
    'Grow your email list through lead magnets.',
    'Reach younger demographics via TikTok.',
    'Scale creative testing in Phase 2.',
  ];

  it.each(LEGITIMATE)('passes: %s', (sentence) => {
    const { clean, stripped } = sweepFabricatedClaims(sentence, false, null);
    expect(clean).toBe(sentence);
    expect(stripped).toEqual([]);
  });
});

describe('sweepFabricatedClaims — growth-rate gating', () => {
  it('permits a growth claim that cites the user-reported rate', () => {
    const sentence =
      'Based on your reported 25% trailing twelve-month growth, this plan scales proportionally.';
    const { clean, stripped } = sweepFabricatedClaims(sentence, true, 25);
    expect(clean).toBe(sentence);
    expect(stripped).toEqual([]);
  });

  it('still strips a different growth number even when growth claims are allowed', () => {
    const sentence = 'Targeting 40% YoY growth.';
    const { clean, stripped } = sweepFabricatedClaims(sentence, true, 25);
    expect(clean).not.toBe(sentence);
    expect(stripped.length).toBe(1);
  });

  it('strips all growth claims when allowGrowthClaims is false even if userGrowthRate is provided', () => {
    const sentence = 'Targeting 25% YoY growth.';
    const { clean } = sweepFabricatedClaims(sentence, false, 25);
    expect(clean).not.toBe(sentence);
  });
});

describe('sweepFabricatedClaims — pipeline integration helpers', () => {
  it('sweepExecutiveSummary scrubs the overview field', async () => {
    const { sweepExecutiveSummary } = await import('../validation');
    const dirty = 'Targeting 30% YoY growth. Scale to $5M ARR in 18 months.';
    const result = sweepExecutiveSummary({ overview: dirty }, false, null);
    expect(result.overview).not.toContain('30%');
    expect(result.overview).not.toContain('$5M ARR');
    expect(result.overview).toContain('[growth rate not tracked]');
  });

  it('sweepCampaignPhases scrubs every description', async () => {
    const { sweepCampaignPhases } = await import('../validation');
    const phases = [
      { description: 'Phase 1: Targeting 30% YoY growth.' },
      { description: 'Phase 2: Scale winning ad sets.' },
      { description: undefined },
    ];
    const result = sweepCampaignPhases(phases, false, null);
    expect(result[0].description).toContain('[growth rate not tracked]');
    expect(result[1].description).toBe('Phase 2: Scale winning ad sets.');
    expect(result[2].description).toBeUndefined();
  });

  it('sweepStrategicNarrative returns the cleaned string', async () => {
    const { sweepStrategicNarrative } = await import('../validation');
    const result = sweepStrategicNarrative('Scale to $3M ARR in 18 months.', false, null);
    expect(result).not.toContain('$3M ARR');
    expect(result).toContain('[growth rate not tracked]');
  });
});
