import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
} from '@/lib/ai/prompts/positioning-skills';
import type {
  AllPositioningSectionId,
  PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';

const VALID_RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';

interface SeededSectionRunRow {
  section_id: AllPositioningSectionId;
  section_run_id: string;
  ordinal: number;
  reused: boolean;
}

interface SeededRows {
  parent_audit_run_id: string;
  section_run_ids: SeededSectionRunRow[];
}

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const requireApiUser = vi.fn();
  const seedOrchestration = vi.fn();
  const corpusToResearchInput = vi.fn();
  const runLabSectionJob = vi.fn();
  // `after()` callbacks scheduled by the route — captured so tests can prove
  // the job is deferred until *after* the 202 ACK (and drain them explicitly).
  const afterCallbacks: Array<() => unknown> = [];
  const after = vi.fn((cb: () => unknown) => {
    afterCallbacks.push(cb);
  });
  const store = {
    createRun: vi.fn(),
    readRun: vi.fn(),
    appendEvent: vi.fn(),
    saveArtifact: vi.fn(),
    markSectionRunning: vi.fn(),
    markSectionFailed: vi.fn(),
  };
  const createSupabaseRunStore = vi.fn((input: unknown) => {
    void input;
    return store;
  });
  const sessionQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  sessionQuery.select.mockReturnValue(sessionQuery);
  sessionQuery.eq.mockReturnValue(sessionQuery);
  const committedSectionsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  };
  committedSectionsQuery.select.mockReturnValue(committedSectionsQuery);
  committedSectionsQuery.eq.mockReturnValue(committedSectionsQuery);
  const parentArtifactQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  parentArtifactQuery.select.mockReturnValue(parentArtifactQuery);
  parentArtifactQuery.eq.mockReturnValue(parentArtifactQuery);
  const documentsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  };
  documentsQuery.select.mockReturnValue(documentsQuery);
  documentsQuery.eq.mockReturnValue(documentsQuery);
  const from = vi.fn((table: string) =>
    table === 'research_artifact_sections'
      ? committedSectionsQuery
      : table === 'research_artifacts'
        ? parentArtifactQuery
        : table === 'business_profile_documents'
          ? documentsQuery
          : sessionQuery,
  );
  const createAdminClient = vi.fn(() => ({ from }));

  return {
    auth,
    requireApiUser,
    seedOrchestration,
    corpusToResearchInput,
    runLabSectionJob,
    after,
    afterCallbacks,
    store,
    createSupabaseRunStore,
    sessionQuery,
    committedSectionsQuery,
    parentArtifactQuery,
    documentsQuery,
    from,
    createAdminClient,
  };
});

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => routeMocks.auth(),
}));

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: (cb: () => unknown) => routeMocks.after(cb),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: routeMocks.createAdminClient,
}));

vi.mock('@/lib/auth/app-access', () => ({
  requireApiUser: () => routeMocks.requireApiUser(),
  jsonError: (message: string, status: number) =>
    Response.json({ error: message }, { status }),
}));

vi.mock('@/lib/research-v2/orchestrate-db', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/research-v2/orchestrate-db')
  >('@/lib/research-v2/orchestrate-db');
  return {
    ...actual,
    seedOrchestration: (...args: unknown[]) =>
      routeMocks.seedOrchestration(...args),
  };
});

vi.mock('@/lib/research-v2/corpus-to-research-input', () => ({
  corpusToResearchInput: (...args: unknown[]) =>
    routeMocks.corpusToResearchInput(...args),
}));

vi.mock('@/lib/research-v2/supabase-run-store', () => ({
  createSupabaseRunStore: (input: unknown) =>
    routeMocks.createSupabaseRunStore(input),
}));

vi.mock('@/lib/research-v2/lab-section-job', () => ({
  runLabSectionJob: (input: unknown) => routeMocks.runLabSectionJob(input),
}));

const { LAB_SECTION_ROUTE_TIMEOUT_MS, POST, maxDuration, runtime } =
  await import('../route');

async function drainAfter(): Promise<void> {
  const callbacks = routeMocks.afterCallbacks.splice(0);
  for (const cb of callbacks) {
    await cb();
  }
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/research-v2/run-lab-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function makeAbortableRequest(body: unknown, signal: AbortSignal): Request {
  return new Request('http://localhost/api/research-v2/run-lab-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal,
  });
}

function defaultSeededRows(): SeededRows {
  return {
    parent_audit_run_id: PARENT_ID,
    section_run_ids: POSITIONING_SECTION_IDS.map((zone, i) => ({
      section_id: zone,
      section_run_id: `22222222-2222-4222-8222-${(i + 1).toString().padStart(12, '0')}`,
      ordinal: i + 1,
      reused: false,
    })),
  };
}

function paidMediaSeededRows(): SeededRows {
  return {
    parent_audit_run_id: PARENT_ID,
    section_run_ids: [
      {
        section_id: PAID_MEDIA_PLAN_SECTION_ID,
        section_run_id: '33333333-3333-4333-8333-333333333333',
        ordinal: 7,
        reused: false,
      },
    ],
  };
}

function committedPositioningRows(): Array<{
  zone: PositioningSectionId;
  data: { sectionTitle: string };
}> {
  return POSITIONING_SECTION_IDS.map((zone) => ({
    zone,
    data: { sectionTitle: zone },
  }));
}

function validResearchInput(): Record<string, unknown> {
  return {
    runId: VALID_RUN_ID,
    fixtureId: 'brand_fellow',
    company: {
      id: 'company_fellow',
      name: 'Fellow',
      websiteUrl: 'https://fellow.app',
      category: 'Meeting automation',
      description: 'Fellow automates meetings.',
      stage: 'growth',
      targetCustomer: 'RevOps teams',
    },
    onboarding: {
      primaryGoal: 'Improve paid media performance',
      targetSegments: ['RevOps leaders'],
      keyOffers: ['Meeting automation'],
      distributionChannels: ['paid-search'],
      constraints: [],
      notes: 'Reviewed GTM brief',
    },
    corpus: {
      excerpts: [
        {
          id: 'excerpt_1',
          sourceUrl: 'https://fellow.app',
          title: 'Fellow',
          text: 'Fellow automates meeting workflows for revenue teams.',
          observedAt: '2026-05-26T00:00:00.000Z',
          sourceId: 'source_1',
        },
      ],
    },
    sources: [
      {
        id: 'source_1',
        title: 'Fellow',
        url: 'https://fellow.app',
        observedAt: '2026-05-26T00:00:00.000Z',
      },
    ],
    competitorAds: [],
  };
}

function mockApiUser(actorUserId = 'user_1') {
  return {
    actorUserId,
    role: 'internal',
    accountStatus: 'active',
    effectiveUserId: actorUserId,
    effectiveProfileId: null,
    primaryProfileId: null,
    clientLockedAt: null,
    impersonation: null,
  };
}

function mockOwnedSession(): void {
  routeMocks.sessionQuery.maybeSingle.mockResolvedValue({
    data: {
      id: '00000000-0000-4000-8000-000000000001',
      user_id: 'user_1',
      run_id: VALID_RUN_ID,
      research_results: {
        deepResearchProgram: {
          status: 'complete',
          data: { corpus: { researchSummary: 'Fellow automates meetings.' } },
        },
      },
      onboarding_data: { companyName: 'Fellow' },
      metadata: null,
    },
    error: null,
  });
}

describe('POST /api/research-v2/run-lab-section', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    routeMocks.afterCallbacks.length = 0;
    routeMocks.requireApiUser.mockResolvedValue(mockApiUser());
    routeMocks.sessionQuery.select.mockReturnValue(routeMocks.sessionQuery);
    routeMocks.sessionQuery.eq.mockReturnValue(routeMocks.sessionQuery);
    routeMocks.committedSectionsQuery.select.mockReturnValue(
      routeMocks.committedSectionsQuery,
    );
    routeMocks.committedSectionsQuery.eq.mockReturnValue(
      routeMocks.committedSectionsQuery,
    );
    routeMocks.committedSectionsQuery.in.mockResolvedValue({
      data: committedPositioningRows(),
      error: null,
    });
    routeMocks.parentArtifactQuery.select.mockReturnValue(
      routeMocks.parentArtifactQuery,
    );
    routeMocks.parentArtifactQuery.eq.mockReturnValue(
      routeMocks.parentArtifactQuery,
    );
    routeMocks.parentArtifactQuery.maybeSingle.mockResolvedValue({
      data: { id: PARENT_ID },
      error: null,
    });
    routeMocks.documentsQuery.select.mockReturnValue(routeMocks.documentsQuery);
    routeMocks.documentsQuery.eq.mockReturnValue(routeMocks.documentsQuery);
    routeMocks.documentsQuery.in.mockResolvedValue({
      data: [],
      error: null,
    });
    routeMocks.seedOrchestration.mockResolvedValue(defaultSeededRows());
    routeMocks.corpusToResearchInput.mockReturnValue(validResearchInput());
    routeMocks.store.createRun.mockResolvedValue({});
    routeMocks.runLabSectionJob.mockResolvedValue(undefined);
  });

  it('ACKs 202 and seeds synchronously, then runs the section job in after()', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession();

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: 'positioningBuyerICP',
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      run_id: VALID_RUN_ID,
      section_id: 'positioningBuyerICP',
    });

    // Setup that makes the 202 meaningful happens synchronously, before the ACK.
    expect(routeMocks.seedOrchestration).toHaveBeenCalledWith({
      userId: 'user_1',
      runId: VALID_RUN_ID,
      zones: POSITIONING_SECTION_IDS,
    });
    expect(routeMocks.corpusToResearchInput).toHaveBeenCalledWith({
      runId: VALID_RUN_ID,
      deepResearchProgramData: {
        corpus: { researchSummary: 'Fellow automates meetings.' },
      },
      onboardingData: { companyName: 'Fellow' },
    });
    expect(routeMocks.createSupabaseRunStore).toHaveBeenCalledWith(
      expect.objectContaining({
        parentAuditRunId: PARENT_ID,
        sectionRunIdByZone: Object.fromEntries(
          defaultSeededRows().section_run_ids.map((row) => [
            row.section_id,
            row.section_run_id,
          ]),
        ),
        researchInput: expect.objectContaining({
          runId: VALID_RUN_ID,
          fixtureId: 'brand_fellow',
        }),
      }),
    );
    expect(routeMocks.store.createRun).toHaveBeenCalledWith(expect.objectContaining({
      runId: VALID_RUN_ID,
      fixtureId: 'brand_fellow',
    }));

    // The heavy job is DEFERRED to after() — not awaited before the ACK.
    expect(routeMocks.after).toHaveBeenCalledTimes(1);
    expect(routeMocks.runLabSectionJob).not.toHaveBeenCalled();

    await drainAfter();

    expect(routeMocks.runLabSectionJob).toHaveBeenCalledWith({
      runId: VALID_RUN_ID,
      sectionId: 'positioningBuyerICP',
      signal: expect.any(AbortSignal),
      store: routeMocks.store,
    });
  });

  it('does not mask Clerk auth failures as 401 responses', async (): Promise<void> => {
    routeMocks.auth.mockRejectedValue(new Error('Clerk session store failed'));

    await expect(
      POST(
        makeRequest({
          run_id: VALID_RUN_ID,
          section_id: 'positioningBuyerICP',
        }),
      ),
    ).rejects.toThrow('Clerk session store failed');
  });

  it('loads uploaded document text and passes it into lab research input', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.sessionQuery.maybeSingle.mockResolvedValue({
      data: {
        id: '00000000-0000-4000-8000-000000000001',
        user_id: 'user_1',
        run_id: VALID_RUN_ID,
        research_results: {
          deepResearchProgram: {
            status: 'complete',
            data: { corpus: { researchSummary: 'Fellow automates meetings.' } },
          },
        },
        onboarding_data: { companyName: 'Fellow' },
        metadata: {
          uploadedDocIds: ['doc_1'],
        },
      },
      error: null,
    });
    routeMocks.documentsQuery.in.mockResolvedValue({
      data: [
        {
          id: 'doc_1',
          file_name: 'sales-call.transcript.txt',
          doc_kind: 'client_briefing',
          section_tags: ['positioningBuyerICP'],
          token_count: 120,
          parsed_markdown: 'Sales call transcript with buyer objections.',
        },
      ],
      error: null,
    });

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: 'positioningBuyerICP',
      }),
    );

    expect(response.status).toBe(202);
    expect(routeMocks.documentsQuery.in).toHaveBeenCalledWith('id', ['doc_1']);
    expect(routeMocks.corpusToResearchInput).toHaveBeenCalledWith({
      runId: VALID_RUN_ID,
      deepResearchProgramData: {
        corpus: { researchSummary: 'Fellow automates meetings.' },
      },
      onboardingData: { companyName: 'Fellow' },
      uploadedDocuments: [
        {
          id: 'doc_1',
          fileName: 'sales-call.transcript.txt',
          docKind: 'client_briefing',
          sectionTags: ['positioningBuyerICP'],
          tokenCount: 120,
          parsedMarkdown: 'Sales call transcript with buyer objections.',
        },
      ],
    });
  });

  it('uses a bounded Node route lifecycle longer than the first-step watchdog', (): void => {
    expect(runtime).toBe('nodejs');
    expect(maxDuration * 1000).toBeGreaterThan(LAB_SECTION_ROUTE_TIMEOUT_MS);
    expect(LAB_SECTION_ROUTE_TIMEOUT_MS).toBeGreaterThan(120_000);
  });

  it('runs the deferred job decoupled from the kickoff connection (no abort when the kickoff drops)', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession();
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    routeMocks.runLabSectionJob.mockImplementation(
      async (input: { signal?: AbortSignal }): Promise<void> => {
        observedSignal = input.signal;
      },
    );

    const response = await POST(
      makeAbortableRequest(
        {
          run_id: VALID_RUN_ID,
          section_id: 'positioningBuyerICP',
        },
        controller.signal,
      ),
    );

    expect(response.status).toBe(202);

    // The kickoff connection drops right after the ACK — orchestrate's kickoff
    // fetch times out, or the manual console-loop tab closes. The deferred job
    // MUST survive this and run to completion on its own timeout.
    controller.abort(new Error('kickoff disconnected'));

    await drainAfter();

    expect(routeMocks.runLabSectionJob).toHaveBeenCalledTimes(1);
    expect(observedSignal).toBeInstanceOf(AbortSignal);
    expect(observedSignal).not.toBe(controller.signal);
    expect(observedSignal?.aborted).toBe(false);
  });

  it('returns 400 for an unsupported lab section id', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: 'unknownSection',
      }),
    );

    expect(response.status).toBe(400);
    expect(routeMocks.seedOrchestration).not.toHaveBeenCalled();
  });

  it('dispatches the paid media plan as a dependent one-section wave with committed artifacts', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.seedOrchestration.mockResolvedValue(paidMediaSeededRows());
    mockOwnedSession();

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: PAID_MEDIA_PLAN_SECTION_ID,
      }),
    );

    expect(response.status).toBe(202);
    expect(routeMocks.seedOrchestration).toHaveBeenCalledWith({
      userId: 'user_1',
      runId: VALID_RUN_ID,
      zones: [PAID_MEDIA_PLAN_SECTION_ID],
    });
    expect(routeMocks.committedSectionsQuery.in).toHaveBeenCalledWith(
      'zone',
      [...POSITIONING_SECTION_IDS],
    );
    expect(routeMocks.createSupabaseRunStore).toHaveBeenCalledWith(
      expect.objectContaining({
        parentAuditRunId: PARENT_ID,
        sectionRunIdByZone: {
          [PAID_MEDIA_PLAN_SECTION_ID]: '33333333-3333-4333-8333-333333333333',
        },
        researchInput: expect.objectContaining({
          committedPositioningArtifacts: Object.fromEntries(
            committedPositioningRows().map((row) => [row.zone, row.data]),
          ),
        }),
      }),
    );

    await drainAfter();

    expect(routeMocks.runLabSectionJob).toHaveBeenCalledWith({
      runId: VALID_RUN_ID,
      sectionId: PAID_MEDIA_PLAN_SECTION_ID,
      signal: expect.any(AbortSignal),
      store: routeMocks.store,
    });
  });
});
