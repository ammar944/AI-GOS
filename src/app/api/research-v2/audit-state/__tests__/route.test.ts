import { beforeEach, describe, expect, it, vi } from 'vitest';

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const POSITIONING_ZONES = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
] as const;

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const parentQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  parentQuery.select.mockReturnValue(parentQuery);
  parentQuery.eq.mockReturnValue(parentQuery);

  const runsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  runsQuery.select.mockReturnValue(runsQuery);
  runsQuery.eq.mockReturnValue(runsQuery);
  runsQuery.order.mockResolvedValue({ data: [], error: null });

  const sectionsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  sectionsQuery.select.mockReturnValue(sectionsQuery);
  sectionsQuery.eq.mockResolvedValue({ data: [], error: null });

  const eventsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  eventsQuery.select.mockReturnValue(eventsQuery);
  eventsQuery.eq.mockReturnValue(eventsQuery);
  eventsQuery.order.mockReturnValue(eventsQuery);
  eventsQuery.limit.mockResolvedValue({ data: [], error: null });

  const from = vi.fn((table: string) => {
    if (table === 'research_artifacts') return parentQuery;
    if (table === 'research_section_runs') return runsQuery;
    if (table === 'research_artifact_sections') return sectionsQuery;
    if (table === 'research_section_events') return eventsQuery;
    throw new Error(`Unexpected table ${table}`);
  });
  const createAdminClient = vi.fn(() => ({ from }));

  return {
    auth,
    createAdminClient,
    parentQuery,
    runsQuery,
    sectionsQuery,
    eventsQuery,
  };
});

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => routeMocks.auth(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: routeMocks.createAdminClient,
}));

const { GET } = await import('../route');

function makeRequest(): Request {
  return new Request(`http://localhost/api/research-v2/audit-state?run_id=${RUN_ID}`);
}

describe('GET /api/research-v2/audit-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.parentQuery.select.mockReturnValue(routeMocks.parentQuery);
    routeMocks.parentQuery.eq.mockReturnValue(routeMocks.parentQuery);
    routeMocks.parentQuery.maybeSingle.mockResolvedValue({
      data: {
        id: PARENT_ID,
        status: 'running',
        children_total: 6,
        children_complete: 1,
      },
      error: null,
    });
    routeMocks.runsQuery.select.mockReturnValue(routeMocks.runsQuery);
    routeMocks.runsQuery.eq.mockReturnValue(routeMocks.runsQuery);
    routeMocks.runsQuery.order.mockResolvedValue({ data: [], error: null });
    routeMocks.sectionsQuery.select.mockReturnValue(routeMocks.sectionsQuery);
    routeMocks.sectionsQuery.eq.mockResolvedValue({ data: [], error: null });
    routeMocks.eventsQuery.select.mockReturnValue(routeMocks.eventsQuery);
    routeMocks.eventsQuery.eq.mockReturnValue(routeMocks.eventsQuery);
    routeMocks.eventsQuery.order.mockReturnValue(routeMocks.eventsQuery);
    routeMocks.eventsQuery.limit.mockResolvedValue({ data: [], error: null });
  });

  it('projects durable section phase telemetry into workerStates', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.runsQuery.order.mockResolvedValue({
      data: [
        {
          id: 'section-run-market',
          zone: 'positioningMarketCategory',
          status: 'running',
          started_at: '2026-05-15T12:00:00.000Z',
          telemetry: {
            phase: 'Compiling context',
            phaseStartedAt: '2026-05-15T12:00:01.000Z',
            latestTool: 'web_search',
            latestSource: 'https://example.com/category',
            latestActivity: 'Building Section Context Pack',
            nextStep: 'Read source excerpts',
            wave: 1,
            totalWaves: 2,
            concurrency: 3,
            elapsedMs: 1200,
            capabilityGaps: [{ tool: 'firecrawl', reason: 'missing' }],
            executionMode: 'draft',
            runtimeTimings: {
              sectionStartedAt: '2026-05-15T12:00:00.000Z',
              firstPartialAt: '2026-05-15T12:00:04.000Z',
              timeoutFiredAt: null,
            },
          },
        },
      ],
      error: null,
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workerStates[0]).toMatchObject({
      section_id: 'positioningMarketCategory',
      status: 'running',
      phase: 'Compiling context',
      phaseLabel: 'Compiling context',
      latestTool: 'web_search',
      latestSource: 'https://example.com/category',
      latestActivity: 'Building Section Context Pack',
      nextStep: 'Read source excerpts',
      wave: 1,
      totalWaves: 2,
      concurrency: 3,
      elapsedMs: 1200,
      capabilityGaps: [{ tool: 'firecrawl', reason: 'missing' }],
      executionMode: 'draft',
      runtimeTimings: {
        sectionStartedAt: '2026-05-15T12:00:00.000Z',
        firstPartialAt: '2026-05-15T12:00:04.000Z',
      },
    });
  });

  it('derives live tool, source, and capability gaps from persisted section events', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.runsQuery.order.mockResolvedValue({
      data: [
        {
          id: 'section-run-market',
          zone: 'positioningMarketCategory',
          status: 'running',
          started_at: '2026-05-15T12:00:00.000Z',
          telemetry: {
            latestTool: 'stale_tool',
            latestSource: 'https://stale.example.com',
            capabilityGaps: [{ reason: 'missing_credential' }],
            executionMode: 'lab',
          },
        },
      ],
      error: null,
    });
    routeMocks.eventsQuery.limit.mockResolvedValue({
      data: [
        {
          id: 'event-3',
          zone: 'positioningMarketCategory',
          event_type: 'tool-finished',
          message: 'firecrawl finished',
          payload: {
            toolName: 'firecrawl',
            sourceUrl: 'https://www.gong.io/',
            gap: {
              reason: 'api_error',
              message: 'Firecrawl returned 502',
            },
          },
          created_at: '2026-05-15T12:00:03.000Z',
        },
        {
          id: 'event-2',
          zone: 'positioningMarketCategory',
          event_type: 'tool-started',
          message: 'firecrawl started',
          payload: {
            toolName: 'firecrawl',
            sourceUrl: 'https://www.gong.io/',
          },
          created_at: '2026-05-15T12:00:02.000Z',
        },
        {
          id: 'event-1',
          zone: 'positioningMarketCategory',
          event_type: 'tool-started',
          message: 'web_search started',
          payload: {
            toolName: 'web_search',
            query: 'Gong alternatives',
          },
          created_at: '2026-05-15T12:00:01.000Z',
        },
      ],
      error: null,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.workerStates[0]).toMatchObject({
      section_id: 'positioningMarketCategory',
      status: 'running',
      latestTool: 'firecrawl',
      latestSource: 'https://www.gong.io/',
      capabilityGaps: [
        {
          reason: 'api_error',
          message: 'Firecrawl returned 502',
        },
      ],
    });
  });

  it('queries enough events for each worker zone to keep its newest activity', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });

    const makeRows = (
      zones: readonly (typeof POSITIONING_ZONES)[number][],
    ): Array<Record<string, unknown>> =>
      zones.flatMap((zone) =>
        Array.from({ length: 13 }, (_, index) => {
          const sequence = 13 - index;
          return {
            id: `${zone}-event-${sequence}`,
            zone,
            event_type: 'tool-started',
            message: `event ${sequence}`,
            payload: {
              toolName: 'web_search',
              query: `${zone} query ${sequence}`,
            },
            created_at: `2026-05-15T12:${String(sequence).padStart(2, '0')}:00.000Z`,
          };
        }),
      );
    const completeRows = makeRows(POSITIONING_ZONES);
    const starvedRows = makeRows(POSITIONING_ZONES.slice(0, 5));
    routeMocks.eventsQuery.limit.mockImplementation(
      async (limit: number): Promise<{ data: Array<Record<string, unknown>>; error: null }> => ({
        data: limit >= 12 * POSITIONING_ZONES.length ? completeRows : starvedRows,
        error: null,
      }),
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(routeMocks.eventsQuery.limit).toHaveBeenCalledWith(72);
    for (const zone of POSITIONING_ZONES) {
      expect(body.eventsByZone[zone].map((event: { id: string }) => event.id)).toEqual(
        Array.from({ length: 12 }, (_, index) => `${zone}-event-${index + 2}`),
      );
    }
  });

  it('defaults missing phase telemetry to queued labels', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.workerStates[0]).toMatchObject({
      section_id: 'positioningMarketCategory',
      status: 'queued',
      phase: 'Queued',
      phaseLabel: 'Queued',
      executionMode: null,
      runtimeTimings: {},
    });
  });

  it('prefers the committed artifact section run over a newer terminal row', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.runsQuery.order.mockResolvedValue({
      data: [
        {
          id: 'run-newer-error',
          zone: 'positioningMarketCategory',
          status: 'error',
          started_at: '2026-05-15T12:05:00.000Z',
          telemetry: {
            phase: 'Needs review',
            executionMode: 'deep',
          },
        },
        {
          id: 'run-committed-draft',
          zone: 'positioningMarketCategory',
          status: 'complete',
          started_at: '2026-05-15T12:00:00.000Z',
          telemetry: {
            phase: 'Committed',
            executionMode: 'draft',
          },
        },
      ],
      error: null,
    });
    routeMocks.sectionsQuery.eq.mockResolvedValue({
      data: [
        {
          zone: 'positioningMarketCategory',
          section_run_id: 'run-committed-draft',
          status: 'complete',
          title: 'Market & Category Intelligence',
          markdown: 'draft markdown',
          data: null,
        },
      ],
      error: null,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.workerStates[0]).toMatchObject({
      section_id: 'positioningMarketCategory',
      status: 'complete',
      phase: 'Draft ready',
      phaseLabel: 'Draft ready',
      executionMode: 'draft',
    });
  });

  it('prefers an active running rerun over a stale committed artifact row', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.runsQuery.order.mockResolvedValue({
      data: [
        {
          id: 'run-active-rerun',
          zone: 'positioningMarketCategory',
          status: 'running',
          started_at: '2026-05-15T12:05:00.000Z',
          telemetry: {
            phase: 'Reading sources',
            latestActivity: 'Reading category evidence',
            executionMode: 'lab',
          },
        },
        {
          id: 'run-committed-complete',
          zone: 'positioningMarketCategory',
          status: 'complete',
          started_at: '2026-05-15T12:00:00.000Z',
          telemetry: {
            phase: 'Committed',
            executionMode: 'lab',
          },
        },
      ],
      error: null,
    });
    routeMocks.sectionsQuery.eq.mockResolvedValue({
      data: [
        {
          zone: 'positioningMarketCategory',
          section_run_id: 'run-committed-complete',
          status: 'complete',
          title: 'Market & Category Intelligence',
          markdown: 'stale markdown',
          data: null,
        },
      ],
      error: null,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.workerStates[0]).toMatchObject({
      section_id: 'positioningMarketCategory',
      status: 'running',
      phase: 'Reading sources',
      phaseLabel: 'Reading sources',
      latestActivity: 'Reading category evidence',
      executionMode: 'lab',
    });
    expect(body.sectionsByZone.positioningMarketCategory).toMatchObject({
      title: 'Market & Category Intelligence',
    });
  });

  it('prefers a committed complete artifact over newer queued seed rows for unrelated sections', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.runsQuery.order.mockResolvedValue({
      data: [
        {
          id: 'run-newer-queued',
          zone: 'positioningBuyerICP',
          status: 'queued',
          started_at: '2026-05-15T12:05:00.000Z',
          telemetry: null,
        },
        {
          id: 'run-committed-complete',
          zone: 'positioningBuyerICP',
          status: 'complete',
          started_at: '2026-05-15T12:00:00.000Z',
          telemetry: {
            phase: 'Committed',
            executionMode: 'deep',
          },
        },
      ],
      error: null,
    });
    routeMocks.sectionsQuery.eq.mockResolvedValue({
      data: [
        {
          zone: 'positioningBuyerICP',
          section_run_id: 'run-committed-complete',
          status: 'complete',
          title: 'Buyer & ICP Validation',
          markdown: null,
          data: {
            sectionTitle: 'Buyer & ICP Validation',
            verdict: 'Complete',
            statusSummary: 'Complete section.',
            confidence: 0.8,
            sources: [],
            body: {},
          },
        },
      ],
      error: null,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.workerStates[1]).toMatchObject({
      section_id: 'positioningBuyerICP',
      status: 'complete',
      phase: 'Committed',
      phaseLabel: 'Committed',
      executionMode: 'deep',
    });
    expect(body.sectionsByZone.positioningBuyerICP).toMatchObject({
      title: 'Buyer & ICP Validation',
    });
  });

  it('returns Draft ready for a complete draft worker state even when telemetry says Committed', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.runsQuery.order.mockResolvedValue({
      data: [
        {
          id: 'run-complete-draft',
          zone: 'positioningMarketCategory',
          status: 'complete',
          started_at: '2026-05-15T12:00:00.000Z',
          telemetry: {
            phase: 'Committed',
            executionMode: 'draft',
          },
        },
      ],
      error: null,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.workerStates[0]).toMatchObject({
      section_id: 'positioningMarketCategory',
      status: 'complete',
      phase: 'Draft ready',
      phaseLabel: 'Draft ready',
      executionMode: 'draft',
    });
  });

  it('keeps Committed for complete deep and unknown execution modes', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.runsQuery.order.mockResolvedValue({
      data: [
        {
          id: 'run-complete-deep',
          zone: 'positioningMarketCategory',
          status: 'complete',
          started_at: '2026-05-15T12:00:00.000Z',
          telemetry: {
            phase: 'Committed',
            executionMode: 'deep',
          },
        },
        {
          id: 'run-complete-unknown',
          zone: 'positioningBuyerICP',
          status: 'complete',
          started_at: '2026-05-15T12:00:00.000Z',
          telemetry: {
            phase: 'Committed',
          },
        },
      ],
      error: null,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.workerStates[0]).toMatchObject({
      section_id: 'positioningMarketCategory',
      status: 'complete',
      phase: 'Committed',
      phaseLabel: 'Committed',
      executionMode: 'deep',
    });
    expect(body.workerStates[1]).toMatchObject({
      section_id: 'positioningBuyerICP',
      status: 'complete',
      phase: 'Committed',
      phaseLabel: 'Committed',
      executionMode: null,
    });
  });

  it('projects lab telemetry and derives complete rollup when the parent row is stale', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.parentQuery.maybeSingle.mockResolvedValue({
      data: {
        id: PARENT_ID,
        status: 'queued',
        children_total: 6,
        children_complete: 0,
      },
      error: null,
    });
    routeMocks.runsQuery.order.mockResolvedValue({
      data: [
        'positioningMarketCategory',
        'positioningBuyerICP',
        'positioningCompetitorLandscape',
        'positioningVoiceOfCustomer',
        'positioningDemandIntent',
        'positioningOfferDiagnostic',
      ].map((zone) => ({
        id: `run-${zone}`,
        zone,
        status: 'complete',
        started_at: '2026-05-15T12:00:00.000Z',
        telemetry: {
          executionMode: 'lab',
          phase: 'Committed',
          latestActivity: `${zone} committed`,
          provider: 'deepseek-direct',
          model: 'deepseek-v4-flash',
          runtimeTimings: {
            sectionStartedAt: '2026-05-15T12:00:00.000Z',
            terminalStatusWrittenAt: '2026-05-15T12:01:00.000Z',
          },
        },
      })),
      error: null,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.parent_status).toBe('complete');
    expect(body.children_complete).toBe(6);
    expect(body.children_total).toBe(6);
    expect(body.workerStates[0]).toMatchObject({
      section_id: 'positioningMarketCategory',
      status: 'complete',
      phase: 'Committed',
      executionMode: 'lab',
      latestActivity: 'positioningMarketCategory committed',
      runtimeTimings: {
        sectionStartedAt: '2026-05-15T12:00:00.000Z',
        terminalStatusWrittenAt: '2026-05-15T12:01:00.000Z',
      },
    });
  });

  it('returns Needs review for error and aborted section states', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.runsQuery.order.mockResolvedValue({
      data: [
        {
          id: 'run-error',
          zone: 'positioningMarketCategory',
          status: 'error',
          started_at: '2026-05-15T12:00:00.000Z',
          telemetry: {
            phase: 'Committed',
            executionMode: 'draft',
          },
        },
        {
          id: 'run-aborted',
          zone: 'positioningBuyerICP',
          status: 'aborted',
          started_at: '2026-05-15T12:00:00.000Z',
          telemetry: {
            phase: 'Draft ready',
            executionMode: 'draft',
          },
        },
      ],
      error: null,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.workerStates[0]).toMatchObject({
      section_id: 'positioningMarketCategory',
      status: 'error',
      phase: 'Needs review',
      phaseLabel: 'Needs review',
    });
    expect(body.workerStates[1]).toMatchObject({
      section_id: 'positioningBuyerICP',
      status: 'aborted',
      phase: 'Needs review',
      phaseLabel: 'Needs review',
    });
  });
});
