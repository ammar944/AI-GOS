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
] as const;

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
  it('passes only when the corpus has enough real Perplexity-cited sources and evidence', () => {
    const report = validateDeepResearchMinimums(
      buildCorpusFixture(),
      citationSources,
    );

    expect(report).toMatchObject({
      evidenceCount: 8,
      passed: true,
      sourceCount: 6,
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
});

describe('runDeepResearchProgram', () => {
  it('uses Perplexity sonar for the corpus path without Anthropic auth', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
    const corpusFixture = buildCorpusFixture();
    const generateTextMock = vi.mocked(generateText);
    generateTextMock.mockResolvedValue(
      buildGenerateTextResult(corpusFixture) as Awaited<ReturnType<typeof generateText>>,
    );
    const progress: RunnerProgressUpdate[] = [];

    const result = await runDeepResearchProgram(
      'Website: https://ramp.com\nCompany Name: Ramp',
      (update) => {
        progress.push(update);
      },
    );

    expect(result.status).toBe('complete');
    expect(createPerplexity).toHaveBeenCalledWith({ apiKey: 'test-perplexity-key' });
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const call = generateTextMock.mock.calls[0]?.[0] as {
      model?: { modelId?: string };
      output?: unknown;
      prompt?: string;
    };
    expect(call.model?.modelId).toBe('sonar-pro');
    expect(call.output).toBeDefined();
    expect(call.prompt).toContain('https://ramp.com');
    expect(result.provenance?.citationCount).toBe(6);
    expect(result.telemetry?.model).toBe('sonar-pro');
    expect(JSON.stringify(result.data)).not.toContain('example.com');
    expect(
      progress.some(
        (update) =>
          update.meta?.section === 'deepResearchProgram' &&
          update.meta.status === 'complete',
      ),
    ).toBe(true);
  });

  it('runs a bounded supplemental sonar citation pass when the main corpus has fewer than six citations', async () => {
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
      )
      .mockResolvedValueOnce(
        buildGenerateTextResult({ supplemental: true }, citationSources.slice(4)) as Awaited<ReturnType<typeof generateText>>,
      );

    const result = await runDeepResearchProgram(
      'Website: https://ramp.com\nCompany Name: Ramp',
    );

    expect(result.status).toBe('complete');
    expect(generateTextMock).toHaveBeenCalledTimes(2);
    expect(result.provenance?.citationCount).toBe(6);
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
      )
      .mockResolvedValueOnce(
        buildGenerateTextResult({ supplemental: true }, citationSources.slice(4)) as Awaited<ReturnType<typeof generateText>>,
      )
      .mockResolvedValueOnce(
        buildGenerateTextResult(firstRepair, []) as Awaited<ReturnType<typeof generateText>>,
      )
      .mockResolvedValueOnce(
        buildGenerateTextResult(corpusFixture, []) as Awaited<ReturnType<typeof generateText>>,
      );

    const result = await runDeepResearchProgram(
      'Website: https://ramp.com\nCompany Name: Ramp',
    );

    expect(result.status).toBe('complete');
    expect(generateTextMock).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(result.data)).not.toContain('https://ramp.com/card');
    expect(result.provenance?.citationCount).toBe(6);
  });
});
