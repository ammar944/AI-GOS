import { describe, expect, it } from 'vitest';
import { runResearchIndustryWithDeps } from '../runners/industry';
import type { RunnerProgressUpdate } from '../runner';

function createNow(values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? values[values.length - 1] ?? 0;
}

describe('runResearchIndustryWithDeps', () => {
  it('relables parent-market TAM as context instead of direct niche market size', async () => {
    const result = await runResearchIndustryWithDeps(
      [
        'Business context:',
        '- Company Name: SaaSLaunch',
        '- Business Model: B2B SaaS demand generation agency',
        '- Product Description: Paid media systems for growth-stage B2B SaaS teams',
        '- Ideal Customer Profile: Series A-B B2B SaaS teams',
      ].join('\n'),
      undefined,
      {
        now: createNow([3_000, 3_200]),
        parseJson: JSON.parse,
        runAttempt: async (_attemptContext, config) => {
          expect(config.mode).toBe('primary');

          return {
            resultText: JSON.stringify({
              categorySnapshot: {
                category: 'B2B SaaS Demand Generation Agencies',
                marketSize: '$390B+ B2B SaaS market',
                marketMaturity: 'growing',
                buyingBehavior: 'committee_driven',
                awarenessLevel: 'medium',
                averageSalesCycle: '90-120 days',
              },
              painPoints: {
                primary: ['Attribution gaps make CAC harder to control'],
                secondary: ['Teams lack specialist demand-gen bandwidth'],
                triggers: ['Pipeline slows while CAC keeps rising'],
              },
              marketDynamics: {
                demandDrivers: ['Pressure to prove marketing ROI'],
                buyingTriggers: ['New revenue leader wants clearer pipeline'],
                barriersToPurchase: ['Skepticism about agency ROI'],
              },
              trendSignals: [
                {
                  trend: 'CAC inflation',
                  direction: 'rising',
                  evidence: 'Benchmarks show acquisition costs still trending up.',
                },
              ],
              messagingOpportunities: {
                angles: ['Lead with revenue accountability'],
                summaryRecommendations: ['Own the CAC-to-pipeline narrative'],
              },
              citations: [
                {
                  url: 'https://www.mordorintelligence.com/industry-reports/b2b-saas-market',
                  title: 'B2B SaaS Market Size, Share Analysis, Growth Report 2026 – 2031',
                },
              ],
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 100,
                outputTokens: 350,
                totalTokens: 450,
              },
              estimatedCostUsd: 0.01,
            },
          };
        },
      },
    );

    expect(result.status).toBe('complete');
    if (result.status !== 'complete') {
      throw new Error('Expected industry result to complete');
    }
    const data = result.data as {
      categorySnapshot: {
        marketSize: string;
      };
    };

    expect(data.categorySnapshot.marketSize).toBe(
      'TAM context: $390B+ B2B SaaS market (parent market, not direct niche size)',
    );
  });

  it('repairs the artifact from captured evidence when the primary pass is truncated', async () => {
    const attempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];

    const result = await runResearchIndustryWithDeps(
      'Context about the business',
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([1_000, 1_900]),
        parseJson: JSON.parse,
        runAttempt: async (attemptContext, config, onProgress) => {
          attempts.push(config.mode);

          if (config.mode === 'primary') {
            await onProgress?.({
              phase: 'tool',
              message: 'source: B2B SaaS Market Size, Share Analysis, Growth Report 2026 – 2031 (mordorintelligence.com)',
            });
            await onProgress?.({
              phase: 'analysis',
              message: 'draft category: B2B SaaS Demand Generation Agencies',
            });
            return {
              resultText: '{"categorySnapshot":{"category":"B2B SaaS Demand Generation Agencies"}',
              telemetry: {
                model: config.model,
                stopReason: 'max_tokens',
                usage: {
                  inputTokens: 100,
                  outputTokens: 4500,
                  totalTokens: 4600,
                },
                estimatedCostUsd: 0.02,
              },
            };
          }

          expect(config.mode).toBe('repair');
          expect(attemptContext).toContain('CAPTURED SOURCES:');
          expect(attemptContext).toContain('INCOMPLETE DRAFT TO REPAIR:');

          return {
            resultText: JSON.stringify({
              categorySnapshot: {
                category: 'B2B SaaS Demand Generation Agencies',
                marketSize: '$390B+ B2B SaaS market',
                marketMaturity: 'growing',
                buyingBehavior: 'committee_driven',
                awarenessLevel: 'medium',
                averageSalesCycle: '90-120 days',
              },
              painPoints: {
                primary: ['Attribution gaps make CAC harder to control'],
                secondary: ['Teams lack specialist demand-gen bandwidth'],
                triggers: ['Pipeline slows while CAC keeps rising'],
              },
              marketDynamics: {
                demandDrivers: ['Pressure to prove marketing ROI'],
                buyingTriggers: ['New revenue leader wants clearer pipeline'],
                barriersToPurchase: ['Skepticism about agency ROI'],
              },
              trendSignals: [
                {
                  trend: 'CAC inflation',
                  direction: 'rising',
                  evidence: 'Benchmarks show acquisition costs still trending up.',
                },
              ],
              messagingOpportunities: {
                angles: ['Lead with revenue accountability'],
                summaryRecommendations: ['Own the CAC-to-pipeline narrative'],
              },
              citations: [
                {
                  url: 'https://www.mordorintelligence.com/industry-reports/b2b-saas-market',
                  title: 'B2B SaaS Market Size, Share Analysis, Growth Report 2026 – 2031',
                },
              ],
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 120,
                outputTokens: 400,
                totalTokens: 520,
              },
              estimatedCostUsd: 0.01,
            },
          };
        },
      },
    );

    expect(attempts).toEqual(['primary', 'repair']);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'industryResearch',
      durationMs: 900,
    });
    expect(progress.map((update) => update.message)).toContain(
      'market overview pass hit token limit — repairing artifact from captured evidence',
    );
  });

  it('repairs the artifact from captured evidence when the primary pass times out', async () => {
    const attempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];

    const result = await runResearchIndustryWithDeps(
      'Context about the business',
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([2_000, 2_750]),
        parseJson: JSON.parse,
        runAttempt: async (attemptContext, config, onProgress) => {
          attempts.push(config.mode);

          if (config.mode === 'primary') {
            await onProgress?.({
              phase: 'tool',
              message: 'source: B2B Buyer Journey Research in 2024 (wynter.com)',
            });
            await onProgress?.({
              phase: 'tool',
              message: 'source: B2B SaaS CAC Benchmarks | Powered by Search (poweredbysearch.com)',
            });
            await onProgress?.({
              phase: 'tool',
              message: 'source: B2B SaaS Trends That Will Drive The Industry In 2025 (growth.cx)',
            });
            throw new Error('Sub-agent timed out after 120s');
          }

          expect(config.mode).toBe('repair');
          expect(attemptContext).toContain('CAPTURED SOURCES:');

          return {
            resultText: JSON.stringify({
              categorySnapshot: {
                category: 'B2B SaaS Demand Generation Agencies',
                marketSize: '$390B+ B2B SaaS market',
                marketMaturity: 'growing',
                buyingBehavior: 'committee_driven',
                awarenessLevel: 'medium',
                averageSalesCycle: '90-120 days',
              },
              painPoints: {
                primary: ['Attribution gaps make CAC harder to control'],
                secondary: ['Teams lack specialist demand-gen bandwidth'],
                triggers: ['Pipeline slows while CAC keeps rising'],
              },
              marketDynamics: {
                demandDrivers: ['Pressure to prove marketing ROI'],
                buyingTriggers: ['New revenue leader wants clearer pipeline'],
                barriersToPurchase: ['Skepticism about agency ROI'],
              },
              trendSignals: [
                {
                  trend: 'CAC inflation',
                  direction: 'rising',
                  evidence: 'Benchmarks show acquisition costs still trending up.',
                },
              ],
              messagingOpportunities: {
                angles: ['Lead with revenue accountability'],
                summaryRecommendations: ['Own the CAC-to-pipeline narrative'],
              },
              citations: [
                {
                  url: 'https://wynter.com',
                  title: 'B2B Buyer Journey Research in 2024',
                },
              ],
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 120,
                outputTokens: 400,
                totalTokens: 520,
              },
              estimatedCostUsd: 0.01,
            },
          };
        },
      },
    );

    expect(attempts).toEqual(['primary', 'repair']);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'industryResearch',
      durationMs: 750,
    });
    expect(progress.map((update) => update.message)).toContain(
      'primary market overview pass timed out — repairing artifact from captured evidence',
    );
  });
});
