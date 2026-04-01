import { describe, expect, it } from 'vitest';
import { runResearchOfferWithDeps } from '../runners/offer';

function createNow(values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? values[values.length - 1] ?? 0;
}

const MINIMAL_RESULT_TEXT = JSON.stringify({
  offerStrength: {
    overallScore: 7,
    painRelevance: 8,
    urgency: 7,
    differentiation: 6,
    tangibility: 7,
    proof: 6,
    pricingLogic: 7,
  },
  recommendation: {
    status: 'proceed',
    summary: 'The offer is credible enough to launch if the proof story stays concrete.',
    topStrengths: ['Strong pain alignment', 'Clear category fit'],
    priorityFixes: ['Sharpen proof before scale', 'Make launch scope more concrete'],
    recommendedActionPlan: [
      'Lead with pipeline-proof headlines',
      'Show a tighter launch scope',
      'Pressure-test price objections in search copy',
    ],
  },
  redFlags: [
    {
      issue: 'Proof story is still thinner than the promise.',
      severity: 'medium',
      priority: 1,
      recommendedAction: 'Add concrete proof before scaling cold traffic.',
      launchBlocker: false,
      evidence: 'The offer promise is stronger than the visible proof stack.',
    },
  ],
  pricingAnalysis: {
    currentPricing: 'Custom proposal',
    marketBenchmark: 'Mid-market agency retainers vary widely',
    pricingPosition: 'unclear',
    coldTrafficViability: 'Viable if proof and launch scope are explicit in the funnel.',
  },
  marketFitAssessment: 'The market wants the outcome, but proof needs to stay prominent.',
  messagingRecommendations: [
    'Lead with pipeline accountability.',
    'Reduce retainer anxiety with transparent scope.',
  ],
});

function makeFakeTelemetry(model: string) {
  return {
    model,
    stopReason: 'end_turn' as const,
    usage: { inputTokens: 110, outputTokens: 320, totalTokens: 430 },
    estimatedCostUsd: 0.008,
  };
}

describe('runResearchOfferWithDeps', () => {
  it('does not expose Firecrawl when no first-party URL is present in context', async () => {
    const toolsPerAttempt: string[][] = [];

    const result = await runResearchOfferWithDeps(
      [
        'Business context:',
        '- Company Name: SaaSLaunch',
        '- Product Description: Paid media systems for B2B SaaS teams',
        '- Goals: Generate more qualified demos and lower CAC',
      ].join('\n'),
      undefined,
      {
        now: createNow([1_000, 1_220]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => {
          toolsPerAttempt.push(config.tools.map((tool) => tool.name));
          return { resultText: MINIMAL_RESULT_TEXT, telemetry: makeFakeTelemetry(config.model) };
        },
      },
    );

    expect(toolsPerAttempt).toEqual([['web_search', 'adLibrary']]);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'offerAnalysis',
      durationMs: 220,
    });
  });

  it('exposes Firecrawl only when a first-party pricing or website URL is present', async () => {
    const toolsPerAttempt: string[][] = [];

    const result = await runResearchOfferWithDeps(
      [
        'Business context:',
        '- Company Name: SaaSLaunch',
        '- Product Description: Paid media systems for B2B SaaS teams',
        '- Website URL: https://saaslaunch.test',
        '- Pricing Page URL: https://saaslaunch.test/pricing',
      ].join('\n'),
      undefined,
      {
        now: createNow([2_000, 2_240]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => {
          toolsPerAttempt.push(config.tools.map((tool) => tool.name));
          return { resultText: MINIMAL_RESULT_TEXT, telemetry: makeFakeTelemetry(config.model) };
        },
      },
    );

    expect(toolsPerAttempt).toEqual([['web_search', 'firecrawlExtract', 'firecrawl', 'adLibrary']]);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'offerAnalysis',
      durationMs: 240,
    });
  });

  it('includes adLibraryTool in the tool array for both the no-URL and with-URL branches', async () => {
    const noUrlTools: string[][] = [];
    const withUrlTools: string[][] = [];

    await runResearchOfferWithDeps(
      '- Company Name: AcmeCo\n- Product Description: B2B SaaS platform',
      undefined,
      {
        now: createNow([0, 100]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => {
          noUrlTools.push(config.tools.map((t) => t.name));
          return { resultText: MINIMAL_RESULT_TEXT, telemetry: makeFakeTelemetry(config.model) };
        },
      },
    );

    await runResearchOfferWithDeps(
      '- Company Name: AcmeCo\n- Website URL: https://acmeco.test',
      undefined,
      {
        now: createNow([0, 100]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => {
          withUrlTools.push(config.tools.map((t) => t.name));
          return { resultText: MINIMAL_RESULT_TEXT, telemetry: makeFakeTelemetry(config.model) };
        },
      },
    );

    // adLibrary must appear in both branches
    expect(noUrlTools[0]).toContain('adLibrary');
    expect(withUrlTools[0]).toContain('adLibrary');

    // firecrawl tools must only appear when a first-party URL is present
    expect(noUrlTools[0]).not.toContain('firecrawl');
    expect(withUrlTools[0]).toContain('firecrawl');
  });

  it('system prompt instructs use of ad_library / adLibrary tool for the client', () => {
    // Capture the system prompt by intercepting config.system
    let capturedSystemPrompt = '';

    // We can read the system prompt by running a dummy attempt and checking config.system
    const promise = runResearchOfferWithDeps(
      '- Company Name: AcmeCo',
      undefined,
      {
        now: createNow([0, 100]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => {
          capturedSystemPrompt = config.system;
          return { resultText: MINIMAL_RESULT_TEXT, telemetry: makeFakeTelemetry(config.model) };
        },
      },
    );

    return promise.then(() => {
      // Verify ad library guidance appears in the prompt
      const promptLower = capturedSystemPrompt.toLowerCase();
      expect(
        promptLower.includes('ad library') || promptLower.includes('adlibrary'),
      ).toBe(true);
    });
  });
});
