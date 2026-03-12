import { describe, expect, it } from 'vitest';
import { runSynthesizeResearchWithDeps } from '../runners/synthesize';
import type { RunnerProgressUpdate } from '../runner';

function createNow(values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? values[values.length - 1] ?? 0;
}

describe('runSynthesizeResearchWithDeps', () => {
  it('repairs strategic synthesis from a compact no-chart evidence package after primary timeout', async () => {
    const attempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];
    let repairContext = '';
    const primaryContext = [
      'Journey research sandbox context',
      'Section: Strategic Synthesis',
      '',
      'Business context:',
      '- Company Name: SaaSLaunch',
      '- Business Model: B2B SaaS demand generation agency',
      '- Product Description: Paid media systems for B2B SaaS teams',
      '- Goals: Generate more qualified demos and lower CAC',
      '- Monthly Ad Budget: $5,000',
      '',
      'Existing persisted research to reuse:',
      '',
      '## Market Overview',
      JSON.stringify({
        categorySnapshot: {
          category: 'B2B SaaS Demand Generation',
          buyingBehavior: 'roi_based',
        },
        painPoints: {
          primary: ['Attribution gaps', 'High CAC', 'Weak pipeline visibility'],
        },
      }),
      '',
      '## Competitor Intel',
      JSON.stringify({
        competitors: [
          {
            name: 'Hey Digital',
            website: 'https://heydigital.co',
            weaknesses: ['Weak attribution reporting'],
          },
          {
            name: 'Directive Consulting',
            website: 'https://directiveconsulting.com',
            weaknesses: ['Enterprise-heavy pricing'],
          },
        ],
        whiteSpaceGaps: [
          {
            gap: 'Pipeline accountability',
            recommendedAction: 'Lead with revenue reporting',
          },
        ],
      }),
      '',
      '## ICP Validation',
      JSON.stringify({
        validatedPersona: 'VP Marketing at Series A-B B2B SaaS companies',
        channels: ['LinkedIn', 'Google Search'],
        objections: ['Agencies overpromise', 'Attribution is unclear'],
      }),
      '',
      '## Offer Analysis',
      JSON.stringify({
        recommendation: {
          status: 'proceed',
          summary: 'Lead with pipeline accountability',
          priorityFixes: ['Sharpen attribution promise'],
        },
        pricingAnalysis: {
          pricingPosition: 'mid-market',
        },
      }),
    ].join('\n');

    const result = await runSynthesizeResearchWithDeps(
      primaryContext,
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([1_000, 1_900]),
        parseJson: JSON.parse,
        runAttempt: async (attemptContext, config, onProgress) => {
          attempts.push(config.mode);

          if (config.mode === 'primary') {
            expect(config.tools).toHaveLength(0);
            await onProgress?.({
              phase: 'analysis',
              message: 'draft evidence: Buyers need pipeline accountability, not more channel fragmentation.',
            });
            throw new Error('Sub-agent timed out after 180s');
          }

          repairContext = attemptContext;
          expect(config.mode).toBe('repair');
          expect(config.system).toContain(
            'Map at least 2 messaging angles explicitly as objection -> counter-angle -> supporting proof',
          );

          return {
            resultText: JSON.stringify({
              keyInsights: [
                {
                  insight: 'Pipeline attribution is the core buying trigger for this market.',
                  source: 'industryResearch',
                  implication: 'Lead ads with measurable revenue accountability.',
                  priority: 'high',
                },
                {
                  insight: 'Competitors leave attribution proof vague.',
                  source: 'competitorIntel',
                  implication: 'Use reporting transparency as the lead differentiator.',
                  priority: 'high',
                },
              ],
              positioningStrategy: {
                recommendedAngle: 'Pipeline accountability for growth-stage SaaS',
                alternativeAngles: [
                  'Faster launch without enterprise agency overhead',
                  'SaaS-only paid media systems',
                ],
                leadRecommendation:
                  'It directly answers the strongest market pain and competitor gap.',
                keyDifferentiator: 'Revenue-linked reporting systems',
              },
              platformRecommendations: [
                {
                  platform: 'LinkedIn',
                  role: 'primary',
                  budgetAllocation: '60% ($3,000)',
                  rationale: 'The validated buyer lives in LinkedIn demand-gen workflows.',
                  priority: 1,
                },
                {
                  platform: 'Google Search',
                  role: 'secondary',
                  budgetAllocation: '30% ($1,500)',
                  rationale: 'Capture high-intent demand already searching for agencies.',
                  priority: 2,
                },
              ],
              messagingAngles: [
                {
                  angle: 'Stop guessing where pipeline comes from',
                  targetEmotion: 'control',
                  exampleHook: 'Finally prove which campaigns create revenue, not vanity leads.',
                  evidence: 'ICP objections and competitor weaknesses both center on attribution.',
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
                downstreamSequence: ['keywordIntel', 'mediaPlan'],
              },
              strategicNarrative:
                'SaaSLaunch should lead with pipeline accountability, then support that promise with channel sequencing and visible reporting proof.',
              citations: [
                {
                  url: 'https://heydigital.co',
                  title: 'Hey Digital',
                },
              ],
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 120,
                outputTokens: 500,
                totalTokens: 620,
              },
              estimatedCostUsd: 0.01,
            },
          };
        },
      },
    );

    expect(attempts).toEqual(['primary', 'repair']);
    expect(repairContext).toContain('BUSINESS SNAPSHOT:');
    expect(repairContext).toContain('MARKET OVERVIEW SNAPSHOT:');
    expect(repairContext).toContain('COMPETITOR INTEL SNAPSHOT:');
    expect(repairContext).toContain('ICP VALIDATION SNAPSHOT:');
    expect(repairContext).toContain('OFFER ANALYSIS SNAPSHOT:');
    expect(repairContext).not.toContain('## Market Overview');
    expect(repairContext).not.toContain('## Competitor Intel');
    expect(repairContext).not.toContain('## Offer Analysis');
    expect(repairContext.length).toBeLessThan(3_000);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'strategicSynthesis',
      durationMs: 900,
    });
    expect(progress.map((update) => update.message)).toEqual(
      expect.arrayContaining([
        'attempt primary (model: claude-sonnet-4-6, tools: disabled) started',
        'attempt primary (model: claude-sonnet-4-6, tools: disabled) timed out (source: worker_timeout)',
        'primary strategic synthesis pass timed out — repairing artifact without charts',
        expect.stringMatching(
          /^repair evidence package prepared \(business lines: 5, section summaries: 4, citations: 0, analysis notes: 1, draft chars: 0, total chars: \d+\)$/,
        ),
        'attempt repair (model: claude-sonnet-4-6, tools: disabled) started',
        'attempt repair (model: claude-sonnet-4-6, tools: disabled) completed (stop reason: end_turn)',
      ]),
    );
  });

  it('repairs generic messaging angles when objections are not carried through into hooks and proof', async () => {
    const attempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];
    let repairContext = '';
    const context = [
      'Journey research sandbox context',
      'Section: Strategic Synthesis',
      '',
      'Business context:',
      '- Company Name: SaaSLaunch',
      '- Business Model: B2B SaaS demand generation agency',
      '- Product Description: Paid media systems for B2B SaaS teams',
      '- Goals: Generate more qualified demos and lower CAC',
      '- Monthly Ad Budget: $5,000',
      '',
      'Existing persisted research to reuse:',
      '',
      '## Market Overview',
      JSON.stringify({
        categorySnapshot: {
          category: 'B2B SaaS Demand Generation',
          buyingBehavior: 'roi_based',
        },
        painPoints: {
          primary: ['Attribution gaps', 'High CAC', 'Weak pipeline visibility'],
        },
      }),
      '',
      '## Competitor Intel',
      JSON.stringify({
        competitors: [
          {
            name: 'Hey Digital',
            website: 'https://heydigital.co',
            weaknesses: ['Weak attribution reporting'],
          },
        ],
        whiteSpaceGaps: [
          {
            gap: 'Pipeline accountability',
            recommendedAction: 'Lead with revenue reporting',
          },
        ],
      }),
      '',
      '## ICP Validation',
      JSON.stringify({
        validatedPersona: 'VP Marketing at Series A-B B2B SaaS companies',
        channels: ['LinkedIn', 'Google Search'],
        objections: [
          'I have hired agencies before and could not trace spend to revenue.',
          'I do not want another retainer without proof that launch will be fast and measurable.',
        ],
      }),
      '',
      '## Offer Analysis',
      JSON.stringify({
        recommendation: {
          status: 'proceed',
          summary: 'Lead with pipeline accountability',
          priorityFixes: ['Sharpen attribution promise'],
        },
        pricingAnalysis: {
          pricingPosition: 'mid-market',
        },
        messagingRecommendations: [
          'Lead with pipeline accountability and visible reporting proof.',
          'Use transparent launch scope to reduce retainer anxiety.',
        ],
      }),
    ].join('\n');

    const result = await runSynthesizeResearchWithDeps(
      context,
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([3_000, 3_910]),
        parseJson: JSON.parse,
        runAttempt: async (attemptContext, config) => {
          attempts.push(config.mode);

          if (config.mode === 'primary') {
            return {
              resultText: JSON.stringify({
                keyInsights: [
                  {
                    insight: 'Pipeline attribution is the core buying trigger for this market.',
                    source: 'industryResearch',
                    implication: 'Lead ads with measurable revenue accountability.',
                    priority: 'high',
                  },
                  {
                    insight: 'Competitors leave attribution proof vague.',
                    source: 'competitorIntel',
                    implication: 'Use reporting transparency as the lead differentiator.',
                    priority: 'high',
                  },
                ],
                positioningStrategy: {
                  recommendedAngle: 'Pipeline accountability for growth-stage SaaS',
                  alternativeAngles: [
                    'Faster launch without enterprise agency overhead',
                    'SaaS-only paid media systems',
                  ],
                  leadRecommendation:
                    'It directly answers the strongest market pain and competitor gap.',
                  keyDifferentiator: 'Revenue-linked reporting systems',
                },
                platformRecommendations: [
                  {
                    platform: 'LinkedIn',
                    role: 'primary',
                    budgetAllocation: '60% ($3,000)',
                    rationale:
                      'The validated buyer lives in LinkedIn demand-gen workflows.',
                    priority: 1,
                  },
                ],
                messagingAngles: [
                  {
                    angle: 'Pipeline visibility',
                    targetEmotion: 'control',
                    exampleHook:
                      'Finally get more clarity on your paid media performance.',
                    evidence:
                      'Research suggests buyers want more accountability and better reporting.',
                  },
                ],
                criticalSuccessFactors: [
                  'Clear attribution proof in creative and landing pages',
                ],
                nextSteps: ['Build attribution-led LinkedIn creative'],
                planningContext: {
                  monthlyBudget: '$5,000',
                  downstreamSequence: ['keywordIntel', 'mediaPlan'],
                },
                strategicNarrative:
                  'SaaSLaunch should lead with pipeline accountability and visible reporting proof.',
              }),
              telemetry: {
                model: config.model,
                stopReason: 'end_turn',
                usage: {
                  inputTokens: 120,
                  outputTokens: 420,
                  totalTokens: 540,
                },
                estimatedCostUsd: 0.009,
              },
            };
          }

          repairContext = attemptContext;
          expect(config.mode).toBe('repair');

          return {
            resultText: JSON.stringify({
              keyInsights: [
                {
                  insight: 'Pipeline attribution is the core buying trigger for this market.',
                  source: 'industryResearch',
                  implication: 'Lead ads with measurable revenue accountability.',
                  priority: 'high',
                },
                {
                  insight: 'Competitors leave attribution proof vague.',
                  source: 'competitorIntel',
                  implication: 'Use reporting transparency as the lead differentiator.',
                  priority: 'high',
                },
              ],
              positioningStrategy: {
                recommendedAngle: 'Pipeline accountability for growth-stage SaaS',
                alternativeAngles: [
                  'Faster launch without enterprise agency overhead',
                  'SaaS-only paid media systems',
                ],
                leadRecommendation:
                  'It directly answers the strongest market pain and competitor gap.',
                keyDifferentiator: 'Revenue-linked reporting systems',
              },
              platformRecommendations: [
                {
                  platform: 'LinkedIn',
                  role: 'primary',
                  budgetAllocation: '60% ($3,000)',
                  rationale:
                    'The validated buyer lives in LinkedIn demand-gen workflows.',
                  priority: 1,
                },
                {
                  platform: 'Google Search',
                  role: 'secondary',
                  budgetAllocation: '30% ($1,500)',
                  rationale:
                    'Capture high-intent demand already searching for agencies.',
                  priority: 2,
                },
              ],
              messagingAngles: [
                {
                  angle: 'Revenue proof before retainer bloat',
                  targetEmotion: 'relief',
                  exampleHook:
                    'See pipeline-linked reporting in week one before you fund another bloated agency retainer.',
                  evidence:
                    'Objection: I do not want another retainer without proof that launch will be fast and measurable. | Proof: Offer analysis recommends transparent launch scope and visible reporting proof.',
                },
                {
                  angle: 'Trace every dollar to revenue',
                  targetEmotion: 'control',
                  exampleHook:
                    'If you have been burned by fuzzy agency reporting, start with a search program tied to pipeline and CRM proof.',
                  evidence:
                    'Objection: I have hired agencies before and could not trace spend to revenue. | Proof: Competitor weaknesses and market pain both center on missing attribution clarity.',
                },
              ],
              criticalSuccessFactors: [
                'Clear attribution proof in creative and landing pages',
                'Tight LinkedIn to search sequencing',
                'Visible pipeline reporting from week one',
              ],
              nextSteps: [
                'Build objection-led LinkedIn creative',
                'Launch branded and competitor search campaigns',
                'Create a reporting proof landing page',
              ],
              planningContext: {
                monthlyBudget: '$5,000',
                targetCpl: '$250',
                targetCac: '$2,000',
                downstreamSequence: ['keywordIntel', 'mediaPlan'],
              },
              strategicNarrative:
                'SaaSLaunch should lead with pipeline accountability, then support that promise with channel sequencing and visible reporting proof.',
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

    expect(attempts).toEqual(['primary', 'repair']);
    expect(repairContext).toContain('ICP VALIDATION SNAPSHOT:');
    expect(repairContext).toContain('Core objections');
    expect(result).toMatchObject({
      status: 'complete',
      section: 'strategicSynthesis',
      durationMs: 910,
    });
    expect(progress.map((update) => update.message)).toEqual(
      expect.arrayContaining([
        'strategic synthesis messaging angles missed objection carry-through — repairing artifact without charts',
        'attempt repair (model: claude-sonnet-4-6, tools: disabled) started',
        'attempt repair (model: claude-sonnet-4-6, tools: disabled) completed (stop reason: end_turn)',
      ]),
    );
  });

  it('does not run a quality-only repair when the primary messaging angles are already decision-useful', async () => {
    const attempts: string[] = [];
    const progress: RunnerProgressUpdate[] = [];

    const result = await runSynthesizeResearchWithDeps(
      [
        'Journey research sandbox context',
        'Section: Strategic Synthesis',
        '',
        'Business context:',
        '- Company Name: SaaSLaunch',
        '- Business Model: B2B SaaS demand generation agency',
        '- Product Description: Paid media systems for B2B SaaS teams',
        '- Goals: Generate more qualified demos and lower CAC',
        '- Monthly Ad Budget: $5,000',
        '',
        'Existing persisted research to reuse:',
        '',
        '## ICP Validation',
        JSON.stringify({
          validatedPersona: 'VP Marketing at Series A-B B2B SaaS companies',
          channels: ['LinkedIn', 'Google Search'],
          objections: [
            'I need proof that spend maps to revenue before I hire another agency.',
            'I do not want a slow launch that burns budget before we learn anything.',
          ],
        }),
        '',
        '## Competitor Intel',
        JSON.stringify({
          competitors: [
            {
              name: 'Hey Digital',
              website: 'https://heydigital.co',
              weaknesses: ['Weak attribution reporting'],
            },
          ],
        }),
      ].join('\n'),
      (update) => {
        progress.push(update);
      },
      {
        now: createNow([6_000, 6_240]),
        parseJson: JSON.parse,
        runAttempt: async (_attemptContext, config) => {
          attempts.push(config.mode);
          expect(config.tools).toHaveLength(0);

          return {
            resultText: JSON.stringify({
              keyInsights: [
                {
                  insight: 'Buyers want proof that paid spend becomes pipeline.',
                  source: 'icpValidation',
                  implication: 'Lead with CRM-linked reporting instead of channel tactics.',
                  priority: 'high',
                },
              ],
              positioningStrategy: {
                recommendedAngle: 'Pipeline accountability for lean SaaS teams',
                alternativeAngles: [
                  'Faster launch without bloated agency process',
                  'Transparent execution scope tied to revenue proof',
                ],
                leadRecommendation: 'It addresses the loudest buyer trust objection directly.',
                keyDifferentiator: 'Visible pipeline reporting in the first launch window',
              },
              platformRecommendations: [
                {
                  platform: 'LinkedIn',
                  role: 'primary',
                  budgetAllocation: '60% ($3,000)',
                  rationale: 'The buyer is active in B2B demand-gen workflows here.',
                  priority: 1,
                },
              ],
              messagingAngles: [
                {
                  angle: 'Trace every dollar to pipeline',
                  targetEmotion: 'control',
                  exampleHook: 'Stop funding campaigns you cannot tie back to revenue.',
                  evidence:
                    'Buyers explicitly ask for revenue proof before they trust another agency retainer.',
                },
                {
                  angle: 'Launch fast enough to learn before budget drifts',
                  targetEmotion: 'relief',
                  exampleHook: 'See useful signal in the first launch window instead of waiting through a slow agency rollout.',
                  evidence:
                    'The strongest trust objection is slow, expensive onboarding without fast feedback loops.',
                },
              ],
              criticalSuccessFactors: [
                'Revenue-linked reporting proof in creative',
                'Fast launch motion with visible early signal',
                'Tight offer-to-channel sequencing',
              ],
              nextSteps: [
                'Write objection-led LinkedIn ads',
                'Build a pipeline-proof landing page',
                'Sequence search around attribution terms',
              ],
              planningContext: {
                monthlyBudget: '$5,000',
                downstreamSequence: ['keywordIntel', 'mediaPlan'],
              },
              strategicNarrative:
                'SaaSLaunch should win by pairing fast launch execution with visible pipeline accountability.',
            }),
            telemetry: {
              model: config.model,
              stopReason: 'end_turn',
              usage: {
                inputTokens: 140,
                outputTokens: 420,
                totalTokens: 560,
              },
              estimatedCostUsd: 0.009,
            },
          };
        },
      },
    );

    expect(attempts).toEqual(['primary']);
    expect(result).toMatchObject({
      status: 'complete',
      section: 'strategicSynthesis',
      durationMs: 240,
    });
    expect(
      progress.some((update) =>
        update.message.includes('strategic synthesis messaging angles missed objection carry-through'),
      ),
    ).toBe(false);
  });
});
