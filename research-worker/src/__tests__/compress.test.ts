import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stable mock instance — shared across both tests by default
const mockCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        keyFindings: ['Market is growing'],
        dataPoints: { growth: '15%' },
        confidence: 'high',
        sources: ['https://example.com'],
        gaps: ['Limited SMB data'],
      }),
    },
  ],
});

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

describe('compressResearchOutput', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            keyFindings: ['Market is growing'],
            dataPoints: { growth: '15%' },
            confidence: 'high',
            sources: ['https://example.com'],
            gaps: ['Limited SMB data'],
          }),
        },
      ],
    });
  });

  it('returns a valid CompressedSummary from raw data', async () => {
    const { compressResearchOutput } = await import('../compress');
    const result = await compressResearchOutput('industryMarket', {
      categorySnapshot: { category: 'B2B SaaS', marketMaturity: 'growing' },
      painPoints: { primary: ['High CAC', 'Long sales cycles'] },
      marketTrends: ['AI adoption', 'Product-led growth'],
    });

    expect(result.keyFindings).toHaveLength(1);
    expect(result.confidence).toBe('high');
  });

  it('returns fallback summary when Haiku call fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API error'));

    const { compressResearchOutput } = await import('../compress');
    const result = await compressResearchOutput('industryMarket', {
      summary: 'Market is growing rapidly',
    });

    expect(result.keyFindings.length).toBeGreaterThan(0);
    expect(result.confidence).toBe('low');
  });
});
