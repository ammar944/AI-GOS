import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SynthesisInput } from '../synthesize';
import type { ParallelFetchResults } from '../parallel-fetch';

// Mock the Anthropic SDK at module level so synthesize.ts sees a fake client.
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
    },
  };
});

import { synthesizeCompetitorIntel } from '../synthesize';

function makeSynthInput(): SynthesisInput {
  return {
    parsed: {
      companyName: 'TestCo',
      productDescription: 'A test product',
      icpDescription: '',
      websiteUrl: 'testco.com',
      competitors: [{ name: 'Acme', domain: 'acme.com', inferredDomain: false }],
    },
    fetchResults: {
      reviews: [],
      pricing: [],
      spyfu: [],
      adLibrary: [],
    } as unknown as ParallelFetchResults,
    sonarResults: {
      competitorInsights: [],
      marketPatterns: [],
      whiteSpaceOpportunities: [],
      citations: [],
      verifiedEntries: [],
      removedCompetitors: [],
    },
  } as unknown as SynthesisInput;
}

describe('synthesizeCompetitorIntel telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns telemetry with usage and estimatedCostUsd from the Anthropic response', async () => {
    mockCreate.mockResolvedValue({
      model: 'claude-haiku-4-5-20251001',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 12000,
        output_tokens: 3500,
        cache_creation_input_tokens: 800,
        cache_read_input_tokens: 400,
      },
      content: [{ type: 'text', text: '{"competitors":[]}' }],
    });

    const result = await synthesizeCompetitorIntel(makeSynthInput());

    expect(result.stopReason).toBe('end_turn');
    expect(result.telemetry).toBeDefined();
    expect(result.telemetry.model).toBe('claude-haiku-4-5-20251001');
    expect(result.telemetry.stopReason).toBe('end_turn');
    expect(result.telemetry.usage).toEqual({
      inputTokens: 12000,
      outputTokens: 3500,
      totalTokens: 16700,
      cacheCreationInputTokens: 800,
      cacheReadInputTokens: 400,
      serverToolUseCount: undefined,
      iterations: undefined,
    });
    // Haiku pricing: $0.80/1M input, $4.00/1M output.
    // cost = (12000/1M * 0.80) + (3500/1M * 4.00) = 0.0096 + 0.014 = 0.0236
    expect(result.telemetry.estimatedCostUsd).toBeCloseTo(0.0236, 4);
  });

  it('preserves telemetry shape even when usage counts are zero', async () => {
    mockCreate.mockResolvedValue({
      model: 'claude-haiku-4-5-20251001',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 0,
        output_tokens: 0,
      },
      content: [{ type: 'text', text: '{}' }],
    });

    const result = await synthesizeCompetitorIntel(makeSynthInput());

    expect(result.telemetry.usage?.inputTokens).toBe(0);
    expect(result.telemetry.usage?.outputTokens).toBe(0);
    expect(result.telemetry.estimatedCostUsd).toBe(0);
  });
});
