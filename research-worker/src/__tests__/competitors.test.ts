import { describe, expect, it, vi } from 'vitest';
import {
  isCompetitorTimeoutError,
  runResearchCompetitorsWithDeps,
  shouldRetryCompetitorsWithFallback,
  shouldRetryCompetitorsWithRescue,
} from '../runners/competitors';
import type { RunnerProgressUpdate } from '../runner';

function createNow(values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? values[values.length - 1] ?? 0;
}

describe('isCompetitorTimeoutError', () => {
  it('matches request timeout errors', () => {
    expect(isCompetitorTimeoutError(new Error('Request timed out.'))).toBe(true);
    expect(isCompetitorTimeoutError(new Error('Sub-agent timed out after 90s'))).toBe(true);
    expect(isCompetitorTimeoutError(new Error('network timeout while reading body'))).toBe(true);
    expect(isCompetitorTimeoutError(new Error('Invalid API key'))).toBe(false);
  });
});

describe('shouldRetryCompetitorsWithFallback', () => {
  it('retries when the response was truncated by max tokens', () => {
    expect(
      shouldRetryCompetitorsWithFallback({
        parseError: new Error('Unexpected end of JSON input'),
        telemetry: {
          stopReason: 'max_tokens',
        },
      }),
    ).toBe(true);
  });

  it('does not retry when parsing succeeded or the stop reason differs', () => {
    expect(
      shouldRetryCompetitorsWithFallback({
        parseError: undefined,
        telemetry: {
          stopReason: 'max_tokens',
        },
      }),
    ).toBe(false);
    expect(
      shouldRetryCompetitorsWithFallback({
        parseError: new Error('Unexpected end of JSON input'),
        telemetry: {
          stopReason: 'end_turn',
        },
      }),
    ).toBe(false);
  });
});

describe('shouldRetryCompetitorsWithRescue', () => {
  it('retries when the compact repair pass also hit max tokens', () => {
    expect(
      shouldRetryCompetitorsWithRescue({
        parseError: new Error('Unexpected end of JSON input'),
        telemetry: {
          stopReason: 'max_tokens',
        },
      }),
    ).toBe(true);
  });

  it('does not retry when parsing succeeded or the stop reason differs', () => {
    expect(
      shouldRetryCompetitorsWithRescue({
        parseError: undefined,
        telemetry: {
          stopReason: 'max_tokens',
        },
      }),
    ).toBe(false);
    expect(
      shouldRetryCompetitorsWithRescue({
        parseError: new Error('Unexpected end of JSON input'),
        telemetry: {
          stopReason: 'end_turn',
        },
      }),
    ).toBe(false);
  });
});

describe('runResearchCompetitorsWithDeps', () => {
  it('normalizes low-confidence ad data to limited-coverage semantics', async () => {
    const result = await runResearchCompetitorsWithDeps(
      'Context about the business',
      undefined,
      {
        now: createNow([9_000, 9_350]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => {
          expect(config.mode).toBe('primary');

          return {
            resultText: JSON.stringify({
              competitors: [
                {
                  name: 'Acme',
                  website: 'https://acme.test',
                  positioning: 'Fast attribution for B2B teams',
                  price: 'See pricing page',
                  pricingConfidence: 'low',
                  strengths: ['Known in the category'],
                  weaknesses: ['Long implementation cycle'],
                  opportunities: ['Own implementation speed'],
                  ourAdvantage: 'Faster onboarding and clearer paid media reporting.',
                  adActivity: {
                    activeAdCount: 2,
                    platforms: ['LinkedIn'],
                    themes: ['Revenue visibility'],
                    evidence: 'Foreplay historical creative snapshots only.',
                    sourceConfidence: 'low',
                  },
                },
              ],
              marketPatterns: ['Most competitors lean on platform-centric positioning'],
              marketStrengths: ['Strong category education'],
              marketWeaknesses: ['Weak speed messaging'],
              whiteSpaceGaps: [
                {
                  gap: 'No competitor owns speed-to-value',
                  type: 'messaging',
                  evidence: 'Review complaints center on slow onboarding',
                  exploitability: 8,
                  impact: 8,
                  recommendedAction: 'Lead with implementation speed in paid creative',
                },
              ],
              overallLandscape: 'Crowded market with weak speed messaging.',
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 100,
                outputTokens: 350,
                totalTokens: 450,
              },
              estimatedCostUsd: 0.002,
            },
          };
        },
      },
    );

    expect(result.status).toBe('complete');
    if (result.status !== 'complete') {
      throw new Error('Expected competitor result to complete');
    }

    expect(result.data).toMatchObject({
      competitors: [
        {
          adActivity: {
            activeAdCount: 2,
            platforms: ['Not verified'],
            evidence: expect.stringContaining('Limited coverage'),
            sourceConfidence: 'low',
          },
        },
      ],
    });
  });

  it('preserves enriched ad evidence with adCreatives and libraryLinks', async () => {
    const result = await runResearchCompetitorsWithDeps(
      'Context about the business',
      undefined,
      {
        now: createNow([9_000, 9_350]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => {
          expect(config.mode).toBe('primary');

          return {
            resultText: JSON.stringify({
              competitors: [
                {
                  name: 'Hey Digital',
                  website: 'https://heydigital.com',
                  positioning: 'B2B SaaS PPC agency',
                  strengths: ['Strong case studies'],
                  weaknesses: ['Limited platform coverage'],
                  opportunities: ['Win on multi-channel'],
                  ourAdvantage: 'Broader platform strategy.',
                  adActivity: {
                    activeAdCount: 8,
                    platforms: ['LinkedIn', 'Google'],
                    themes: ['Pipeline growth'],
                    evidence: 'Observed 8 current ad-library records.',
                    sourceConfidence: 'medium',
                  },
                  adCreatives: [
                    {
                      platform: 'linkedin',
                      id: 'li-1',
                      advertiser: 'Hey Digital',
                      headline: 'Pipeline growth for B2B SaaS',
                      format: 'image',
                      isActive: true,
                      detailsUrl: 'https://www.linkedin.com/ad-library/detail/1',
                    },
                  ],
                  libraryLinks: {
                    metaLibraryUrl: 'https://www.facebook.com/ads/library/?q=Hey%20Digital',
                    linkedInLibraryUrl: 'https://www.linkedin.com/ad-library/search?keyword=Hey%20Digital',
                    googleAdvertiserUrl: 'https://adstransparency.google.com/?q=heydigital.com',
                  },
                },
              ],
              marketPatterns: ['Competitors lean on channel execution'],
              whiteSpaceGaps: [
                {
                  gap: 'Multi-channel accountability',
                  type: 'channel',
                  evidence: 'Competitors focus on single platforms.',
                  exploitability: 8,
                  impact: 7,
                  recommendedAction: 'Lead with cross-platform proof.',
                },
              ],
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: { inputTokens: 100, outputTokens: 350, totalTokens: 450 },
              estimatedCostUsd: 0.002,
            },
          };
        },
      },
    );

    expect(result.status).toBe('complete');
    if (result.status !== 'complete') throw new Error('Expected complete');

    expect(result.data).toMatchObject({
      competitors: [
        {
          name: 'Hey Digital',
          adCreatives: [
            {
              platform: 'linkedin',
              id: 'li-1',
              headline: 'Pipeline growth for B2B SaaS',
              detailsUrl: 'https://www.linkedin.com/ad-library/detail/1',
            },
          ],
          libraryLinks: {
            metaLibraryUrl: expect.stringContaining('facebook.com/ads/library'),
            linkedInLibraryUrl: expect.stringContaining('linkedin.com/ad-library'),
          },
        },
      ],
    });
  });

  it('preserves libraryLinks with empty adCreatives for low-confidence competitors', async () => {
    const result = await runResearchCompetitorsWithDeps(
      'Context about the business',
      undefined,
      {
        now: createNow([9_000, 9_350]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => ({
          resultText: JSON.stringify({
            competitors: [
              {
                name: 'Unknown Corp',
                website: 'https://unknowncorp.test',
                positioning: 'Unknown positioning',
                strengths: ['Brand awareness'],
                weaknesses: ['No verified ad data'],
                opportunities: ['Win on proof'],
                ourAdvantage: 'Verified current ad presence.',
                adActivity: {
                  activeAdCount: 0,
                  platforms: ['Not verified'],
                  themes: ['Unknown'],
                  evidence: 'Limited coverage: no ad-library sources returned results.',
                  sourceConfidence: 'low',
                },
                adCreatives: [],
                libraryLinks: {
                  metaLibraryUrl: 'https://www.facebook.com/ads/library/?q=Unknown%20Corp',
                  linkedInLibraryUrl: 'https://www.linkedin.com/ad-library/search?keyword=Unknown%20Corp',
                  googleAdvertiserUrl: 'https://adstransparency.google.com/?q=unknowncorp.test',
                },
              },
            ],
            marketPatterns: ['Sparse ad coverage'],
            whiteSpaceGaps: [
              {
                gap: 'Ad presence',
                type: 'channel',
                evidence: 'Competitors have weak ad presence.',
                exploitability: 7,
                impact: 6,
                recommendedAction: 'Run visible ads to own the space.',
              },
            ],
          }),
          telemetry: {
            model: config.model,
            stopReason: 'end_turn',
            usage: { inputTokens: 80, outputTokens: 250, totalTokens: 330 },
            estimatedCostUsd: 0.001,
          },
        }),
      },
    );

    expect(result.status).toBe('complete');
    if (result.status !== 'complete') throw new Error('Expected complete');

    const competitor = (result.data as { competitors: Array<Record<string, unknown>> }).competitors[0]!;
    expect(competitor.adCreatives).toEqual([]);
    expect(competitor.libraryLinks).toMatchObject({
      metaLibraryUrl: expect.stringContaining('facebook.com/ads/library'),
    });
    expect(competitor.adActivity).toMatchObject({
      platforms: ['Not verified'],
      evidence: expect.stringContaining('Limited coverage'),
    });
  });

  it('routes timeout recovery through a no-tool repair pass without restarting research', async () => {
    const toolAttempts: string[] = [];
    const messageAttempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];
    let repairContext = '';
    const primaryContext = [
      'Journey research sandbox context',
      'Section: Competitor Intel',
      '',
      'Business context:',
      '- Company Name: Acme',
      '- Business Model: B2B SaaS demand generation agency',
      '- Product Description: Paid media systems for B2B SaaS teams',
      '- Top Competitors: Hey Digital, Sales Captain',
      '- Unique Edge: Revenue-first attribution and faster launch speed',
      '',
      'Existing persisted research to reuse:',
      '',
      '## Market Overview',
      JSON.stringify({
        categorySnapshot: {
          category: 'B2B SaaS Demand Generation & Paid Media Services',
          marketSize: '$1B+',
        },
        marketDynamics: {
          demandDrivers: ['Long sales cycles', 'CAC pressure', 'Attribution gaps'],
        },
      }),
    ].join('\n');

    const result = await runResearchCompetitorsWithDeps(
      primaryContext,
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([1_000, 1_850]),
        parseJson: JSON.parse,
        runToolAttempt: async (_attemptContext, config, onProgress) => {
          toolAttempts.push(config.mode);
          expect(config.mode).toBe('primary');

          await onProgress?.({
            phase: 'tool',
            message: 'source: Hey Digital | Drive Pipeline Growth & Revenue For Your B2B SaaS (heydigital.co)',
          });
          await onProgress?.({
            phase: 'tool',
            message: 'source: Salescaptain Case Studies (salescaptain.io)',
          });
          await onProgress?.({
            phase: 'tool',
            message: 'source: B2B SaaS Marketing Agency: Accelerate Growth | Growth Marketing Pro (growthmarketingpro.com)',
          });
          throw new Error('Request timed out.');
        },
        runMessageAttempt: async (attemptContext, config) => {
          messageAttempts.push(config.mode);
          repairContext = attemptContext;
          expect(config.mode).toBe('repair');

          return {
            resultText: JSON.stringify({
              competitors: [
                {
                  name: 'Acme',
                  website: 'https://acme.test',
                  positioning: 'Fast attribution for B2B teams',
                  price: 'See pricing page',
                  pricingConfidence: 'low',
                  strengths: ['Known in the category'],
                  weaknesses: ['Long implementation cycle'],
                  opportunities: ['Own implementation speed'],
                  ourAdvantage: 'Faster onboarding and clearer paid media reporting.',
                  adActivity: {
                    activeAdCount: 3,
                    platforms: ['LinkedIn'],
                    themes: ['Revenue visibility'],
                    evidence: 'SearchAPI returned recent LinkedIn ad examples.',
                    sourceConfidence: 'medium',
                  },
                  threatAssessment: {
                    threatFactors: {
                      marketShareRecognition: 7,
                      adSpendIntensity: 5,
                      productOverlap: 8,
                      priceCompetitiveness: 4,
                      growthTrajectory: 6,
                    },
                    topAdHooks: ['Revenue visibility'],
                    counterPositioning: 'Lead with implementation speed.',
                  },
                },
              ],
              marketPatterns: ['Most competitors lean on platform-centric positioning'],
              marketStrengths: ['Strong category education'],
              marketWeaknesses: ['Weak speed messaging'],
              whiteSpaceGaps: [
                {
                  gap: 'No competitor owns speed-to-value',
                  type: 'messaging',
                  evidence: 'Review complaints center on slow onboarding',
                  exploitability: 8,
                  impact: 8,
                  recommendedAction: 'Lead with implementation speed in paid creative',
                },
              ],
              overallLandscape: 'Crowded market with weak speed messaging.',
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 100,
                outputTokens: 50,
                totalTokens: 150,
              },
              estimatedCostUsd: 0.0012,
            },
          };
        },
      },
    );

    expect(toolAttempts).toEqual(['primary']);
    expect(messageAttempts).toEqual(['repair']);
    expect(repairContext).toContain('CAPTURED SOURCES:');
    expect(repairContext).toContain('- Company Name: Acme');
    expect(repairContext).not.toContain('Existing persisted research to reuse:');
    expect(repairContext).not.toContain('## Market Overview');
    expect(repairContext.length).toBeLessThan(1_500);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'competitorIntel',
      durationMs: 850,
    });
    expect(progress.map((update) => update.message)).toEqual(
      expect.arrayContaining([
        'attempt primary (model: claude-sonnet-4-6, tools: enabled) started',
        'attempt primary (model: claude-sonnet-4-6, tools: enabled) timed out (source: request_timeout)',
        'primary competitor pass timed out — repairing artifact from captured evidence',
        'repair evidence package prepared (business lines: 5, searches: 0, sources: 3, analysis notes: 0, draft chars: 0, total chars: 825)',
        'attempt repair (model: claude-sonnet-4-6, tools: disabled) started',
        'attempt repair (model: claude-sonnet-4-6, tools: disabled) completed (stop reason: end_turn)',
      ]),
    );
  });

  it('returns an error immediately for non-timeout failures', async () => {
    const runAttempt = vi.fn(async () => {
      throw new Error('Invalid API key');
    });

    const result = await runResearchCompetitorsWithDeps(
      'Context about the business',
      undefined,
      {
        now: createNow([2_000, 2_050]),
        runAttempt,
      },
    );

    expect(runAttempt).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'error',
      section: 'competitorIntel',
      error: 'Invalid API key',
      durationMs: 50,
    });
  });

  it('falls back to the compact pass when the primary attempt is truncated at max tokens', async () => {
    const attempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];

    const result = await runResearchCompetitorsWithDeps(
      'Context about the business',
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([5_000, 5_900]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => {
          attempts.push(config.mode);

          if (config.mode === 'primary') {
            return {
              resultText: '{"competitors":[{"name":"Acme"}',
              telemetry: {
                model: config.model,
                stopReason: 'max_tokens',
                usage: {
                  inputTokens: 100,
                  outputTokens: 6500,
                  totalTokens: 6600,
                },
                estimatedCostUsd: 0.02,
              },
            };
          }

          return {
            resultText: JSON.stringify({
              competitors: [
                {
                  name: 'Acme',
                  website: 'https://acme.test',
                  positioning: 'Fast attribution for B2B teams',
                  price: 'See pricing page',
                  pricingConfidence: 'low',
                  strengths: ['Known in the category'],
                  weaknesses: ['Long implementation cycle'],
                  opportunities: ['Own implementation speed'],
                  ourAdvantage: 'Faster onboarding and clearer paid media reporting.',
                  adActivity: {
                    activeAdCount: 3,
                    platforms: ['LinkedIn'],
                    themes: ['Revenue visibility'],
                    evidence: 'SearchAPI returned recent LinkedIn ad examples.',
                    sourceConfidence: 'medium',
                  },
                  threatAssessment: {
                    threatFactors: {
                      marketShareRecognition: 7,
                      adSpendIntensity: 5,
                      productOverlap: 8,
                      priceCompetitiveness: 4,
                      growthTrajectory: 6,
                    },
                    topAdHooks: ['Revenue visibility'],
                    counterPositioning: 'Lead with implementation speed.',
                  },
                },
              ],
              marketPatterns: ['Most competitors lean on platform-centric positioning'],
              marketStrengths: ['Strong category education'],
              marketWeaknesses: ['Weak speed messaging'],
              whiteSpaceGaps: [
                {
                  gap: 'No competitor owns speed-to-value',
                  type: 'messaging',
                  evidence: 'Review complaints center on slow onboarding',
                  exploitability: 8,
                  impact: 8,
                  recommendedAction: 'Lead with implementation speed in paid creative',
                },
              ],
              overallLandscape: 'Crowded market with weak speed messaging.',
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 120,
                outputTokens: 400,
                totalTokens: 520,
              },
              estimatedCostUsd: 0.002,
            },
          };
        },
      },
    );

    expect(attempts).toEqual(['primary', 'repair']);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'competitorIntel',
      durationMs: 900,
    });
    expect(progress.map((update) => update.message)).toContain(
      'primary competitor pass hit token limit — repairing artifact from captured evidence',
    );
  });

  it('falls back to the ultra-compact rescue when the compact repair is also truncated', async () => {
    const attempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];

    const result = await runResearchCompetitorsWithDeps(
      'Context about the business',
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([7_000, 8_200]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => {
          attempts.push(config.mode);

          if (config.mode === 'primary') {
            return {
              resultText: '{"competitors":[{"name":"Acme"}',
              telemetry: {
                model: config.model,
                stopReason: 'max_tokens',
                usage: {
                  inputTokens: 100,
                  outputTokens: 6500,
                  totalTokens: 6600,
                },
                estimatedCostUsd: 0.02,
              },
            };
          }

          if (config.mode === 'repair') {
            return {
              resultText: '{"competitors":[{"name":"Acme","website":"https://acme.test"}',
              telemetry: {
                model: config.model,
                stopReason: 'max_tokens',
                usage: {
                  inputTokens: 110,
                  outputTokens: 6200,
                  totalTokens: 6310,
                },
                estimatedCostUsd: 0.021,
              },
            };
          }

          return {
            resultText: JSON.stringify({
              competitors: [
                {
                  name: 'Acme',
                  website: 'https://acme.test',
                  positioning: 'Fast attribution for B2B teams.',
                  price: 'See pricing page',
                  pricingConfidence: 'low',
                  strengths: ['Known in the category', 'Fast onboarding'],
                  weaknesses: ['Long implementation cycle', 'Weak creative angle'],
                  opportunities: ['Own implementation speed', 'Lead with revenue clarity'],
                  ourAdvantage: 'Faster onboarding and clearer paid media reporting.',
                  adActivity: {
                    activeAdCount: 3,
                    platforms: ['LinkedIn'],
                    themes: ['Revenue visibility', 'Pipeline quality'],
                    evidence: 'Recent LinkedIn ads emphasize revenue visibility.',
                    sourceConfidence: 'medium',
                  },
                  threatAssessment: {
                    threatFactors: {
                      marketShareRecognition: 7,
                      adSpendIntensity: 5,
                      productOverlap: 8,
                      priceCompetitiveness: 4,
                      growthTrajectory: 6,
                    },
                    topAdHooks: ['Revenue visibility', 'Pipeline quality'],
                    counterPositioning: 'Lead with implementation speed.',
                  },
                },
              ],
              marketPatterns: ['Competitors lean on channel execution', 'Few own revenue accountability'],
              marketStrengths: ['Strong category education', 'Established SaaS specialization'],
              marketWeaknesses: ['Weak differentiation', 'Little pricing clarity'],
              whiteSpaceGaps: [
                {
                  gap: 'No competitor owns speed-to-value',
                  type: 'messaging',
                  evidence: 'Review complaints center on slow onboarding',
                  exploitability: 8,
                  impact: 8,
                  recommendedAction: 'Lead with implementation speed in paid creative',
                },
              ],
              overallLandscape: 'Crowded market with weak speed messaging.',
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 120,
                outputTokens: 400,
                totalTokens: 520,
              },
              estimatedCostUsd: 0.002,
            },
          };
        },
      },
    );

    expect(attempts).toEqual(['primary', 'repair', 'rescue']);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'competitorIntel',
      durationMs: 1200,
    });
    expect(progress.map((update) => update.message)).toContain(
      'competitor repair pass hit token limit — retrying with ultra-compact rescue',
    );
  });

  it('falls back to the ultra-compact rescue when the compact repair pass times out', async () => {
    const attempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];

    const result = await runResearchCompetitorsWithDeps(
      'Context about the business',
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([11_000, 12_500]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => {
          attempts.push(config.mode);

          if (config.mode === 'primary') {
            throw new Error('Sub-agent timed out after 120s');
          }

          if (config.mode === 'repair') {
            throw new Error('Sub-agent timed out after 60s');
          }

          return {
            resultText: JSON.stringify({
              competitors: [
                {
                  name: 'Acme',
                  website: 'https://acme.test',
                  positioning: 'Fast attribution for B2B teams.',
                  price: 'See pricing page',
                  pricingConfidence: 'low',
                  strengths: ['Known in the category', 'Fast onboarding'],
                  weaknesses: ['Long implementation cycle', 'Weak creative angle'],
                  opportunities: ['Own implementation speed', 'Lead with revenue clarity'],
                  ourAdvantage: 'Faster onboarding and clearer paid media reporting.',
                  adActivity: {
                    activeAdCount: 0,
                    platforms: ['Not verified'],
                    themes: ['Revenue visibility', 'Pipeline quality'],
                    evidence: 'Limited coverage: current active ads are not verified.',
                    sourceConfidence: 'low',
                  },
                  threatAssessment: {
                    threatFactors: {
                      marketShareRecognition: 7,
                      adSpendIntensity: 4,
                      productOverlap: 8,
                      priceCompetitiveness: 4,
                      growthTrajectory: 6,
                    },
                    topAdHooks: ['Revenue visibility', 'Pipeline quality'],
                    counterPositioning: 'Lead with implementation speed.',
                  },
                },
              ],
              marketPatterns: ['Competitors lean on channel execution', 'Few own revenue accountability'],
              marketStrengths: ['Strong category education', 'Established SaaS specialization'],
              marketWeaknesses: ['Weak differentiation', 'Little pricing clarity'],
              whiteSpaceGaps: [
                {
                  gap: 'No competitor owns speed-to-value',
                  type: 'messaging',
                  evidence: 'Review complaints center on slow onboarding',
                  exploitability: 8,
                  impact: 8,
                  recommendedAction: 'Lead with implementation speed in paid creative',
                },
              ],
              overallLandscape: 'Crowded market with weak speed messaging.',
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 120,
                outputTokens: 400,
                totalTokens: 520,
              },
              estimatedCostUsd: 0.002,
            },
          };
        },
      },
    );

    expect(attempts).toEqual(['primary', 'repair', 'rescue']);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'competitorIntel',
      durationMs: 1500,
    });
    expect(progress.map((update) => update.message)).toEqual(
      expect.arrayContaining([
        'attempt repair (model: claude-sonnet-4-6, tools: disabled) timed out (source: worker_timeout)',
        'competitor repair pass timed out — retrying with ultra-compact rescue',
        'attempt rescue (model: claude-sonnet-4-6, tools: disabled) started',
        'attempt rescue (model: claude-sonnet-4-6, tools: disabled) completed (stop reason: end_turn)',
      ]),
    );
  });
});
