// Regression test for the research-fabrication-fix.
//
// Uses a recorded fixture taken from a real synthesize runner output that
// contained fabricated growth/scaling/ARR claims. The sweep helpers must
// strip every fabrication while preserving the legitimate strategic prose
// around it.

import { describe, it, expect } from 'vitest';
import {
  sweepStrategicNarrative,
  sweepExecutiveSummary,
  sweepCampaignPhases,
} from '../validation';

const RECORDED_DIRTY_NARRATIVE = `Given the strong pain signals and competitive white space, this client
is positioned to scale to $3M ARR in 18 months through aggressive Meta
and LinkedIn spend, targeting 30% YoY growth with a base-case CPL of $85.
The initial 90 days should focus on hook testing and audience validation
across the qualified ICP segments before scaling winning ad sets.`.trim();

const RECORDED_DIRTY_SUMMARY = {
  overview:
    'Multi-platform paid media plan designed to grow from $500K to $2M ARR through aggressive demand gen across LinkedIn, Meta, and Google Search.',
};

const RECORDED_DIRTY_PHASES = [
  {
    name: 'Foundation',
    phase: 1,
    durationWeeks: 4,
    objective:
      'Validate hooks and narrow audiences. Reach $1M ARR by end of Q2.',
    activities: [],
    successCriteria: [],
    estimatedBudget: 0,
  },
  {
    name: 'Scale',
    phase: 2,
    durationWeeks: 8,
    objective: 'Double down on winning ad sets and expand audiences.',
    activities: [],
    successCriteria: [],
    estimatedBudget: 0,
  },
];

describe('synthesize fabrication regression — narrative', () => {
  it('strips all forbidden growth/scale/ARR fragments when no baseline metrics are provided', () => {
    const clean = sweepStrategicNarrative(RECORDED_DIRTY_NARRATIVE, false, null);
    expect(clean).not.toMatch(/30\s*%\s*YoY/i);
    expect(clean).not.toMatch(/scale to \$3M ARR/i);
    expect(clean).not.toMatch(/\$3M ARR in 18 months/i);
    expect(clean).toContain('[growth rate not tracked]');
  });

  it('preserves legitimate campaign-phase language unchanged', () => {
    const clean = sweepStrategicNarrative(RECORDED_DIRTY_NARRATIVE, false, null);
    expect(clean).toContain('hook testing');
    expect(clean).toContain('audience validation');
    expect(clean).toContain('90 days');
    expect(clean).toContain('qualified ICP segments');
  });

  it('keeps a growth claim that cites the user-reported rate exactly', () => {
    const sentence =
      'Based on your reported 25% annual growth, the plan scales proportionally.';
    const result = sweepStrategicNarrative(sentence, true, 25);
    expect(result).toBe(sentence);
  });

  it('still strips a different growth number even when growth claims are allowed', () => {
    const sentence = 'Targeting 40% YoY growth despite reported 25%.';
    const result = sweepStrategicNarrative(sentence, true, 25);
    expect(result).not.toContain('40%');
    expect(result).toContain('[growth rate not tracked]');
  });
});

describe('synthesize fabrication regression — executive summary', () => {
  it('strips grow-from-to references in the summary overview', () => {
    const result = sweepExecutiveSummary(RECORDED_DIRTY_SUMMARY, false, null);
    expect(result.overview).not.toContain('grow from $500K to $2M ARR');
    expect(result.overview).not.toContain('$2M ARR');
    expect(result.overview).toContain('LinkedIn, Meta, and Google Search');
  });
});

describe('synthesize fabrication regression — campaign phases', () => {
  it('strips ARR-scaling targets in phase objectives without dropping the foundation language', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = sweepCampaignPhases(RECORDED_DIRTY_PHASES as any, false, null);
    expect(result[0].objective).not.toContain('$1M ARR');
    expect(result[0].objective).toContain('Validate hooks and narrow audiences');
    expect(result[1].objective).toBe('Double down on winning ad sets and expand audiences.');
  });
});
