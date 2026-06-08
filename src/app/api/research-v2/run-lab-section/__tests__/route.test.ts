import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CROSS_SECTION_REASONING_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
} from '@/lib/ai/prompts/positioning-skills';
import type {
  AllPositioningSectionId,
  PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import type { SectionRunClaimResult } from '@/lib/research-v2/section-run-claim';

const VALID_RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';

interface SeededSectionRunRow {
  section_id: AllPositioningSectionId;
  section_run_id: string;
  ordinal: number;
  reused: boolean;
  status: 'queued' | 'running' | 'complete';
}

interface SeededRows {
  parent_audit_run_id: string;
  section_run_ids: SeededSectionRunRow[];
}

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const requireApiUser = vi.fn();
  const seedOrchestration = vi.fn();
  const claimSectionRun = vi.fn();
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
    claimSectionRun,
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

vi.mock('@/lib/research-v2/section-run-claim', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/research-v2/section-run-claim')
  >('@/lib/research-v2/section-run-claim');
  return {
    ...actual,
    claimSectionRun: (...args: unknown[]) =>
      routeMocks.claimSectionRun(...args),
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
      status: 'queued',
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
        status: 'queued',
      },
    ],
  };
}

function synthesisSeededRows(): SeededRows {
  return {
    parent_audit_run_id: PARENT_ID,
    section_run_ids: [
      {
        section_id: POSITIONING_SYNTHESIS_SECTION_ID,
        section_run_id: '55555555-5555-4555-8555-555555555555',
        ordinal: 8,
        reused: false,
        status: 'queued',
      },
    ],
  };
}

function crossSectionReasoningSeededRows(): SeededRows {
  return {
    parent_audit_run_id: PARENT_ID,
    section_run_ids: [
      {
        section_id: CROSS_SECTION_REASONING_SECTION_ID,
        section_run_id: '44444444-4444-4444-8444-444444444444',
        ordinal: 7,
        reused: false,
        status: 'queued',
      },
    ],
  };
}

function claimResult(
  status: 'claimed' | 'already_running',
  sectionRunId = '22222222-2222-4222-8222-000000000002',
  sectionId: AllPositioningSectionId = 'positioningBuyerICP',
): SectionRunClaimResult {
  return {
    status,
    runId: VALID_RUN_ID,
    sectionId,
    sectionRunId,
    previousStatus: status === 'claimed' ? 'queued' : 'running',
  };
}

function verifiedFlag(): Record<string, unknown> {
  return {
    confidence: 1,
    evidenceGap: false,
    insufficientThreshold: 0.5,
    needsReviewThreshold: 0.75,
    tier: 'verified',
    totalClaims: 1,
    unsupportedCount: 0,
    verifiedCount: 1,
  };
}

function readyVoiceOfCustomerBody(): Record<string, unknown> {
  return {
    painLanguage: {
      quotes: Array.from({ length: 10 }, (_, index) => ({
        sourceUrl: `https://reviews.example.com/pain-${index + 1}`,
        verbatimText: `Pain quote ${index + 1}`,
      })),
    },
    successLanguage: {
      quotes: Array.from({ length: 5 }, (_, index) => ({
        sourceUrl: `https://reviews.example.com/success-${index + 1}`,
        verbatimText: `Success quote ${index + 1}`,
      })),
    },
  };
}

function readyBuyerICPBody(): Record<string, unknown> {
  return {
    personaReality: {
      personas: [
        {
          company: 'ExampleCo',
          name: 'Jane Doe',
          role: 'economic-buyer',
          seniority: 'executive',
          sourceUrl: 'https://example.com/customers/jane-doe',
          title: 'Chief Financial Officer',
        },
        {
          company: 'ExampleCo',
          name: 'Mina Patel',
          role: 'champion',
          seniority: 'director',
          sourceUrl: 'https://example.com/customers/mina-patel',
          title: 'Director of Procurement',
        },
      ],
    },
  };
}

function readyCommittedSectionData(
  zone: PositioningSectionId,
): { body?: Record<string, unknown>; sectionTitle: string } {
  if (zone === 'positioningVoiceOfCustomer') {
    return { sectionTitle: zone, body: readyVoiceOfCustomerBody() };
  }

  if (zone === 'positioningBuyerICP') {
    return { sectionTitle: zone, body: readyBuyerICPBody() };
  }

  return { sectionTitle: zone };
}

function committedPositioningRows(): Array<{
  zone: PositioningSectionId;
  data: { body?: Record<string, unknown>; sectionTitle: string };
  verification_tier: string;
  verification_flag: Record<string, unknown>;
}> {
  return POSITIONING_SECTION_IDS.map((zone) => ({
    zone,
    data: readyCommittedSectionData(zone),
    verification_tier: 'verified',
    verification_flag: verifiedFlag(),
  }));
}

function committedPositioningRowsWithVoiceOfCustomerGap(): Array<{
  zone: PositioningSectionId;
  data: { body?: Record<string, unknown>; sectionTitle: string };
  verification_tier: string;
  verification_flag: Record<string, unknown>;
}> {
  return committedPositioningRows().map((row) =>
    row.zone === 'positioningVoiceOfCustomer'
      ? {
          ...row,
          data: {
            sectionTitle: row.zone,
            body: {
              evidenceGap: true,
              evidenceGapReport: {
                reason: 'insufficient_voice_of_customer_sources',
              },
              painLanguage: { quotes: [] },
              successLanguage: { quotes: [] },
            },
          },
          verification_tier: 'insufficient',
          verification_flag: {
            ...verifiedFlag(),
            confidence: 0,
            evidenceGap: true,
            tier: 'insufficient',
            unsupportedCount: 1,
            verifiedCount: 0,
          },
        }
      : row,
  );
}

function committedRowsWithCrossSectionReasoning(): Array<{
  zone: PositioningSectionId | typeof CROSS_SECTION_REASONING_SECTION_ID;
  data: { body?: Record<string, unknown>; sectionTitle: string };
  verification_tier?: string;
  verification_flag?: Record<string, unknown>;
}> {
  return [
    ...committedPositioningRows(),
    {
      zone: CROSS_SECTION_REASONING_SECTION_ID,
      data: { sectionTitle: 'Cross-Section Reasoning' },
      verification_tier: 'verified',
      verification_flag: verifiedFlag(),
    },
  ];
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
    vi.unstubAllEnvs();
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-deepseek-key');
    vi.stubEnv('LAB_ENGINE_PROVIDER', 'deepseek-direct');
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
    routeMocks.claimSectionRun.mockResolvedValue(claimResult('claimed'));
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
      claim_status: 'claimed',
      section_run_id: '22222222-2222-4222-8222-000000000002',
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

  it('keeps repeated kickoff attempts idempotent and schedules only the claimed owner', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession();
    routeMocks.claimSectionRun
      .mockResolvedValueOnce(claimResult('claimed'))
      .mockResolvedValueOnce(claimResult('already_running'));

    const first = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: 'positioningBuyerICP',
      }),
    );
    const second = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: 'positioningBuyerICP',
      }),
    );

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    await expect(first.json()).resolves.toMatchObject({
      ok: true,
      claim_status: 'claimed',
    });
    await expect(second.json()).resolves.toMatchObject({
      ok: true,
      claim_status: 'already_running',
    });
    expect(routeMocks.claimSectionRun).toHaveBeenCalledTimes(2);
    expect(routeMocks.after).toHaveBeenCalledTimes(1);

    await drainAfter();

    expect(routeMocks.runLabSectionJob).toHaveBeenCalledTimes(1);
  });

  it('server-dispatches cross-section reasoning once after the sixth positioning section commits', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession();
    routeMocks.parentArtifactQuery.maybeSingle.mockResolvedValue({
      data: {
        status: 'complete',
        children_complete: POSITIONING_SECTION_IDS.length,
        children_total: POSITIONING_SECTION_IDS.length,
      },
      error: null,
    });
    routeMocks.seedOrchestration
      .mockResolvedValueOnce(defaultSeededRows())
      .mockResolvedValueOnce(crossSectionReasoningSeededRows());
    routeMocks.claimSectionRun
      .mockResolvedValueOnce(
        claimResult(
          'claimed',
          '22222222-2222-4222-8222-000000000002',
          'positioningBuyerICP',
        ),
      )
      .mockResolvedValueOnce(
        claimResult(
          'claimed',
          '44444444-4444-4444-8444-444444444444',
          CROSS_SECTION_REASONING_SECTION_ID,
        ),
      );

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: 'positioningBuyerICP',
      }),
    );

    expect(response.status).toBe(202);
    expect(routeMocks.after).toHaveBeenCalledTimes(1);

    await drainAfter();

    expect(routeMocks.seedOrchestration).toHaveBeenNthCalledWith(2, {
      userId: 'user_1',
      runId: VALID_RUN_ID,
      zones: [CROSS_SECTION_REASONING_SECTION_ID],
    });
    expect(routeMocks.claimSectionRun).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        runId: VALID_RUN_ID,
        sectionId: CROSS_SECTION_REASONING_SECTION_ID,
        userId: 'user_1',
      }),
    );
    expect(routeMocks.committedSectionsQuery.in).toHaveBeenCalledWith(
      'zone',
      [...POSITIONING_SECTION_IDS],
    );
    expect(routeMocks.after).toHaveBeenCalledTimes(2);
    expect(routeMocks.runLabSectionJob).toHaveBeenCalledTimes(1);

    await drainAfter();

    expect(routeMocks.runLabSectionJob).toHaveBeenNthCalledWith(2, {
      runId: VALID_RUN_ID,
      sectionId: CROSS_SECTION_REASONING_SECTION_ID,
      signal: expect.any(AbortSignal),
      store: routeMocks.store,
    });
  });

  it('does not schedule a duplicate thinker job when the server trigger finds it already dispatched', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession();
    routeMocks.parentArtifactQuery.maybeSingle.mockResolvedValue({
      data: {
        status: 'complete',
        children_complete: POSITIONING_SECTION_IDS.length,
        children_total: POSITIONING_SECTION_IDS.length,
      },
      error: null,
    });
    routeMocks.seedOrchestration
      .mockResolvedValueOnce(defaultSeededRows())
      .mockResolvedValueOnce(crossSectionReasoningSeededRows());
    routeMocks.claimSectionRun
      .mockResolvedValueOnce(
        claimResult(
          'claimed',
          '22222222-2222-4222-8222-000000000002',
          'positioningBuyerICP',
        ),
      )
      .mockResolvedValueOnce(
        claimResult(
          'already_running',
          '44444444-4444-4444-8444-444444444444',
          CROSS_SECTION_REASONING_SECTION_ID,
        ),
      );

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: 'positioningBuyerICP',
      }),
    );

    expect(response.status).toBe(202);

    await drainAfter();

    expect(routeMocks.seedOrchestration).toHaveBeenNthCalledWith(2, {
      userId: 'user_1',
      runId: VALID_RUN_ID,
      zones: [CROSS_SECTION_REASONING_SECTION_ID],
    });
    expect(routeMocks.claimSectionRun).toHaveBeenCalledTimes(2);
    expect(routeMocks.after).toHaveBeenCalledTimes(1);
    expect(routeMocks.runLabSectionJob).toHaveBeenCalledTimes(1);
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

  it('fails before seeding, claiming, or scheduling when local lab provider preflight fails', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession();
    vi.stubEnv('LAB_ENGINE_PROVIDER', '');
    vi.stubEnv('DEEPSEEK_API_KEY', '');

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: 'positioningBuyerICP',
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'lab_engine_provider_preflight_failed',
      message: expect.stringContaining('LAB_ENGINE_PROVIDER is unset'),
      missingEnv: ['LAB_ENGINE_PROVIDER'],
      provider: 'anthropic',
    });
    expect(routeMocks.seedOrchestration).not.toHaveBeenCalled();
    expect(routeMocks.claimSectionRun).not.toHaveBeenCalled();
    expect(routeMocks.store.createRun).not.toHaveBeenCalled();
    expect(routeMocks.after).not.toHaveBeenCalled();
    expect(routeMocks.runLabSectionJob).not.toHaveBeenCalled();
  });

  it('returns 404 before provider preflight for unknown runs', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.sessionQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    vi.stubEnv('LAB_ENGINE_PROVIDER', '');
    vi.stubEnv('DEEPSEEK_API_KEY', '');

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: 'positioningBuyerICP',
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'session_not_found',
    });
    expect(routeMocks.seedOrchestration).not.toHaveBeenCalled();
    expect(routeMocks.claimSectionRun).not.toHaveBeenCalled();
    expect(routeMocks.store.createRun).not.toHaveBeenCalled();
    expect(routeMocks.after).not.toHaveBeenCalled();
    expect(routeMocks.runLabSectionJob).not.toHaveBeenCalled();
  });

  it('dispatches cross-section reasoning as a dependent one-section wave with committed artifacts', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.seedOrchestration.mockResolvedValue(crossSectionReasoningSeededRows());
    routeMocks.claimSectionRun.mockResolvedValue(
      claimResult(
        'claimed',
        '44444444-4444-4444-8444-444444444444',
        CROSS_SECTION_REASONING_SECTION_ID,
      ),
    );
    mockOwnedSession();

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: CROSS_SECTION_REASONING_SECTION_ID,
      }),
    );

    expect(response.status).toBe(202);
    expect(routeMocks.seedOrchestration).toHaveBeenCalledWith({
      userId: 'user_1',
      runId: VALID_RUN_ID,
      zones: [CROSS_SECTION_REASONING_SECTION_ID],
    });
    expect(routeMocks.committedSectionsQuery.in).toHaveBeenCalledWith(
      'zone',
      [...POSITIONING_SECTION_IDS],
    );
    expect(routeMocks.createSupabaseRunStore).toHaveBeenCalledWith(
      expect.objectContaining({
        parentAuditRunId: PARENT_ID,
        sectionRunIdByZone: {
          [CROSS_SECTION_REASONING_SECTION_ID]:
            '44444444-4444-4444-8444-444444444444',
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
      sectionId: CROSS_SECTION_REASONING_SECTION_ID,
      signal: expect.any(AbortSignal),
      store: routeMocks.store,
    });
  });

  it('dispatches the paid media plan as a dependent one-section wave with committed artifacts and thinker output', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.seedOrchestration.mockResolvedValue(paidMediaSeededRows());
    routeMocks.committedSectionsQuery.in.mockResolvedValue({
      data: committedRowsWithCrossSectionReasoning(),
      error: null,
    });
    routeMocks.claimSectionRun.mockResolvedValue(
      claimResult(
        'claimed',
        '33333333-3333-4333-8333-333333333333',
        PAID_MEDIA_PLAN_SECTION_ID,
      ),
    );
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
      [...POSITIONING_SECTION_IDS, CROSS_SECTION_REASONING_SECTION_ID],
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
          crossSectionReasoningArtifact: {
            sectionTitle: 'Cross-Section Reasoning',
          },
        }),
      }),
    );
    const createStoreInput = routeMocks.createSupabaseRunStore.mock
      .calls[0]?.[0] as
      | {
          researchInput: {
            committedPositioningArtifacts?: Record<string, unknown>;
          };
        }
      | undefined;
    const voiceOfCustomerArtifact =
      createStoreInput?.researchInput.committedPositioningArtifacts
        ?.positioningVoiceOfCustomer as
        | { body?: { painLanguage?: { quotes?: unknown[] } } }
        | undefined;
    expect(voiceOfCustomerArtifact?.body?.painLanguage?.quotes).toHaveLength(10);

    await drainAfter();

    expect(routeMocks.runLabSectionJob).toHaveBeenCalledWith({
      runId: VALID_RUN_ID,
      sectionId: PAID_MEDIA_PLAN_SECTION_ID,
      signal: expect.any(AbortSignal),
      store: routeMocks.store,
    });
  });

  it('dispatches the thinker on thin evidence, passing an evidenceCoverage annotation', async (): Promise<void> => {
    // ARI: readiness is a coverage annotation, not a gate. A 6/6 run with a thin
    // VoC still dispatches the thinker; the gap rides along in evidenceCoverage.
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.seedOrchestration.mockResolvedValue(crossSectionReasoningSeededRows());
    routeMocks.committedSectionsQuery.in.mockResolvedValue({
      data: committedPositioningRowsWithVoiceOfCustomerGap(),
      error: null,
    });
    routeMocks.claimSectionRun.mockResolvedValue(
      claimResult(
        'claimed',
        '44444444-4444-4444-8444-444444444444',
        CROSS_SECTION_REASONING_SECTION_ID,
      ),
    );
    mockOwnedSession();

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: CROSS_SECTION_REASONING_SECTION_ID,
      }),
    );

    expect(response.status).toBe(202);
    expect(routeMocks.createSupabaseRunStore).toHaveBeenCalledWith(
      expect.objectContaining({
        researchInput: expect.objectContaining({
          evidenceCoverage: expect.objectContaining({
            ready: false,
            blockedSections: expect.arrayContaining([
              expect.objectContaining({
                zone: 'positioningVoiceOfCustomer',
                reasons: expect.arrayContaining([
                  'positioningVoiceOfCustomer has zero real buyer quotes',
                ]),
              }),
            ]),
          }),
        }),
      }),
    );

    await drainAfter();

    expect(routeMocks.runLabSectionJob).toHaveBeenCalledWith({
      runId: VALID_RUN_ID,
      sectionId: CROSS_SECTION_REASONING_SECTION_ID,
      signal: expect.any(AbortSignal),
      store: routeMocks.store,
    });
  });

  it('blocks paid media dispatch until cross-section reasoning is committed', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.seedOrchestration.mockResolvedValue(paidMediaSeededRows());
    routeMocks.claimSectionRun.mockResolvedValue(
      claimResult(
        'claimed',
        '33333333-3333-4333-8333-333333333333',
        PAID_MEDIA_PLAN_SECTION_ID,
      ),
    );
    mockOwnedSession();

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: PAID_MEDIA_PLAN_SECTION_ID,
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'cross_section_reasoning_not_ready',
      missing_sections: [CROSS_SECTION_REASONING_SECTION_ID],
    });
    expect(routeMocks.createSupabaseRunStore).not.toHaveBeenCalled();
    expect(routeMocks.runLabSectionJob).not.toHaveBeenCalled();
  });

  it('blocks synthesis dispatch until cross-section reasoning is committed', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.seedOrchestration.mockResolvedValue(synthesisSeededRows());
    routeMocks.claimSectionRun.mockResolvedValue(
      claimResult(
        'claimed',
        '55555555-5555-4555-8555-555555555555',
        POSITIONING_SYNTHESIS_SECTION_ID,
      ),
    );
    mockOwnedSession();

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: POSITIONING_SYNTHESIS_SECTION_ID,
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'cross_section_reasoning_not_ready',
      missing_sections: [CROSS_SECTION_REASONING_SECTION_ID],
    });
    expect(routeMocks.createSupabaseRunStore).not.toHaveBeenCalled();
    expect(routeMocks.runLabSectionJob).not.toHaveBeenCalled();
  });
});
