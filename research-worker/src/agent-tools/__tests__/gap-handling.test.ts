/**
 * Phase 3a verification: wrappers gracefully surface gaps when credentials
 * are absent, not throw. This is the design-contract test from Phase 3a
 * verify gate item 1.
 */

import { describe, expect, it } from 'vitest';

import {
  firecrawlAgentTool,
  pagespeedAgentTool,
  reviewsAgentTool,
  spyfuAgentTool,
  keywordAdProbeAgentTool,
  adLibraryAgentTool,
} from '../index';

function clearEnv(...keys: string[]) {
  const prior: Record<string, string | undefined> = {};
  for (const key of keys) {
    prior[key] = process.env[key];
    delete process.env[key];
  }
  return () => {
    for (const key of keys) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
  };
}

function toolExecOptions(abortSignal?: AbortSignal): Parameters<NonNullable<Parameters<typeof invokeTool>[0]['execute']>>[1] {
  return {
    abortSignal: abortSignal ?? new AbortController().signal,
    toolCallId: 'test-tool-call',
    messages: [],
  } as unknown as Parameters<NonNullable<Parameters<typeof invokeTool>[0]['execute']>>[1];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function invokeTool(toolLike: { execute?: (...args: any[]) => any }, input: unknown, abortSignal?: AbortSignal): Promise<unknown> {
  if (!toolLike.execute) {
    throw new Error('tool has no execute');
  }
  return toolLike.execute(input, toolExecOptions(abortSignal));
}

describe('Phase 3a agent-tools — gap handling', () => {
  it('spyfu surfaces missing_credential when SPYFU_API_KEY is absent', async () => {
    const restore = clearEnv('SPYFU_API_KEY');
    try {
      const result = await invokeTool(spyfuAgentTool, { domain: 'example.com' });
      expect(result).toMatchObject({
        type: 'gap',
        reason: 'missing_credential',
        envVar: 'SPYFU_API_KEY',
      });
    } finally {
      restore();
    }
  });

  it('firecrawl surfaces missing_credential when FIRECRAWL_API_KEY is absent', async () => {
    const restore = clearEnv('FIRECRAWL_API_KEY');
    try {
      const result = await invokeTool(firecrawlAgentTool, {
        url: 'https://example.com',
        onlyMainContent: true,
      });
      expect(result).toMatchObject({
        type: 'gap',
        reason: 'missing_credential',
        envVar: 'FIRECRAWL_API_KEY',
      });
    } finally {
      restore();
    }
  });

  it('reviews surfaces missing_credential when SEARCHAPI_KEY is absent', async () => {
    const restore = clearEnv('SEARCHAPI_KEY');
    try {
      const result = await invokeTool(reviewsAgentTool, {
        brand: 'TestBrand',
        max_results: 5,
      });
      expect(result).toMatchObject({
        type: 'gap',
        reason: 'missing_credential',
        envVar: 'SEARCHAPI_KEY',
      });
    } finally {
      restore();
    }
  });

  it('keyword-ad-probe surfaces missing_credential when SEARCHAPI_KEY is absent', async () => {
    const restore = clearEnv('SEARCHAPI_KEY');
    try {
      const result = await invokeTool(keywordAdProbeAgentTool, {
        keyword: 'project management software',
        location: 'United States',
      });
      expect(result).toMatchObject({
        type: 'gap',
        reason: 'missing_credential',
        envVar: 'SEARCHAPI_KEY',
      });
    } finally {
      restore();
    }
  });

  it('adlibrary surfaces missing_credential when SEARCHAPI_KEY is absent', async () => {
    const restore = clearEnv('SEARCHAPI_KEY');
    try {
      const result = await invokeTool(adLibraryAgentTool, {
        advertiser: 'TestBrand',
        platform: 'meta',
        max_results: 5,
      });
      expect(result).toMatchObject({
        type: 'gap',
        reason: 'missing_credential',
        envVar: 'SEARCHAPI_KEY',
      });
    } finally {
      restore();
    }
  });

  it('pagespeed forwards abort signal — aborted controllers reject', async () => {
    // PageSpeed has no credential gate; verify the wrapper surfaces network
    // errors as api_error gaps rather than throwing.
    const controller = new AbortController();
    controller.abort();
    const result = await invokeTool(
      pagespeedAgentTool,
      { url: 'https://example.com' },
      controller.signal,
    );
    expect(result).toMatchObject({ type: 'gap' });
  });
});
