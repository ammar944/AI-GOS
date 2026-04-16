import { describe, expect, it, vi } from 'vitest';
import { synthesizeOpportunity } from '../cards/opportunity';
import { buildEvidencePack } from '../evidence-packer';
import type { WikiEntry } from '../../wiki';

// ---------------------------------------------------------------------------
// Minimal valid wiki entries
// ---------------------------------------------------------------------------

const makeEntry = (topic: string, content: string): WikiEntry => ({
  topic,
  content,
  source_runner: 'industryResearch',
  provenance: 'web_search',
  confidence: 80,
});

const threeEntries: WikiEntry[] = [
  makeEntry('market_size', '$12B TAM growing at 18% YoY per Gartner 2024'),
  makeEntry('identity_category', 'B2B SaaS project management for ops teams'),
  makeEntry('pain_point', 'Ops teams lose 4hr/wk to manual status updates per survey'),
];

// ---------------------------------------------------------------------------
// Mock client helper
// ---------------------------------------------------------------------------

function makeMockClient(responseText: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: responseText }],
      }),
    },
  };
}

function makeThrowingClient() {
  return {
    messages: {
      create: vi.fn().mockRejectedValue(new Error('should not be called')),
    },
  };
}

// ---------------------------------------------------------------------------
// Valid response fixture
// ---------------------------------------------------------------------------

const validOpportunityJson = JSON.stringify({
  opportunities: [
    {
      value: {
        opportunity: 'Lead with no-rip-and-replace angle against incumbent tools',
        archetype: 'C',
        size: 'medium',
        timing: 'now',
        difficulty: 'low',
        evidence: 'Ops teams lose 4hr/wk to status updates, no competitor addresses this directly',
        mechanism: 'Problem-Aware audience will resonate with friction-reduction hook on Meta',
      },
      evidenceIds: ['pain_point#1'],
      confidence: 82,
    },
    {
      value: {
        opportunity: 'Target 18% YoY growth cohort before saturation hits in 3-6 months',
        archetype: 'D',
        size: 'large',
        timing: '3-6 months',
        difficulty: 'medium',
        evidence: '$12B TAM growing 18% YoY per Gartner 2024 — window before major entrants',
        mechanism: 'Trend-rider: launch before growth plateau locks in brand recall',
      },
      evidenceIds: ['market_size#1'],
      confidence: 75,
    },
  ],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('synthesizeOpportunity', () => {
  describe('gate on thin evidence', () => {
    it('returns empty opportunities without calling client when pack has 0 entries', async () => {
      const pack = buildEvidencePack('opportunity', 'industryMarket', [], 'run-1', 'user-1');
      const client = makeThrowingClient();

      const result = await synthesizeOpportunity(pack, { client: client as never });

      expect(result).toEqual({ opportunities: [] });
      expect(client.messages.create).not.toHaveBeenCalled();
    });

    it('returns empty opportunities without calling client when pack has 1 entry', async () => {
      const pack = buildEvidencePack(
        'opportunity',
        'industryMarket',
        [threeEntries[0]],
        'run-1',
        'user-1',
      );
      const client = makeThrowingClient();

      const result = await synthesizeOpportunity(pack, { client: client as never });

      expect(result).toEqual({ opportunities: [] });
      expect(client.messages.create).not.toHaveBeenCalled();
    });

    it('returns empty opportunities without calling client when pack has 2 entries', async () => {
      const pack = buildEvidencePack(
        'opportunity',
        'industryMarket',
        threeEntries.slice(0, 2),
        'run-1',
        'user-1',
      );
      const client = makeThrowingClient();

      const result = await synthesizeOpportunity(pack, { client: client as never });

      expect(result).toEqual({ opportunities: [] });
      expect(client.messages.create).not.toHaveBeenCalled();
    });
  });

  describe('valid synthesis', () => {
    it('calls client and returns parsed opportunities when pack has >=3 entries', async () => {
      const pack = buildEvidencePack(
        'opportunity',
        'industryMarket',
        threeEntries,
        'run-1',
        'user-1',
      );
      const client = makeMockClient(validOpportunityJson);

      const result = await synthesizeOpportunity(pack, { client: client as never });

      expect(client.messages.create).toHaveBeenCalledOnce();
      expect(result.opportunities).toHaveLength(2);
      expect(result.opportunities[0].value.archetype).toBe('C');
      expect(result.opportunities[0].evidenceIds).toContain('pain_point#1');
      expect(result.opportunities[1].value.archetype).toBe('D');
    });

    it('passes identityCard in prompt when present', async () => {
      const identityCard = { coreKeywords: ['ops', 'automation'] };
      const pack = buildEvidencePack(
        'opportunity',
        'industryMarket',
        threeEntries,
        'run-1',
        'user-1',
        identityCard,
      );
      const client = makeMockClient(validOpportunityJson);

      await synthesizeOpportunity(pack, { client: client as never });

      const callArgs = client.messages.create.mock.calls[0][0] as { messages: { content: string }[] };
      expect(callArgs.messages[0].content).toContain('coreKeywords');
    });
  });

  describe('graceful empty on parse failure', () => {
    it('returns empty opportunities when client returns non-JSON prose', async () => {
      const pack = buildEvidencePack(
        'opportunity',
        'industryMarket',
        threeEntries,
        'run-1',
        'user-1',
      );
      const client = makeMockClient('Sorry, I cannot identify any market opportunities at this time.');

      const result = await synthesizeOpportunity(pack, { client: client as never });

      expect(result).toEqual({ opportunities: [] });
    });
  });

  describe('graceful empty on schema-invalid JSON', () => {
    it('returns empty opportunities when JSON is missing required archetype field', async () => {
      const invalidJson = JSON.stringify({
        opportunities: [
          {
            value: {
              opportunity: 'Some opportunity that is long enough',
              // archetype is missing — schema requires it
              size: 'medium',
              timing: 'now',
              difficulty: 'low',
              evidence: 'Some evidence that is long enough to pass validation',
              mechanism: 'Some mechanism that is long enough to pass',
            },
            evidenceIds: ['market_size#1'],
            confidence: 70,
          },
        ],
      });
      const pack = buildEvidencePack(
        'opportunity',
        'industryMarket',
        threeEntries,
        'run-1',
        'user-1',
      );
      const client = makeMockClient(invalidJson);

      const result = await synthesizeOpportunity(pack, { client: client as never });

      expect(result).toEqual({ opportunities: [] });
    });
  });
});
