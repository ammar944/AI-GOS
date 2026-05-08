import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildJourneyRunView,
  getJourneyRunView,
  type JourneySessionRunRow,
} from '@/lib/journey/run-view';

const supabaseMocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);

  const from = vi.fn(() => query);
  const createAdminClient = vi.fn(() => ({ from }));

  return {
    createAdminClient,
    from,
    query,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: supabaseMocks.createAdminClient,
}));

function makeDeepResearchResult(
  section: string,
): Record<string, unknown> {
  return {
    status: 'complete',
    section,
    durationMs: 1200,
    data: {
      source: 'deepResearchProgram',
      sectionTitle: 'Market Overview',
      statusSummary: 'The category has active demand.',
      verdict: 'Prioritize the validated wedge.',
      confidence: 82,
      keyFindings: [
        {
          title: 'Demand exists',
          detail: 'Buyers search for the category.',
          evidence: 'Search and competitor evidence are present.',
          sourceUrl: 'https://example.com/source',
        },
      ],
      evidenceQuotes: [],
      risksOrGaps: [],
      recommendedMoves: ['Lead with the strongest evidence-backed wedge.'],
    },
  };
}

function makeRunRow(): JourneySessionRunRow {
  return {
    id: 'session-1',
    profile_id: 'profile-1',
    run_id: 'run-1',
    created_at: '2026-05-07T00:00:00.000Z',
    updated_at: '2026-05-07T00:05:00.000Z',
    metadata: {
      activeJourneyRunId: 'run-1',
      companyName: 'Acme AI',
    },
    messages: [
      {
        id: 'message-new',
        role: 'assistant',
        content: 'Newer message',
        createdAt: '2026-05-07T00:03:00.000Z',
      },
      {
        id: 'message-old',
        role: 'user',
        content: 'Older message',
        createdAt: '2026-05-07T00:01:00.000Z',
      },
    ],
    research_results: {
      industryResearch: makeDeepResearchResult('industryResearch'),
      competitorIntel: makeDeepResearchResult('competitorIntel'),
      opportunityIntel: {
        status: 'complete',
        data: {
          opportunities: [
            {
              title: 'Evidence-led wedge',
              evidence: 'Validated in the corpus.',
            },
          ],
        },
      },
    },
    job_status: {
      'job-market': {
        status: 'complete',
        tool: 'researchIndustry',
        startedAt: '2026-05-07T00:00:10.000Z',
        completedAt: '2026-05-07T00:01:10.000Z',
        updates: [
          {
            at: '2026-05-07T00:00:20.000Z',
            id: 'update-market-1',
            message: 'Collected market sources.',
            phase: 'tool',
          },
          {
            at: '2026-05-07T00:01:00.000Z',
            id: 'update-market-2',
            message: 'Synthesized market overview.',
            phase: 'analysis',
          },
        ],
      },
      'job-icp': {
        status: 'running',
        tool: 'researchICP',
        startedAt: '2026-05-07T00:02:00.000Z',
        updates: [
          {
            at: '2026-05-07T00:02:10.000Z',
            id: 'update-icp-1',
            message: 'Validating ICP reachability.',
            phase: 'analysis',
          },
        ],
      },
    },
  };
}

describe('buildJourneyRunView', () => {
  it('normalizes a journey session into ordered sections, events, artifacts, cards, and messages', () => {
    const view = buildJourneyRunView(makeRunRow());

    expect(view.run).toEqual({
      sessionId: 'session-1',
      profileId: 'profile-1',
      runId: 'run-1',
      companyName: 'Acme AI',
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:05:00.000Z',
      raw: {
        activeJourneyRunId: 'run-1',
        companyName: 'Acme AI',
      },
    });
    expect(view.status).toBe('running');
    expect(view.sections.map((section) => section.id)).toEqual([
      'deepResearchProgram',
      'industryMarket',
      'icpValidation',
      'competitors',
      'offerAnalysis',
      'crossAnalysis',
      'keywordIntel',
      'mediaPlan',
    ]);
    expect(view.sections[0]).toMatchObject({
      id: 'deepResearchProgram',
      phase: 'queued',
      status: 'queued',
    });
    expect(view.sections[1]).toMatchObject({
      id: 'industryMarket',
      phase: 'review',
      status: 'complete',
      latestEvent: {
        id: 'update-market-2',
        message: 'Synthesized market overview.',
      },
    });
    expect(view.sections[1].cards.length).toBeGreaterThan(0);
    expect(view.sections[2]).toMatchObject({
      id: 'icpValidation',
      phase: 'researching',
      status: 'running',
      latestEvent: {
        id: 'update-icp-1',
        message: 'Validating ICP reachability.',
      },
    });
    expect(view.sections[4].pendingDependencyReason).toBe(
      'Waiting for Deep Research.',
    );
    expect(view.artifactsBySection.industryMarket?.section).toBe('industryMarket');
    expect(view.artifactsByTool.researchIndustry).toHaveLength(1);
    expect(view.eventsBySection.industryMarket).toHaveLength(2);
    expect(view.messages.map((message) => message.id)).toEqual([
      'message-old',
      'message-new',
    ]);
  });

  it('handles missing optional collections without crashing', () => {
    const view = buildJourneyRunView({
      id: 'session-empty',
      run_id: 'run-empty',
      metadata: null,
      research_results: null,
      job_status: null,
      messages: null,
    });

    expect(view.status).toBe('queued');
    expect(view.sections.every((section) => section.status === 'queued')).toBe(true);
    expect(view.sections.every((section) => section.events.length === 0)).toBe(true);
    expect(view.messages).toEqual([]);
  });

  it('tracks company-level deep research separately from per-section synthesis activity', () => {
    const view = buildJourneyRunView({
      id: 'session-deep',
      run_id: 'run-deep',
      metadata: {
        activeJourneyRunId: 'run-deep',
        companyName: 'Deep Co',
      },
      research_results: null,
      job_status: {
        'job-deep': {
          status: 'running',
          tool: 'runDeepResearchProgram',
          startedAt: '2026-05-07T09:00:00.000Z',
          updates: [
            {
              at: '2026-05-07T09:00:01.000Z',
              id: 'update-deep-1',
              message: 'starting company research extraction',
              phase: 'runner',
            },
          ],
        },
      },
      messages: null,
    });

    expect(view.status).toBe('running');
    expect(view.sections[0].status).toBe('running');
    expect(view.sections.slice(1).every((section) => section.status === 'queued')).toBe(true);
    expect(view.sections.slice(1).every((section) => section.phase === 'queued')).toBe(true);
    expect(view.sections.every((section) => section.latestEvent === null)).toBe(false);
    expect(view.sections[0].latestEvent).not.toBeNull();
    expect(view.sections.slice(1).every((section) => section.latestEvent === null)).toBe(true);
    expect(view.deepResearchActivity).toMatchObject({
      jobId: 'job-deep',
      section: 'deepResearchProgram',
      status: 'running',
      tool: 'runDeepResearchProgram',
    });
  });

  it('normalizes versioned workspace message envelopes for visibility summaries', () => {
    const view = buildJourneyRunView({
      id: 'session-workspace-messages',
      run_id: 'run-workspace-messages',
      metadata: null,
      research_results: null,
      job_status: null,
      messages: {
        schemaVersion: 1,
        workspace: {
          industryMarket: [
            {
              id: 'industry-message',
              role: 'user',
              parts: [{ type: 'text', text: 'Market workspace question' }],
            },
          ],
          competitors: [
            {
              id: 'competitors-message',
              role: 'assistant',
              parts: [{ type: 'text', text: 'Competitor workspace answer' }],
            },
          ],
        },
      },
    });

    expect(view.messages.map((message) => message.id)).toEqual([
      'industry-message',
      'competitors-message',
    ]);
    expect(view.messages.map((message) => message.content)).toEqual([
      'Market workspace question',
      'Competitor workspace answer',
    ]);
  });
});

describe('getJourneyRunView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.query.select.mockReturnValue(supabaseMocks.query);
    supabaseMocks.query.eq.mockReturnValue(supabaseMocks.query);
    supabaseMocks.query.order.mockReturnValue(supabaseMocks.query);
    supabaseMocks.query.limit.mockReturnValue(supabaseMocks.query);
  });

  it('scopes run lookups by Clerk user id and requested run id', async () => {
    supabaseMocks.query.maybeSingle.mockResolvedValue({
      data: makeRunRow(),
      error: null,
    });

    await getJourneyRunView('user-1', 'run-1');

    expect(supabaseMocks.from).toHaveBeenCalledWith('journey_sessions');
    expect(supabaseMocks.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(supabaseMocks.query.eq).toHaveBeenCalledWith('run_id', 'run-1');
  });

  it('throws an actionable load error when Supabase fails', async () => {
    supabaseMocks.query.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    await expect(getJourneyRunView('user-1', 'run-1')).rejects.toThrow(
      'Failed to load journey run view for user user-1 and run run-1: database unavailable',
    );
  });
});
