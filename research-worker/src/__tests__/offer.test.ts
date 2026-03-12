import { describe, expect, it } from 'vitest';
import { runResearchOfferWithDeps } from '../runners/offer';

function createNow(values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? values[values.length - 1] ?? 0;
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

          return {
            resultText: JSON.stringify({
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
                topStrengths: [
                  'Strong pain alignment',
                  'Clear category fit',
                ],
                priorityFixes: [
                  'Sharpen proof before scale',
                  'Make launch scope more concrete',
                ],
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
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 110,
                outputTokens: 320,
                totalTokens: 430,
              },
              estimatedCostUsd: 0.008,
            },
          };
        },
      },
    );

    expect(toolsPerAttempt).toEqual([['web_search']]);
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

          return {
            resultText: JSON.stringify({
              offerStrength: {
                overallScore: 8,
                painRelevance: 8,
                urgency: 7,
                differentiation: 7,
                tangibility: 8,
                proof: 7,
                pricingLogic: 8,
              },
              recommendation: {
                status: 'proceed',
                summary: 'The offer is clear enough for launch if the pricing page supports the proof story.',
                topStrengths: [
                  'Clear outcome',
                  'Concrete pricing context',
                ],
                priorityFixes: [
                  'Tighten proof placement',
                ],
                recommendedActionPlan: [
                  'Refresh the pricing page proof strip',
                  'Launch pricing-intent search ads',
                  'Pressure-test retainer objections in copy',
                ],
              },
              redFlags: [
                {
                  issue: 'Proof is still lighter than the headline promise.',
                  severity: 'medium',
                  priority: 1,
                  recommendedAction: 'Add concrete proof to the pricing page.',
                  launchBlocker: false,
                  evidence: 'The pricing context is stronger than the testimonial stack.',
                },
              ],
              pricingAnalysis: {
                currentPricing: '$4,000/mo starter retainer',
                marketBenchmark: '$3,000-$7,000/mo for comparable agencies',
                pricingPosition: 'mid-market',
                coldTrafficViability: 'Viable if the funnel keeps price-to-proof alignment tight.',
              },
              marketFitAssessment: 'The market fit is strong when the pricing page supports the proof story.',
              messagingRecommendations: [
                'Lead with pricing clarity.',
                'Pair price with pipeline-proof outcomes.',
              ],
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 120,
                outputTokens: 340,
                totalTokens: 460,
              },
              estimatedCostUsd: 0.009,
            },
          };
        },
      },
    );

    expect(toolsPerAttempt).toEqual([['web_search', 'firecrawl']]);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'offerAnalysis',
      durationMs: 240,
    });
  });
});
