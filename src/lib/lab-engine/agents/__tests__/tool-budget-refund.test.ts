import type { Tool, ToolExecutionOptions } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SectionToolBudget } from '../budget';
import { buildToolMap } from '../tool-registry';

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
}

function requireTool(value: unknown, name: string): Tool {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Expected ${name} tool object.`);
  }

  const execute = (value as { execute?: unknown }).execute;
  if (typeof execute !== 'function') {
    throw new Error(`Expected ${name} executable tool.`);
  }

  return value as Tool;
}

describe('tool budget refunds', (): void => {
  afterEach((): void => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    {
      markdown: 'Please enable JS and disable any ad blocker to continue.',
      name: 'JS challenge',
    },
    {
      markdown: '',
      name: 'empty markdown',
    },
  ])(
    'does not decrement usable budget for Firecrawl $name gaps',
    async ({ markdown }): Promise<void> => {
      vi.stubEnv('FIRECRAWL_API_KEY', 'test-firecrawl');
      vi.stubGlobal(
        'fetch',
        vi.fn(async (): Promise<Response> =>
          jsonResponse({
            data: {
              markdown,
              metadata: {
                sourceURL: 'https://www.g2.com/products/acme/reviews',
                title: 'Acme reviews',
              },
            },
          }),
        ),
      );

      const budget = new SectionToolBudget(1);
      const tools = buildToolMap(['firecrawl'], {
        budget,
        webSearchMaxUses: 1,
      });
      const firecrawl = requireTool(tools.firecrawl, 'firecrawl');

      const output = await firecrawl.execute?.(
        {
          onlyMainContent: true,
          url: 'https://www.g2.com/products/acme/reviews',
        },
        {} as ToolExecutionOptions,
      );

      expect(output).toMatchObject({
        consumesBudget: false,
        reason: 'content_unavailable',
        type: 'gap',
      });
      expect(budget.remaining()).toBe(1);
    },
  );
});
