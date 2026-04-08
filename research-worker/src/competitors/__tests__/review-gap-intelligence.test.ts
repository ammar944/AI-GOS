import { describe, it, expect, vi } from 'vitest';
import type { ReviewResult } from '../../tools/reviews';

// Mock generateObject before importing the module
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'mocked-model'),
}));

import { analyzeReviewGaps } from '../review-gap-intelligence';
import { generateObject } from 'ai';

const mockGenerateObject = vi.mocked(generateObject);

function makeReviewResult(name: string, negativeReviews: ReviewResult['negativeReviews']): ReviewResult {
  return {
    competitorName: name,
    domain: `${name.toLowerCase()}.com`,
    trustpilot: null,
    g2: null,
    capterra: null,
    testimonials: [],
    testimonialPages: [],
    negativeReviews,
  };
}

describe('analyzeReviewGaps', () => {
  it('returns null when no negative reviews exist', async () => {
    const result = await analyzeReviewGaps([
      makeReviewResult('Acme', []),
      makeReviewResult('BetaCo', []),
    ], 'TestCo');

    expect(result).toBeNull();
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('calls generateObject with correct structure', async () => {
    // Schema is { competitors: Array<{ name, analysis }> } — the runner
    // converts the array into a Record keyed by competitor name on the way out.
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        competitors: [
          {
            name: 'Acme',
            analysis: {
              recurringComplaints: ['slow onboarding'],
              exploitAngles: [{
                gap: 'Slow onboarding',
                whyItMatters: 'Cited by 2 reviewers',
                positioningAngle: 'Position as instant setup',
                adHook: 'Stop waiting. Start selling.',
                confidence: 'high',
                evidenceQuotes: ['Took 3 weeks'],
              }],
            },
          },
        ],
      },
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      finishReason: 'stop',
      rawResponse: undefined,
      warnings: [],
      request: {},
      response: { id: '', timestamp: new Date(), modelId: '', headers: {} },
      logprobs: undefined,
      providerMetadata: undefined,
      experimental_providerMetadata: undefined,
      toJsonResponse: () => new Response(),
    } as never);

    const result = await analyzeReviewGaps([
      makeReviewResult('Acme', [
        { text: 'Took 3 weeks to onboard', rating: 1, source: 'g2' },
        { text: 'Setup was painful', rating: 2, source: 'capterra' },
      ]),
    ], 'TestCo');

    expect(result).not.toBeNull();
    expect(result!['Acme']).toBeDefined();
    expect(result!['Acme'].exploitAngles).toHaveLength(1);
    expect(mockGenerateObject).toHaveBeenCalledOnce();
  });

  it('returns null on timeout (graceful degradation)', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('AbortError: signal timed out'));

    const result = await analyzeReviewGaps([
      makeReviewResult('Acme', [
        { text: 'Bad experience', rating: 1, source: 'g2' },
      ]),
    ], 'TestCo');

    expect(result).toBeNull();
  });

  it('returns null on API error (graceful degradation)', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const result = await analyzeReviewGaps([
      makeReviewResult('Acme', [
        { text: 'Bad experience', rating: 1, source: 'g2' },
      ]),
    ], 'TestCo');

    expect(result).toBeNull();
  });
});
