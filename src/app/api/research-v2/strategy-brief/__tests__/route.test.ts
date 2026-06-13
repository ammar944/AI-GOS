import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import type { StrategyBriefArtifact } from '@/lib/research-v2/strategy-brief/schema';

const RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const after = vi.fn();
  const createAdminClient = vi.fn();
  const loadOwnedResearchSession = vi.fn();
  const corpusToResearchInput = vi.fn();
  const buildCommittedArtifactsResearchInput = vi.fn();
  const createResearchArtifactsEvidencePoolStore = vi.fn();
  const readEvidencePoolFromArtifactData = vi.fn();
  const composeStrategyBrief = vi.fn();
  const validateStrategyBriefSupport = vi.fn();
  const commitStrategyBrief = vi.fn();

  const artifactsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  artifactsQuery.select.mockReturnValue(artifactsQuery);
  artifactsQuery.eq.mockReturnValue(artifactsQuery);

  const sectionsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  sectionsQuery.select.mockReturnValue(sectionsQuery);
  sectionsQuery.eq.mockReturnValue(sectionsQuery);

  const from = vi.fn((table: string) => {
    if (table === 'research_artifacts') return artifactsQuery;
    if (table === 'research_artifact_sections') return sectionsQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  createAdminClient.mockReturnValue({ from });

  return {
    after,
    auth,
    artifactsQuery,
    buildCommittedArtifactsResearchInput,
    commitStrategyBrief,
    composeStrategyBrief,
    corpusToResearchInput,
    createAdminClient,
    createResearchArtifactsEvidencePoolStore,
    readEvidencePoolFromArtifactData,
    sectionsQuery,
    validateStrategyBriefSupport,
    loadOwnedResearchSession,
  };
});

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => routeMocks.auth(),
}));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>(
    'next/server',
  );
  return {
    ...actual,
    after: (...args: unknown[]) => routeMocks.after(...args),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => routeMocks.createAdminClient(),
}));

vi.mock('@/lib/research-v2/orchestration-session', () => ({
  loadOwnedResearchSession: (...args: unknown[]) =>
    routeMocks.loadOwnedResearchSession(...args),
  corpusReady: (session: { corpusReady?: boolean }): boolean =>
    session.corpusReady === true,
  getDeepResearchProgramData: (
    session: { deepResearchProgramData?: unknown },
  ): unknown | null => session.deepResearchProgramData ?? null,
}));

vi.mock('@/lib/research-v2/corpus-to-research-input', () => ({
  corpusToResearchInput: (...args: unknown[]) =>
    routeMocks.corpusToResearchInput(...args),
}));

vi.mock('@/lib/research-v2/uploaded-document-context.server', () => ({
  loadUploadedDocumentContextsForSession: () => [],
}));

vi.mock('@/lib/research-v2/committed-positioning-artifacts', () => ({
  buildCommittedArtifactsResearchInput: (...args: unknown[]) =>
    routeMocks.buildCommittedArtifactsResearchInput(...args),
}));

vi.mock('@/lib/lab-engine/evidence/evidence-pool', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/lab-engine/evidence/evidence-pool')
  >('@/lib/lab-engine/evidence/evidence-pool');
  return {
    ...actual,
    createResearchArtifactsEvidencePoolStore: (...args: unknown[]) =>
      routeMocks.createResearchArtifactsEvidencePoolStore(...args),
    readEvidencePoolFromArtifactData: (...args: unknown[]) =>
      routeMocks.readEvidencePoolFromArtifactData(...args),
  };
});

vi.mock('@/lib/research-v2/strategy-brief/composer', () => ({
  composeStrategyBrief: (...args: unknown[]) =>
    routeMocks.composeStrategyBrief(...args),
}));

vi.mock('@/lib/research-v2/strategy-brief/support', () => ({
  validateStrategyBriefSupport: (...args: unknown[]) =>
    routeMocks.validateStrategyBriefSupport(...args),
}));

vi.mock('@/lib/research-v2/strategy-brief/commit', () => ({
  commitStrategyBrief: (...args: unknown[]) =>
    routeMocks.commitStrategyBrief(...args),
}));

const { POST } = await import('../route');

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/research-v2/strategy-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function committedSectionMarkdown(): Record<string, string> {
  return Object.fromEntries(
    POSITIONING_SECTION_IDS.map((sectionId) => [
      sectionId,
      `# ${sectionId}\nCommitted findings for ${sectionId}.`,
    ]),
  );
}

function validResearchInput(): Record<string, unknown> {
  return {
    runId: RUN_ID,
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
    committedPositioningSectionMarkdown: committedSectionMarkdown(),
  };
}

function validStrategyBrief(): StrategyBriefArtifact {
  return {
    sectionTitle: 'Offer & Angle Brief',
    verdict: 'Lead with meeting accountability.',
    statusSummary: 'The brief is ready for media planning.',
    confidence: 0.82,
    sources: [{ title: 'Fellow', url: 'https://fellow.app' }],
    body: {
      positioning: {
        oneLiner: 'Fellow keeps revenue meetings accountable.',
        valueProp: 'Turn meeting chaos into accountable execution.',
        mechanism: 'Shared agendas, notes, and follow-up ownership.',
      },
      angles: [
        {
          name: 'The dropped handoff',
          vignette: 'I left the meeting without a clear owner.',
          coreEmotion: 'frustration',
          adFrame: 'Open on the missed follow-up.',
          rank: 1,
          sourceEvidence: ['positioningVoiceOfCustomer'],
        },
      ],
      lexicon: {
        approved: ['accountability'],
        banned: [{ term: 'AI meeting copilot', reason: 'Too generic.' }],
      },
      funnelStance: 'Demand capture first.',
      gaps: [],
      changelog: [
        {
          revision: 1,
          summary: 'Initial brief.',
          rationale: 'Six committed sections were available.',
          at: '2026-06-13T00:00:00.000Z',
        },
      ],
    },
  };
}

describe('POST /api/research-v2/strategy-brief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.artifactsQuery.select.mockReturnValue(routeMocks.artifactsQuery);
    routeMocks.artifactsQuery.eq.mockReturnValue(routeMocks.artifactsQuery);
    routeMocks.artifactsQuery.maybeSingle.mockResolvedValue({
      data: { id: PARENT_ID },
      error: null,
    });
    routeMocks.sectionsQuery.select.mockReturnValue(routeMocks.sectionsQuery);
    routeMocks.sectionsQuery.eq.mockReturnValue(routeMocks.sectionsQuery);
    routeMocks.sectionsQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    routeMocks.loadOwnedResearchSession.mockResolvedValue({
      corpusReady: true,
      deepResearchProgramData: { corpus: { researchSummary: 'Fellow' } },
      onboarding_data: { companyName: 'Fellow' },
      metadata: {},
    });
    routeMocks.corpusToResearchInput.mockReturnValue(validResearchInput());
    routeMocks.buildCommittedArtifactsResearchInput.mockResolvedValue({
      ok: true,
      researchInput: validResearchInput(),
    });
    routeMocks.createResearchArtifactsEvidencePoolStore.mockReturnValue({
      readArtifactData: vi.fn().mockResolvedValue({}),
    });
    routeMocks.readEvidencePoolFromArtifactData.mockReturnValue({
      version: 1,
      updatedAt: '2026-06-13T00:00:00.000Z',
      entries: [
        {
          kind: 'webSearchResult',
          fetchedAt: '2026-06-13T00:00:00.000Z',
          toolName: 'web_search',
          sourceUrl: 'https://fellow.app',
          payload: { title: 'Fellow' },
        },
      ],
    });
    routeMocks.composeStrategyBrief.mockResolvedValue(validStrategyBrief());
    routeMocks.validateStrategyBriefSupport.mockReturnValue({ ok: true });
    routeMocks.commitStrategyBrief.mockResolvedValue({ ok: true });
  });

  it('returns 401 when there is no Clerk user', async () => {
    routeMocks.auth.mockResolvedValue({ userId: null });

    const response = await POST(makeRequest({ runId: RUN_ID }));

    expect(response.status).toBe(401);
    expect(routeMocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('rejects invalid request bodies before DB access', async () => {
    const response = await POST(makeRequest({ refinement: 'missing run' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('invalid_strategy_brief_request');
    expect(routeMocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('returns the committed-section readiness response before scheduling background work', async () => {
    routeMocks.buildCommittedArtifactsResearchInput.mockResolvedValue({
      ok: false,
      response: Response.json(
        {
          error: 'positioning_sections_not_ready',
          missing_sections: ['positioningBuyerICP'],
        },
        { status: 409 },
      ),
    });

    const response = await POST(makeRequest({ runId: RUN_ID }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('positioning_sections_not_ready');
    expect(routeMocks.after).not.toHaveBeenCalled();
  });

  it('accepts a ready request and schedules detached compose-and-commit work', async () => {
    const response = await POST(
      makeRequest({ runId: RUN_ID, refinement: 'tighten the angle ranking' }),
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toEqual({
      ok: true,
      status: 'queued',
      sectionId: 'strategyBrief',
      runId: RUN_ID,
    });
    expect(routeMocks.after).toHaveBeenCalledTimes(1);
  });

  it('composes and commits the strategy brief in the detached callback', async () => {
    await POST(makeRequest({ runId: RUN_ID, refinement: 'tighten ranking' }));

    const callback = routeMocks.after.mock.calls[0]?.[0] as
      | (() => Promise<void>)
      | undefined;
    expect(callback).toBeDefined();

    await callback?.();

    expect(routeMocks.composeStrategyBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        committedSectionMarkdown: committedSectionMarkdown(),
        evidencePoolSlice: expect.stringContaining('https://fellow.app'),
        onboardingFrame: expect.stringContaining('Primary objective'),
        refinement: 'tighten ranking',
        priorBrief: null,
      }),
    );
    expect(routeMocks.validateStrategyBriefSupport).toHaveBeenCalledWith({
      body: validStrategyBrief().body,
      committedSectionIds: POSITIONING_SECTION_IDS,
      evidenceSourceUrls: ['https://fellow.app'],
    });
    expect(routeMocks.commitStrategyBrief).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      userId: 'user_1',
      runId: RUN_ID,
      artifact: validStrategyBrief(),
    });
  });
});
