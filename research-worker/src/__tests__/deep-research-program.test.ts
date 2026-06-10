import { createPerplexity } from '@ai-sdk/perplexity';
import { generateText } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  runDeepResearchProgram,
  validateDeepResearchMinimums,
} from '../runners/deep-research-program';
import type { RunnerProgressUpdate } from '../runner';

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();

  return {
    ...actual,
    generateText: vi.fn(),
  };
});

vi.mock('@ai-sdk/perplexity', () => ({
  createPerplexity: vi.fn(() => (modelId: string) => ({
    modelId,
    provider: 'perplexity',
  })),
}));

const originalEnv = { ...process.env };

const citationSources = [
  { title: 'Ramp homepage', url: 'https://ramp.com/' },
  { title: 'Ramp corporate card', url: 'https://ramp.com/corporate-card' },
  { title: 'Ramp bill pay', url: 'https://ramp.com/bill-pay' },
  { title: 'Ramp expense management', url: 'https://ramp.com/expense-management' },
  { title: 'Ramp procurement', url: 'https://ramp.com/procurement' },
  { title: 'Ramp pricing', url: 'https://ramp.com/pricing' },
  { title: 'Ramp customers', url: 'https://ramp.com/customers' },
  { title: 'Ramp integrations', url: 'https://ramp.com/integrations' },
  { title: 'Ramp finance automation guide', url: 'https://ramp.com/blog/finance-automation' },
  { title: 'Ramp approvals documentation', url: 'https://ramp.com/docs/approvals' },
] as const;

type GenerateTextMock = ReturnType<typeof vi.mocked<typeof generateText>>;

function onboardingField(value: string | null): {
  value: string | null;
  confidence: number;
  sourceUrl: string | null;
  reasoning: string;
} {
  return {
    value,
    confidence: value === null ? 0 : 85,
    sourceUrl: value === null ? null : 'https://ramp.com/',
    reasoning: value === null ? 'Not verified in captured evidence.' : 'Verified from cited Ramp pages.',
  };
}

function buildCorpusFixture(): Record<string, unknown> {
  return {
    corpus: {
      company: 'Ramp',
      category: 'Spend management',
      researchSummary:
        'Ramp is a spend management platform combining cards, expenses, bill pay, procurement, and finance automation for businesses.',
      sources: citationSources.map((source) => ({
        ...source,
        whyItMatters: 'Perplexity citation supporting the company corpus.',
      })),
      evidence: [
        {
          claim: 'Ramp sells spend management software.',
          source: 'Ramp homepage',
          url: 'https://ramp.com/',
          quote: 'Ramp describes its platform as helping businesses control spend.',
          confidence: 90,
        },
        {
          claim: 'Ramp offers corporate cards.',
          source: 'Ramp corporate card',
          url: 'https://ramp.com/corporate-card',
          quote: 'Ramp markets corporate cards as part of the spend management platform.',
          confidence: 88,
        },
        {
          claim: 'Ramp supports bill payments.',
          source: 'Ramp bill pay',
          url: 'https://ramp.com/bill-pay',
          quote: 'Ramp bill pay centralizes vendor payments and approvals.',
          confidence: 86,
        },
        {
          claim: 'Ramp supports expense workflows.',
          source: 'Ramp expense management',
          url: 'https://ramp.com/expense-management',
          quote: 'Ramp expense management helps teams submit, approve, and reconcile expenses.',
          confidence: 86,
        },
        {
          claim: 'Ramp supports procurement.',
          source: 'Ramp procurement',
          url: 'https://ramp.com/procurement',
          quote: 'Ramp procurement helps companies manage purchase intake and approvals.',
          confidence: 84,
        },
        {
          claim: 'Ramp publishes pricing information.',
          source: 'Ramp pricing',
          url: 'https://ramp.com/pricing',
          quote: 'Ramp pricing pages describe plan options for the product.',
          confidence: 82,
        },
        {
          claim: 'Ramp targets finance teams.',
          source: 'Ramp homepage',
          url: 'https://ramp.com/',
          quote: 'Ramp positions finance automation for businesses and their finance teams.',
          confidence: 83,
        },
        {
          claim: 'Ramp combines multiple finance workflows.',
          source: 'Ramp homepage',
          url: 'https://ramp.com/',
          quote: 'Ramp combines cards, expenses, bill pay, procurement, and reporting workflows.',
          confidence: 85,
        },
      ],
      intelligenceTopics: [
        {
          topic: 'company_truth',
          summary: 'Ramp combines spend management software with finance automation workflows.',
          evidence: [
            {
              claim: 'Ramp presents itself as a spend management platform.',
              source: 'Ramp homepage',
              url: 'https://ramp.com/',
              quote: 'Ramp describes its platform as helping businesses control spend.',
              confidence: 90,
            },
            {
              claim: 'Ramp corporate cards are a named product line.',
              source: 'Ramp corporate card',
              url: 'https://ramp.com/corporate-card',
              quote: 'Ramp markets corporate cards as a spend-control product for businesses.',
              confidence: 86,
            },
          ],
        },
        {
          topic: 'market_category',
          summary: 'Ramp competes in spend management and adjacent finance automation categories.',
          evidence: [
            {
              claim: 'Ramp combines cards, expenses, bill pay, procurement, and reporting workflows.',
              source: 'Ramp homepage',
              url: 'https://ramp.com/',
              quote: 'Ramp combines cards, expenses, bill pay, procurement, and reporting workflows.',
              confidence: 85,
            },
          ],
        },
        {
          topic: 'buyer_icp',
          summary: 'Ramp is aimed at finance teams that need spend controls and workflow automation.',
          evidence: [
            {
              claim: 'Ramp targets finance teams.',
              source: 'Ramp homepage',
              url: 'https://ramp.com/',
              quote: 'Ramp positions finance automation for businesses and their finance teams.',
              confidence: 83,
            },
            {
              claim: 'Ramp publishes customer proof for businesses evaluating spend management.',
              source: 'Ramp customers',
              url: 'https://ramp.com/customers',
              quote: 'Ramp customer pages present businesses using Ramp as buyer proof.',
              confidence: 80,
            },
          ],
        },
        {
          topic: 'competitors',
          summary: 'Ramp positions against finance-stack alternatives through breadth across spend workflows.',
          evidence: [
            {
              claim: 'Ramp includes procurement in the same spend platform.',
              source: 'Ramp procurement',
              url: 'https://ramp.com/procurement',
              quote: 'Ramp procurement helps companies manage purchase intake and approvals.',
              confidence: 84,
            },
          ],
        },
        {
          topic: 'pricing_packaging',
          summary: 'Ramp has public pricing and packaging information that downstream offer sections can use.',
          evidence: [
            {
              claim: 'Ramp publishes pricing information.',
              source: 'Ramp pricing',
              url: 'https://ramp.com/pricing',
              quote: 'Ramp pricing pages describe plan options for the product.',
              confidence: 82,
            },
            {
              claim: 'Ramp integrations extend the spend management package into connected finance systems.',
              source: 'Ramp integrations',
              url: 'https://ramp.com/integrations',
              quote: 'Ramp integrations connect the platform to finance and operating systems.',
              confidence: 78,
            },
          ],
        },
        {
          topic: 'demand_intent',
          summary: 'Ramp demand research can use finance automation and approval workflow topics.',
          evidence: [
            {
              claim: 'Ramp publishes finance automation content.',
              source: 'Ramp finance automation guide',
              url: 'https://ramp.com/blog/finance-automation',
              quote: 'Ramp finance automation content describes automation pains for finance teams.',
              confidence: 76,
            },
            {
              claim: 'Ramp approval documentation supports approval-workflow demand themes.',
              source: 'Ramp approvals documentation',
              url: 'https://ramp.com/docs/approvals',
              quote: 'Ramp approval documentation describes approval controls for spend workflows.',
              confidence: 76,
            },
          ],
        },
      ],
    },
    onboardingFields: {
      companyName: onboardingField('Ramp'),
      businessModel: onboardingField('B2B SaaS'),
      industryVertical: onboardingField('Fintech'),
      primaryIcpDescription: onboardingField('Finance leaders at growing businesses'),
      jobTitles: onboardingField('CFO, Controller, Finance Operations'),
      companySize: onboardingField('Mid-market and growth-stage companies'),
      geography: onboardingField('United States'),
      headquartersLocation: onboardingField('New York, NY'),
      productDescription: onboardingField('Spend management software for business finance teams.'),
      coreDeliverables: onboardingField('Corporate cards, expense management, bill pay, procurement'),
      pricingTiers: onboardingField('Public pricing page available'),
      valueProp: onboardingField('Control spend and automate finance workflows.'),
      guarantees: onboardingField(null),
      topCompetitors: onboardingField('Brex, Airbase, Navan'),
      uniqueEdge: onboardingField('Integrated spend controls and automation.'),
      marketProblem: onboardingField('Finance teams need better spend visibility and controls.'),
      situationBeforeBuying: onboardingField('Manual expense, card, and bill payment workflows.'),
      desiredTransformation: onboardingField('Automated spend controls and faster close workflows.'),
      commonObjections: onboardingField(null),
      brandPositioning: onboardingField('Finance automation and spend management platform.'),
      testimonialQuote: onboardingField(null),
      caseStudiesUrl: onboardingField(null),
      testimonialsUrl: onboardingField(null),
      pricingUrl: onboardingField('https://ramp.com/pricing'),
      demoUrl: onboardingField(null),
    },
  };
}

function buildTopicSupplementResults(): Array<{
  output: Record<string, unknown>;
  sources: ReadonlyArray<{ title: string; url: string }>;
}> {
  return [
    {
      sources: citationSources.slice(4, 7),
      output: {
        evidence: [
          {
            claim: 'Supplemental buyer proof names finance teams as the audience.',
            source: 'Ramp customers',
            url: 'https://ramp.com/customers',
            quote: 'Ramp customer proof is aimed at finance teams evaluating spend controls.',
            confidence: 78,
          },
        ],
        intelligenceTopics: [
          {
            topic: 'buyer_icp',
            summary: 'Supplemental fan-out found buyer proof for finance teams.',
            evidence: [
              {
                claim: 'Supplemental buyer proof names finance teams as the audience.',
                source: 'Ramp customers',
                url: 'https://ramp.com/customers',
                quote: 'Ramp customer proof is aimed at finance teams evaluating spend controls.',
                confidence: 78,
              },
            ],
          },
        ],
      },
    },
    {
      sources: citationSources.slice(7, 8),
      output: {
        evidence: [
          {
            claim: 'Supplemental offer proof ties integrations to packaging depth.',
            source: 'Ramp integrations',
            url: 'https://ramp.com/integrations',
            quote: 'Ramp integrations connect the platform to finance and operating systems.',
            confidence: 76,
          },
        ],
        intelligenceTopics: [
          {
            topic: 'offer_diagnostic',
            summary: 'Supplemental fan-out found integration breadth as offer proof.',
            evidence: [
              {
                claim: 'Supplemental offer proof ties integrations to packaging depth.',
                source: 'Ramp integrations',
                url: 'https://ramp.com/integrations',
                quote: 'Ramp integrations connect the platform to finance and operating systems.',
                confidence: 76,
              },
            ],
          },
        ],
      },
    },
    {
      sources: citationSources.slice(8, 10),
      output: {
        evidence: [
          {
            claim: 'Supplemental demand evidence names finance automation content.',
            source: 'Ramp finance automation guide',
            url: 'https://ramp.com/blog/finance-automation',
            quote: 'Ramp finance automation content describes automation pains for finance teams.',
            confidence: 76,
          },
          {
            claim: 'Supplemental recent-event evidence names approval workflow documentation.',
            source: 'Ramp approvals documentation',
            url: 'https://ramp.com/docs/approvals',
            quote: 'Ramp approval documentation describes approval controls for spend workflows.',
            confidence: 76,
          },
        ],
        intelligenceTopics: [
          {
            topic: 'demand_intent',
            summary: 'Supplemental fan-out found finance automation demand evidence.',
            evidence: [
              {
                claim: 'Supplemental demand evidence names finance automation content.',
                source: 'Ramp finance automation guide',
                url: 'https://ramp.com/blog/finance-automation',
                quote: 'Ramp finance automation content describes automation pains for finance teams.',
                confidence: 76,
              },
            ],
          },
          {
            topic: 'recent_events',
            summary: 'Supplemental fan-out found approval documentation as recent product context.',
            evidence: [
              {
                claim: 'Supplemental recent-event evidence names approval workflow documentation.',
                source: 'Ramp approvals documentation',
                url: 'https://ramp.com/docs/approvals',
                quote: 'Ramp approval documentation describes approval controls for spend workflows.',
                confidence: 76,
              },
            ],
          },
        ],
      },
    },
  ];
}

function queueTopicFanoutResults(generateTextMock: GenerateTextMock): void {
  for (const supplement of buildTopicSupplementResults()) {
    generateTextMock.mockResolvedValueOnce(
      buildGenerateTextResult(
        supplement.output,
        supplement.sources,
      ) as Awaited<ReturnType<typeof generateText>>,
    );
  }
}

function buildGenerateTextResult(
  output: Record<string, unknown>,
  sources: ReadonlyArray<{ title: string; url: string }> = citationSources,
): unknown {
  return {
    text: JSON.stringify(output),
    output,
    sources,
    finishReason: 'stop',
    rawFinishReason: 'stop',
    usage: {
      inputTokens: 1000,
      inputTokenDetails: {
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
        noCacheTokens: 1000,
      },
      outputTokens: 500,
      outputTokenDetails: {
        reasoningTokens: undefined,
        textTokens: 500,
      },
      totalTokens: 1500,
    },
    totalUsage: {
      inputTokens: 1000,
      inputTokenDetails: {
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
        noCacheTokens: 1000,
      },
      outputTokens: 500,
      outputTokenDetails: {
        reasoningTokens: undefined,
        textTokens: 500,
      },
      totalTokens: 1500,
    },
    providerMetadata: {
      perplexity: {
        usage: {
          citationTokens: 250,
          numSearchQueries: 4,
        },
      },
    },
  };
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

describe('validateDeepResearchMinimums', () => {
  it('passes only when the corpus has enough real Perplexity-cited sources, evidence, and topic coverage', () => {
    const report = validateDeepResearchMinimums(
      buildCorpusFixture(),
      citationSources,
    );

    expect(report).toMatchObject({
      coveredTopics: [
        'company_truth',
        'market_category',
        'buyer_icp',
        'competitors',
        'pricing_packaging',
        'demand_intent',
      ],
      evidenceCount: 16,
      passed: true,
      sourceCount: 10,
    });
    expect(report.errors).toEqual([]);
  });

  it('rejects fabricated URLs before the worker can persist the corpus', () => {
    const fixture = buildCorpusFixture();
    const corpus = fixture.corpus as {
      sources: Array<{ url: string }>;
    };
    corpus.sources[0] = { url: 'https://example.com/fake-ramp-report' };

    const report = validateDeepResearchMinimums(fixture, citationSources);

    expect(report.passed).toBe(false);
    expect(report.fabricatedMatches).toContain('https://example.com/fake-ramp-report');
    expect(report.errors.some((error) => error.includes('fabricated'))).toBe(true);
  });

  it('rejects shallow topic coverage before the worker can persist the corpus', () => {
    const fixture = buildCorpusFixture();
    const corpus = fixture.corpus as {
      intelligenceTopics: Record<string, unknown>[];
    };
    corpus.intelligenceTopics = corpus.intelligenceTopics.slice(0, 1);

    const report = validateDeepResearchMinimums(fixture, citationSources);

    expect(report.passed).toBe(false);
    expect(report.errors.some((error) => error.includes('corpus.intelligenceTopics'))).toBe(true);
  });

  it('rejects topic evidence URLs missing from captured Perplexity citations', () => {
    const fixture = buildCorpusFixture();
    const corpus = fixture.corpus as {
      intelligenceTopics: Array<{
        evidence: Array<{ url: string }>;
      }>;
    };
    corpus.intelligenceTopics[0]!.evidence[0]!.url = 'https://ramp.com/uncited-topic';

    const report = validateDeepResearchMinimums(fixture, citationSources);

    expect(report.passed).toBe(false);
    expect(report.ungroundedEvidenceUrls).toContain('https://ramp.com/uncited-topic');
    expect(report.errors.some((error) => error.includes('corpus.evidence includes URLs missing'))).toBe(true);
  });
});

describe('runDeepResearchProgram', () => {
  it('uses Perplexity sonar for the corpus path without Anthropic auth', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
    const corpusFixture = buildCorpusFixture();
    const generateTextMock = vi.mocked(generateText);
    generateTextMock.mockResolvedValueOnce(
      buildGenerateTextResult(corpusFixture) as Awaited<ReturnType<typeof generateText>>,
    );
    queueTopicFanoutResults(generateTextMock);
    const progress: RunnerProgressUpdate[] = [];

    const result = await runDeepResearchProgram(
      'Website: https://ramp.com\nCompany Name: Ramp',
      (update) => {
        progress.push(update);
      },
    );

    expect(result.status).toBe('complete');
    expect(createPerplexity).toHaveBeenCalledWith({ apiKey: 'test-perplexity-key' });
    expect(generateTextMock).toHaveBeenCalledTimes(4);
    const call = generateTextMock.mock.calls[0]?.[0] as {
      model?: { modelId?: string };
      output?: unknown;
      prompt?: string;
    };
    expect(call.model?.modelId).toBe('sonar-deep-research');
    expect(call.output).toBeDefined();
    expect(call.prompt).toContain('https://ramp.com');
    expect(call.prompt).toContain('intelligenceTopics');
    expect(call.prompt).toContain('multi-topic');
    const fanoutCall = generateTextMock.mock.calls[1]?.[0] as {
      model?: { modelId?: string };
    };
    expect(fanoutCall.model?.modelId).toBe('sonar-pro');
    expect(generateTextMock.mock.calls[1]?.[0].prompt).toContain('company-market-buyers');
    expect(generateTextMock.mock.calls[2]?.[0].prompt).toContain('competitors-pricing-offer');
    expect(generateTextMock.mock.calls[3]?.[0].prompt).toContain('voc-demand-events');
    expect(result.provenance?.citationCount).toBe(10);
    expect(result.telemetry?.model).toBe('sonar-deep-research');
    expect(JSON.stringify(result.data)).toContain('Supplemental offer proof');
    expect(JSON.stringify(result.data)).not.toContain('example.com');
    expect(
      progress.some(
        (update) =>
          update.meta?.section === 'deepResearchProgram' &&
          update.meta.status === 'complete',
      ),
    ).toBe(true);
  });

  it('runs bounded topic fan-out when the main corpus has fewer than ten citations', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
    const corpusFixture = buildCorpusFixture();
    const corpus = corpusFixture.corpus as {
      sources: Array<{ title: string; url: string; whyItMatters: string }>;
    };
    corpus.sources = corpus.sources.slice(0, 4);
    const generateTextMock = vi.mocked(generateText);
    generateTextMock
      .mockResolvedValueOnce(
        buildGenerateTextResult(corpusFixture, citationSources.slice(0, 4)) as Awaited<ReturnType<typeof generateText>>,
      );
    queueTopicFanoutResults(generateTextMock);

    const result = await runDeepResearchProgram(
      'Website: https://ramp.com\nCompany Name: Ramp',
    );

    expect(result.status).toBe('complete');
    expect(generateTextMock).toHaveBeenCalledTimes(4);
    expect(result.provenance?.citationCount).toBe(10);
  });

  it('re-repairs a corpus when the first repair still contains non-cited URLs', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
    const corpusFixture = buildCorpusFixture();
    const brokenCorpus = buildCorpusFixture();
    const brokenSources = (brokenCorpus.corpus as {
      sources: Array<{ title: string; url: string; whyItMatters: string }>;
    }).sources;
    brokenSources.splice(4, brokenSources.length - 4);
    const brokenEvidence = (brokenCorpus.corpus as {
      evidence: Array<{ claim: string; source: string; url: string; quote: string; confidence: number }>;
    }).evidence;
    brokenEvidence.splice(5, brokenEvidence.length - 5);
    brokenEvidence.push(
      {
        claim: 'Ramp has an uncited card page.',
        source: 'Ramp card',
        url: 'https://ramp.com/card',
        quote: 'Ramp card claim that is not in the Perplexity citation set.',
        confidence: 80,
      },
      {
        claim: 'Ramp has an uncited bill pay page.',
        source: 'Ramp bill pay',
        url: 'https://ramp.com/bill-pay',
        quote: 'Ramp bill pay claim that is not in the Perplexity citation set.',
        confidence: 80,
      },
      {
        claim: 'Ramp has an uncited customer page.',
        source: 'Ramp customers',
        url: 'https://ramp.com/customers',
        quote: 'Ramp customer claim that is not in the Perplexity citation set.',
        confidence: 80,
      },
    );

    const firstRepair = buildCorpusFixture();
    (firstRepair.corpus as {
      sources: Array<{ title: string; url: string; whyItMatters: string }>;
    }).sources.push({
      title: 'Ramp card',
      url: 'https://ramp.com/card',
      whyItMatters: 'Uncited URL from model repair.',
    });
    const firstRepairEvidence = (firstRepair.corpus as {
      evidence: Array<{ claim: string; source: string; url: string; quote: string; confidence: number }>;
    }).evidence;
    firstRepairEvidence.splice(5, firstRepairEvidence.length - 5);
    firstRepairEvidence.push({
      claim: 'Ramp has an uncited card page.',
      source: 'Ramp card',
      url: 'https://ramp.com/card',
      quote: 'Ramp card claim that is not in the Perplexity citation set.',
      confidence: 80,
    });

    const generateTextMock = vi.mocked(generateText);
    generateTextMock
      .mockResolvedValueOnce(
        buildGenerateTextResult(brokenCorpus, citationSources.slice(0, 4)) as Awaited<ReturnType<typeof generateText>>,
      );
    queueTopicFanoutResults(generateTextMock);
    generateTextMock
      .mockResolvedValueOnce(
        buildGenerateTextResult(firstRepair, []) as Awaited<ReturnType<typeof generateText>>,
      );
    queueTopicFanoutResults(generateTextMock);
    generateTextMock
      .mockResolvedValueOnce(
        buildGenerateTextResult(corpusFixture, []) as Awaited<ReturnType<typeof generateText>>,
      );
    queueTopicFanoutResults(generateTextMock);

    const result = await runDeepResearchProgram(
      'Website: https://ramp.com\nCompany Name: Ramp',
    );

    expect(result.status).toBe('complete');
    expect(generateTextMock).toHaveBeenCalledTimes(12);
    expect(JSON.stringify(result.data)).not.toContain('https://ramp.com/card');
    expect(result.provenance?.citationCount).toBe(10);
  });

  it('accepts structured repair output even when repair text is not parseable JSON', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
    const brokenCorpus = buildCorpusFixture();
    const corpus = brokenCorpus.corpus as {
      sources: Array<{ title: string; url: string; whyItMatters: string }>;
    };
    corpus.sources[0] = {
      title: 'Fabricated source',
      url: 'https://example.com/fake-ramp-report',
      whyItMatters: 'This fabricated source forces a minimums repair.',
    };
    const repairedCorpus = buildCorpusFixture();
    const generateTextMock = vi.mocked(generateText);
    generateTextMock.mockResolvedValueOnce(
      buildGenerateTextResult(brokenCorpus) as Awaited<ReturnType<typeof generateText>>,
    );
    queueTopicFanoutResults(generateTextMock);
    generateTextMock.mockResolvedValueOnce({
      ...(buildGenerateTextResult(repairedCorpus) as Record<string, unknown>),
      text: 'I repaired the corpus into the structured output payload.',
    } as Awaited<ReturnType<typeof generateText>>);
    queueTopicFanoutResults(generateTextMock);

    const result = await runDeepResearchProgram(
      'Website: https://ramp.com\nCompany Name: Ramp',
    );

    expect(result.status).toBe('complete');
    expect(generateTextMock).toHaveBeenCalledTimes(8);
    expect(JSON.stringify(result.data)).not.toContain('example.com');
    expect(result.provenance?.citationCount).toBe(10);
    expect(
      (generateTextMock.mock.calls[4]?.[0] as { output?: unknown }).output,
    ).toBeDefined();
  });
});
