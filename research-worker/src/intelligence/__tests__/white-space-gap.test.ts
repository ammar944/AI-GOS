import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { synthesizeWhiteSpaceGap } from '../cards/white-space-gap';
import { buildEvidencePack } from '../evidence-packer';
import type { WikiEntry } from '../../wiki';

// ---------------------------------------------------------------------------
// Mock client helpers
// ---------------------------------------------------------------------------

function mockClient(text: string): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text }] }),
    },
  } as unknown as Anthropic;
}

function mockThrowingClient(): Anthropic {
  return {
    messages: {
      create: vi.fn(() => {
        throw new Error('should not be called');
      }),
    },
  } as unknown as Anthropic;
}

// ---------------------------------------------------------------------------
// Shared wiki entry fixtures
// ---------------------------------------------------------------------------

const baseEntries: WikiEntry[] = [
  {
    topic: 'competitor_name',
    content: 'Acme Corp',
    source_runner: 'competitors',
    provenance: 'tool_output',
    confidence: 85,
  },
  {
    topic: 'competitor_name',
    content: 'Beta Inc',
    source_runner: 'competitors',
    provenance: 'tool_output',
    confidence: 85,
  },
  {
    topic: 'competitor_weakness',
    content: 'Slow implementation, 6-month timeline',
    source_runner: 'competitors',
    provenance: 'ai_synthesis',
    confidence: 70,
  },
  {
    topic: 'offer_value_prop',
    content: '30-day onboarding guarantee',
    source_runner: 'offer',
    provenance: 'tool_output',
    confidence: 80,
  },
];

// ---------------------------------------------------------------------------
// Valid response fixture
// ---------------------------------------------------------------------------

function makeValidResponse(competitorNames: [string, string] = ['Acme Corp', 'Beta Inc']): string {
  return JSON.stringify({
    gaps: [
      {
        value: {
          move: 'Lead with no-rip-and-replace angle vs ' + competitorNames[0],
          archetype: 'D',
          targetCompetitor: competitorNames[0],
          competitorWeakness: 'Slow 6-month implementation timeline cited in reviews',
          valueEquationAxis: 'timeDelay',
          risk: 'low',
          reward: 'high',
          playbook: 'Meta + LinkedIn ads highlighting 30-day vs 6-month setup time',
          evidence:
            'competitor_weakness#1 mentions 6-month timeline; offer_value_prop#1 promises 30-day onboarding',
        },
        evidenceIds: ['competitor_weakness#1', 'offer_value_prop#1'],
        confidence: 82,
      },
      {
        value: {
          move: 'Undercut ' + competitorNames[1] + ' on time-to-value messaging',
          archetype: 'C',
          targetCompetitor: competitorNames[1],
          competitorWeakness: 'Complex pricing structure causes confusion among buyers',
          valueEquationAxis: 'effort',
          risk: 'medium',
          reward: 'medium',
          playbook: 'Price transparency landing pages + Google comparison ads',
          evidence: 'competitor_name#2 identified in research; offer_value_prop#1 highlights simplicity',
        },
        evidenceIds: ['competitor_name#2', 'offer_value_prop#1'],
        confidence: 74,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('synthesizeWhiteSpaceGap', () => {
  // Test 1 — Gate on <3 entries
  it('returns empty without calling client when pack has fewer than 3 entries', async () => {
    const twoEntries: WikiEntry[] = [
      {
        topic: 'competitor_name',
        content: 'Acme Corp',
        source_runner: 'competitors',
        provenance: 'tool_output',
        confidence: 85,
      },
      {
        topic: 'competitor_weakness',
        content: 'Too slow to onboard customers effectively',
        source_runner: 'competitors',
        provenance: 'ai_synthesis',
        confidence: 70,
      },
    ];
    const pack = buildEvidencePack('white-space-gap', 'competitorIntel', twoEntries, 'run-1', 'user-1');
    const client = mockThrowingClient();
    const createSpy = vi.spyOn(client.messages, 'create');

    const result = await synthesizeWhiteSpaceGap(pack, { client });

    expect(result).toEqual({ gaps: [] });
    expect(createSpy).not.toHaveBeenCalled();
  });

  // Test 2 — Gate on no competitor_name entries
  it('returns empty without calling client when no competitor_name entries exist', async () => {
    const noCompetitorEntries: WikiEntry[] = [
      {
        topic: 'offer_value_prop',
        content: '30-day onboarding guarantee beats industry average',
        source_runner: 'offer',
        provenance: 'tool_output',
        confidence: 80,
      },
      {
        topic: 'market_size',
        content: '$5B TAM growing at 15% YoY',
        source_runner: 'industryResearch',
        provenance: 'web_search',
        confidence: 75,
      },
      {
        topic: 'offer_pricing',
        content: '$299/month flat pricing',
        source_runner: 'offer',
        provenance: 'tool_output',
        confidence: 90,
      },
      {
        topic: 'market_trend',
        content: 'AI automation driving consolidation in this sector',
        source_runner: 'industryResearch',
        provenance: 'web_search',
        confidence: 70,
      },
      {
        topic: 'offer_value_prop',
        content: 'Zero integration fees unlike competitors',
        source_runner: 'offer',
        provenance: 'tool_output',
        confidence: 85,
      },
    ];
    const pack = buildEvidencePack(
      'white-space-gap',
      'competitorIntel',
      noCompetitorEntries,
      'run-1',
      'user-1',
    );
    const client = mockThrowingClient();
    const createSpy = vi.spyOn(client.messages, 'create');

    const result = await synthesizeWhiteSpaceGap(pack, { client });

    expect(result).toEqual({ gaps: [] });
    expect(createSpy).not.toHaveBeenCalled();
  });

  // Test 3 — Valid synthesis
  it('returns 2 gaps when pack has valid entries with 2 competitors', async () => {
    const pack = buildEvidencePack('white-space-gap', 'competitorIntel', baseEntries, 'run-1', 'user-1');
    const client = mockClient(makeValidResponse());

    const result = await synthesizeWhiteSpaceGap(pack, { client });

    expect(result.gaps).toHaveLength(2);
    expect(result.gaps[0].value.targetCompetitor).toBe('Acme Corp');
    expect(result.gaps[0].value.archetype).toBe('D');
    expect(result.gaps[0].evidenceIds).toContain('competitor_weakness#1');
    expect(result.gaps[1].value.targetCompetitor).toBe('Beta Inc');
    expect(result.gaps[1].value.archetype).toBe('C');
  });

  // Test 4 — Competitor filter drops unknown names
  it('filters gaps with unknown competitor names and warns', async () => {
    const responseWithUnknown = JSON.stringify({
      gaps: [
        {
          value: {
            move: 'Lead with no-rip-and-replace angle vs Acme Corp',
            archetype: 'D',
            targetCompetitor: 'Acme Corp',
            competitorWeakness: 'Slow 6-month implementation timeline',
            valueEquationAxis: 'timeDelay',
            risk: 'low',
            reward: 'high',
            playbook: 'Meta + LinkedIn ads highlighting 30-day vs 6-month setup time',
            evidence: 'competitor_weakness#1 mentions 6-month timeline',
          },
          evidenceIds: ['competitor_weakness#1'],
          confidence: 82,
        },
        {
          value: {
            move: 'Attack Unknown LLC on pricing transparency grounds',
            archetype: 'B',
            targetCompetitor: 'Unknown LLC',
            competitorWeakness: 'Hidden fees surprise buyers at renewal',
            valueEquationAxis: 'effort',
            risk: 'high',
            reward: 'low',
            playbook: 'Comparison landing page vs Unknown LLC',
            evidence: 'offer_value_prop#1 highlights transparent pricing',
          },
          evidenceIds: ['offer_value_prop#1'],
          confidence: 55,
        },
        {
          value: {
            move: 'Undercut Beta Inc on time-to-value',
            archetype: 'C',
            targetCompetitor: 'Beta Inc',
            competitorWeakness: 'Complex pricing causes confusion',
            valueEquationAxis: 'effort',
            risk: 'medium',
            reward: 'medium',
            playbook: 'Google comparison ads vs Beta Inc',
            evidence: 'competitor_name#2 from research',
          },
          evidenceIds: ['competitor_name#2'],
          confidence: 74,
        },
      ],
    });

    const pack = buildEvidencePack('white-space-gap', 'competitorIntel', baseEntries, 'run-1', 'user-1');
    const client = mockClient(responseWithUnknown);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await synthesizeWhiteSpaceGap(pack, { client });

    expect(result.gaps).toHaveLength(2);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('filtered 1 gap'));

    warnSpy.mockRestore();
  });

  // Test 5 — Case-insensitive substring match
  it('keeps gap when targetCompetitor is a substring match of competitor_name', async () => {
    const entriesWithLongName: WikiEntry[] = [
      {
        topic: 'competitor_name',
        content: 'Acme Corporation',
        source_runner: 'competitors',
        provenance: 'tool_output',
        confidence: 85,
      },
      {
        topic: 'competitor_weakness',
        content: 'Slow 6-month implementation timeline cited in G2 reviews',
        source_runner: 'competitors',
        provenance: 'ai_synthesis',
        confidence: 70,
      },
      {
        topic: 'offer_value_prop',
        content: '30-day onboarding guarantee',
        source_runner: 'offer',
        provenance: 'tool_output',
        confidence: 80,
      },
    ];
    const responseWithSubstring = JSON.stringify({
      gaps: [
        {
          value: {
            move: 'Beat Acme on implementation speed',
            archetype: 'D',
            targetCompetitor: 'Acme',
            competitorWeakness: 'Slow 6-month implementation timeline',
            valueEquationAxis: 'timeDelay',
            risk: 'low',
            reward: 'high',
            playbook: 'Ads showing 30-day vs 6-month onboarding',
            evidence: 'competitor_weakness#1 shows 6-month timeline',
          },
          evidenceIds: ['competitor_weakness#1'],
          confidence: 80,
        },
      ],
    });

    const pack = buildEvidencePack(
      'white-space-gap',
      'competitorIntel',
      entriesWithLongName,
      'run-1',
      'user-1',
    );
    const client = mockClient(responseWithSubstring);

    const result = await synthesizeWhiteSpaceGap(pack, { client });

    // 'Acme Corporation'.toLowerCase() includes 'acme' → gap should survive
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0].value.targetCompetitor).toBe('Acme');
  });

  // Test 6 — Non-JSON prose → graceful empty
  it('returns empty gaps when client returns non-JSON prose', async () => {
    const pack = buildEvidencePack('white-space-gap', 'competitorIntel', baseEntries, 'run-1', 'user-1');
    const client = mockClient(
      'Sorry, I cannot identify any competitive positioning gaps at this time. Please try again with more data.',
    );

    const result = await synthesizeWhiteSpaceGap(pack, { client });

    expect(result).toEqual({ gaps: [] });
  });

  // Test 7 — Schema-invalid JSON → graceful empty
  it('returns empty gaps when JSON is missing required archetype field', async () => {
    const invalidJson = JSON.stringify({
      gaps: [
        {
          value: {
            move: 'Attack Acme Corp on implementation speed advantage',
            // archetype is missing — schema requires it
            targetCompetitor: 'Acme Corp',
            competitorWeakness: 'Slow 6-month implementation timeline from G2',
            valueEquationAxis: 'timeDelay',
            risk: 'low',
            reward: 'high',
            playbook: 'Comparison ads highlighting our 30-day vs their 6-month timeline',
            evidence: 'competitor_weakness#1 confirms slow timeline',
          },
          evidenceIds: ['competitor_weakness#1'],
          confidence: 78,
        },
      ],
    });

    const pack = buildEvidencePack('white-space-gap', 'competitorIntel', baseEntries, 'run-1', 'user-1');
    const client = mockClient(invalidJson);

    const result = await synthesizeWhiteSpaceGap(pack, { client });

    expect(result).toEqual({ gaps: [] });
  });

  // Test 8 — IdentityCard injection
  it('includes IDENTITY block in user prompt when identityCard is present', async () => {
    const identityCard = { category: 'B2B SaaS' };
    const pack = buildEvidencePack(
      'white-space-gap',
      'competitorIntel',
      baseEntries,
      'run-1',
      'user-1',
      identityCard,
    );
    const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"gaps":[]}' }] });
    const client = { messages: { create } } as unknown as Anthropic;

    await synthesizeWhiteSpaceGap(pack, { client });

    expect(create).toHaveBeenCalledOnce();
    const call = create.mock.calls[0][0] as { messages: { content: string }[] };
    const userContent = call.messages[0].content as string;
    expect(userContent).toContain('IDENTITY:');
    expect(userContent).toContain('"category": "B2B SaaS"');
  });
});
