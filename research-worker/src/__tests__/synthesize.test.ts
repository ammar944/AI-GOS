import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { RunnerProgressUpdate } from '../runner';

const mockGenerateObject = vi.fn();

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: (model: string) => `anthropic:${model}`,
}));

import { runSynthesizeResearch } from '../runners/synthesize';

function makeSynthesisResult() {
  return {
    keyInsights: [
      {
        insight: 'Pipeline attribution is the core buying trigger.',
        source: 'industryResearch' as const,
        implication: 'Lead ads with measurable revenue accountability.',
        priority: 'high' as const,
      },
      {
        insight: 'Competitors leave attribution proof vague.',
        source: 'competitorIntel' as const,
        implication: 'Use reporting transparency as the lead differentiator.',
        priority: 'high' as const,
      },
    ],
    positioningStrategy: {
      recommendedAngle: 'Pipeline accountability for growth-stage SaaS',
      alternativeAngles: [
        'Faster launch without enterprise agency overhead',
        'SaaS-only paid media systems',
      ],
      leadRecommendation: 'It directly answers the strongest market pain.',
      keyDifferentiator: 'Revenue-linked reporting systems',
    },
    platformRecommendations: [
      {
        platform: 'LinkedIn',
        role: 'primary' as const,
        budgetAllocation: '60% ($3,000)',
        rationale: 'The validated buyer lives in LinkedIn demand-gen workflows.',
        priority: 1,
      },
      {
        platform: 'Google Search',
        role: 'secondary' as const,
        budgetAllocation: '30% ($1,500)',
        rationale: 'Capture high-intent demand already searching for agencies.',
        priority: 2,
      },
    ],
    messagingAngles: [
      {
        angle: 'Stop guessing where pipeline comes from',
        targetEmotion: 'control',
        exampleHook: 'Finally prove which campaigns create revenue.',
        evidence: 'ICP objections and competitor weaknesses center on attribution.',
      },
      {
        angle: 'Revenue proof before retainer bloat',
        targetEmotion: 'relief',
        exampleHook: 'See pipeline-linked reporting in week one.',
        evidence: 'Objection: agencies overpromise. Proof: visible reporting from day one.',
      },
    ],
    criticalSuccessFactors: [
      'Clear attribution proof in creative and landing pages',
      'Tight LinkedIn to search sequencing',
      'Visible pipeline reporting from week one',
    ],
    nextSteps: [
      'Build attribution-led LinkedIn creative',
      'Launch branded and competitor search campaigns',
      'Create a reporting proof landing page',
    ],
    planningContext: {
      monthlyBudget: '$5,000',
      targetCpl: '$250',
      targetCac: '$2,000',
      downstreamSequence: ['keywordIntel' as const, 'mediaPlan' as const],
    },
    strategicNarrative:
      'SaaSLaunch should lead with pipeline accountability.',
  };
}

const SAMPLE_CONTEXT = [
  'Business context:',
  '- Company Name: SaaSLaunch',
  '- Monthly Ad Budget: $5,000',
  '',
  '## Market Overview',
  JSON.stringify({ categorySnapshot: { category: 'B2B SaaS Demand Generation' } }),
  '',
  '## Competitor Intel',
  JSON.stringify({ competitors: [{ name: 'Hey Digital', weaknesses: ['Weak attribution'] }] }),
  '',
  '## ICP Validation',
  JSON.stringify({ objections: ['Agencies overpromise', 'Attribution is unclear'] }),
].join('\n');

describe('runSynthesizeResearch', () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  it('produces a complete strategic synthesis using generateObject', async () => {
    const progress: RunnerProgressUpdate[] = [];

    mockGenerateObject.mockResolvedValueOnce({
      object: makeSynthesisResult(),
      usage: { inputTokens: 800, outputTokens: 600 },
    });

    const result = await runSynthesizeResearch(
      SAMPLE_CONTEXT,
      (update: RunnerProgressUpdate) => { progress.push(update); },
    );

    expect(result).toMatchObject({
      status: 'complete',
      section: 'strategicSynthesis',
    });
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(progress.map((u) => u.message)).toContain('strategic synthesis complete');
  });

  it('retries once on timeout then succeeds', async () => {
    const progress: RunnerProgressUpdate[] = [];

    const timeoutError = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    mockGenerateObject.mockRejectedValueOnce(timeoutError);
    mockGenerateObject.mockResolvedValueOnce({
      object: makeSynthesisResult(),
      usage: { inputTokens: 800, outputTokens: 600 },
    });

    const result = await runSynthesizeResearch(
      SAMPLE_CONTEXT,
      (update: RunnerProgressUpdate) => { progress.push(update); },
    );

    expect(result).toMatchObject({
      status: 'complete',
      section: 'strategicSynthesis',
    });
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    expect(progress.map((u) => u.message)).toContain('strategic synthesis timed out — retrying');
  });

  it('returns error after 2 consecutive timeouts', async () => {
    const timeoutError = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    mockGenerateObject.mockRejectedValueOnce(timeoutError);
    mockGenerateObject.mockRejectedValueOnce(timeoutError);

    const result = await runSynthesizeResearch(SAMPLE_CONTEXT);

    expect(result).toMatchObject({
      status: 'error',
      section: 'strategicSynthesis',
    });
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });

  it('returns error on non-timeout failures without retrying', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('API key invalid'));

    const result = await runSynthesizeResearch(SAMPLE_CONTEXT);

    expect(result).toMatchObject({
      status: 'error',
      section: 'strategicSynthesis',
      error: 'API key invalid',
    });
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });
});
