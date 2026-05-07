// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lookup } from 'node:dns/promises';

import { runCompanyResearch } from '../run-company-research';
import type { CompanyResearchOutput } from '../schemas';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createGateway } from '@ai-sdk/gateway';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

vi.mock('ai', () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  Output: {
    object: vi.fn(({ schema }) => ({ type: 'object-output', schema })),
  },
}));

vi.mock('@ai-sdk/gateway', () => ({
  createGateway: vi.fn(() => vi.fn((modelId: string) => ({ provider: 'gateway', modelId }))),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: {
    tools: {
      webSearch_20250305: vi.fn(() => ({ type: 'anthropic-web-search-tool' })),
    },
  },
  createAnthropic: vi.fn(() => vi.fn()),
}));

vi.mock('@ai-sdk/perplexity', () => ({
  createPerplexity: vi.fn(() => vi.fn((modelId: string) => ({ provider: 'perplexity', modelId }))),
}));

vi.mock('@/lib/firecrawl', () => ({
  createFirecrawlClient: vi.fn(() => ({
    isAvailable: () => false,
    batchScrape: vi.fn(),
  })),
}));

const FIELD_NAMES = [
  'companyName',
  'businessModel',
  'industryVertical',
  'primaryIcpDescription',
  'jobTitles',
  'companySize',
  'geography',
  'headquartersLocation',
  'productDescription',
  'coreDeliverables',
  'pricingTiers',
  'valueProp',
  'guarantees',
  'topCompetitors',
  'uniqueEdge',
  'marketProblem',
  'situationBeforeBuying',
  'desiredTransformation',
  'commonObjections',
  'brandPositioning',
  'testimonialQuote',
  'caseStudiesUrl',
  'testimonialsUrl',
  'pricingUrl',
  'demoUrl',
] as const;

function makeOutput(): CompanyResearchOutput {
  const nullField = {
    value: null,
    confidence: 0,
    sourceUrl: null,
    reasoning: 'Not found on website or LinkedIn.',
  };

  const output = Object.fromEntries(FIELD_NAMES.map((field) => [field, { ...nullField }])) as unknown as CompanyResearchOutput;
  output.companyName = {
    value: 'ExampleCo',
    confidence: 95,
    sourceUrl: 'https://example.com',
    reasoning: 'Found on homepage.',
  };
  output.confidenceNotes = 'Gateway research completed.';
  return output;
}

async function readStream(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return result;
    result += value;
  }
}

describe('runCompanyResearch gateway routing', () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    vi.clearAllMocks();
    vi.mocked(lookup).mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it('uses Vercel AI Gateway with Anthropic native web search before older fallbacks when gateway auth is present', async () => {
    process.env.AI_GATEWAY_API_KEY = 'test-gateway-key';
    vi.mocked(generateText).mockResolvedValue({ output: makeOutput(), usage: { inputTokens: 10, outputTokens: 20 } } as Awaited<ReturnType<typeof generateText>>);

    const result = await runCompanyResearch({ websiteUrl: 'https://example.com', linkedinUrl: 'https://www.linkedin.com/company/example' });
    const payload = JSON.parse(await readStream(result.textStream)) as CompanyResearchOutput;

    expect(payload.companyName.value).toBe('ExampleCo');
    expect(createGateway).toHaveBeenCalledWith({ apiKey: 'test-gateway-key' });
    expect(anthropic.tools.webSearch_20250305).toHaveBeenCalledWith({ maxUses: 5 });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateText).mock.calls[0]?.[0]).toMatchObject({
      model: { provider: 'gateway', modelId: 'anthropic/claude-sonnet-4.6' },
      output: { type: 'object-output' },
      tools: { web_search: { type: 'anthropic-web-search-tool' } },
      temperature: 0,
      maxOutputTokens: 8000,
    });
  });

  it('uses Vercel deployment context for Gateway OIDC without passing an apiKey', async () => {
    process.env.VERCEL = '1';
    vi.mocked(generateText).mockResolvedValue({ output: makeOutput(), usage: { inputTokens: 10, outputTokens: 20 } } as Awaited<ReturnType<typeof generateText>>);

    const result = await runCompanyResearch({ websiteUrl: 'https://example.com' });
    const payload = JSON.parse(await readStream(result.textStream)) as CompanyResearchOutput;

    expect(payload.companyName.value).toBe('ExampleCo');
    expect(createGateway).toHaveBeenCalledWith();
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('does not treat VERCEL_OIDC_TOKEN alone as local Gateway auth and falls back to basic homepage intel', async () => {
    process.env.VERCEL_OIDC_TOKEN = 'test-oidc-token';
    vi.mocked(generateText).mockRejectedValueOnce(new Error('gateway unavailable'));
    globalThis.fetch = vi.fn(async () => new Response('<html><head><title>FallbackCo | Home</title><meta name="description" content="FallbackCo automates revenue operations."></head></html>', { status: 200, headers: { 'content-type': 'text/html' } }));

    const result = await runCompanyResearch({ websiteUrl: 'https://example.com' });
    const payload = JSON.parse(await readStream(result.textStream)) as CompanyResearchOutput;

    expect(generateText).not.toHaveBeenCalled();
    expect(createGateway).not.toHaveBeenCalled();
    expect(payload.companyName.value).toBe('FallbackCo');
    expect(payload.confidenceNotes).toContain('Basic homepage metadata fallback');
  });

  it('returns an all-null schema-valid payload when no AI credentials exist and homepage metadata fetch fails', async () => {
    globalThis.fetch = vi.fn(async () => new Response('blocked', { status: 403 }));

    const result = await runCompanyResearch({ websiteUrl: 'https://blocked.example' });
    const payload = JSON.parse(await readStream(result.textStream)) as CompanyResearchOutput;

    expect(generateText).not.toHaveBeenCalled();
    expect(createGateway).not.toHaveBeenCalled();
    expect(payload.companyName.value).toBeNull();
    expect(payload.topCompetitors.value).toBeNull();
    expect(payload.confidenceNotes).toContain('basic homepage metadata fallback failed');
  });

  it('blocks private IPv6 homepage fallback URLs before fetch', async () => {
    globalThis.fetch = vi.fn(async () => new Response('<html></html>', { status: 200 }));

    const result = await runCompanyResearch({ websiteUrl: 'http://[fd00::1]/' });
    const payload = JSON.parse(await readStream(result.textStream)) as CompanyResearchOutput;

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(payload.companyName.value).toBeNull();
    expect(payload.confidenceNotes).toContain('basic homepage metadata fallback failed');
  });
});
