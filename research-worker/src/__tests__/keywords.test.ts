import { describe, expect, it } from 'vitest';
import {
  runResearchKeywordsWithDeps,
  shouldRetryKeywordsWithRepair,
  shouldRetryKeywordsWithRescue,
} from '../runners/keywords';
import type { RunnerProgressUpdate } from '../runner';

function createNow(values: number[]): () => number {
  let index = 0;
  return () =>
    values[Math.min(index++, values.length - 1)] ??
    values[values.length - 1] ??
    0;
}

describe('shouldRetryKeywordsWithRepair', () => {
  it('retries when the primary keyword response is truncated at max tokens', () => {
    expect(
      shouldRetryKeywordsWithRepair({
        parseError: new Error('Expected \',\' or \']\' after array element'),
        telemetry: {
          stopReason: 'max_tokens',
        },
      }),
    ).toBe(true);
  });

  it('does not retry when parsing succeeded or the stop reason differs', () => {
    expect(
      shouldRetryKeywordsWithRepair({
        parseError: undefined,
        telemetry: {
          stopReason: 'max_tokens',
        },
      }),
    ).toBe(false);
    expect(
      shouldRetryKeywordsWithRepair({
        parseError: new Error('Expected \',\' or \']\' after array element'),
        telemetry: {
          stopReason: 'end_turn',
        },
      }),
    ).toBe(false);
  });
});

describe('shouldRetryKeywordsWithRescue', () => {
  it('retries when the keyword repair response is also truncated at max tokens', () => {
    expect(
      shouldRetryKeywordsWithRescue({
        parseError: new Error('Expected \',\' or \']\' after array element'),
        telemetry: {
          stopReason: 'max_tokens',
        },
      }),
    ).toBe(true);
  });

  it('does not retry when parsing succeeded or the stop reason differs', () => {
    expect(
      shouldRetryKeywordsWithRescue({
        parseError: undefined,
        telemetry: {
          stopReason: 'max_tokens',
        },
      }),
    ).toBe(false);
    expect(
      shouldRetryKeywordsWithRescue({
        parseError: new Error('Expected \',\' or \']\' after array element'),
        telemetry: {
          stopReason: 'end_turn',
        },
      }),
    ).toBe(false);
  });
});

describe('runResearchKeywordsWithDeps', () => {
  it('repairs keyword research from compact evidence after a max-token truncated primary pass', async () => {
    const attempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];
    let repairContext = '';
    const primaryContext = [
      'Journey research sandbox context',
      'Section: Keywords',
      '',
      'Business context:',
      '- Company Name: SaaSLaunch',
      '- Business Model: B2B SaaS demand generation agency',
      '- Product Description: Paid media, creative strategy, and pipeline-focused growth systems for B2B SaaS teams',
      '- Top Competitors: Hey Digital, Refine Labs, Directive Consulting',
      '- Goals: Generate more qualified demos and lower CAC',
      '- Ideal Customer Profile: Series A-B B2B SaaS teams with lean internal marketing resources',
      '',
      'Existing persisted research to reuse:',
      '',
      '## Strategic Synthesis',
      JSON.stringify({
        keyInsights: [
          {
            insight:
              'Growth-stage SaaS buyers distrust MQL-focused agencies and want CAC payback accountability.',
            implication:
              'Lead keywords and landing pages with pipeline and attribution language.',
            priority: 'high',
          },
          {
            insight:
              'Competitor pricing opacity creates a strong comparison-search opportunity.',
            implication:
              'Own competitor alternative and pricing intent with transparent positioning.',
            priority: 'high',
          },
        ],
        positioningStrategy: {
          recommendedAngle:
            'Pipeline-accountable demand generation for growth-stage B2B SaaS',
          alternativeAngles: [
            'Transparent pricing for SaaS pipeline systems',
            'Revenue-first paid media without enterprise overhead',
          ],
          keyDifferentiator:
            'Transparent pricing tied to CAC payback expectations',
        },
        messagingAngles: [
          {
            angle: 'CAC payback accountability',
            exampleHook:
              'Stop paying for MQLs. Buy pipeline accountability instead.',
          },
          {
            angle: 'Transparent pricing',
            exampleHook:
              'See exactly what your SaaS demand gen retainer includes before booking a call.',
          },
        ],
        platformRecommendations: [
          {
            platform: 'Google Search',
            role: 'secondary',
            budgetAllocation: '30% ($3,000)',
            rationale:
              'Capture in-market buyers searching for competitor alternatives and agency pricing.',
            priority: 2,
          },
        ],
      }),
      '',
      '## Competitor Intel',
      JSON.stringify({
        competitors: [
          {
            name: 'Refine Labs',
            website: 'https://refinelabs.com',
            weaknesses: ['Enterprise price floor excludes growth-stage teams'],
            ourAdvantage: 'Lower entry point with done-for-you execution speed',
          },
          {
            name: 'Directive Consulting',
            website: 'https://directiveconsulting.com',
            weaknesses: ['Discovery-heavy evaluation friction'],
            ourAdvantage: 'Clearer pricing and faster launch path',
          },
        ],
        whiteSpaceGaps: [
          {
            gap: 'Transparent pricing for growth-stage SaaS demand gen',
            recommendedAction:
              'Target competitor pricing and alternative terms with transparent-cost messaging',
          },
        ],
      }),
    ].join('\n');

    const result = await runResearchKeywordsWithDeps(
      primaryContext,
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([1_000, 1_920]),
        parseJson: JSON.parse,
        runToolAttempt: async (_attemptContext, config, onProgress) => {
          attempts.push(config.mode);
          expect(config.mode).toBe('primary');

          await onProgress?.({
            phase: 'tool',
            message: 'spyfu started',
          });

          return {
            resultText:
              '{"totalKeywordsFound":24,"competitorGapCount":6,"campaignGroups":[{"campaign":"Competitor Brand & Alternatives","intent":"High-intent evaluation stage","recommendedMonthlyBudget":2800,"adGroups":[{"name":"Refine Labs Alternatives","recommendedMatchTypes":["exact","phrase"],"keywords":[{"keyword":"refine labs alternative","searchVolume":480,"difficulty":"medium","estimatedCpc":"$18.50","priorityScore":97,"confidence":"medium"},{"keyword":"refine labs pricing","searchVolume":390,"difficulty":"low","estimatedCpc":"$15.20","priorityScore":96,"confidence":"medium"}],"negativeKeywords":["jobs","careers"]}]}],"topOpportunities":[{"keyword":"refine labs alternative","searchVolume":480,"difficulty":"medium","estimatedCpc":"$18.50","priorityScore":97,"confidence":"medium"}],"recommendedStartingSet":[{"keyword":"refine labs alternative","campaign":"Competitor Brand & Alternatives","adGroup":"Refine Labs Alternatives","recommendedMonthlyBudget":900,"reason":"High-intent competitor replacement search with strong positioning fit","priorityScore":97},{"keyword":"directive consulting pricing"',
            telemetry: {
              model: config.model,
              stopReason: 'max_tokens',
              usage: {
                inputTokens: 14917,
                outputTokens: 4000,
                totalTokens: 18917,
              },
              estimatedCostUsd: 0.104751,
            },
          };
        },
        runMessageAttempt: async (attemptContext, config) => {
          attempts.push(config.mode);
          repairContext = attemptContext;
          expect(config.mode).toBe('repair');

          return {
            resultText: JSON.stringify({
              totalKeywordsFound: 18,
              competitorGapCount: 6,
              campaignGroups: [
                {
                  campaign: 'Competitor Brand & Alternatives',
                  intent:
                    'High-intent evaluation search from buyers comparing SaaS demand gen agencies',
                  recommendedMonthlyBudget: 2800,
                  adGroups: [
                    {
                      name: 'Refine Labs Alternatives',
                      recommendedMatchTypes: ['exact', 'phrase'],
                      keywords: [
                        {
                          keyword: 'refine labs alternative',
                          searchVolume: 0,
                          difficulty: 'medium',
                          estimatedCpc: 'Not verified',
                          priorityScore: 97,
                          confidence: 'low',
                        },
                        {
                          keyword: 'refine labs pricing',
                          searchVolume: 0,
                          difficulty: 'low',
                          estimatedCpc: 'Not verified',
                          priorityScore: 95,
                          confidence: 'low',
                        },
                      ],
                      negativeKeywords: ['jobs', 'careers', 'vault'],
                    },
                    {
                      name: 'Directive Alternatives',
                      recommendedMatchTypes: ['exact', 'phrase'],
                      keywords: [
                        {
                          keyword: 'directive consulting alternative',
                          searchVolume: 0,
                          difficulty: 'medium',
                          estimatedCpc: 'Not verified',
                          priorityScore: 92,
                          confidence: 'low',
                        },
                        {
                          keyword: 'directive consulting pricing',
                          searchVolume: 0,
                          difficulty: 'low',
                          estimatedCpc: 'Not verified',
                          priorityScore: 90,
                          confidence: 'low',
                        },
                      ],
                      negativeKeywords: ['jobs', 'careers', 'glassdoor'],
                    },
                  ],
                },
                {
                  campaign: 'Category Intent',
                  intent:
                    'Solution-aware buyers already searching for B2B SaaS paid media agencies',
                  recommendedMonthlyBudget: 2200,
                  adGroups: [
                    {
                      name: 'Pipeline-Focused Agency Terms',
                      recommendedMatchTypes: ['exact', 'phrase'],
                      keywords: [
                        {
                          keyword: 'b2b saas demand generation agency',
                          searchVolume: 0,
                          difficulty: 'high',
                          estimatedCpc: 'Not verified',
                          priorityScore: 91,
                          confidence: 'low',
                        },
                        {
                          keyword: 'saas paid media agency',
                          searchVolume: 0,
                          difficulty: 'medium',
                          estimatedCpc: 'Not verified',
                          priorityScore: 88,
                          confidence: 'low',
                        },
                      ],
                      negativeKeywords: ['jobs', 'free', 'course'],
                    },
                  ],
                },
              ],
              topOpportunities: [
                {
                  keyword: 'refine labs alternative',
                  searchVolume: 0,
                  difficulty: 'medium',
                  estimatedCpc: 'Not verified',
                  priorityScore: 97,
                  confidence: 'low',
                },
                {
                  keyword: 'directive consulting pricing',
                  searchVolume: 0,
                  difficulty: 'low',
                  estimatedCpc: 'Not verified',
                  priorityScore: 90,
                  confidence: 'low',
                },
                {
                  keyword: 'b2b saas demand generation agency',
                  searchVolume: 0,
                  difficulty: 'high',
                  estimatedCpc: 'Not verified',
                  priorityScore: 91,
                  confidence: 'low',
                },
              ],
              recommendedStartingSet: [
                {
                  keyword: 'refine labs alternative',
                  campaign: 'Competitor Brand & Alternatives',
                  adGroup: 'Refine Labs Alternatives',
                  recommendedMonthlyBudget: 900,
                  reason:
                    'Strong intent match against the most expensive competitor in the set.',
                  priorityScore: 97,
                },
                {
                  keyword: 'directive consulting pricing',
                  campaign: 'Competitor Brand & Alternatives',
                  adGroup: 'Directive Alternatives',
                  recommendedMonthlyBudget: 700,
                  reason:
                    'Transparent-pricing message directly exploits competitor evaluation friction.',
                  priorityScore: 90,
                },
                {
                  keyword: 'b2b saas demand generation agency',
                  campaign: 'Category Intent',
                  adGroup: 'Pipeline-Focused Agency Terms',
                  recommendedMonthlyBudget: 1200,
                  reason:
                    'Core commercial-intent category term aligned to the positioning strategy.',
                  priorityScore: 91,
                },
              ],
              competitorGaps: [
                {
                  keyword: 'refine labs alternative',
                  competitorName: 'Refine Labs',
                  searchVolume: 0,
                  estimatedCpc: 'Not verified',
                  priorityScore: 97,
                },
                {
                  keyword: 'refine labs pricing',
                  competitorName: 'Refine Labs',
                  searchVolume: 0,
                  estimatedCpc: 'Not verified',
                  priorityScore: 95,
                },
                {
                  keyword: 'directive consulting alternative',
                  competitorName: 'Directive Consulting',
                  searchVolume: 0,
                  estimatedCpc: 'Not verified',
                  priorityScore: 92,
                },
                {
                  keyword: 'directive consulting pricing',
                  competitorName: 'Directive Consulting',
                  searchVolume: 0,
                  estimatedCpc: 'Not verified',
                  priorityScore: 90,
                },
                {
                  keyword: 'transparent saas demand gen pricing',
                  competitorName: 'Category gap',
                  searchVolume: 0,
                  estimatedCpc: 'Not verified',
                  priorityScore: 86,
                },
                {
                  keyword: 'pipeline accountable demand gen agency',
                  competitorName: 'Category gap',
                  searchVolume: 0,
                  estimatedCpc: 'Not verified',
                  priorityScore: 84,
                },
              ],
              negativeKeywords: [
                {
                  keyword: 'jobs',
                  reason: 'Hiring-intent traffic will not convert for agency acquisition.',
                },
                {
                  keyword: 'free',
                  reason: 'Free-seeking searches are mismatched to retainer positioning.',
                },
                {
                  keyword: 'course',
                  reason: 'Training-intent users are not looking for done-for-you execution.',
                },
              ],
              confidenceNotes: [
                'SpyFu evidence was unavailable in the primary pass, so numeric volume and CPC fields are marked as not verified.',
                'Priority scores are based on strategic fit to the persisted synthesis and competitor gaps, not live auction data.',
                'Run a fresh SpyFu or Google Ads Keyword Planner pull before locking budgets.',
              ],
              quickWins: [
                'Launch Refine Labs and Directive alternative terms first with transparent-pricing copy.',
                'Map landing page headlines to CAC payback and pipeline accountability language from the synthesis.',
                'Exclude jobs, careers, free, and course intent from day one to protect early budget.',
              ],
              citations: [
                {
                  url: 'https://refinelabs.com',
                  title: 'Refine Labs',
                },
                {
                  url: 'https://directiveconsulting.com',
                  title: 'Directive Consulting',
                },
              ],
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 110,
                outputTokens: 900,
                totalTokens: 1010,
              },
              estimatedCostUsd: 0.02,
            },
          };
        },
      },
    );

    expect(attempts).toEqual(['primary', 'repair']);
    expect(repairContext).toContain('BUSINESS SNAPSHOT:');
    expect(repairContext).toContain('STRATEGIC SYNTHESIS SNAPSHOT:');
    expect(repairContext).toContain('COMPETITOR INTEL SNAPSHOT:');
    expect(repairContext).toContain('INCOMPLETE DRAFT TO REPAIR:');
    expect(repairContext).not.toContain('## Strategic Synthesis');
    expect(repairContext).not.toContain('## Competitor Intel');
    expect(repairContext.length).toBeLessThan(4_000);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'keywordIntel',
      durationMs: 920,
    });
    expect(progress.map((update) => update.message)).toEqual(
      expect.arrayContaining([
        'attempt primary (model: claude-sonnet-4-6, tools: enabled) started',
        'attempt primary (model: claude-sonnet-4-6, tools: enabled) completed (stop reason: max_tokens)',
        'keyword research pass hit token limit — repairing artifact from compact evidence',
        expect.stringMatching(
          /^repair evidence package prepared \(business lines: 6, section summaries: 2, analysis notes: 0, draft chars: \d+, total chars: \d+\)$/,
        ),
        'attempt repair (model: claude-sonnet-4-6, tools: disabled) started',
        'attempt repair (model: claude-sonnet-4-6, tools: disabled) completed (stop reason: end_turn)',
      ]),
    );
  });

  it('rejects sparse SpyFu output, carries richer fallback context, and accepts empty competitor gaps in heuristic mode', async () => {
    const attempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];
    let heuristicContext = '';

    const result = await runResearchKeywordsWithDeps(
      [
        'Journey research sandbox context',
        'Section: Keywords',
        '',
        'Business context:',
        '- Company Name: SaaSLaunch',
        '- Business Model: B2B SaaS demand generation agency',
        '- Product Description: Paid media, creative strategy, and pipeline-focused growth systems for B2B SaaS teams',
        '- Top Competitors: Refine Labs, Directive Consulting',
        '- Goals: Generate more qualified demos and lower CAC',
        '- Primary ICP Description: Series A-B B2B SaaS teams with lean internal marketing resources',
        '',
        'Existing persisted research to reuse:',
        '',
        '## Market Overview',
        JSON.stringify({
          categorySnapshot: {
            category: 'B2B SaaS Demand Generation Agencies',
            marketSize:
              'Estimated SAM: $250M-$400M for growth-stage B2B SaaS teams outsourcing paid acquisition',
          },
          painPoints: {
            primary: ['Attribution gaps make CAC harder to control'],
          },
        }),
        '',
        '## ICP Validation',
        JSON.stringify({
          validatedPersona: 'VP Marketing at Series A-B B2B SaaS companies',
          objections: [
            'I have hired agencies before and could not trace spend to revenue.',
            'I do not want another bloated retainer before channel fit is proven.',
          ],
        }),
        '',
        '## Offer Analysis',
        JSON.stringify({
          pricingAnalysis: {
            pricingPosition: 'mid-market',
          },
          messagingRecommendations: [
            'Lead with pipeline accountability instead of vanity metrics.',
            'Use transparent pricing and launch-scope framing to reduce retainer fear.',
          ],
        }),
        '',
        '## Strategic Synthesis',
        JSON.stringify({
          positioningStrategy: {
            recommendedAngle:
              'Pipeline-accountable demand generation for growth-stage B2B SaaS',
            keyDifferentiator: 'Transparent pricing tied to CAC payback expectations',
          },
        }),
        '',
        '## Competitor Intel',
        JSON.stringify({
          competitors: [
            {
              name: 'Refine Labs',
              website: 'https://refinelabs.com',
              weaknesses: ['Enterprise price floor excludes growth-stage teams'],
              ourAdvantage: 'Lower entry point with done-for-you execution speed',
            },
          ],
          whiteSpaceGaps: [
            {
              gap: 'Transparent pricing for growth-stage SaaS demand gen',
              recommendedAction:
                'Target pricing and alternative terms with transparent-cost messaging',
            },
          ],
        }),
      ].join('\n'),
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([4_000, 5_050]),
        parseJson: JSON.parse,
        runToolAttempt: async (_context, config) => {
          attempts.push(config.mode);
          expect(config.mode).toBe('primary');

          return {
            resultText: JSON.stringify({
              totalKeywordsFound: 1,
              competitorGapCount: 1,
              campaignGroups: [
                {
                  campaign: 'Competitor Alternatives',
                  intent: 'High-intent switching demand',
                  recommendedMonthlyBudget: 700,
                  adGroups: [
                    {
                      name: 'Refine Labs + Directive alternatives',
                      recommendedMatchTypes: ['exact'],
                      keywords: [
                        {
                          keyword: 'refine labs alternative',
                          searchVolume: 0,
                          difficulty: 'medium',
                          estimatedCpc: 'Not verified',
                          priorityScore: 92,
                          confidence: 'low',
                        },
                      ],
                      negativeKeywords: ['jobs'],
                    },
                  ],
                },
              ],
              topOpportunities: [
                {
                  keyword: 'refine labs alternative',
                  searchVolume: 0,
                  difficulty: 'medium',
                  estimatedCpc: 'Not verified',
                  priorityScore: 92,
                  confidence: 'low',
                },
              ],
              recommendedStartingSet: [
                {
                  keyword: 'refine labs alternative',
                  campaign: 'Competitor Alternatives',
                  adGroup: 'Refine Labs + Directive alternatives',
                  recommendedMonthlyBudget: 700,
                  reason: 'Only term recovered from sparse SpyFu output.',
                  priorityScore: 92,
                },
              ],
              competitorGaps: [
                {
                  keyword: 'refine labs alternative',
                  competitorName: 'Refine Labs',
                  searchVolume: 0,
                  estimatedCpc: 'Not verified',
                  priorityScore: 92,
                },
              ],
              negativeKeywords: [
                {
                  keyword: 'jobs',
                  reason: 'Employment intent will not convert for agency acquisition.',
                },
              ],
              confidenceNotes: [
                'SpyFu returned sparse live coverage, so numeric volume and CPC fields remain unverified.',
              ],
              quickWins: ['Launch competitor alternative ads first.'],
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 120,
                outputTokens: 300,
                totalTokens: 420,
              },
              estimatedCostUsd: 0.01,
            },
          };
        },
        runMessageAttempt: async (attemptContext, config) => {
          attempts.push(config.mode);
          heuristicContext = attemptContext;
          expect(config.mode).toBe('heuristic');

          return {
            resultText: JSON.stringify({
              totalKeywordsFound: 4,
              competitorGapCount: 0,
              campaignGroups: [
                {
                  campaign: 'Competitor Alternatives',
                  intent: 'High-intent switching demand',
                  recommendedMonthlyBudget: 1600,
                  adGroups: [
                    {
                      name: 'Refine Labs + Directive alternatives',
                      recommendedMatchTypes: ['exact', 'phrase'],
                      keywords: [
                        {
                          keyword: 'refine labs alternative',
                          searchVolume: 0,
                          difficulty: 'medium',
                          estimatedCpc: 'Not verified',
                          priorityScore: 92,
                          confidence: 'low',
                        },
                        {
                          keyword: 'directive consulting pricing',
                          searchVolume: 0,
                          difficulty: 'low',
                          estimatedCpc: 'Not verified',
                          priorityScore: 88,
                          confidence: 'low',
                        },
                      ],
                      negativeKeywords: ['jobs', 'glassdoor'],
                    },
                  ],
                },
                {
                  campaign: 'Pain + Category Intent',
                  intent: 'Solution-aware commercial research',
                  recommendedMonthlyBudget: 1800,
                  adGroups: [
                    {
                      name: 'Pipeline accountability terms',
                      recommendedMatchTypes: ['phrase', 'exact'],
                      keywords: [
                        {
                          keyword: 'b2b saas demand generation agency',
                          searchVolume: 0,
                          difficulty: 'high',
                          estimatedCpc: 'Not verified',
                          priorityScore: 89,
                          confidence: 'low',
                        },
                        {
                          keyword: 'pipeline accountable demand gen agency',
                          searchVolume: 0,
                          difficulty: 'medium',
                          estimatedCpc: 'Not verified',
                          priorityScore: 86,
                          confidence: 'low',
                        },
                      ],
                      negativeKeywords: ['free', 'course'],
                    },
                  ],
                },
              ],
              topOpportunities: [
                {
                  keyword: 'refine labs alternative',
                  searchVolume: 0,
                  difficulty: 'medium',
                  estimatedCpc: 'Not verified',
                  priorityScore: 92,
                  confidence: 'low',
                },
                {
                  keyword: 'pipeline accountable demand gen agency',
                  searchVolume: 0,
                  difficulty: 'medium',
                  estimatedCpc: 'Not verified',
                  priorityScore: 90,
                  confidence: 'low',
                },
              ],
              recommendedStartingSet: [
                {
                  keyword: 'refine labs alternative',
                  campaign: 'Competitor Alternatives',
                  adGroup: 'Refine Labs + Directive alternatives',
                  recommendedMonthlyBudget: 700,
                  reason:
                    'Strong switching intent paired with transparent-pricing differentiation.',
                  priorityScore: 92,
                },
                {
                  keyword: 'pipeline accountable demand gen agency',
                  campaign: 'Pain + Category Intent',
                  adGroup: 'Pipeline accountability terms',
                  recommendedMonthlyBudget: 900,
                  reason: 'Matches the buyer objection around weak attribution proof.',
                  priorityScore: 90,
                },
              ],
              competitorGaps: [],
              negativeKeywords: [
                {
                  keyword: 'jobs',
                  reason: 'Employment intent will not convert for agency acquisition.',
                },
                {
                  keyword: 'free',
                  reason: 'Free-seeking queries do not match a retainer offer.',
                },
              ],
              confidenceNotes: [
                'SpyFu returned sparse live coverage, so numeric volume and CPC fields remain unverified.',
                'Google Keyword Planner, SEMrush, and Ahrefs are not configured in this worker, so heuristic grouping uses industry, ICP, offer, synthesis, and competitor evidence only.',
              ],
              quickWins: [
                'Launch competitor alternative ads with transparent-pricing copy first.',
                'Mirror the ICP trust objection with pipeline-proof headlines on search landing pages.',
                'Use negative keywords to filter free, jobs, and course intent from the first budget tranche.',
              ],
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 150,
                outputTokens: 750,
                totalTokens: 900,
              },
              estimatedCostUsd: 0.02,
            },
          };
        },
      },
    );

    expect(attempts).toEqual(['primary', 'heuristic']);
    expect(heuristicContext).toContain('INDUSTRY RESEARCH SNAPSHOT:');
    expect(heuristicContext).toContain('ICP VALIDATION SNAPSHOT:');
    expect(heuristicContext).toContain('OFFER ANALYSIS SNAPSHOT:');
    expect(heuristicContext).toContain('KEYWORD PROVIDER STATUS:');
    expect(result).toMatchObject({
      status: 'complete',
      section: 'keywordIntel',
      durationMs: 1050,
    });
    expect(progress.map((update) => update.message)).toContain(
      'keyword research artifact was too thin to trust — switching to heuristic fallback',
    );
  });

  it('keeps a usable primary artifact when no named competitors were provided', async () => {
    const attempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];

    const result = await runResearchKeywordsWithDeps(
      [
        'Journey research sandbox context',
        'Section: Keywords',
        '',
        'Business context:',
        '- Company Name: SaaSLaunch',
        '- Business Model: B2B SaaS demand generation agency',
        '- Product Description: Pipeline-focused paid media systems',
        '- Goals: Generate more qualified demos and lower CAC',
        '',
        'Existing persisted research to reuse:',
        '',
        '## Strategic Synthesis',
        JSON.stringify({
          positioningStrategy: {
            recommendedAngle: 'Pipeline accountability for growth-stage SaaS',
            keyDifferentiator: 'Transparent pricing and faster launch path',
          },
        }),
      ].join('\n'),
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([6_500, 6_860]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => {
          attempts.push(config.mode);

          return {
            resultText: JSON.stringify({
              totalKeywordsFound: 4,
              competitorGapCount: 0,
              campaignGroups: [
                {
                  campaign: 'Category Intent',
                  intent: 'Solution-aware category demand',
                  recommendedMonthlyBudget: 1800,
                  adGroups: [
                    {
                      name: 'Pipeline accountability terms',
                      recommendedMatchTypes: ['phrase', 'exact'],
                      keywords: [
                        {
                          keyword: 'b2b saas demand generation agency',
                          searchVolume: 0,
                          difficulty: 'high',
                          estimatedCpc: 'Not verified',
                          priorityScore: 89,
                          confidence: 'low',
                        },
                        {
                          keyword: 'pipeline accountable demand gen agency',
                          searchVolume: 0,
                          difficulty: 'medium',
                          estimatedCpc: 'Not verified',
                          priorityScore: 86,
                          confidence: 'low',
                        },
                      ],
                      negativeKeywords: ['free', 'course'],
                    },
                  ],
                },
                {
                  campaign: 'Pricing Intent',
                  intent: 'Commercial evaluation demand',
                  recommendedMonthlyBudget: 1400,
                  adGroups: [
                    {
                      name: 'Transparent pricing terms',
                      recommendedMatchTypes: ['phrase', 'exact'],
                      keywords: [
                        {
                          keyword: 'saas paid media agency pricing',
                          searchVolume: 0,
                          difficulty: 'medium',
                          estimatedCpc: 'Not verified',
                          priorityScore: 84,
                          confidence: 'low',
                        },
                        {
                          keyword: 'demand generation agency pricing',
                          searchVolume: 0,
                          difficulty: 'medium',
                          estimatedCpc: 'Not verified',
                          priorityScore: 82,
                          confidence: 'low',
                        },
                      ],
                      negativeKeywords: ['jobs', 'template'],
                    },
                  ],
                },
              ],
              topOpportunities: [
                {
                  keyword: 'b2b saas demand generation agency',
                  searchVolume: 0,
                  difficulty: 'high',
                  estimatedCpc: 'Not verified',
                  priorityScore: 89,
                  confidence: 'low',
                },
                {
                  keyword: 'saas paid media agency pricing',
                  searchVolume: 0,
                  difficulty: 'medium',
                  estimatedCpc: 'Not verified',
                  priorityScore: 84,
                  confidence: 'low',
                },
              ],
              recommendedStartingSet: [
                {
                  keyword: 'b2b saas demand generation agency',
                  campaign: 'Category Intent',
                  adGroup: 'Pipeline accountability terms',
                  recommendedMonthlyBudget: 900,
                  reason: 'Highest-fit category term for the positioning strategy.',
                  priorityScore: 89,
                },
                {
                  keyword: 'saas paid media agency pricing',
                  campaign: 'Pricing Intent',
                  adGroup: 'Transparent pricing terms',
                  recommendedMonthlyBudget: 700,
                  reason: 'Commercial pricing intent matches the transparent offer angle.',
                  priorityScore: 84,
                },
              ],
              competitorGaps: [],
              negativeKeywords: [
                {
                  keyword: 'jobs',
                  reason: 'Employment intent will not convert for agency acquisition.',
                },
                {
                  keyword: 'free',
                  reason: 'Free-seeking queries do not match a retainer offer.',
                },
              ],
              confidenceNotes: [
                'Live keyword metrics were sparse, so numeric volume and CPC fields remain unverified.',
                'The starting set is prioritized by strategic fit rather than auction coverage alone.',
              ],
              quickWins: [
                'Launch category-intent ads first.',
                'Lead pricing pages with pipeline-proof copy.',
                'Filter low-intent free and jobs traffic on day one.',
              ],
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 140,
                outputTokens: 520,
                totalTokens: 660,
              },
              estimatedCostUsd: 0.011,
            },
          };
        },
      },
    );

    expect(attempts).toEqual(['primary']);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'keywordIntel',
      durationMs: 360,
    });
    expect(progress.map((update) => update.message)).not.toContain(
      'keyword research artifact was too thin to trust — switching to heuristic fallback',
    );
  });

  it('falls back to an ultra-compact rescue when the repair pass is also truncated at max tokens', async () => {
    const attempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];
    let rescueContext = '';

    const result = await runResearchKeywordsWithDeps(
      [
        'Journey research sandbox context',
        'Section: Keywords',
        '',
        'Business context:',
        '- Company Name: SaaSLaunch',
        '- Business Model: B2B SaaS demand generation agency',
        '- Product Description: Pipeline-focused paid media systems',
        '- Top Competitors: Refine Labs, Directive Consulting',
        '- Goals: Generate more qualified demos and lower CAC',
        '',
        'Existing persisted research to reuse:',
        '',
        '## Strategic Synthesis',
        JSON.stringify({
          positioningStrategy: {
            recommendedAngle: 'Pipeline accountability for growth-stage SaaS',
            keyDifferentiator: 'Transparent pricing and faster launch path',
          },
          messagingAngles: [
            {
              angle: 'Anti-MQL credibility',
              exampleHook: 'Stop paying for MQL volume that never becomes pipeline.',
            },
          ],
        }),
        '',
        '## Competitor Intel',
        JSON.stringify({
          competitors: [
            {
              name: 'Refine Labs',
              weaknesses: ['Enterprise pricing excludes growth-stage teams'],
              ourAdvantage: 'Accessible retainer tiers',
            },
          ],
          whiteSpaceGaps: [
            {
              gap: 'Transparent pricing for competitor comparison traffic',
            },
          ],
        }),
      ].join('\n'),
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([5_000, 5_950]),
        parseJson: JSON.parse,
        runAttempt: async (_context, config) => {
          attempts.push(config.mode);

          if (config.mode === 'primary') {
            return {
              resultText:
                '{"totalKeywordsFound":12,"competitorGapCount":4,"campaignGroups":[{"campaign":"Competitor terms"',
              telemetry: {
                model: config.model,
                stopReason: 'max_tokens',
                usage: {
                  inputTokens: 900,
                  outputTokens: 4000,
                  totalTokens: 4900,
                },
                estimatedCostUsd: 0.1,
              },
            };
          }

          if (config.mode === 'repair') {
            return {
              resultText:
                '{"totalKeywordsFound":8,"competitorGapCount":4,"campaignGroups":[{"campaign":"Competitor Intercept"',
              telemetry: {
                model: config.model,
                stopReason: 'max_tokens',
                usage: {
                  inputTokens: 400,
                  outputTokens: 3200,
                  totalTokens: 3600,
                },
                estimatedCostUsd: 0.05,
              },
            };
          }

          rescueContext = _context;
          return {
            resultText: JSON.stringify({
              totalKeywordsFound: 4,
              competitorGapCount: 4,
              campaignGroups: [
                {
                  campaign: 'Competitor Alternatives',
                  intent: 'BOFU comparison traffic',
                  recommendedMonthlyBudget: 1800,
                  adGroups: [
                    {
                      name: 'Refine Labs Alternatives',
                      recommendedMatchTypes: ['exact', 'phrase'],
                      keywords: [
                        {
                          keyword: 'refine labs alternative',
                          searchVolume: 0,
                          difficulty: 'medium',
                          estimatedCpc: 'Not verified',
                          priorityScore: 97,
                          confidence: 'low',
                        },
                        {
                          keyword: 'refine labs pricing',
                          searchVolume: 0,
                          difficulty: 'low',
                          estimatedCpc: 'Not verified',
                          priorityScore: 95,
                          confidence: 'low',
                        },
                      ],
                      negativeKeywords: ['jobs', 'careers'],
                    },
                  ],
                },
                {
                  campaign: 'Category Intent',
                  intent: 'Commercial solution search',
                  recommendedMonthlyBudget: 1200,
                  adGroups: [
                    {
                      name: 'Pipeline Agency Terms',
                      recommendedMatchTypes: ['exact', 'phrase'],
                      keywords: [
                        {
                          keyword: 'b2b saas demand generation agency',
                          searchVolume: 0,
                          difficulty: 'high',
                          estimatedCpc: 'Not verified',
                          priorityScore: 90,
                          confidence: 'low',
                        },
                        {
                          keyword: 'saas paid media agency',
                          searchVolume: 0,
                          difficulty: 'medium',
                          estimatedCpc: 'Not verified',
                          priorityScore: 87,
                          confidence: 'low',
                        },
                      ],
                      negativeKeywords: ['free', 'course'],
                    },
                  ],
                },
              ],
              topOpportunities: [
                {
                  keyword: 'refine labs alternative',
                  searchVolume: 0,
                  difficulty: 'medium',
                  estimatedCpc: 'Not verified',
                  priorityScore: 97,
                  confidence: 'low',
                },
              ],
              recommendedStartingSet: [
                {
                  keyword: 'refine labs alternative',
                  campaign: 'Competitor Alternatives',
                  adGroup: 'Refine Labs Alternatives',
                  recommendedMonthlyBudget: 900,
                  reason: 'Captures high-intent buyers comparing premium alternatives.',
                  priorityScore: 97,
                },
              ],
              competitorGaps: [
                {
                  keyword: 'refine labs alternative',
                  competitorName: 'Refine Labs',
                  searchVolume: 0,
                  estimatedCpc: 'Not verified',
                  priorityScore: 97,
                },
                {
                  keyword: 'refine labs pricing',
                  competitorName: 'Refine Labs',
                  searchVolume: 0,
                  estimatedCpc: 'Not verified',
                  priorityScore: 95,
                },
                {
                  keyword: 'directive consulting alternative',
                  competitorName: 'Directive Consulting',
                  searchVolume: 0,
                  estimatedCpc: 'Not verified',
                  priorityScore: 91,
                },
                {
                  keyword: 'transparent saas agency pricing',
                  competitorName: 'Category gap',
                  searchVolume: 0,
                  estimatedCpc: 'Not verified',
                  priorityScore: 86,
                },
              ],
              negativeKeywords: [
                {
                  keyword: 'jobs',
                  reason: 'Exclude employment intent.',
                },
                {
                  keyword: 'free',
                  reason: 'Exclude non-commercial search intent.',
                },
              ],
              confidenceNotes: [
                'Rescue pass used compact strategic and competitor evidence only.',
                'All numeric metrics remain unverified because live SpyFu data was unavailable.',
              ],
              quickWins: [
                'Start with Refine Labs comparison traffic.',
                'Use transparent-pricing copy in search ads.',
                'Route clicks to a CAC-payback audit landing page.',
              ],
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 250,
                outputTokens: 800,
                totalTokens: 1050,
              },
              estimatedCostUsd: 0.02,
            },
          };
        },
      },
    );

    expect(attempts).toEqual(['primary', 'repair', 'rescue']);
    expect(rescueContext).toContain('BUSINESS SNAPSHOT:');
    expect(rescueContext).toContain('STRATEGIC SYNTHESIS SNAPSHOT:');
    expect(rescueContext).toContain('COMPETITOR INTEL SNAPSHOT:');
    expect(rescueContext).not.toContain('## Strategic Synthesis');
    expect(rescueContext).not.toContain('## Competitor Intel');
    expect(rescueContext.length).toBeLessThan(3_500);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'keywordIntel',
      durationMs: 950,
    });
    expect(progress.map((update) => update.message)).toEqual(
      expect.arrayContaining([
        'attempt primary (model: claude-sonnet-4-6, tools: enabled) started',
        'attempt primary (model: claude-sonnet-4-6, tools: enabled) completed (stop reason: max_tokens)',
        'keyword research pass hit token limit — repairing artifact from compact evidence',
        expect.stringMatching(
          /^repair evidence package prepared \(business lines: 5, section summaries: 2, analysis notes: 0, draft chars: \d+, total chars: \d+\)$/,
        ),
        'attempt repair (model: claude-sonnet-4-6, tools: disabled) started',
        'attempt repair (model: claude-sonnet-4-6, tools: disabled) completed (stop reason: max_tokens)',
        'keyword repair pass hit token limit — retrying with ultra-compact rescue',
        expect.stringMatching(
          /^rescue evidence package prepared \(business lines: 5, section summaries: 2, analysis notes: 0, draft chars: \d+, total chars: \d+\)$/,
        ),
        'attempt rescue (model: claude-sonnet-4-6, tools: disabled) started',
        'attempt rescue (model: claude-sonnet-4-6, tools: disabled) completed (stop reason: end_turn)',
      ]),
    );
  });
});
