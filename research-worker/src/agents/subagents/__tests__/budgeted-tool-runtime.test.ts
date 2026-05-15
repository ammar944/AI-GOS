import { describe, expect, it, vi } from 'vitest';

import { createBudgetedToolRuntime } from '../index';

const mocks = vi.hoisted(() => {
  const executeFirecrawl = vi.fn(async () => ({
    type: 'result',
    tool: 'firecrawl',
  }));
  const executeGoogleAds = vi.fn(async () => ({
    type: 'result',
    tool: 'google_ads',
  }));
  return { executeFirecrawl, executeGoogleAds };
});

vi.mock('@ai-sdk/anthropic', () => {
  const anthropic = (modelId: string) => ({ modelId });
  return {
    anthropic: Object.assign(anthropic, {
      tools: {
        webSearch_20250305: () => ({ type: 'provider-defined', name: 'web_search' }),
      },
    }),
  };
});

vi.mock('ai', () => ({
  ToolLoopAgent: class {
    constructor() {
      // Runtime tests only exercise tool filtering and budgeting.
    }
  },
}));

vi.mock('../../../agent-tools', () => ({
  POSITIONING_TOOL_MAPS: {
    positioningMarketCategory: {
      web_search: { type: 'provider-defined', name: 'web_search' },
      firecrawl: { execute: mocks.executeFirecrawl },
      pagespeed: { execute: vi.fn() },
    },
    positioningBuyerICP: {},
    positioningCompetitorLandscape: {
      web_search: { type: 'provider-defined', name: 'web_search' },
      google_ads: { execute: mocks.executeGoogleAds },
      meta_ads: { execute: vi.fn() },
      firecrawl: { execute: vi.fn() },
    },
    positioningVoiceOfCustomer: {},
    positioningDemandIntent: {},
    positioningOfferDiagnostic: {},
  },
}));

function executableTool(value: unknown): {
  execute: (input: unknown, options: { abortSignal: AbortSignal }) => Promise<unknown>;
} {
  expect(value).toBeTruthy();
  const record = value as {
    execute?: (input: unknown, options: { abortSignal: AbortSignal }) => Promise<unknown>;
  };
  expect(typeof record.execute).toBe('function');
  return record as {
    execute: (input: unknown, options: { abortSignal: AbortSignal }) => Promise<unknown>;
  };
}

function readPrepareStep(runtime: {
  prepareStep: unknown;
}): { activeTools: string[] } {
  const prepareStep = runtime.prepareStep as () => { activeTools: string[] };
  return prepareStep();
}

describe('createBudgetedToolRuntime', () => {
  it('filters section tools to the Section Context Pack allowlist', () => {
    const runtime = createBudgetedToolRuntime({
      section: 'positioningCompetitorLandscape',
      toolBudget: {
        maxExternalLookups: 2,
        allowedTools: ['webSearch', 'googleAds'],
      },
    });

    expect(Object.keys(runtime.tools).sort()).toEqual([
      'google_ads',
      'web_search',
    ]);
  });

  it('returns a structured exhausted result once executable tools exceed the budget', async () => {
    mocks.executeFirecrawl.mockClear();
    const runtime = createBudgetedToolRuntime({
      section: 'positioningMarketCategory',
      toolBudget: {
        maxExternalLookups: 1,
        allowedTools: ['firecrawl'],
      },
      unresolvedEvidenceGapId: 'gap-001',
    });
    const firecrawl = executableTool(runtime.tools.firecrawl);
    const options = { abortSignal: new AbortController().signal };

    await expect(firecrawl.execute({ url: 'https://example.com/1' }, options))
      .resolves.toMatchObject({ type: 'result', tool: 'firecrawl' });
    await expect(firecrawl.execute({ url: 'https://example.com/2' }, options))
      .resolves.toMatchObject({
        ok: false,
        status: 'tool_budget_exhausted',
        maxExternalLookups: 1,
        unresolvedEvidenceGapId: 'gap-001',
      });

    expect(mocks.executeFirecrawl).toHaveBeenCalledTimes(1);
    expect(readPrepareStep(runtime)).toEqual({ activeTools: [] });
  });

  it('tracks provider-native tool calls against the same lookup budget', () => {
    const runtime = createBudgetedToolRuntime({
      section: 'positioningMarketCategory',
      toolBudget: {
        maxExternalLookups: 1,
        allowedTools: ['webSearch'],
      },
      unresolvedEvidenceGapId: 'gap-001',
    });

    expect(runtime.recordProviderToolCalls(['web_search'])).toEqual([]);
    expect(readPrepareStep(runtime)).toEqual({ activeTools: [] });
    expect(runtime.recordProviderToolCalls(['web_search'])).toEqual([
      expect.objectContaining({
        ok: false,
        status: 'tool_budget_exhausted',
        maxExternalLookups: 1,
        unresolvedEvidenceGapId: 'gap-001',
      }),
    ]);
  });
});
