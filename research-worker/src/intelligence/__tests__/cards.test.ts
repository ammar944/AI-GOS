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

import { synthesizeWhiteSpaceGap } from '../cards/white-space-gap';

const gapMockPack: EvidencePack = {
  cardName: 'white-space-gap',
  section: 'competitorIntel',
  entries: [
    {
      topic: 'competitor_name',
      content: 'Asana',
      source_runner: 'competitorIntel',
      provenance: 'tool_output',
      confidence: 95,
    },
    {
      topic: 'competitor_positioning',
      content: 'Asana targets large teams; pricing starts at $13/user/mo',
      source_runner: 'competitorIntel',
      provenance: 'web_search',
      confidence: 80,
    },
  ],
  entryIds: ['competitor_name#1', 'competitor_positioning#1'],
  runId: 'r1',
  userId: 'u1',
};

describe('synthesizeWhiteSpaceGap', () => {
  it('parses a valid model response', async () => {
    const client = mockAnthropicClient(
      JSON.stringify({
        gaps: [
          {
            value: {
              gap: 'SMB-friendly pricing under $10/user',
              targetCompetitor: 'Asana',
              type: 'price',
            },
            evidenceIds: ['competitor_positioning#1'],
            confidence: 78,
          },
        ],
      }),
    );
    const result = await synthesizeWhiteSpaceGap(gapMockPack, { client });
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].value.targetCompetitor).toBe('Asana');
  });

  it('throws on non-JSON response', async () => {
    const client = mockAnthropicClient('nope');
    await expect(synthesizeWhiteSpaceGap(gapMockPack, { client })).rejects.toThrow(
      /white-space-gap: no json/i,
    );
  });
});

import { synthesizeOfferStatements } from '../cards/offer-statements';

const offerMockPack: EvidencePack = {
  cardName: 'offer-statement',
  section: 'offerAnalysis',
  entries: [
    {
      topic: 'offer_value_prop',
      content: 'Automate status reporting for ops teams',
      source_runner: 'offerAnalysis',
      provenance: 'ai_synthesis',
      confidence: 82,
    },
    {
      topic: 'icp_trigger',
      content: 'Ops lead sees another 4hr Friday lost to status reports',
      source_runner: 'icpValidation',
      provenance: 'meeting_intel',
      confidence: 85,
    },
  ],
  entryIds: ['offer_value_prop#1', 'icp_trigger#1'],
  runId: 'r1',
  userId: 'u1',
};

describe('synthesizeOfferStatements', () => {
  it('parses a valid model response', async () => {
    const client = mockAnthropicClient(
      JSON.stringify({
        statements: [
          {
            value: {
              type: 'hero',
              statement: 'Never lose another Friday to status reports',
              valueEquationAxis: 'time_delay',
              awarenessLevel: 'problem_aware',
            },
            evidenceIds: ['icp_trigger#1'],
            confidence: 82,
          },
        ],
      }),
    );
    const result = await synthesizeOfferStatements(offerMockPack, { client });
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0].value.type).toBe('hero');
  });
});
