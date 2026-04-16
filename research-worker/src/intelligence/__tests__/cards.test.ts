import { describe, expect, it } from 'vitest';
import { extractJsonObject } from '../cards/_shared';

describe('extractJsonObject', () => {
  it('parses bare JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it('parses fenced JSON', () => {
    expect(extractJsonObject('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it('parses JSON with leading prose', () => {
    expect(extractJsonObject('Here is the result:\n{"a":3}\nEnd.')).toEqual({ a: 3 });
  });
  it('returns null on invalid JSON', () => {
    expect(extractJsonObject('nope')).toBeNull();
    expect(extractJsonObject('{ bad json }')).toBeNull();
  });
});

import { synthesizeOpportunity } from '../cards/opportunity';
import type { EvidencePack } from '../types';
import type { WikiEntry } from '../../wiki';

const mockEntries: WikiEntry[] = [
  {
    topic: 'market_size',
    content: '$12B TAM growing 18% YoY',
    source_runner: 'industryResearch',
    provenance: 'web_search',
    confidence: 80,
  },
  {
    topic: 'pain_point',
    content: 'Ops teams lose 4hr/wk to status updates',
    source_runner: 'industryResearch',
    provenance: 'web_search',
    confidence: 75,
  },
];

const mockPack: EvidencePack = {
  cardName: 'opportunity',
  section: 'industryMarket',
  entries: mockEntries,
  entryIds: ['market_size#1', 'pain_point#1'],
  runId: 'r1',
  userId: 'u1',
};

function mockAnthropicClient(responseText: string) {
  return {
    messages: {
      create: async () => ({
        content: [{ type: 'text', text: responseText }],
      }),
    },
  } as unknown as import('@anthropic-ai/sdk').default;
}

describe('synthesizeOpportunity', () => {
  it('parses a valid model response', async () => {
    const client = mockAnthropicClient(
      JSON.stringify({
        opportunities: [
          {
            value: {
              opportunity: 'Automated status update tool',
              size: 'large',
              timing: 'now',
              difficulty: 'medium',
            },
            evidenceIds: ['market_size#1', 'pain_point#1'],
            confidence: 85,
          },
        ],
      }),
    );
    const result = await synthesizeOpportunity(mockPack, { client });
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].value.opportunity).toContain('Automated');
    expect(result.opportunities[0].evidenceIds).toEqual(['market_size#1', 'pain_point#1']);
  });

  it('throws when response is not valid JSON', async () => {
    const client = mockAnthropicClient('no json here');
    await expect(synthesizeOpportunity(mockPack, { client })).rejects.toThrow(
      /opportunity: no json/i,
    );
  });

  it('throws when schema validation fails', async () => {
    const client = mockAnthropicClient(JSON.stringify({ opportunities: 'not-an-array' }));
    await expect(synthesizeOpportunity(mockPack, { client })).rejects.toThrow(
      /schema mismatch/i,
    );
  });
});
