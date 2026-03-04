import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSingle = vi.fn();
const mockLimit = vi.fn(() => ({ single: mockSingle }));
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockEq = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

describe('readResearchResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: null });
  });

  it('returns null when no session exists', async () => {
    const { readResearchResult } = await import('../read-research-result');
    const result = await readResearchResult('user-123', 'industryMarket');
    expect(result).toBeNull();
  });

  it('returns section data when research_results contains the section', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        research_results: { industryMarket: { trends: ['AI growth'] } },
      },
      error: null,
    });
    const { readResearchResult } = await import('../read-research-result');
    const result = await readResearchResult('user-123', 'industryMarket');
    expect(result).toEqual({ trends: ['AI growth'] });
  });

  it('returns null when section not in research_results', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { research_results: { competitors: {} } },
      error: null,
    });
    const { readResearchResult } = await import('../read-research-result');
    const result = await readResearchResult('user-123', 'industryMarket');
    expect(result).toBeNull();
  });
});

describe('readJobStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: null });
  });

  it('returns null when no job exists', async () => {
    const { readJobStatus } = await import('../read-research-result');
    const result = await readJobStatus('user-123', 'job-uuid');
    expect(result).toBeNull();
  });

  it('returns job status when found', async () => {
    const jobStatus = {
      status: 'complete',
      tool: 'researchIndustry',
      startedAt: '2026-03-05T00:00:00Z',
      completedAt: '2026-03-05T00:01:00Z',
    };
    mockSingle.mockResolvedValueOnce({
      data: { job_status: { 'job-uuid': jobStatus } },
      error: null,
    });
    const { readJobStatus } = await import('../read-research-result');
    const result = await readJobStatus('user-123', 'job-uuid');
    expect(result).toEqual(jobStatus);
  });
});
