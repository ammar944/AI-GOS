import { describe, it, expect, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { validateCardsBatch, type BatchValidationInput } from '../validator';
import type { EvidencePack } from '../types';

function mkPack(entryCount = 2): EvidencePack {
  const entries = Array.from({ length: entryCount }, (_, i) => ({
    topic: `topic_${i}`,
    content: `content${i}`,
    source_runner: 'industry',
    provenance: 'web',
    source_url: null,
    confidence: 80,
  }));
  return {
    cardName: 'any',
    section: 'any',
    runId: 'r1',
    userId: 'u1',
    identityCard: null,
    entries,
    entryIds: entries.map((_, i) => `topic_${i}#${i + 1}`),
  } as unknown as EvidencePack;
}

function mkMockClient(responseText: string): Anthropic {
  return {
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: 'text', text: responseText }],
        stop_reason: 'end_turn',
      })),
    },
  } as unknown as Anthropic;
}

describe('validateCardsBatch', () => {
  const inputs: BatchValidationInput<{ claim: string }>[] = [
    { cardName: 'opportunity', draft: { claim: 'A' }, pack: mkPack() },
    { cardName: 'white-space-gap', draft: { claim: 'B' }, pack: mkPack() },
  ];

  it('returns per-card results keyed by cardName when model responds cleanly', async () => {
    const client = mkMockClient(
      JSON.stringify({
        opportunity: { validated: { claim: 'A-validated' }, rejected: [], confidence: 95 },
        'white-space-gap': { validated: { claim: 'B-validated' }, rejected: ['weak'], confidence: 72 },
      }),
    );
    const out = await validateCardsBatch(inputs, { client });
    expect(out.opportunity?.validated.claim).toBe('A-validated');
    expect(out.opportunity?.confidence).toBe(95);
    expect(out['white-space-gap']?.rejected).toEqual(['weak']);
  });

  it('bypasses when INTELLIGENCE_VALIDATOR=false', async () => {
    const previous = process.env.INTELLIGENCE_VALIDATOR;
    process.env.INTELLIGENCE_VALIDATOR = 'false';
    try {
      const out = await validateCardsBatch(inputs);
      expect(out.opportunity?.validated.claim).toBe('A');
      expect(out.opportunity?.confidence).toBe(100);
    } finally {
      if (previous !== undefined) process.env.INTELLIGENCE_VALIDATOR = previous;
      else delete process.env.INTELLIGENCE_VALIDATOR;
    }
  });

  it('returns no-evidence results when all packs are empty', async () => {
    const emptyInputs = inputs.map((i) => ({ ...i, pack: mkPack(0) }));
    const out = await validateCardsBatch(emptyInputs);
    expect(out.opportunity?.rejected).toEqual(['no_evidence_available']);
    expect(out.opportunity?.confidence).toBe(0);
  });

  it('falls back per-card when model returns malformed JSON', async () => {
    const client = mkMockClient('not json at all');
    const out = await validateCardsBatch(inputs, { client });
    // Fallback: at least return keys for each input
    expect(Object.keys(out).sort()).toEqual(['opportunity', 'white-space-gap'].sort());
  });

  it('marks missing cards in batch response as validator_batch_missing', async () => {
    const client = mkMockClient(
      JSON.stringify({
        opportunity: { validated: { claim: 'A-validated' }, rejected: [], confidence: 90 },
        // white-space-gap intentionally omitted
      }),
    );
    const out = await validateCardsBatch(inputs, { client });
    expect(out.opportunity?.confidence).toBe(90);
    expect(out['white-space-gap']?.rejected).toContain('validator_batch_missing');
  });

  it('returns empty object on empty input', async () => {
    expect(await validateCardsBatch([])).toEqual({});
  });
});
