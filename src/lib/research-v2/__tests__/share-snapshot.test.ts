import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';

import {
  buildV3ShareSnapshot,
  createV3SharedSession,
} from '../share-snapshot';

const userId = 'user_123';
const runId = '00000000-0000-4000-8000-0000000000aa';
const sessionId = '33333333-3333-4333-8333-333333333333';
const parentAuditRunId = '11111111-1111-4111-8111-111111111111';

function createFakeSupabase(): {
  supabase: SupabaseClient;
  insert: ReturnType<typeof vi.fn>;
} {
  const journeyMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: sessionId,
      metadata: { companyName: 'SaaSLaunch' },
    },
    error: null,
  });
  const artifactMaybeSingle = vi.fn().mockResolvedValue({
    data: { id: parentAuditRunId },
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
      return { insert };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    supabase: { from } as unknown as SupabaseClient,
    insert,
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
    });
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
});
