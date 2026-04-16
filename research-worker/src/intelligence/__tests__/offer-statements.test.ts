import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { synthesizeOfferStatements } from '../cards/offer-statements';
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
// Wiki entry fixtures
// ---------------------------------------------------------------------------

const makeEntry = (topic: string, content: string): WikiEntry => ({
  topic,
  content,
  source_runner: 'offerAnalysis',
  provenance: 'web_search',
  confidence: 80,
});

/** Pack with offer evidence — passes both gates. All topics match CARD_TOPIC_FILTERS['offer-statement']. */
const validEntries: WikiEntry[] = [
  makeEntry('offer_value_prop', '30-day onboarding guarantee or your money back'),
  makeEntry('offer_pricing', '$299/month flat — no setup fees, no per-seat pricing'),
  makeEntry('offer_mechanism', 'AI-driven reporting replaces manual spreadsheet work entirely'),
  makeEntry('icp_trigger', 'Ops teams promoted to director level start seeking automation tools'),
  makeEntry('competitor_positioning', 'Top 5 competitors all lead with feature lists; none lead with outcome speed'),
];

/** Pack with identity + competitor entries but NO offer_ topics — fails gate 2. */
const noOfferEntries: WikiEntry[] = [
  makeEntry('identity_category', 'B2B SaaS project management for ops teams'),
  makeEntry('identity_positioning', 'Challenger brand in ops automation space'),
  makeEntry('icp_trigger', 'Teams promoted to director level seek automation'),
  makeEntry('competitor_positioning', 'Competitors lead with features not outcomes'),
];

// ---------------------------------------------------------------------------
// Valid response fixture
// ---------------------------------------------------------------------------

function makeValidResponse(): string {
  return JSON.stringify({
    statements: [
      {
        value: {
          type: 'hero',
          statement: 'Replace manual reporting entirely — AI does it in under 20 minutes per week',
          valueEquationAxis: 'time_delay',
          awarenessLevel: 'problem_aware',
          rationale: 'Attacks time_delay axis with a specific mechanism from the offer_mechanism entry. Problem-aware hook leads with the outcome before the mechanism.',
          evidence: 'offer_mechanism#1: AI-driven reporting replaces manual spreadsheet work entirely',
          targetEmotion: 'relief',
        },
        evidenceIds: ['offer_mechanism#1'],
        confidence: 88,
      },
      {
        value: {
          type: 'guarantee',
          statement: 'Go live in 30 days or get a full refund — no questions asked',
          valueEquationAxis: 'likelihood',
          awarenessLevel: 'product_aware',
          rationale: 'Guarantee elevates perceived likelihood of success by removing risk. Product-aware buyers respond to risk-reversal moves.',
          evidence: 'offer_value_prop#1: 30-day onboarding guarantee or your money back',
        },
        evidenceIds: ['offer_value_prop#1'],
        confidence: 82,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('synthesizeOfferStatements', () => {
  // Test 1 — Gate on <3 entries
  it('returns empty without calling client when pack has fewer than 3 entries', async () => {
    const twoEntries: WikiEntry[] = [
      makeEntry('offer_value_prop', '30-day onboarding guarantee'),
      makeEntry('offer_pricing', '$299/month'),
    ];
    const pack = buildEvidencePack('offer-statement', 'offerAnalysis', twoEntries, 'run-1', 'user-1');
    const client = mockThrowingClient();
    const createSpy = vi.spyOn(client.messages, 'create');

    const result = await synthesizeOfferStatements(pack, { client });

    expect(result).toEqual({ statements: [] });
    expect(createSpy).not.toHaveBeenCalled();
  });

  // Test 2 — Gate on no offer_* entries
  it('returns empty without calling client when pack has no offer_ entries', async () => {
    const pack = buildEvidencePack(
      'offer-statement',
      'offerAnalysis',
      noOfferEntries,
      'run-1',
      'user-1',
    );
    const client = mockThrowingClient();
    const createSpy = vi.spyOn(client.messages, 'create');

    const result = await synthesizeOfferStatements(pack, { client });

    expect(result).toEqual({ statements: [] });
    expect(createSpy).not.toHaveBeenCalled();
  });

  // Test 3 — Valid synthesis with 2 statements
  it('calls client and returns parsed statements when pack has valid entries', async () => {
    const pack = buildEvidencePack(
      'offer-statement',
      'offerAnalysis',
      validEntries,
      'run-1',
      'user-1',
    );
    const client = mockClient(makeValidResponse());

    const result = await synthesizeOfferStatements(pack, { client });

    expect((client.messages.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
    expect(result.statements).toHaveLength(2);
    expect(result.statements[0].value.type).toBe('hero');
    expect(result.statements[0].value.valueEquationAxis).toBe('time_delay');
    expect(result.statements[0].value.awarenessLevel).toBe('problem_aware');
    expect(result.statements[0].evidenceIds).toContain('offer_mechanism#1');
    expect(result.statements[1].value.type).toBe('guarantee');
    expect(result.statements[1].value.valueEquationAxis).toBe('likelihood');
  });

  // Test 4 — IdentityCard injection
  it('includes IDENTITY block in user prompt when identityCard is present', async () => {
    const identityCard = { coreKeywords: ['ops', 'automation'], category: 'B2B SaaS' };
    const pack = buildEvidencePack(
      'offer-statement',
      'offerAnalysis',
      validEntries,
      'run-1',
      'user-1',
      identityCard,
    );
    const create = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '{"statements":[]}' }],
    });
    const client = { messages: { create } } as unknown as Anthropic;

    await synthesizeOfferStatements(pack, { client });

    expect(create).toHaveBeenCalledOnce();
    const call = create.mock.calls[0][0] as { messages: { content: string }[] };
    const userContent = call.messages[0].content as string;
    expect(userContent).toContain('IDENTITY:');
    expect(userContent).toContain('"coreKeywords"');
    expect(userContent).toContain('"B2B SaaS"');
  });

  // Test 5 — Prose response → graceful empty
  it('returns empty statements when client returns non-JSON prose', async () => {
    const pack = buildEvidencePack(
      'offer-statement',
      'offerAnalysis',
      validEntries,
      'run-1',
      'user-1',
    );
    const client = mockClient(
      'Sorry, I cannot generate any offer statements at this time. Please try again with more specific offer data.',
    );

    const result = await synthesizeOfferStatements(pack, { client });

    expect(result).toEqual({ statements: [] });
  });

  // Test 6 — Schema-invalid JSON (missing required valueEquationAxis) → graceful empty
  it('returns empty statements when JSON is missing required valueEquationAxis field', async () => {
    const invalidJson = JSON.stringify({
      statements: [
        {
          value: {
            type: 'hero',
            statement: 'Replace manual reporting with AI automation in under 20 minutes',
            // valueEquationAxis is missing — schema requires it
            awarenessLevel: 'problem_aware',
            rationale: 'Attacks time_delay axis with specific mechanism from offer evidence',
            evidence: 'offer_mechanism#1: AI-driven reporting replaces manual spreadsheet work',
          },
          evidenceIds: ['offer_mechanism#1'],
          confidence: 80,
        },
      ],
    });
    const pack = buildEvidencePack(
      'offer-statement',
      'offerAnalysis',
      validEntries,
      'run-1',
      'user-1',
    );
    const client = mockClient(invalidJson);

    const result = await synthesizeOfferStatements(pack, { client });

    expect(result).toEqual({ statements: [] });
  });

  // Test 7 — Schema-invalid JSON (statement too short, min 10) → graceful empty
  it('returns empty statements when statement field is too short', async () => {
    const invalidJson = JSON.stringify({
      statements: [
        {
          value: {
            type: 'hero',
            statement: 'Short',
            valueEquationAxis: 'time_delay',
            awarenessLevel: 'problem_aware',
            rationale: 'Has a rationale that is long enough to pass validation threshold',
            evidence: 'offer_mechanism#1: AI-driven reporting replaces manual spreadsheet work',
          },
          evidenceIds: ['offer_mechanism#1'],
          confidence: 80,
        },
      ],
    });
    const pack = buildEvidencePack(
      'offer-statement',
      'offerAnalysis',
      validEntries,
      'run-1',
      'user-1',
    );
    const client = mockClient(invalidJson);

    const result = await synthesizeOfferStatements(pack, { client });

    expect(result).toEqual({ statements: [] });
  });

  // Test 8 — Empty array response → returns empty successfully (valid schema)
  it('returns empty statements array when model returns {"statements":[]}', async () => {
    const pack = buildEvidencePack(
      'offer-statement',
      'offerAnalysis',
      validEntries,
      'run-1',
      'user-1',
    );
    const client = mockClient('{"statements":[]}');

    const result = await synthesizeOfferStatements(pack, { client });

    expect(result).toEqual({ statements: [] });
    expect((client.messages.create as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
  });
});
