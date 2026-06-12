import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buyerICPFixtureArtifact } from '@/lib/lab-engine/fixtures/buyer-icp-artifact';
import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { offerDiagnosticFixtureArtifact } from '@/lib/lab-engine/fixtures/offer-diagnostic-artifact';
import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';

import {
  buildCommittedSectionProfileInsights,
  persistAuditProfile,
  persistAuditProfileBestEffort,
} from '../section-profile-persistence';

const userId = 'user_123';
const sessionId = '33333333-3333-4333-8333-333333333333';
const runId = saaslaunchResearchInput.runId;
const parentAuditRunId = '44444444-4444-4444-8444-444444444444';

interface FakeResearchArtifactSectionRow {
  zone: string;
  title: string;
  markdown: string;
  data: unknown;
  status: string;
  verification_tier: string | null;
  verification_flag: Record<string, unknown> | null;
  updated_at: string;
}

function createSectionRow(input: {
  zone: string;
  data: unknown;
  status?: string;
  verificationTier?: string | null;
  verificationFlag?: Record<string, unknown> | null;
}): FakeResearchArtifactSectionRow {
  return {
    zone: input.zone,
    title: input.zone,
    markdown: `# ${input.zone}`,
    data: input.data,
    status: input.status ?? 'complete',
    verification_tier: input.verificationTier ?? null,
    verification_flag: input.verificationFlag ?? null,
    updated_at: '2026-06-03T05:00:00.000Z',
  };
}

function createFakeSupabase(sectionRows: FakeResearchArtifactSectionRow[] = []): {
  supabase: SupabaseClient;
  from: ReturnType<typeof vi.fn>;
  sessionMaybeSingle: ReturnType<typeof vi.fn>;
  sectionEq: ReturnType<typeof vi.fn>;
  updateEq: ReturnType<typeof vi.fn>;
} {
  const sessionMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: sessionId,
      metadata: { companyName: 'Metadata Co', websiteUrl: 'https://metadata.example' },
      onboarding_data: { companyName: 'SaaSLaunch', monthlyAdBudget: '$25k' },
    },
    error: null,
  });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const selectQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: sessionMaybeSingle,
  };
  selectQuery.select.mockReturnValue(selectQuery);
  selectQuery.eq.mockReturnValue(selectQuery);
  const sectionEq = vi.fn().mockResolvedValue({
    data: sectionRows,
    error: null,
  });
  const sectionQuery = {
    select: vi.fn(),
    eq: sectionEq,
  };
  sectionQuery.select.mockReturnValue(sectionQuery);
  const updateQuery = {
    update: vi.fn().mockReturnValue({ eq: updateEq }),
  };
  const from = vi.fn((table: string) => {
    if (table === 'journey_sessions') {
      return {
        ...selectQuery,
        ...updateQuery,
      };
    }

    if (table === 'research_artifact_sections') {
      return sectionQuery;
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return {
    supabase: { from } as unknown as SupabaseClient,
    from,
    sessionMaybeSingle,
    sectionEq,
    updateEq,
  };
}

describe('section profile persistence', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it('builds a stable v3 insight key without overwriting sibling sections', (): void => {
    const insights = buildCommittedSectionProfileInsights({
      sectionId: 'positioningMarketCategory',
      artifact: marketCategoryFixtureArtifact,
    });

    expect(insights).toEqual({
      positioningMarketCategory: {
        sectionTitle: marketCategoryFixtureArtifact.sectionTitle,
        verdict: marketCategoryFixtureArtifact.verdict,
        statusSummary: marketCategoryFixtureArtifact.statusSummary,
        confidence: marketCategoryFixtureArtifact.confidence,
        sourceCount: marketCategoryFixtureArtifact.sources.length,
      },
    });
  });

  it('persists only clientQuestions from a review — tierRationale and removedItems stay internal', (): void => {
    const reviewedArtifact = {
      ...marketCategoryFixtureArtifact,
      review: {
        upgradedMarkdown: 'Reviewed market category markdown.',
        tier: 'needs_review' as const,
        tierRationale: 'Model-asserted clean bill of health.',
        removedItems: ['Removed a claim that was never in the body.'],
        clientQuestions: ['Can you share real churn-call notes?'],
      },
    };

    const insights = buildCommittedSectionProfileInsights({
      sectionId: 'positioningMarketCategory',
      artifact: reviewedArtifact,
    });
    const summary = insights.positioningMarketCategory as Record<
      string,
      unknown
    >;

    expect(summary.clientQuestions).toEqual([
      'Can you share real churn-call notes?',
    ]);
    expect(summary).not.toHaveProperty('reviewTierRationale');
    expect(summary).not.toHaveProperty('removedItems');
  });

  it('sources positioningStrategy from paid-media cross-section insight', (): void => {
    const insights = buildCommittedSectionProfileInsights({
      sectionId: 'positioningPaidMediaPlan',
      artifact: paidMediaPlanFixtureArtifact,
    });

    expect(insights).toEqual(
      expect.objectContaining({
        positioningPaidMediaPlan: expect.objectContaining({
          sectionTitle: paidMediaPlanFixtureArtifact.sectionTitle,
          verdict: paidMediaPlanFixtureArtifact.verdict,
        }),
        positioningStrategy: expect.objectContaining({
          source: 'positioningPaidMediaPlan',
          recommendedAngle:
            paidMediaPlanFixtureArtifact.body.crossSectionInsight[0]?.implicationForPlan,
          leadRecommendation: paidMediaPlanFixtureArtifact.body.campaignOverview.prose,
          crossSectionInsight: [
            expect.objectContaining({
              tension:
                paidMediaPlanFixtureArtifact.body.crossSectionInsight[0]?.tension,
              sourceSections:
                paidMediaPlanFixtureArtifact.body.crossSectionInsight[0]?.sourceSections,
            }),
          ],
          paidMediaPlan: expect.objectContaining({
            platform: paidMediaPlanFixtureArtifact.body.campaignOverview.platform,
            primaryKpi: paidMediaPlanFixtureArtifact.body.campaignOverview.primaryKpi,
          }),
        }),
      }),
    );
  });

  it('persists an audit profile with one merged insight write for completed sections', async (): Promise<void> => {
    const needsReviewFlag = {
      tier: 'needs_review',
      verifiedCount: 2,
      unsupportedCount: 1,
      totalClaims: 3,
      confidence: 2 / 3,
      needsReviewThreshold: 0.75,
      insufficientThreshold: 0.5,
      evidenceGap: false,
    };
    const fakeSupabase = createFakeSupabase([
      createSectionRow({
        zone: 'positioningMarketCategory',
        data: marketCategoryFixtureArtifact,
        verificationTier: 'needs_review',
        verificationFlag: needsReviewFlag,
      }),
      createSectionRow({
        zone: 'positioningBuyerICP',
        data: buyerICPFixtureArtifact,
      }),
      createSectionRow({
        zone: 'positioningOfferDiagnostic',
        data: offerDiagnosticFixtureArtifact,
      }),
      createSectionRow({
        zone: 'positioningPaidMediaPlan',
        data: paidMediaPlanFixtureArtifact,
      }),
      createSectionRow({
        zone: 'positioningVoiceOfCustomer',
        data: marketCategoryFixtureArtifact,
        status: 'running',
      }),
    ]);
    const saveBusinessProfile = vi.fn().mockResolvedValue({ id: 'profile-123' });
    const saveProfileInsights = vi.fn().mockResolvedValue(true);

    const profileId = await persistAuditProfile(
      {
        supabase: fakeSupabase.supabase,
        userId,
        runId,
        researchInput: saaslaunchResearchInput,
        parentAuditRunId,
      },
      {
        saveBusinessProfile,
        saveProfileInsights,
      },
    );

    expect(profileId).toBe('profile-123');
    expect(saveBusinessProfile).toHaveBeenCalledTimes(1);
    expect(saveBusinessProfile).toHaveBeenCalledWith(
      userId,
      sessionId,
      expect.objectContaining({
        companyName: 'SaaSLaunch',
        websiteUrl: 'https://metadata.example',
        monthlyAdBudget: '$25k',
      }),
      { companyName: 'SaaSLaunch', monthlyAdBudget: '$25k' },
    );
    expect(fakeSupabase.sectionEq).toHaveBeenCalledWith(
      'artifact_id',
      parentAuditRunId,
    );
    expect(fakeSupabase.updateEq).toHaveBeenCalledTimes(1);
    expect(fakeSupabase.updateEq).toHaveBeenCalledWith('id', sessionId);
    expect(saveProfileInsights).toHaveBeenCalledTimes(1);
    expect(saveProfileInsights).toHaveBeenCalledWith(
      userId,
      'SaaSLaunch',
      expect.objectContaining({
        positioningMarketCategory: expect.objectContaining({
          verdict: marketCategoryFixtureArtifact.verdict,
          verificationTier: 'needs_review',
          verificationFlag: needsReviewFlag,
        }),
        positioningBuyerICP: expect.objectContaining({
          verdict: buyerICPFixtureArtifact.verdict,
        }),
        positioningOfferDiagnostic: expect.objectContaining({
          verdict: offerDiagnosticFixtureArtifact.verdict,
        }),
        offerScore: expect.objectContaining({
          verdict: offerDiagnosticFixtureArtifact.verdict,
          body: offerDiagnosticFixtureArtifact.body,
        }),
        positioningStrategy: expect.objectContaining({
          source: 'positioningPaidMediaPlan',
          recommendedAngle:
            paidMediaPlanFixtureArtifact.body.crossSectionInsight[0]?.implicationForPlan,
        }),
      }),
    );
  });

  it('passes cached onboarding to the profile upsert', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase([
      createSectionRow({
        zone: 'positioningMarketCategory',
        data: marketCategoryFixtureArtifact,
      }),
    ]);
    const saveBusinessProfile = vi.fn().mockResolvedValue({ id: 'profile-123' });
    const saveProfileInsights = vi.fn().mockResolvedValue(true);

    await persistAuditProfile(
      {
        supabase: fakeSupabase.supabase,
        userId,
        runId,
        researchInput: saaslaunchResearchInput,
        parentAuditRunId,
      },
      {
        saveBusinessProfile,
        saveProfileInsights,
      },
    );

    expect(saveBusinessProfile).toHaveBeenCalledWith(
      userId,
      sessionId,
      expect.any(Object),
      { companyName: 'SaaSLaunch', monthlyAdBudget: '$25k' },
    );
  });

  it('resets the profile persist claim when best-effort persistence fails', async (): Promise<void> => {
    const resetEq = vi.fn().mockResolvedValue({ error: null });
    const failingMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'session missing' },
    });
    const selectQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: failingMaybeSingle,
    };
    selectQuery.select.mockReturnValue(selectQuery);
    selectQuery.eq.mockReturnValue(selectQuery);
    const from = vi.fn((table: string) => {
      if (table !== 'journey_sessions' && table !== 'research_artifacts') {
        throw new Error(`Unexpected table ${table}`);
      }

      return table === 'journey_sessions'
        ? selectQuery
        : {
            update: vi.fn().mockReturnValue({ eq: resetEq }),
          };
    });

    await expect(
      persistAuditProfileBestEffort({
        supabase: { from } as unknown as SupabaseClient,
        userId,
        runId,
        researchInput: saaslaunchResearchInput,
        parentAuditRunId,
      }),
    ).resolves.toBeNull();

    expect(resetEq).toHaveBeenCalledWith('id', parentAuditRunId);
  });
});
