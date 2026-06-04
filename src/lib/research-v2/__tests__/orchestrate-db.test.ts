import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: dbMocks.createAdminClient,
}));

import {
  buildFrozenGtmBriefThesisPatch,
  buildSynthesizedThesisPatch,
  freezeReviewedBriefSnapshot,
  seedOrchestration,
} from '../orchestrate-db';

beforeEach((): void => {
  dbMocks.rpc.mockReset();
  dbMocks.createAdminClient.mockReset();
  dbMocks.createAdminClient.mockReturnValue({
    rpc: dbMocks.rpc,
  });
});

describe('buildFrozenGtmBriefThesisPatch', () => {
  it('adds the reviewed GTM Brief snapshot to an unfrozen thesis', () => {
    const result = buildFrozenGtmBriefThesisPatch({
      existingThesis: { prior: 'keep' },
      gtmBriefSnapshot: { companyName: 'Fellow' },
      gtmBriefReview: { fieldCount: 47 },
      frozenAt: '2026-05-15T12:00:00.000Z',
    });

    expect(result.shouldUpdate).toBe(true);
    expect(result.thesis).toEqual({
      prior: 'keep',
      source: 'onboarding_v2_review',
      frozenAt: '2026-05-15T12:00:00.000Z',
      gtmBriefSnapshot: { companyName: 'Fellow' },
      gtmBriefReview: { fieldCount: 47 },
    });
  });

  it('does not overwrite an already frozen snapshot when onboarding changes later', () => {
    const existingThesis = {
      source: 'onboarding_v2_review',
      frozenAt: '2026-05-15T12:00:00.000Z',
      gtmBriefSnapshot: { companyName: 'Original Fellow' },
      gtmBriefReview: { fieldCount: 47 },
    };

    const result = buildFrozenGtmBriefThesisPatch({
      existingThesis,
      gtmBriefSnapshot: { companyName: 'Edited Later' },
      gtmBriefReview: { fieldCount: 47, edited: true },
      frozenAt: '2026-05-15T13:00:00.000Z',
    });

    expect(result.shouldUpdate).toBe(false);
    expect(result.thesis).toBe(existingThesis);
  });
});

describe('buildSynthesizedThesisPatch', () => {
  it('preserves the legacy wedge and records T9 strategist fields', () => {
    const result = buildSynthesizedThesisPatch({
      existingThesis: { source: 'onboarding_v2_review' },
      headlineWedge: 'Lead with operational speed.',
      recommendedAngle: 'Research to campaign in days.',
      rationale: 'Founders buy delay reduction before platform breadth.',
      optionCount: 2,
      strategicThesis:
        'This plan bets that impatient founder-led SaaS teams move on implementation-delay anxiety.',
      strategicSegment: 'Founder-led SaaS teams',
      strategicAwareness: 'Problem-aware',
      strategicForce: 'Operational impatience',
      defensibleDifferentiator: 'Proof-backed time-to-first-campaign loop',
      contradiction:
        'Demand supports immediate testing while proof gaps constrain authority claims.',
      resolution:
        'Spend first on the narrow speed-and-proof loop, then expand.',
      tradeOffAccepted: 'Accept a smaller initial story.',
      orderedMoveCount: 3,
      updatedAt: '2026-06-04T12:00:00.000Z',
    });

    expect(result.thesis).toEqual({
      source: 'onboarding_v2_review',
      positioningSynthesis: {
        headlineWedge: 'Lead with operational speed.',
        recommendedAngle: 'Research to campaign in days.',
        rationale: 'Founders buy delay reduction before platform breadth.',
        optionCount: 2,
        strategicThesis:
          'This plan bets that impatient founder-led SaaS teams move on implementation-delay anxiety.',
        strategicSegment: 'Founder-led SaaS teams',
        strategicAwareness: 'Problem-aware',
        strategicForce: 'Operational impatience',
        defensibleDifferentiator: 'Proof-backed time-to-first-campaign loop',
        contradiction:
          'Demand supports immediate testing while proof gaps constrain authority claims.',
        resolution:
          'Spend first on the narrow speed-and-proof loop, then expand.',
        tradeOffAccepted: 'Accept a smaller initial story.',
        orderedMoveCount: 3,
        updatedAt: '2026-06-04T12:00:00.000Z',
      },
    });
  });

  it('omits empty optional strategist fields for legacy synthesis artifacts', () => {
    const result = buildSynthesizedThesisPatch({
      existingThesis: null,
      headlineWedge: 'Lead with operational speed.',
      recommendedAngle: 'Research to campaign in days.',
      rationale: 'Founders buy delay reduction before platform breadth.',
      optionCount: 2,
      strategicThesis: ' ',
      contradiction: '',
      updatedAt: '2026-06-04T12:00:00.000Z',
    });

    expect(result.thesis.positioningSynthesis).toEqual({
      headlineWedge: 'Lead with operational speed.',
      recommendedAngle: 'Research to campaign in days.',
      rationale: 'Founders buy delay reduction before platform breadth.',
      optionCount: 2,
      updatedAt: '2026-06-04T12:00:00.000Z',
    });
  });
});

describe('freezeReviewedBriefSnapshot', () => {
  it('delegates the freeze write to the atomic security-definer RPC', async () => {
    dbMocks.rpc.mockResolvedValue({ data: 'frozen', error: null });

    await expect(
      freezeReviewedBriefSnapshot({
        parentAuditRunId: '11111111-1111-4111-8111-111111111111',
        gtmBriefSnapshot: { companyName: 'Fellow' },
        gtmBriefReview: { fieldCount: 47 },
        frozenAt: '2026-05-15T12:00:00.000Z',
      }),
    ).resolves.toBe('frozen');

    expect(dbMocks.rpc).toHaveBeenCalledWith('freeze_reviewed_brief_snapshot', {
      p_parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      p_gtm_brief_snapshot: { companyName: 'Fellow' },
      p_gtm_brief_review: { fieldCount: 47 },
      p_frozen_at: '2026-05-15T12:00:00.000Z',
    });
  });
});

describe('seedOrchestration', () => {
  it('preserves existing error rows instead of forcing them back to queued', async () => {
    dbMocks.rpc.mockResolvedValue({
      data: [
        {
          parent_id: '11111111-1111-4111-8111-111111111111',
          zone: 'positioningBuyerICP',
          section_run_id: '22222222-2222-4222-8222-000000000002',
          ordinal: 2,
          reused: true,
          status: 'error',
        },
      ],
      error: null,
    });

    await expect(
      seedOrchestration({
        userId: 'user_1',
        runId: '00000000-0000-4000-8000-0000000000aa',
        zones: ['positioningBuyerICP'],
      }),
    ).resolves.toEqual({
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      section_run_ids: [
        {
          section_id: 'positioningBuyerICP',
          section_run_id: '22222222-2222-4222-8222-000000000002',
          ordinal: 2,
          reused: true,
          status: 'error',
        },
      ],
    });
  });
});
