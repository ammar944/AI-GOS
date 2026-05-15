import { beforeEach, describe, expect, it, vi } from 'vitest';

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const RUN_ID = '00000000-0000-4000-8000-0000000000aa';

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
    });
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
      phase: 'Committed',
      executionMode: 'draft',
    });
  });
});
