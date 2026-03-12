import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const validIndustryResearchData = {
  categorySnapshot: {
    category: 'AI attribution software',
    marketSize: '$4.2B',
    marketMaturity: 'growing',
    awarenessLevel: 'high',
    buyingBehavior: 'committee_driven',
    averageSalesCycle: '45-90 days',
  },
  marketDynamics: {
    demandDrivers: ['Pressure to prove ROI'],
    buyingTriggers: ['New revenue leader hired'],
    barriersToPurchase: ['Tool fatigue'],
  },
  painPoints: {
    primary: ['Revenue teams lack trustworthy attribution'],
    secondary: ['Channel data is fragmented'],
  },
  messagingOpportunities: {
    summaryRecommendations: ['Lead with revenue visibility'],
  },
  trendSignals: [
    {
      trend: 'AI-assisted reporting',
      direction: 'rising',
      evidence: 'Search demand keeps climbing.',
    },
  ],
} as const;

const validCompetitorIntelData = {
  competitors: [
    {
      name: 'SalesCaptain',
      website: 'https://salescaptain.io',
      positioning: 'B2B SaaS paid media for RevOps-led teams.',
      strengths: ['Strong outbound-to-paid handoff'],
      weaknesses: ['Thin proof library'],
      opportunities: ['Differentiate on attribution clarity'],
      ourAdvantage: 'Stronger revenue accountability narrative.',
      adActivity: {
        activeAdCount: 6,
        platforms: ['LinkedIn'],
        themes: ['Revenue accountability'],
        evidence: 'SearchAPI surfaced six live ads in the last 30 days.',
        sourceConfidence: 'medium',
      },
    },
  ],
  whiteSpaceGaps: [
    {
      gap: 'Proof-led attribution messaging',
      type: 'messaging',
      evidence: 'Competitors lead with execution, not measurement confidence.',
      exploitability: 8,
      impact: 9,
      recommendedAction: 'Lead launch creative with revenue visibility proof.',
    },
  ],
} as const;

// Mock @clerk/nextjs/server so createAdminClient can be imported
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Mock createAdminClient
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      upsert: mockUpsert,
    })),
  })),
}));

describe('persistResearchToSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockRpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns { ok: true } on successful write', async () => {
    const { persistResearchToSupabase } = await import('../session-state.server');
    const result = await persistResearchToSupabase('user-1', {
      industryMarket: {
        status: 'complete',
        section: 'industryMarket',
        durationMs: 1200,
        data: validIndustryResearchData,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith('merge_journey_session_research_result', {
      p_result: expect.objectContaining({
        status: 'complete',
        section: 'industryResearch',
        durationMs: 1200,
        data: validIndustryResearchData,
      }),
      p_section: 'industryResearch',
      p_user_id: 'user-1',
    });
  });

  it('returns { ok: false, error } when Supabase returns a non-retryable error', async () => {
    // Use a non-retryable code (unique violation) — ensures no retry attempt is made
    mockRpc.mockResolvedValue({ error: { message: 'duplicate key value', code: '23505' } });

    const { persistResearchToSupabase } = await import('../session-state.server');
    const result = await persistResearchToSupabase('user-2', {
      industryMarket: {
        status: 'complete',
        section: 'industryMarket',
        durationMs: 1200,
        data: validIndustryResearchData,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('duplicate key value');
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('retries once on a transient Supabase error before returning success', async () => {
    // First call fails (transient), second succeeds
    mockRpc
      .mockResolvedValueOnce({ error: { message: 'timeout', code: '57014' } })
      .mockResolvedValueOnce({ error: null });

    const { persistResearchToSupabase } = await import('../session-state.server');
    const promise = persistResearchToSupabase('user-3', {
      industryMarket: {
        status: 'complete',
        section: 'industryMarket',
        durationMs: 1200,
        data: validIndustryResearchData,
      },
    });
    await vi.runAllTimersAsync(); // advance the 1s retry delay
    const result = await promise;

    expect(result.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('returns { ok: false } after 2 failed attempts', async () => {
    mockRpc
      .mockResolvedValueOnce({ error: { message: 'timeout', code: '57014' } })
      .mockResolvedValueOnce({ error: { message: 'timeout again', code: '57014' } });

    const { persistResearchToSupabase } = await import('../session-state.server');
    const promise = persistResearchToSupabase('user-4', {
      industryMarket: {
        status: 'complete',
        section: 'industryMarket',
        durationMs: 1200,
        data: validIndustryResearchData,
      },
    });
    await vi.runAllTimersAsync(); // advance the 1s retry delay
    const result = await promise;

    expect(result.ok).toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite an existing complete artifact with a later error payload', async () => {
    const { persistResearchToSupabase } = await import('../session-state.server');
    await persistResearchToSupabase('user-5', {
      competitors: {
        status: 'error',
        section: 'competitors',
        error: 'Request timed out.',
        durationMs: 5678,
      },
    });

    expect(mockRpc).toHaveBeenCalledWith('merge_journey_session_research_result', {
      p_result: expect.objectContaining({
        status: 'error',
        section: 'competitorIntel',
        error: 'Request timed out.',
        durationMs: 5678,
      }),
      p_section: 'competitorIntel',
      p_user_id: 'user-5',
    });
  });

  it('allows a completed artifact to replace an existing error payload', async () => {
    const { persistResearchToSupabase } = await import('../session-state.server');
    await persistResearchToSupabase('user-6', {
      competitors: {
        status: 'complete',
        section: 'competitors',
        data: validCompetitorIntelData,
        durationMs: 9999,
      },
    });

    expect(mockRpc).toHaveBeenCalledWith('merge_journey_session_research_result', {
      p_result: expect.objectContaining({
        status: 'complete',
        section: 'competitorIntel',
        data: validCompetitorIntelData,
        durationMs: 9999,
      }),
      p_section: 'competitorIntel',
      p_user_id: 'user-6',
    });
  });

  it('preserves an explicit run id when persisting research artifacts', async () => {
    const { persistResearchToSupabase } = await import('../session-state.server');
    await persistResearchToSupabase('user-7', {
      industryMarket: {
        status: 'complete',
        section: 'industryMarket',
        durationMs: 1200,
        data: validIndustryResearchData,
        runId: 'run-123',
      },
    });

    expect(mockRpc).toHaveBeenCalledWith('merge_journey_session_research_result', {
      p_result: expect.objectContaining({
        runId: 'run-123',
        status: 'complete',
        section: 'industryResearch',
      }),
      p_section: 'industryResearch',
      p_user_id: 'user-7',
    });
  });
});

describe('persistToSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips writes from an inactive run', async () => {
    mockSingle.mockResolvedValue({
      data: {
        metadata: {
          activeJourneyRunId: 'run-current',
          companyName: 'Current Company',
        },
      },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        metadata: {
          activeJourneyRunId: 'run-current',
        },
      },
      error: null,
    });

    const { persistToSupabase } = await import('../session-state.server');
    const result = await persistToSupabase(
      'user-8',
      { companyName: 'Stale Company' },
      'run-stale',
    );

    expect(result).toEqual({ ok: true, skipped: true });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('allows bootstrapping metadata when no active run exists yet', async () => {
    mockSingle.mockResolvedValue({
      data: {
        metadata: {
          companyName: 'Draft Company',
        },
      },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        metadata: {},
      },
      error: null,
    });
    mockUpsert.mockResolvedValue({ error: null });

    const { persistToSupabase } = await import('../session-state.server');
    const result = await persistToSupabase(
      'user-9',
      { companyName: 'Draft Company' },
      'run-bootstrap',
    );

    expect(result).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          activeJourneyRunId: 'run-bootstrap',
          companyName: 'Draft Company',
        }),
        user_id: 'user-9',
      }),
      { onConflict: 'user_id' },
    );
  });
});
