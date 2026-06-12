import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';

import {
  buildV3ShareSnapshot,
  createV3SharedSession,
  isV3ShareResearchSnapshot,
  readExecutiveBriefFromThesis,
  refreshV3SharedSessionSnapshots,
} from '../share-snapshot';

const userId = 'user_123';
const runId = '00000000-0000-4000-8000-0000000000aa';
const sessionId = '33333333-3333-4333-8333-333333333333';
const parentAuditRunId = '11111111-1111-4111-8111-111111111111';

function createFakeSupabase(options?: {
  thesis?: unknown;
  journeyMatchColumn?: 'run_id' | 'id';
}): {
  supabase: SupabaseClient;
  insert: ReturnType<typeof vi.fn>;
  journeyLookups: string[];
} {
  const journeyLookups: string[] = [];
  const journeyRow = {
    id: sessionId,
    run_id: runId,
    metadata: { companyName: 'SaaSLaunch' },
  };
  const artifactMaybeSingle = vi.fn().mockResolvedValue({
    data: { id: parentAuditRunId, thesis: options?.thesis ?? null },
    error: null,
  });
  const sectionsOrder = vi.fn().mockResolvedValue({
    data: [
      {
        zone: 'positioningMarketCategory',
        title: marketCategoryFixtureArtifact.sectionTitle,
        markdown: null,
        data: marketCategoryFixtureArtifact,
        status: 'complete',
        verification_tier: 'needs_review',
        verification_flag: {
          tier: 'needs_review',
          verifiedCount: 2,
          unsupportedCount: 1,
          totalClaims: 3,
          confidence: 2 / 3,
          needsReviewThreshold: 0.75,
          insufficientThreshold: 0.5,
          evidenceGap: false,
        },
        updated_at: '2026-05-25T12:00:00.000Z',
      },
      {
        zone: 'positioningBuyerICP',
        title: 'Buyer & ICP Validation',
        markdown: null,
        data: { sectionTitle: 'Buyer & ICP Validation' },
        status: 'queued',
        verification_tier: null,
        verification_flag: null,
        updated_at: '2026-05-25T12:00:01.000Z',
      },
    ],
    error: null,
  });
  const insert = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn((table: string) => {
    if (table === 'journey_sessions') {
      let lookupColumn: 'run_id' | 'id' | null = null;
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn(),
      };
      query.select.mockReturnValue(query);
      query.eq.mockImplementation((column: string) => {
        if (column === 'run_id' || column === 'id') {
          lookupColumn = column;
          journeyLookups.push(column);
        }
        return query;
      });
      query.maybeSingle.mockImplementation(() =>
        Promise.resolve({
          data:
            options?.journeyMatchColumn === undefined ||
            lookupColumn === options.journeyMatchColumn
              ? journeyRow
              : null,
          error: null,
        }),
      );
      return query;
    }
    if (table === 'research_artifacts') {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: artifactMaybeSingle,
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      return query;
    }
    if (table === 'research_artifact_sections') {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        order: sectionsOrder,
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      return query;
    }
    if (table === 'shared_sessions') {
      return { insert };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    supabase: { from } as unknown as SupabaseClient,
    insert,
    journeyLookups,
  };
}

function createRefreshFakeSupabase(): {
  supabase: SupabaseClient;
  update: ReturnType<typeof vi.fn>;
} {
  const journeyMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: sessionId,
      run_id: runId,
      metadata: { companyName: 'SaaSLaunch' },
    },
    error: null,
  });
  const artifactMaybeSingle = vi.fn().mockResolvedValue({
    data: { id: parentAuditRunId, thesis: null },
    error: null,
  });
  const sectionsOrder = vi.fn().mockResolvedValue({
    data: [
      {
        zone: 'positioningMarketCategory',
        title: marketCategoryFixtureArtifact.sectionTitle,
        markdown: null,
        data: marketCategoryFixtureArtifact,
        status: 'complete',
        verification_tier: 'verified',
        verification_flag: {
          tier: 'verified',
          verifiedCount: 3,
          unsupportedCount: 0,
          totalClaims: 3,
          confidence: 1,
          needsReviewThreshold: 0.75,
          insufficientThreshold: 0.5,
          evidenceGap: false,
        },
        updated_at: '2026-05-25T12:00:00.000Z',
      },
    ],
    error: null,
  });
  const sharedSelectEq = vi.fn();
  sharedSelectEq.mockReturnValue(
    Object.assign(
      Promise.resolve({
        data: [
          {
            share_token: 'v3_token',
            title: 'Existing v3 title',
            research_snapshot: {
              schemaVersion: 'research-v3',
              runId,
              title: 'Existing v3 title',
              sections: [
                {
                  zone: 'positioningMarketCategory',
                  title: marketCategoryFixtureArtifact.sectionTitle,
                  markdown: null,
                  data: marketCategoryFixtureArtifact,
                  verificationTier: 'insufficient',
                  verificationFlag: {
                    tier: 'insufficient',
                    verifiedCount: 0,
                    unsupportedCount: 1,
                    totalClaims: 1,
                    confidence: 0,
                    needsReviewThreshold: 0.75,
                    insufficientThreshold: 0.5,
                    evidenceGap: true,
                  },
                  updatedAt: '2026-05-24T12:00:00.000Z',
                },
              ],
            },
          },
          {
            share_token: 'legacy_token',
            title: 'Legacy title',
            research_snapshot: { industryMarket: [{ id: 'legacy-card' }] },
          },
        ],
        error: null,
      }),
      { eq: sharedSelectEq },
    ),
  );
  const update = vi.fn();
  const updateEq = vi.fn();
  updateEq.mockReturnValue(
    Object.assign(Promise.resolve({ error: null }), { eq: updateEq }),
  );

  const from = vi.fn((table: string) => {
    if (table === 'journey_sessions') {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: journeyMaybeSingle,
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      return query;
    }
    if (table === 'research_artifacts') {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: artifactMaybeSingle,
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      return query;
    }
    if (table === 'research_artifact_sections') {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        order: sectionsOrder,
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      return query;
    }
    if (table === 'shared_sessions') {
      return {
        select: vi.fn().mockReturnValue({ eq: sharedSelectEq }),
        update: (patch: Record<string, unknown>) => {
          update(patch);
          return { eq: updateEq };
        },
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    supabase: { from } as unknown as SupabaseClient,
    update,
  };
}

describe('v3 share snapshot', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it('builds a v3 snapshot from complete research_artifact_sections only', (): void => {
    const snapshot = buildV3ShareSnapshot({
      runId,
      title: 'SaaSLaunch Positioning Audit',
      sections: [
        {
          zone: 'positioningBuyerICP',
          title: 'Buyer & ICP Validation',
          markdown: null,
          data: { sectionTitle: 'Buyer & ICP Validation' },
          status: 'queued',
          verification_tier: null,
          verification_flag: null,
          updated_at: '2026-05-25T12:00:01.000Z',
        },
        {
          zone: 'positioningMarketCategory',
          title: marketCategoryFixtureArtifact.sectionTitle,
          markdown: null,
          data: marketCategoryFixtureArtifact,
          status: 'complete',
          verification_tier: 'needs_review',
          verification_flag: {
            tier: 'needs_review',
            verifiedCount: 2,
            unsupportedCount: 1,
            totalClaims: 3,
            confidence: 2 / 3,
            needsReviewThreshold: 0.75,
            insufficientThreshold: 0.5,
            evidenceGap: false,
          },
          updated_at: '2026-05-25T12:00:00.000Z',
        },
      ],
    });

    expect(snapshot).toEqual({
      schemaVersion: 'research-v3',
      runId,
      title: 'SaaSLaunch Positioning Audit',
      sections: [
        {
          zone: 'positioningMarketCategory',
          title: marketCategoryFixtureArtifact.sectionTitle,
          markdown: null,
          data: marketCategoryFixtureArtifact,
          verificationTier: 'needs_review',
          verificationFlag: {
            tier: 'needs_review',
            verifiedCount: 2,
            unsupportedCount: 1,
            totalClaims: 3,
            confidence: 2 / 3,
            needsReviewThreshold: 0.75,
            insufficientThreshold: 0.5,
            evidenceGap: false,
          },
          updatedAt: '2026-05-25T12:00:00.000Z',
        },
      ],
      executiveBrief: null,
    });
  });

  it('carries a completed executive brief as a top-level snapshot string', (): void => {
    const executiveBrief = readExecutiveBriefFromThesis({
      status: 'complete',
      executiveThesis: 'One argument the whole report proves.',
      decisions: [
        { decision: 'Launch the comparison campaign.' },
        { decision: 'Fix the demo gate.' },
      ],
    });

    expect(executiveBrief).toBe(
      [
        'One argument the whole report proves.',
        '',
        '1. Launch the comparison campaign.',
        '2. Fix the demo gate.',
      ].join('\n'),
    );

    const snapshot = buildV3ShareSnapshot({
      runId,
      title: 'SaaSLaunch Positioning Audit',
      sections: [
        {
          zone: 'positioningMarketCategory',
          title: marketCategoryFixtureArtifact.sectionTitle,
          markdown: null,
          data: marketCategoryFixtureArtifact,
          status: 'complete',
          verification_tier: null,
          verification_flag: null,
          updated_at: '2026-05-25T12:00:00.000Z',
        },
      ],
      executiveBrief,
    });

    expect(snapshot.executiveBrief).toBe(executiveBrief);
  });

  it('ships no executive brief for generating, error, or missing thesis states', (): void => {
    expect(
      readExecutiveBriefFromThesis({ status: 'generating', claimedAt: 'now' }),
    ).toBeNull();
    expect(
      readExecutiveBriefFromThesis({ status: 'error', message: 'boom' }),
    ).toBeNull();
    expect(readExecutiveBriefFromThesis(null)).toBeNull();
    expect(readExecutiveBriefFromThesis(undefined)).toBeNull();
  });

  it('keeps legacy snapshots without executiveBrief recognized as v3 snapshots', (): void => {
    expect(
      isV3ShareResearchSnapshot({
        schemaVersion: 'research-v3',
        runId,
        title: 'Legacy snapshot',
        sections: [],
      }),
    ).toBe(true);
  });

  it('preserves reviewed artifact body and committed trust metadata in share sections', (): void => {
    const reviewedArtifact = {
      ...marketCategoryFixtureArtifact,
      review: {
        upgradedMarkdown: '# Reviewed market category\n\nUse the narrower wedge.',
        tier: 'needs_review',
        tierRationale: 'One load-bearing claim needs client proof.',
        removedItems: ['Unsupported market-size precision'],
        clientQuestions: ['Can you provide sourced segment sizing?'],
      },
    };

    const snapshot = buildV3ShareSnapshot({
      runId,
      title: 'SaaSLaunch Positioning Audit',
      sections: [
        {
          zone: 'positioningMarketCategory',
          title: marketCategoryFixtureArtifact.sectionTitle,
          markdown: 'Reviewed market category markdown.',
          data: reviewedArtifact,
          status: 'complete',
          verification_tier: 'needs_review',
          verification_flag: {
            tier: 'needs_review',
            verifiedCount: 5,
            unsupportedCount: 1,
            totalClaims: 6,
            confidence: 5 / 6,
            needsReviewThreshold: 0.75,
            insufficientThreshold: 0.5,
            evidenceGap: false,
          },
          updated_at: '2026-05-25T12:00:00.000Z',
        },
      ],
    });

    expect(snapshot.sections).toHaveLength(1);
    expect(snapshot.sections[0]).toEqual(
      expect.objectContaining({
        verificationTier: 'needs_review',
        verificationFlag: expect.objectContaining({
          tier: 'needs_review',
        }),
        data: expect.objectContaining({
          review: expect.objectContaining({
            tier: 'needs_review',
            upgradedMarkdown: expect.stringContaining(
              'Reviewed market category',
            ),
          }),
        }),
      }),
    );
  });

  it('creates a shared session row with a v3 normalized snapshot', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase();

    const result = await createV3SharedSession({
      supabase: fakeSupabase.supabase,
      userId,
      runId,
      title: 'Shared title',
      appUrl: 'https://app.example',
      newShareToken: () => 'share_token_123',
    });

    expect(result).toEqual({
      shareToken: 'share_token_123',
      shareUrl: 'https://app.example/shared/share_token_123',
    });
    expect(fakeSupabase.insert).toHaveBeenCalledWith({
      share_token: 'share_token_123',
      session_id: sessionId,
      owner_user_id: userId,
      title: 'Shared title',
      research_snapshot: expect.objectContaining({
        schemaVersion: 'research-v3',
        executiveBrief: null,
        sections: expect.arrayContaining([
          expect.objectContaining({
            zone: 'positioningMarketCategory',
            verificationTier: 'needs_review',
            verificationFlag: expect.objectContaining({
              tier: 'needs_review',
            }),
          }),
        ]),
      }),
      media_plan_snapshot: null,
    });
  });

  it('accepts a journey session id and snapshots the resolved run id', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase({ journeyMatchColumn: 'id' });

    const result = await createV3SharedSession({
      supabase: fakeSupabase.supabase,
      userId,
      runId: sessionId,
      title: 'Shared title',
      appUrl: 'https://app.example',
      newShareToken: () => 'share_token_123',
    });

    expect(result).toEqual({
      shareToken: 'share_token_123',
      shareUrl: 'https://app.example/shared/share_token_123',
    });
    expect(fakeSupabase.journeyLookups).toEqual(['run_id', 'id']);
    expect(fakeSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: sessionId,
        research_snapshot: expect.objectContaining({
          runId,
        }),
      }),
    );
  });

  it('populates the shared snapshot executiveBrief from research_artifacts.thesis', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase({
      thesis: {
        status: 'complete',
        executiveThesis: 'One argument the whole report proves.',
        decisions: [{ decision: 'Launch the comparison campaign.' }],
      },
    });

    await createV3SharedSession({
      supabase: fakeSupabase.supabase,
      userId,
      runId,
      title: 'Shared title',
      appUrl: 'https://app.example',
      newShareToken: () => 'share_token_123',
    });

    expect(fakeSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        research_snapshot: expect.objectContaining({
          executiveBrief: [
            'One argument the whole report proves.',
            '',
            '1. Launch the comparison campaign.',
          ].join('\n'),
        }),
      }),
    );
  });

  it('refreshes existing v3 share snapshots without rewriting legacy snapshots', async (): Promise<void> => {
    const fakeSupabase = createRefreshFakeSupabase();

    const refreshed = await refreshV3SharedSessionSnapshots({
      supabase: fakeSupabase.supabase,
      userId,
      runId,
    });

    expect(refreshed).toBe(1);
    expect(fakeSupabase.update).toHaveBeenCalledTimes(1);
    expect(fakeSupabase.update).toHaveBeenCalledWith({
      title: 'Existing v3 title',
      research_snapshot: expect.objectContaining({
        schemaVersion: 'research-v3',
        runId,
        title: 'Existing v3 title',
        sections: [
          expect.objectContaining({
            zone: 'positioningMarketCategory',
            verificationTier: 'verified',
            verificationFlag: expect.objectContaining({ tier: 'verified' }),
          }),
        ],
      }),
    });
  });
});
